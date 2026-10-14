import { appEnv } from "@/lib/env";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import {
  deleteEvent,
  eventIdFor,
  GoogleApiError,
  insertEvent,
  refreshAccessToken,
  updateEvent,
  type GoogleEventInput,
} from "@/lib/integrations/google/client";
import { errorMessage, logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { INTERVIEW_MODE_LABEL } from "@/lib/labels";

/**
 * Worker-side one-way sync of one interview/task to Google Calendar.
 * JobTrack is the source of truth; edits made in Google are not imported.
 * Shared with tests; must not import `server-only` or `next/*`.
 */

export type SyncOutcome = "synced" | "deleted" | "skipped" | "failed" | "needs-reauth";

type Connection = {
  id: string;
  userId: string;
  calendarId: string;
  status: string;
  encryptedRefreshToken: string;
  encryptedAccessToken: string | null;
  accessTokenExpiresAt: Date | null;
};

/** Marks the connection as needing reconnection and tells the user once. */
async function requireReauth(connection: Connection, reason: string): Promise<void> {
  const updated = await prisma.calendarConnection.updateMany({
    where: { id: connection.id, status: "CONNECTED" },
    data: {
      status: "NEEDS_REAUTH",
      lastError: reason,
      encryptedAccessToken: null,
      accessTokenExpiresAt: null,
    },
  });
  if (updated.count > 0) {
    await prisma.notification.create({
      data: {
        userId: connection.userId,
        type: "CALENDAR_SYNC_ERROR",
        title: "Reconnect Google Calendar",
        body: "Google no longer accepts JobTrack's access. Your interviews are safe; reconnect to resume syncing.",
        link: "/settings/integrations",
      },
    });
  }
}

/** A valid access token, refreshed (and re-encrypted) when it is about to expire. */
export async function getAccessToken(connection: Connection): Promise<string> {
  if (
    connection.encryptedAccessToken &&
    connection.accessTokenExpiresAt &&
    connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000
  ) {
    return decryptSecret(connection.encryptedAccessToken);
  }
  const tokens = await refreshAccessToken(decryptSecret(connection.encryptedRefreshToken));
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: encryptSecret(tokens.access_token),
      accessTokenExpiresAt: expiresAt,
      ...(tokens.refresh_token ? { encryptedRefreshToken: encryptSecret(tokens.refresh_token) } : {}),
    },
  });
  return tokens.access_token;
}

function eventForInterview(interview: {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string;
  mode: keyof typeof INTERVIEW_MODE_LABEL;
  meetingUrl: string | null;
  location: string | null;
  interviewers: string | null;
  applicationId: string;
  application: { opportunity: { title: string; company: { name: string } } };
}): GoogleEventInput {
  const { opportunity } = interview.application;
  const end = interview.endsAt ?? new Date(interview.startsAt.getTime() + 60 * 60_000);
  const lines = [
    `${interview.title} for ${opportunity.title} at ${opportunity.company.name}`,
    `Format: ${INTERVIEW_MODE_LABEL[interview.mode]}`,
    ...(interview.meetingUrl ? [`Meeting link: ${interview.meetingUrl}`] : []),
    ...(interview.interviewers ? [`Interviewers: ${interview.interviewers}`] : []),
    "",
    `Open in JobTrack: ${appEnv().APP_URL}/applications/${interview.applicationId}?tab=interviews`,
    "Managed by JobTrack. Edits made here are not synced back.",
  ];
  return {
    summary: `Interview: ${interview.title} · ${opportunity.company.name}`,
    description: lines.join("\n"),
    location: interview.location ?? interview.meetingUrl ?? undefined,
    start: { dateTime: interview.startsAt.toISOString(), timeZone: interview.timezone },
    end: { dateTime: end.toISOString(), timeZone: interview.timezone },
  };
}

function eventForTask(
  task: {
    title: string;
    dueAt: Date;
    applicationId: string | null;
    opportunity: { company: { name: string } } | null;
  },
  timezone: string,
): GoogleEventInput {
  return {
    summary: `Task: ${task.title}`,
    description: [
      task.opportunity ? `Related to ${task.opportunity.company.name}` : "JobTrack task",
      "",
      `Open in JobTrack: ${appEnv().APP_URL}${task.applicationId ? `/applications/${task.applicationId}` : "/tasks"}`,
      "Managed by JobTrack. Edits made here are not synced back.",
    ].join("\n"),
    start: { dateTime: task.dueAt.toISOString(), timeZone: timezone },
    end: { dateTime: new Date(task.dueAt.getTime() + 30 * 60_000).toISOString(), timeZone: timezone },
  };
}

/** Creates or updates the remote event; recreates it if it was deleted in Google. */
async function upsertRemote(
  accessToken: string,
  link: { id: string; externalEventId: string | null; calendarId: string | null },
  calendarId: string,
  event: GoogleEventInput,
): Promise<string> {
  if (link.externalEventId && link.calendarId && link.calendarId !== calendarId) {
    // The user picked another destination calendar: move the event.
    await deleteEvent(accessToken, link.calendarId, link.externalEventId);
  } else if (link.externalEventId) {
    try {
      return (await updateEvent(accessToken, calendarId, link.externalEventId, event)).id;
    } catch (error) {
      if (!(error instanceof GoogleApiError && (error.status === 404 || error.status === 410))) throw error;
      // Deleted in Google: create a fresh event below (without reusing the id).
      return (await insertEvent(accessToken, calendarId, event)).id;
    }
  }
  const id = eventIdFor(link.id);
  try {
    return (await insertEvent(accessToken, calendarId, { ...event, id })).id;
  } catch (error) {
    // A previous attempt already created it (crash before saving the id).
    if (error instanceof GoogleApiError && error.status === 409)
      return (await updateEvent(accessToken, calendarId, id, event)).id;
    throw error;
  }
}

/** Syncs one link. Throws only for retryable failures. */
export async function syncCalendarEvent(syncId: string): Promise<SyncOutcome> {
  const link = await prisma.calendarEventSync.findUnique({
    where: { id: syncId },
    select: {
      id: true,
      userId: true,
      status: true,
      externalEventId: true,
      calendarId: true,
      syncRevision: true,
      connection: {
        select: {
          id: true,
          userId: true,
          calendarId: true,
          status: true,
          encryptedRefreshToken: true,
          encryptedAccessToken: true,
          accessTokenExpiresAt: true,
        },
      },
      interview: {
        select: {
          id: true,
          title: true,
          status: true,
          startsAt: true,
          endsAt: true,
          timezone: true,
          mode: true,
          meetingUrl: true,
          location: true,
          interviewers: true,
          applicationId: true,
          application: {
            select: {
              status: true,
              opportunity: { select: { title: true, company: { select: { name: true } } } },
            },
          },
        },
      },
      task: {
        select: {
          title: true,
          status: true,
          dueAt: true,
          applicationId: true,
          opportunity: { select: { company: { select: { name: true } } } },
        },
      },
      user: { select: { preferences: { select: { timezone: true, calendarSyncTasks: true } } } },
    },
  });
  if (!link) return "skipped";
  const { connection } = link;
  if (connection.status !== "CONNECTED") {
    await prisma.calendarEventSync.update({
      where: { id: link.id },
      data: { status: "FAILED", lastError: "Calendar needs to be reconnected" },
    });
    return "skipped";
  }

  const interview = link.interview;
  const task = link.task;
  const prefs = link.user.preferences;
  const interviewLive =
    interview?.startsAt &&
    (interview.status === "SCHEDULED" ||
      interview.status === "RESCHEDULED" ||
      interview.status === "COMPLETED");
  const taskLive = task?.dueAt && task.status === "OPEN" && prefs?.calendarSyncTasks;
  const shouldExist = link.status !== "DELETE_PENDING" && Boolean(interviewLive || taskLive);

  let accessToken: string;
  try {
    accessToken = await getAccessToken(connection);
  } catch (error) {
    if (error instanceof GoogleApiError && error.needsReauth) {
      await requireReauth(connection, error.message);
      await prisma.calendarEventSync.update({
        where: { id: link.id },
        data: { status: "FAILED", lastError: "Calendar needs to be reconnected" },
      });
      return "needs-reauth";
    }
    throw error;
  }

  try {
    if (!shouldExist) {
      if (link.externalEventId)
        await deleteEvent(accessToken, link.calendarId ?? connection.calendarId, link.externalEventId);
      await prisma.calendarEventSync.delete({ where: { id: link.id } });
      return "deleted";
    }
    const event = interviewLive
      ? eventForInterview({ ...interview!, startsAt: interview!.startsAt! })
      : eventForTask({ ...task!, dueAt: task!.dueAt! }, prefs?.timezone ?? "UTC");
    const externalEventId = await upsertRemote(accessToken, link, connection.calendarId, event);
    await prisma.$transaction([
      prisma.calendarEventSync.update({
        where: { id: link.id },
        data: {
          status: "SYNCED",
          externalEventId,
          calendarId: connection.calendarId,
          lastSyncedAt: new Date(),
          lastError: null,
        },
      }),
      prisma.calendarConnection.update({
        where: { id: connection.id },
        data: { lastSyncedAt: new Date(), lastError: null },
      }),
    ]);
    return "synced";
  } catch (error) {
    if (error instanceof GoogleApiError && error.status === 401) {
      // Access token rejected despite refresh: force a refresh next time.
      await prisma.calendarConnection.update({
        where: { id: connection.id },
        data: { encryptedAccessToken: null, accessTokenExpiresAt: null },
      });
      throw error;
    }
    const reason = errorMessage(error);
    await prisma.calendarEventSync.update({
      where: { id: link.id },
      data: { attempts: { increment: 1 }, lastError: reason },
    });
    if (error instanceof GoogleApiError && !error.retryable) {
      await prisma.calendarEventSync.update({ where: { id: link.id }, data: { status: "FAILED" } });
      logger.warn("calendar sync failed permanently", {
        syncId: link.id,
        status: error.status,
        reason: error.reason,
      });
      return "failed";
    }
    throw error;
  }
}
