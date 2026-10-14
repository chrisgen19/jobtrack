import "server-only";
import type { CalendarConnectionStatus } from "@/generated/prisma/enums";
import { getAccessToken } from "@/features/calendar-sync/sync";
import { requireWorkspace } from "@/features/workspace/data";
import { DomainError, NotFoundError } from "@/lib/action-result";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import {
  emailFromIdToken,
  GoogleApiError,
  isGoogleConfigured,
  listCalendars,
  revokeToken,
  type GoogleCalendar,
  type TokenResponse,
} from "@/lib/integrations/google/client";
import { enqueueJob } from "@/lib/jobs/queue";
import { errorMessage, logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { resyncUser } from "./side-effects";

export type CalendarIntegration = {
  configured: boolean;
  connection: {
    accountEmail: string | null;
    calendarId: string;
    calendarName: string | null;
    status: CalendarConnectionStatus;
    lastSyncedAt: Date | null;
    lastError: string | null;
    synced: number;
    pending: number;
    failed: number;
  } | null;
};

export async function getCalendarIntegration(): Promise<CalendarIntegration> {
  const { user } = await requireWorkspace();
  const connection = await prisma.calendarConnection.findFirst({
    where: { userId: user.id, provider: "GOOGLE" },
    select: {
      id: true,
      accountEmail: true,
      calendarId: true,
      calendarName: true,
      status: true,
      lastSyncedAt: true,
      lastError: true,
    },
  });
  if (!connection) return { configured: isGoogleConfigured(), connection: null };
  const counts = await prisma.calendarEventSync.groupBy({
    by: ["status"],
    where: { connectionId: connection.id },
    _count: { _all: true },
  });
  const count = (statuses: string[]) =>
    counts.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + row._count._all, 0);
  const { id: _id, ...rest } = connection;
  return {
    configured: isGoogleConfigured(),
    connection: {
      ...rest,
      synced: count(["SYNCED"]),
      pending: count(["PENDING", "DELETE_PENDING"]),
      failed: count(["FAILED"]),
    },
  };
}

export async function hasConnectedCalendar(): Promise<boolean> {
  const { user } = await requireWorkspace();
  return (await prisma.calendarConnection.count({ where: { userId: user.id, status: "CONNECTED" } })) > 0;
}

/**
 * Stores a new Google connection after the OAuth callback (tokens are
 * encrypted at rest) and queues publishing of upcoming interviews.
 */
export async function saveGoogleConnection(userId: string, tokens: TokenResponse): Promise<void> {
  if (!tokens.refresh_token)
    throw new DomainError(
      "Google did not return offline access. Remove JobTrack in your Google account permissions and connect again.",
    );
  const data = {
    accountEmail: emailFromIdToken(tokens.id_token),
    encryptedRefreshToken: encryptSecret(tokens.refresh_token),
    encryptedAccessToken: encryptSecret(tokens.access_token),
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scope: tokens.scope ?? null,
    status: "CONNECTED" as const,
    lastError: null,
  };
  await prisma.$transaction(
    async (tx) => {
      await tx.calendarConnection.upsert({
        where: { userId_provider: { userId, provider: "GOOGLE" } },
        create: {
          userId,
          provider: "GOOGLE",
          calendarId: "primary",
          calendarName: "Primary calendar",
          ...data,
        },
        update: data,
      });
      await resyncUser(tx, userId, { calendar: true });
    },
    { timeout: 30_000 },
  );
}

async function loadConnection(userId: string) {
  const connection = await prisma.calendarConnection.findFirst({
    where: { userId, provider: "GOOGLE" },
    select: {
      id: true,
      userId: true,
      calendarId: true,
      status: true,
      encryptedRefreshToken: true,
      encryptedAccessToken: true,
      accessTokenExpiresAt: true,
    },
  });
  if (!connection) throw new NotFoundError("Calendar connection");
  return connection;
}

/** Writable calendars for the destination picker (empty when Google is unreachable). */
export async function listDestinationCalendars(): Promise<{
  calendars: GoogleCalendar[];
  error: string | null;
}> {
  const { user } = await requireWorkspace();
  const connection = await loadConnection(user.id);
  if (connection.status !== "CONNECTED") return { calendars: [], error: null };
  try {
    return { calendars: await listCalendars(await getAccessToken(connection)), error: null };
  } catch (error) {
    logger.warn("could not list Google calendars", { userId: user.id, error: errorMessage(error) });
    if (error instanceof GoogleApiError && error.needsReauth) {
      await prisma.calendarConnection.update({
        where: { id: connection.id },
        data: { status: "NEEDS_REAUTH", lastError: error.message },
      });
    }
    return { calendars: [], error: "Couldn't load your calendars from Google right now." };
  }
}

async function requeueLinks(
  connectionId: string,
  where: { status?: "FAILED" } = {},
  status: "PENDING" | "DELETE_PENDING" = "PENDING",
) {
  const links = await prisma.calendarEventSync.findMany({
    where: { connectionId, ...where },
    select: { id: true },
  });
  for (const link of links) {
    await prisma.$transaction(async (tx) => {
      await tx.calendarEventSync.update({
        where: { id: link.id },
        data: { status, attempts: 0, lastError: null, syncRevision: { increment: 1 } },
      });
      await enqueueJob(
        tx,
        "sync_calendar_event",
        { syncId: link.id },
        { jobKey: `calsync:${link.id}`, maxAttempts: 10 },
      );
    });
  }
  return links.length;
}

/** Publishes to another calendar; existing events are moved by the worker. */
export async function setCalendarDestination(calendarId: string): Promise<void> {
  const { user } = await requireWorkspace();
  const connection = await loadConnection(user.id);
  const { calendars } = await listDestinationCalendars();
  const calendar = calendars.find((item) => item.id === calendarId);
  if (!calendar) throw new DomainError("Choose one of your writable Google calendars.");
  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: { calendarId: calendar.id, calendarName: calendar.summary },
  });
  await requeueLinks(connection.id);
}

export async function retryFailedCalendarSyncs(): Promise<number> {
  const { user } = await requireWorkspace();
  const connection = await loadConnection(user.id);
  if (connection.status !== "CONNECTED") throw new DomainError("Reconnect Google Calendar first.");
  return requeueLinks(connection.id, { status: "FAILED" });
}

/** Removes every JobTrack event from Google (the connection stays). */
export async function removeSyncedEvents(): Promise<number> {
  const { user } = await requireWorkspace();
  const connection = await loadConnection(user.id);
  return requeueLinks(connection.id, {}, "DELETE_PENDING");
}

/**
 * Disconnects: revokes Google's grant (best effort) and deletes the stored
 * credentials and sync links. Events already in Google stay there unless
 * removed first.
 */
export async function disconnectCalendar(): Promise<void> {
  const { user } = await requireWorkspace();
  const connection = await loadConnection(user.id);
  try {
    await revokeToken(decryptSecret(connection.encryptedRefreshToken));
  } catch (error) {
    logger.warn("google token revoke failed during disconnect", {
      userId: user.id,
      error: errorMessage(error),
    });
  }
  await prisma.calendarConnection.delete({ where: { id: connection.id } });
}
