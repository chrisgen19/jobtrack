"use server";

import { z } from "zod";
import { runAction, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { revalidateWorkspace } from "@/lib/revalidate";
import {
  disconnectCalendar,
  removeSyncedEvents,
  retryFailedCalendarSyncs,
  setCalendarDestination,
} from "./data";

const destinationSchema = z.object({ calendarId: z.string().min(1).max(300) });

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  await requireUser();
  const result = await runAction(fn);
  if (result.ok) revalidateWorkspace();
  return result;
}

export async function setCalendarDestinationAction(input: unknown): Promise<ActionResult> {
  const parsed = destinationSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  return run(() => setCalendarDestination(parsed.data.calendarId));
}

export async function retryFailedCalendarSyncsAction(): Promise<ActionResult<number>> {
  return run(retryFailedCalendarSyncs);
}

export async function removeSyncedEventsAction(): Promise<ActionResult<number>> {
  return run(removeSyncedEvents);
}

export async function disconnectCalendarAction(): Promise<ActionResult> {
  return run(disconnectCalendar);
}
