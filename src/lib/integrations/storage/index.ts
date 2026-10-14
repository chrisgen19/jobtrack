import { storageEnv } from "@/lib/env";
import { createLocalStorage } from "./local";
import { createS3Storage } from "./s3";
import type { ObjectStorage } from "./types";

export type { ObjectStorage } from "./types";

let storage: ObjectStorage | undefined;

/** The configured document store (shared by the web app and the worker). */
export function getStorage(): ObjectStorage {
  if (storage) return storage;
  const env = storageEnv();
  storage =
    env.STORAGE_DRIVER === "s3"
      ? createS3Storage({
          endpoint: env.S3_ENDPOINT!,
          region: env.S3_REGION,
          bucket: env.S3_BUCKET!,
          accessKeyId: env.S3_ACCESS_KEY_ID!,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
        })
      : createLocalStorage();
  return storage;
}

/** Test hook: replace the store with an in-memory or failing fake. */
export function setStorageForTests(next: ObjectStorage | undefined): void {
  storage = next;
}
