import { betterAuth } from "better-auth";
import { createAuthMiddleware, isAPIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { randomUUID } from "node:crypto";
import { afterAccountDelete, beforeAccountDelete } from "@/features/account/deletion";
import { revokeAllExtensionTokensForUser } from "@/features/extension/revoke";
import { existingAccountEmail, resetPasswordEmail, verificationEmail } from "@/lib/email/templates";
import { appEnv, authEnv } from "@/lib/env";
import { enqueueJob } from "@/lib/jobs/queue";
import { logger, errorMessage } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * Queues an auth email on the durable job queue instead of calling the
 * provider inline, so the response never waits on Resend and the worker
 * retries provider failures. The insert is awaited, so the job is committed
 * before Better Auth responds. A failed enqueue is logged and the response
 * stays the same, so it never reveals whether an account exists.
 */
async function queueAuthEmail(
  kind: string,
  to: string,
  rendered: { subject: string; html: string; text: string },
): Promise<void> {
  try {
    await enqueueJob(
      prisma,
      "send_email",
      { to, ...rendered, idempotencyKey: `auth:${kind}:${randomUUID()}` },
      { maxAttempts: 8 },
    );
  } catch (error) {
    logger.error("failed to enqueue auth email", { kind, error: errorMessage(error) });
  }
}

export function createAuth() {
  const env = authEnv();
  const isProduction = appEnv().NODE_ENV === "production";

  return betterAuth({
    appName: "JobTrack",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [appEnv().APP_URL],
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: env.AUTH_REQUIRE_EMAIL_VERIFICATION,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      // Sessions are revoked above; browser extension tokens live in their own table.
      onPasswordReset: async ({ user }) => {
        await revokeAllExtensionTokensForUser(user.id);
      },
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        await queueAuthEmail("reset", user.email, resetPasswordEmail(user.name, url));
      },
      // Sign-up answers the same way for existing emails (no enumeration);
      // the real owner is told about the attempt instead.
      onExistingUserSignUp: async ({ user }) => {
        await queueAuthEmail(
          "existing",
          user.email,
          existingAccountEmail(user.name, `${appEnv().APP_URL}/login`),
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await queueAuthEmail("verify", user.email, verificationEmail(user.name, url));
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: (user) => beforeAccountDelete(user.id),
        afterDelete: (user) => afterAccountDelete(user.id),
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: env.AUTH_RATE_LIMIT === "on",
      storage: "database",
      window: 60,
      max: 120,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/request-password-reset": { window: 300, max: 3 },
        "/reset-password": { window: 300, max: 5 },
        "/send-verification-email": { window: 300, max: 3 },
        "/change-password": { window: 300, max: 5 },
        "/delete-user": { window: 300, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: isProduction,
      ipAddress: { ipAddressHeaders: [env.TRUSTED_IP_HEADER] },
    },
    hooks: {
      // Changing the password with "sign out other sessions" also disconnects
      // browser extensions. Runs only when the change succeeded.
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/change-password" || ctx.body?.revokeOtherSessions !== true) return;
        const returned = ctx.context.returned;
        if (!returned || isAPIError(returned)) return;
        const userId = (returned as { user?: { id?: unknown } }).user?.id;
        if (typeof userId === "string") await revokeAllExtensionTokensForUser(userId);
      }),
    },
    // nextCookies must stay last so Server Actions can set auth cookies.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __jobtrackAuth?: Auth };

/** Lazily built Better Auth instance (so `next build` needs no secrets). */
export function getAuth(): Auth {
  globalForAuth.__jobtrackAuth ??= createAuth();
  return globalForAuth.__jobtrackAuth;
}
