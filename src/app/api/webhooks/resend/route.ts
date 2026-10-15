import { z } from "zod";
import { handleEmailBounce } from "@/features/notifications/bounces";
import { emailEnv } from "@/lib/env";
import { verifySvixSignature } from "@/lib/integrations/svix";
import { logger } from "@/lib/logger";

const eventSchema = z.object({
  type: z.string(),
  data: z.object({ email_id: z.string().optional() }).loose(),
});

/** Resend delivery webhooks (bounces and complaints). Signature verified. */
export async function POST(request: Request) {
  const secret = emailEnv().RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 404 });
  const body = await request.text();
  const valid = verifySvixSignature({
    secret,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
  });
  if (!valid) return new Response("Invalid signature", { status: 401 });

  const parsed = eventSchema.safeParse(JSON.parse(body));
  if (!parsed.success) return new Response("Ignored", { status: 200 });
  const { type, data } = parsed.data;
  if ((type === "email.bounced" || type === "email.complained") && data.email_id) {
    const handled = await handleEmailBounce(
      data.email_id,
      type === "email.bounced" ? "bounced" : "complained",
    );
    logger.info("resend webhook processed", { type, handled });
  }
  return new Response("OK", { status: 200 });
}
