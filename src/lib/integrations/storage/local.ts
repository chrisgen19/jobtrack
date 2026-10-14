import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ObjectStorage } from "./types";

/**
 * Development/test driver: files live under `.data/uploads` (outside
 * `public/`) and are only served through the authenticated download route.
 * Refused in production, where documents must go to private object storage.
 */
export function createLocalStorage(root = path.join(process.cwd(), ".data", "uploads")): ObjectStorage {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The local storage driver is for development only. Set STORAGE_DRIVER=s3 in production.");
  }
  const resolve = (key: string) => {
    const target = path.resolve(root, key);
    if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error("Invalid storage key");
    return target;
  };
  return {
    driver: "local",
    async put(key, body) {
      const target = resolve(key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, body, { flag: "wx" });
    },
    async delete(key) {
      await rm(resolve(key), { force: true });
    },
    async signedDownloadUrl() {
      return null;
    },
    async read(key) {
      return readFile(resolve(key));
    },
  };
}
