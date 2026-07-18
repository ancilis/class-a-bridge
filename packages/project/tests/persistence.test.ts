import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";

import {
  IndexedDbProjectStore,
  LocalStorageProjectStore,
  MemoryProjectStore,
  createEmptyProject,
  createProjectStore,
  createProjectStoreSafely,
  deleteAllLocalProjectData,
  sha256Hex,
} from "../src/index";

class FakeStorage implements Storage {
  readonly data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe.each([
  ["memory", () => new MemoryProjectStore()],
  ["localStorage", () => new LocalStorageProjectStore(new FakeStorage())],
] as const)("%s project store", (_name, makeStore) => {
  it("saves, loads, lists, deletes, and clears owned project data", async () => {
    const store = makeStore();
    const first = createEmptyProject("One", "Acme");
    const second = createEmptyProject("Two", "Acme");
    await store.save(first);
    await store.save(second);
    expect((await store.list()).map((item) => item.id)).toEqual(
      expect.arrayContaining([first.metadata.id, second.metadata.id]),
    );
    expect(await store.load(first.metadata.id)).toEqual(first);
    await store.delete(first.metadata.id);
    expect(await store.load(first.metadata.id)).toBeUndefined();
    await store.deleteAll();
    expect(await store.list()).toEqual([]);
  });
});

it("deletes attachments owned by a deleted project", async () => {
  const store = new MemoryProjectStore();
  const project = createEmptyProject("Files", "Acme");
  await store.save(project);
  await store.putAttachment("att-owned", new Uint8Array([1, 2, 3]), project.metadata.id);
  expect(await store.getAttachment("att-owned")).toBeDefined();
  await store.delete(project.metadata.id);
  expect(await store.getAttachment("att-owned")).toBeUndefined();
});

it("reassigns shared IndexedDB bytes and removes legacy raw bytes without orphaning data", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const factory = new IDBFactory();
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: factory,
  });
  const databaseName = `class-a-bridge-persistence-test-${crypto.randomUUID()}`;

  try {
    const store = new IndexedDbProjectStore(databaseName);
    const bytes = new Uint8Array([1, 4, 1, 4]);
    const hash = await sha256Hex(bytes);
    const first = createEmptyProject("First owner", "Acme");
    const second = createEmptyProject("Second owner", "Acme");
    first.soc2.sourceReport = {
      fileName: "first.pdf",
      attachmentId: "shared-indexeddb-file",
      sha256: hash,
    };
    second.soc2.sourceReport = {
      fileName: "second.pdf",
      attachmentId: "shared-indexeddb-file",
      sha256: hash,
    };
    await store.save(first);
    await store.save(second);
    await store.putAttachment("shared-indexeddb-file", bytes, first.metadata.id);

    await store.delete(first.metadata.id);
    expect(await store.getAttachmentOwner("shared-indexeddb-file")).toEqual({
      kind: "owned",
      projectId: second.metadata.id,
    });
    expect(await store.getAttachment("shared-indexeddb-file")).toEqual(bytes);
    await store.delete(second.metadata.id);
    expect(await store.getAttachment("shared-indexeddb-file")).toBeUndefined();

    const legacy = createEmptyProject("Legacy owner", "Acme");
    legacy.soc2.sourceReport = {
      fileName: "legacy.pdf",
      attachmentId: "legacy-raw-file",
      sha256: hash,
    };
    await store.save(legacy);
    const request = factory.open(databaseName, 2);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed."));
      request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction("attachments", "readwrite");
    transaction.objectStore("attachments").put(bytes, "legacy-raw-file");
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("IndexedDB transaction failed."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
    });
    database.close();

    expect(await store.getAttachmentOwner("legacy-raw-file")).toEqual({
      kind: "legacy-unowned",
    });
    await store.delete(legacy.metadata.id);
    expect(await store.getAttachment("legacy-raw-file")).toBeUndefined();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "indexedDB", descriptor);
    else Reflect.deleteProperty(globalThis, "indexedDB");
  }
});

it("deletes active-backend files and prior localStorage fallback records together", async () => {
  const store = new MemoryProjectStore();
  const fallback = new FakeStorage();
  const project = createEmptyProject("Files", "Acme");
  await store.save(project);
  await store.putAttachment("att-owned", new Uint8Array([1, 2, 3]), project.metadata.id);
  fallback.setItem("class-a-bridge:project:legacy", "legacy project");
  fallback.setItem("class-a-bridge:legacy-attachment", "legacy attachment");
  fallback.setItem("another-app:project", "preserve me");

  await deleteAllLocalProjectData(store, fallback);

  expect(await store.list()).toEqual([]);
  expect(await store.getAttachment("att-owned")).toBeUndefined();
  expect(fallback.getItem("class-a-bridge:project:legacy")).toBeNull();
  expect(fallback.getItem("class-a-bridge:legacy-attachment")).toBeNull();
  expect(fallback.getItem("another-app:project")).toBe("preserve me");
});

it("falls back to session memory when browser storage getters throw", async () => {
  const indexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    get() {
      throw new Error("IndexedDB access denied");
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("localStorage access denied");
    },
  });

  try {
    expect(createProjectStore().backend).toBe("memory");
    await expect(createProjectStoreSafely()).resolves.toMatchObject({ backend: "memory" });
  } finally {
    if (indexedDbDescriptor) Object.defineProperty(globalThis, "indexedDB", indexedDbDescriptor);
    else Reflect.deleteProperty(globalThis, "indexedDB");
    if (localStorageDescriptor)
      Object.defineProperty(globalThis, "localStorage", localStorageDescriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
