import { createAuthClient } from "better-auth/react";

/** Browser-side Better Auth client (same-origin `/api/auth`). */
export const authClient = createAuthClient();
