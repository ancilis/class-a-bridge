import { describe, expect, it } from "vitest";

import {
  LocalStorageProjectStore,
  MemoryProjectStore,
  createEmptyProject,
  createProjectStore,
  createProjectStoreSafely,
  deleteAllLocalProjectData,
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
