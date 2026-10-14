import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ActivityType } from "@/generated/prisma/enums";
import type { TransactionClient } from "@/lib/prisma";

export type ActivityInput = {
  userId: string;
  opportunityId: string;
  applicationId?: string | null;
  type: ActivityType;
  /** Human sentence snapshot, e.g. "Moved from Applied to Technical Interview". */
  summary: string;
  /** IDs and snapshot values (never resume content or secrets). */
  details?: Prisma.InputJsonValue;
  occurredAt?: Date;
};

/**
 * Appends an immutable activity event. Always called with the transaction
 * client of the change it describes, so the event and the change commit
 * (or roll back) together.
 */
export async function recordActivity(tx: TransactionClient, input: ActivityInput): Promise<void> {
  await tx.activityEvent.create({
    data: {
      userId: input.userId,
      opportunityId: input.opportunityId,
      applicationId: input.applicationId ?? null,
      type: input.type,
      summary: input.summary.slice(0, 500),
      details: input.details ?? {},
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
}
