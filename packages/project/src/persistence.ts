import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import { BridgeProjectSchema, type BridgeProject } from "./model";

export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly organization: string;
  readonly updatedAt: string;
  readonly isSample: boolean;
}

export interface ProjectStore {
  readonly backend: "indexeddb" | "localstorage" | "memory";
  readonly supportsAttachments: boolean;
  save(project: BridgeProject): Promise<void>;
  load(id: string): Promise<BridgeProject | undefined>;
  list(): Promise<readonly ProjectSummary[]>;
  delete(id: string): Promise<void>;
  deleteAll(): Promise<void>;
  putAttachment(id: string, bytes: Uint8Array): Promise<void>;
  getAttachment(id: string): Promise<Uint8Array | undefined>;
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

export class MemoryProjectStore implements ProjectStore {
  readonly backend = "memory" as const;
  readonly supportsAttachments = true;
  private readonly projects = new Map<string, BridgeProject>();
  private readonly attachments = new Map<string, Uint8Array>();

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
    return Promise.resolve();
  }
  deleteAll(): Promise<void> {
    this.projects.clear();
    this.attachments.clear();
    return Promise.resolve();
  }
  putAttachment(id: string, bytes: Uint8Array): Promise<void> {
    this.attachments.set(id, bytes.slice());
    return Promise.resolve();
  }
  getAttachment(id: string): Promise<Uint8Array | undefined> {
    return Promise.resolve(this.attachments.get(id)?.slice());
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
        [...this.attachments.values()].reduce((total, bytes) => total + bytes.byteLength, 0),
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
    return Promise.resolve(raw ? BridgeProjectSchema.parse(JSON.parse(raw)) : undefined);
  }
  list(): Promise<readonly ProjectSummary[]> {
    const projects: ProjectSummary[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (!key?.startsWith(this.prefix)) continue;
      const raw = this.storage.getItem(key);
      if (!raw) continue;
      const parsed = BridgeProjectSchema.safeParse(JSON.parse(raw));
      if (parsed.success) projects.push(summary(parsed.data));
    }
    return Promise.resolve(projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }
  delete(id: string): Promise<void> {
    this.storage.removeItem(`${this.prefix}${id}`);
    return Promise.resolve();
  }
  deleteAll(): Promise<void> {
    const owned: string[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (key?.startsWith("class-a-bridge:")) owned.push(key);
    }
    for (const key of owned) this.storage.removeItem(key);
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

interface BridgeDatabase extends DBSchema {
  projects: { key: string; value: BridgeProject };
  attachments: { key: string; value: Uint8Array };
}

export class IndexedDbProjectStore implements ProjectStore {
  readonly backend = "indexeddb" as const;
  readonly supportsAttachments = true;
  private readonly database: Promise<IDBPDatabase<BridgeDatabase>>;
  constructor(name = "class-a-bridge-v1") {
    this.database = openDB<BridgeDatabase>(name, 1, {
      upgrade(database) {
        database.createObjectStore("projects");
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
    return project ? BridgeProjectSchema.parse(project) : undefined;
  }
  async list() {
    return (await (await this.database).getAll("projects"))
      .map((project) => summary(BridgeProjectSchema.parse(project)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async delete(id: string) {
    await (await this.database).delete("projects", id);
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
  async putAttachment(id: string, bytes: Uint8Array) {
    await (await this.database).put("attachments", bytes.slice(), id);
  }
  async getAttachment(id: string) {
    return (await (await this.database).get("attachments", id))?.slice();
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
      attachments.reduce((total, bytes) => total + bytes.byteLength, 0)
    );
  }
}

export function createProjectStore(): ProjectStore {
  if (typeof globalThis.indexedDB !== "undefined") return new IndexedDbProjectStore();
  if (typeof globalThis.localStorage !== "undefined") return new LocalStorageProjectStore();
  return new MemoryProjectStore();
}

export async function browserStorageEstimate() {
  if (typeof navigator !== "undefined" && navigator.storage?.estimate)
    return navigator.storage.estimate();
  return { usage: undefined, quota: undefined };
}
