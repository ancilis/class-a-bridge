import { describe, expect, it } from "vitest";

import { LocalStorageProjectStore, MemoryProjectStore, createEmptyProject } from "../src/index";

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
