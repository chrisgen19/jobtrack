import { resyncUser } from "@/features/integrations/side-effects";
import { prisma } from "@/lib/prisma";

/**
 * Handles a hard bounce or spam complaint for a reminder email: the
 * delivery is marked failed, email reminders are switched off for that
 * user (no repeated sends to a bad address) and the user is told in-app.
 */
export async function handleEmailBounce(
  providerMessageId: string,
  kind: "bounced" | "complained",
): Promise<boolean> {
  const delivery = await prisma.notificationDelivery.findFirst({
    where: { providerMessageId, channel: "EMAIL" },
    select: { id: true, userId: true },
  });
  if (!delivery) return false;
  await prisma.$transaction(
    async (tx) => {
      await tx.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: "FAILED", error: `email ${kind}` },
      });
      const preferences = await tx.userPreferences.findUnique({
        where: { userId: delivery.userId },
        select: { emailReminders: true },
      });
      if (!preferences?.emailReminders) return;
      await tx.userPreferences.update({
        where: { userId: delivery.userId },
        data: { emailReminders: false },
      });
      await tx.notification.create({
        data: {
          userId: delivery.userId,
          type: "SYSTEM",
          title: "Email reminders turned off",
          body:
            kind === "bounced"
              ? "Reminder emails to your address bounced, so we switched them off. In-app reminders continue."
              : "A reminder email was marked as spam, so we switched email reminders off. You can turn them back on in settings.",
          link: "/settings/notifications",
        },
      });
      await resyncUser(tx, delivery.userId, { calendar: false });
    },
    { timeout: 30_000 },
  );
  return true;
}
