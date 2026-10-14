import type { ObjectStorage } from "@/lib/integrations/storage";

/** In-memory object store for tests (records every operation). */
export function createMemoryStorage(): ObjectStorage & {
  objects: Map<string, Buffer>;
  failDeletes: boolean;
} {
  const objects = new Map<string, Buffer>();
  const store = {
    driver: "local" as const,
    objects,
    failDeletes: false,
    async put(key: string, body: Buffer) {
      if (objects.has(key)) throw new Error("exists");
      objects.set(key, body);
    },
    async delete(key: string) {
      if (store.failDeletes) throw new Error("storage offline");
      objects.delete(key);
    },
    async signedDownloadUrl() {
      return null;
    },
    async read(key: string) {
      const value = objects.get(key);
      if (!value) throw new Error("missing");
      return value;
    },
  };
  return store;
}
