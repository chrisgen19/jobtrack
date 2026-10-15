/** Minimal private object storage used for user documents. */
export interface ObjectStorage {
  readonly driver: "s3" | "local";
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /**
   * A short-lived URL that downloads the object as an attachment, or null
   * when the driver serves bytes through the app instead (local driver).
   */
  signedDownloadUrl(
    key: string,
    filename: string,
    contentType: string,
    ttlSeconds: number,
  ): Promise<string | null>;
  read(key: string): Promise<Buffer>;
}
