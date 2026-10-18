import { z } from "zod";

/**
 * Server environment, validated with Zod.
 *
 * Every group is parsed lazily on first use so `next build` (which has no
 * secrets) can import modules that depend on it. Shared by the web app and
 * the worker process, so it must not import `server-only`.
 */

if (typeof window !== "undefined") {
  throw new Error("src/lib/env.ts must never be imported from client code.");
}

function lazy<T>(parse: () => T): () => T {
  let cached: T | undefined;
  return () => {
    cached ??= parse();
    return cached;
  };
}

const booleanString = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((value) => value === "true" || value === "1");

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined));

export const appEnv = lazy(() =>
  z
    .object({
      APP_URL: z.url().transform((url) => url.replace(/\/$/, "")),
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    })
    .parse(process.env),
);

export const databaseEnv = lazy(() =>
  z
    .object({
      DATABASE_URL: z.string().min(1, { error: "DATABASE_URL is required." }),
      DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    })
    .parse(process.env),
);

export const authEnv = lazy(() =>
  z
    .object({
      BETTER_AUTH_SECRET: z.string().min(32, { error: "BETTER_AUTH_SECRET must be 32+ characters." }),
      BETTER_AUTH_URL: z.url(),
      AUTH_REQUIRE_EMAIL_VERIFICATION: z
        .enum(["true", "false"])
        .default("true")
        .transform((value) => value === "true"),
      /** Header the reverse proxy sets to the real client IP (Traefik: x-real-ip). */
      TRUSTED_IP_HEADER: z.string().min(1).default("x-real-ip"),
      /** Auth endpoint rate limiting. Only the E2E suite turns this off. */
      AUTH_RATE_LIMIT: z.enum(["on", "off"]).default("on"),
    })
    .parse(process.env),
);

export const encryptionEnv = lazy(() =>
  z
    .object({
      TOKEN_ENCRYPTION_KEY: z.string().refine((value) => Buffer.from(value, "base64").length === 32, {
        error: "TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded.",
      }),
    })
    .parse(process.env),
);

export const emailEnv = lazy(() =>
  z
    .object({
      RESEND_API_KEY: optionalString,
      EMAIL_FROM: z.string().min(3).default("JobTrack <noreply@example.com>"),
      RESEND_WEBHOOK_SECRET: optionalString,
    })
    .parse(process.env),
);

export const storageEnv = lazy(() => {
  const parsed = z
    .object({
      STORAGE_DRIVER: z.enum(["s3", "local"]).default("local"),
      S3_ENDPOINT: optionalString,
      S3_REGION: z.string().default("auto"),
      S3_BUCKET: optionalString,
      S3_ACCESS_KEY_ID: optionalString,
      S3_SECRET_ACCESS_KEY: optionalString,
      DOCUMENT_MAX_MB: z.coerce.number().min(1).max(50).default(10),
      /** Test-only escape hatch so E2E (a production build) can use local files. */
      UNSAFE_ALLOW_LOCAL_STORAGE: booleanString,
    })
    .parse(process.env);

  if (
    parsed.STORAGE_DRIVER === "s3" &&
    !(parsed.S3_ENDPOINT && parsed.S3_BUCKET && parsed.S3_ACCESS_KEY_ID && parsed.S3_SECRET_ACCESS_KEY)
  ) {
    throw new Error(
      "STORAGE_DRIVER=s3 requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.",
    );
  }
  return parsed;
});

/** Google OAuth credentials, or `null` when the integration is not configured. */
export const googleEnv = lazy(() => {
  const parsed = z
    .object({ GOOGLE_CLIENT_ID: optionalString, GOOGLE_CLIENT_SECRET: optionalString })
    .parse(process.env);
  if (!parsed.GOOGLE_CLIENT_ID || !parsed.GOOGLE_CLIENT_SECRET) return null;
  return { clientId: parsed.GOOGLE_CLIENT_ID, clientSecret: parsed.GOOGLE_CLIENT_SECRET };
});

/** An optional whole number with a default; an empty variable means the default. */
const intWithDefault = (fallback: number, min: number, max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().min(min).max(max).default(fallback),
  );

/**
 * "Improve with AI" in the browser extension (Google Gemini), or `null` when
 * GEMINI_API_KEY is not set, which turns the feature off. Only the web
 * service needs these.
 */
export const aiEnv = lazy(() => {
  const parsed = z
    .object({
      GEMINI_API_KEY: optionalString,
      AI_MODEL: optionalString.transform((value) => value ?? "gemini-3.8-flash"),
      AI_DAILY_REQUESTS_PER_USER: intWithDefault(25, 0, 10_000),
      AI_MONTHLY_REQUEST_LIMIT: intWithDefault(3_000, 0, 10_000_000),
      AI_TIMEOUT_MS: intWithDefault(20_000, 1_000, 120_000),
    })
    .parse(process.env);
  if (!parsed.GEMINI_API_KEY) return null;
  return {
    apiKey: parsed.GEMINI_API_KEY,
    model: parsed.AI_MODEL,
    dailyRequestsPerUser: parsed.AI_DAILY_REQUESTS_PER_USER,
    monthlyRequestLimit: parsed.AI_MONTHLY_REQUEST_LIMIT,
    timeoutMs: parsed.AI_TIMEOUT_MS,
  };
});

/**
 * Browser extension IDs allowed to receive an extension token from the
 * connect page (comma separated). Empty means the extension is not set up.
 */
export const extensionEnv = lazy(() =>
  z
    .object({
      EXTENSION_IDS: z
        .string()
        .optional()
        .transform((value) =>
          (value ?? "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
        )
        .pipe(
          z.array(z.string().regex(/^[a-p]{32}$/, { error: "EXTENSION_IDS must be Chrome extension IDs." })),
        ),
    })
    .parse(process.env),
);

export const workerEnv = lazy(() =>
  z
    .object({
      WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
    })
    .parse(process.env),
);

export const seedEnv = lazy(() => z.object({ ALLOW_DEMO_SEED: booleanString }).parse(process.env));
