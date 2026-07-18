import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import { migrateProject } from "./migrations";
import { BridgeProjectSchema, type BridgeProject } from "./model";

export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly organization: string;
  readonly updatedAt: string;
  readonly isSample: boolean;
}

export type AttachmentOwnership =
  { readonly kind: "owned"; readonly projectId: string } | { readonly kind: "legacy-unowned" };

export interface ProjectStore {
  readonly backend: "indexeddb" | "localstorage" | "memory";
  readonly supportsAttachments: boolean;
  save(project: BridgeProject): Promise<void>;
  load(id: string): Promise<BridgeProject | undefined>;
  list(): Promise<readonly ProjectSummary[]>;
  delete(id: string): Promise<void>;
  deleteAll(): Promise<void>;
  putAttachment(id: string, bytes: Uint8Array, projectId?: string): Promise<void>;
  getAttachment(id: string): Promise<Uint8Array | undefined>;
  getAttachmentOwner(id: string): Promise<AttachmentOwnership | undefined>;
  isAttachmentReferencedByOtherProject(id: string, projectId: string): Promise<boolean>;
  deleteAttachment(id: string): Promise<void>;
  estimateOwnedBytes(): Promise<number>;
}

const summary = (project: BridgeProject): ProjectSummary => ({
  id: project.metadata.id,
  name: project.metadata.name,
  organization: project.organization.name,
  updatedAt: project.metadata.updatedAt,
  isSample: project.metadata.isSample,
});

const STORAGE_PREFIX = "class-a-bridge:";

function localByteIds(project: BridgeProject): ReadonlySet<string> {
  const ids = new Set<string>();
  if (project.soc2.sourceReport) ids.add(project.soc2.sourceReport.attachmentId);
  for (const evidence of project.evidence)
    if (evidence.attachmentId) ids.add(evidence.attachmentId);
  for (const material of project.materials)
    if (material.attachmentId) ids.add(material.attachmentId);
  for (const output of project.generatedOutputs) ids.add(output.id);
  return ids;
}

function browserIndexedDb(): IDBFactory | undefined {
  try {
    return globalThis.indexedDB;
  } catch {
    return undefined;
  }
}

function browserLocalStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function clearOwnedLocalStorage(storage: Storage) {
  const owned: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(STORAGE_PREFIX)) owned.push(key);
  }
  for (const key of owned) storage.removeItem(key);
}

export class MemoryProjectStore implements ProjectStore {
  readonly backend = "memory" as const;
  readonly supportsAttachments = true;
  private readonly projects = new Map<string, BridgeProject>();
  private readonly attachments = new Map<string, { projectId: string; bytes: Uint8Array }>();

  save(project: BridgeProject): Promise<void> {
    const parsed = BridgeProjectSchema.parse(project);
    this.projects.set(parsed.metadata.id, structuredClone(parsed));
    return Promise.resolve();
  }
  load(id: string): Promise<BridgeProject | undefined> {
    const project = this.projects.get(id);
    return Promise.resolve(project ? structuredClone(project) : undefined);
  }
  list(): Promise<readonly ProjectSummary[]> {
    return Promise.resolve(
      [...this.projects.values()]
        .map(summary)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }
  delete(id: string): Promise<void> {
    this.projects.delete(id);
    for (const [attachmentId, attachment] of this.attachments) {
      const nextOwner = [...this.projects.values()].find((project) =>
        localByteIds(project).has(attachmentId),
      )?.metadata.id;
      if (nextOwner) attachment.projectId = nextOwner;
      else if (attachment.projectId === id || !this.projects.has(attachment.projectId))
        this.attachments.delete(attachmentId);
    }
    return Promise.resolve();
  }
  deleteAll(): Promise<void> {
    this.projects.clear();
    this.attachments.clear();
    return Promise.resolve();
  }
  putAttachment(id: string, bytes: Uint8Array, projectId = "unowned"): Promise<void> {
    this.attachments.set(id, { projectId, bytes: bytes.slice() });
    return Promise.resolve();
  }
  getAttachment(id: string): Promise<Uint8Array | undefined> {
    return Promise.resolve(this.attachments.get(id)?.bytes.slice());
  }
  getAttachmentOwner(id: string): Promise<AttachmentOwnership | undefined> {
    const projectId = this.attachments.get(id)?.projectId;
    return Promise.resolve(projectId ? { kind: "owned", projectId } : undefined);
  }
  isAttachmentReferencedByOtherProject(id: string, projectId: string): Promise<boolean> {
    return Promise.resolve(
      [...this.projects.values()].some(
        (project) => project.metadata.id !== projectId && localByteIds(project).has(id),
      ),
    );
  }
  deleteAttachment(id: string): Promise<void> {
    this.attachments.delete(id);
    return Promise.resolve();
  }
  estimateOwnedBytes(): Promise<number> {
    const projectBytes = [...this.projects.values()].reduce(
      (total, project) => total + new TextEncoder().encode(JSON.stringify(project)).byteLength,
      0,
    );
    return Promise.resolve(
      projectBytes +
        [...this.attachments.values()].reduce(
          (total, attachment) => total + attachment.bytes.byteLength,
          0,
        ),
    );
  }
}

export class LocalStorageProjectStore implements ProjectStore {
  readonly backend = "localstorage" as const;
  readonly supportsAttachments = false;
  private readonly prefix = "class-a-bridge:project:";
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  save(project: BridgeProject): Promise<void> {
    const parsed = BridgeProjectSchema.parse(project);
    this.storage.setItem(`${this.prefix}${parsed.metadata.id}`, JSON.stringify(parsed));
    return Promise.resolve();
  }
  load(id: string): Promise<BridgeProject | undefined> {
    const raw = this.storage.getItem(`${this.prefix}${id}`);
    return Promise.resolve(raw ? migrateProject(JSON.parse(raw)) : undefined);
  }
  list(): Promise<readonly ProjectSummary[]> {
    const projects: ProjectSummary[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (!key?.startsWith(this.prefix)) continue;
      const raw = this.storage.getItem(key);
      if (!raw) continue;
      try {
        projects.push(summary(migrateProject(JSON.parse(raw))));
      } catch {
        // Invalid owned records are ignored in the project picker and remain available for diagnostics.
      }
    }
    return Promise.resolve(projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }
  delete(id: string): Promise<void> {
    this.storage.removeItem(`${this.prefix}${id}`);
    return Promise.resolve();
  }
  deleteAll(): Promise<void> {
    clearOwnedLocalStorage(this.storage);
    return Promise.resolve();
  }
  putAttachment(): Promise<void> {
    return Promise.reject(
      new Error("Persistent attachments require IndexedDB. Export the project to preserve files."),
    );
  }
  getAttachment(): Promise<undefined> {
    return Promise.resolve(undefined);
  }
  getAttachmentOwner(): Promise<undefined> {
    return Promise.resolve(undefined);
  }
  isAttachmentReferencedByOtherProject(): Promise<false> {
    return Promise.resolve(false);
  }
  deleteAttachment(): Promise<void> {
    return Promise.resolve();
  }
  estimateOwnedBytes(): Promise<number> {
    let bytes = 0;
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (key?.startsWith("class-a-bridge:")) {
        bytes += new TextEncoder().encode(key + (this.storage.getItem(key) ?? "")).byteLength;
      }
    }
    return Promise.resolve(bytes);
  }
}

interface StoredAttachment {
  readonly projectId: string;
  readonly bytes: Uint8Array;
}

interface BridgeDatabase extends DBSchema {
  projects: { key: string; value: unknown };
  attachments: { key: string; value: StoredAttachment | Uint8Array };
}

export class IndexedDbProjectStore implements ProjectStore {
  readonly backend = "indexeddb" as const;
  readonly supportsAttachments = true;
  private readonly database: Promise<IDBPDatabase<BridgeDatabase>>;
  constructor(name = "class-a-bridge-v1") {
    this.database = openDB<BridgeDatabase>(name, 2, {
      upgrade(database) {
        if (!database.objectStoreNames.contains("projects")) database.createObjectStore("projects");
        if (!database.objectStoreNames.contains("attachments"))
          database.createObjectStore("attachments");
      },
    });
  }
  async save(project: BridgeProject) {
    const parsed = BridgeProjectSchema.parse(project);
    await (await this.database).put("projects", structuredClone(parsed), parsed.metadata.id);
  }
  async load(id: string) {
    const project = await (await this.database).get("projects", id);
    return project ? migrateProject(project) : undefined;
  }
  async list() {
    return (await (await this.database).getAll("projects"))
      .map((project) => summary(migrateProject(project)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async delete(id: string) {
    const db = await this.database;
    const transaction = db.transaction(["projects", "attachments"], "readwrite");
    const rawProject = await transaction.objectStore("projects").get(id);
    let targetIds = new Set<string>();
    try {
      if (rawProject) targetIds = new Set(localByteIds(migrateProject(rawProject)));
    } catch {
      // Preserve unowned legacy bytes if project metadata cannot be validated safely.
    }
    await transaction.objectStore("projects").delete(id);
    const attachmentStore = transaction.objectStore("attachments");
    const [keys, values] = await Promise.all([
      attachmentStore.getAllKeys(),
      attachmentStore.getAll(),
    ]);
    const remainingProjects = await transaction.objectStore("projects").getAll();
    const referencedElsewhere = new Map<string, string>();
    const remainingProjectIds = new Set<string>();
    let malformedRemainingProject = false;
    for (const raw of remainingProjects) {
      try {
        const remaining = migrateProject(raw);
        remainingProjectIds.add(remaining.metadata.id);
        for (const attachmentId of localByteIds(remaining))
          if (!referencedElsewhere.has(attachmentId))
            referencedElsewhere.set(attachmentId, remaining.metadata.id);
      } catch {
        malformedRemainingProject = true;
      }
    }
    await Promise.all(
      values.map((value, index) => {
        const key = keys[index];
        if (key === undefined) return Promise.resolve();
        const attachmentId = String(key);
        const nextOwner = referencedElsewhere.get(attachmentId);
        if (nextOwner) {
          const bytes = value instanceof Uint8Array ? value : value.bytes;
          return attachmentStore.put({ projectId: nextOwner, bytes }, key);
        }
        if (
          !(value instanceof Uint8Array) &&
          (value.projectId === id || !remainingProjectIds.has(value.projectId))
        )
          return attachmentStore.delete(key);
        if (
          value instanceof Uint8Array &&
          !malformedRemainingProject &&
          targetIds.has(attachmentId)
        )
          return attachmentStore.delete(key);
        return Promise.resolve();
      }),
    );
    await transaction.done;
  }
  async deleteAll() {
    const db = await this.database;
    const transaction = db.transaction(["projects", "attachments"], "readwrite");
    await Promise.all([
      transaction.objectStore("projects").clear(),
      transaction.objectStore("attachments").clear(),
      transaction.done,
    ]);
  }
  async putAttachment(id: string, bytes: Uint8Array, projectId = "unowned") {
    await (await this.database).put("attachments", { projectId, bytes: bytes.slice() }, id);
  }
  async getAttachment(id: string) {
    const stored = await (await this.database).get("attachments", id);
    return stored instanceof Uint8Array ? stored.slice() : stored?.bytes.slice();
  }
  async getAttachmentOwner(id: string) {
    const stored = await (await this.database).get("attachments", id);
    if (!stored) return undefined;
    return stored instanceof Uint8Array
      ? ({ kind: "legacy-unowned" } as const)
      : ({ kind: "owned", projectId: stored.projectId } as const);
  }
  async isAttachmentReferencedByOtherProject(id: string, projectId: string) {
    const projects = await (await this.database).getAll("projects");
    for (const raw of projects) {
      try {
        const project = migrateProject(raw);
        if (project.metadata.id !== projectId && localByteIds(project).has(id)) return true;
      } catch {
        return true;
      }
    }
    return false;
  }
  async deleteAttachment(id: string) {
    await (await this.database).delete("attachments", id);
  }
  async estimateOwnedBytes() {
    const db = await this.database;
    const [projects, attachments] = await Promise.all([
      db.getAll("projects"),
      db.getAll("attachments"),
    ]);
    return (
      new TextEncoder().encode(JSON.stringify(projects)).byteLength +
      attachments.reduce(
        (total, attachment) =>
          total +
          (attachment instanceof Uint8Array ? attachment.byteLength : attachment.bytes.byteLength),
        0,
      )
    );
  }
}

export function createProjectStore(): ProjectStore {
  if (browserIndexedDb()) {
    try {
      return new IndexedDbProjectStore();
    } catch {
      // Continue to a browser fallback when construction is rejected synchronously.
    }
  }
  const localStorage = browserLocalStorage();
  if (localStorage) return new LocalStorageProjectStore(localStorage);
  return new MemoryProjectStore();
}

export async function createProjectStoreSafely(): Promise<ProjectStore> {
  if (browserIndexedDb()) {
    try {
      const indexedDb = new IndexedDbProjectStore();
      await indexedDb.list();
      return indexedDb;
    } catch {
      // Some private browsing modes expose IndexedDB but reject opening it.
    }
  }
  const localStorage = browserLocalStorage();
  if (localStorage) {
    try {
      const probe = "class-a-bridge:storage-probe";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      return new LocalStorageProjectStore(localStorage);
    } catch {
      // Continue to the in-memory session fallback.
    }
  }
  return new MemoryProjectStore();
}

export async function deleteAllLocalProjectData(
  store: ProjectStore,
  fallbackStorage: Storage | undefined = browserLocalStorage(),
): Promise<void> {
  let activeStoreError: Error | undefined;
  try {
    await store.deleteAll();
  } catch (error) {
    activeStoreError =
      error instanceof Error ? error : new Error("Active browser storage deletion failed.");
  }

  let fallbackError: Error | undefined;
  if (fallbackStorage) {
    try {
      clearOwnedLocalStorage(fallbackStorage);
    } catch (error) {
      fallbackError =
        error instanceof Error ? error : new Error("Fallback browser storage deletion failed.");
    }
  }

  if (activeStoreError) throw activeStoreError;
  if (fallbackError) throw fallbackError;
}

export async function browserStorageEstimate() {
  if (typeof navigator !== "undefined" && navigator.storage?.estimate)
    return navigator.storage.estimate();
  return { usage: undefined, quota: undefined };
}
