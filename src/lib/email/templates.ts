/**
 * Plain, inline-styled transactional email templates. Every template returns
 * both HTML and a text alternative. Values are escaped before interpolation.
 */

export type RenderedEmail = { subject: string; html: string; text: string };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(heading: string, paragraphs: string[], action?: { label: string; url: string }): string {
  const body = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#4b5f55">${escapeHtml(paragraph)}</p>`,
    )
    .join("");
  const button = action
    ? `<p style="margin:22px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#126d50;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 18px;border-radius:9px">${escapeHtml(action.label)}</a></p>
       <p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:#8a9890">If the button does not work, copy this link into your browser:<br><span style="word-break:break-all">${escapeHtml(action.url)}</span></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f7f8f5;font-family:Inter,-apple-system,'Segoe UI',Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="font-size:19px;font-weight:750;letter-spacing:-0.5px;color:#172b26;margin-bottom:20px">job<span style="color:#126d50">track.</span></div>
    <div style="background:#ffffff;border:1px solid #e7ece7;border-radius:16px;padding:28px">
      <h1 style="margin:0 0 16px;font-size:20px;letter-spacing:-0.4px;color:#173329">${escapeHtml(heading)}</h1>
      ${body}${button}
    </div>
    <p style="font-size:11px;color:#9aa69e;margin-top:18px">You are receiving this because of activity on your JobTrack account.</p>
  </div></body></html>`;
}

function textVersion(heading: string, paragraphs: string[], action?: { label: string; url: string }): string {
  return [heading, "", ...paragraphs, ...(action ? ["", `${action.label}: ${action.url}`] : [])].join("\n");
}

function render(
  subject: string,
  heading: string,
  paragraphs: string[],
  action?: { label: string; url: string },
): RenderedEmail {
  return {
    subject,
    html: layout(heading, paragraphs, action),
    text: textVersion(heading, paragraphs, action),
  };
}

export function verificationEmail(name: string, url: string): RenderedEmail {
  return render(
    "Verify your JobTrack email",
    `Welcome, ${name}`,
    [
      "Confirm your email address to finish setting up your private JobTrack workspace.",
      "This link expires in 1 hour.",
    ],
    { label: "Verify email", url },
  );
}

export function resetPasswordEmail(name: string, url: string): RenderedEmail {
  return render(
    "Reset your JobTrack password",
    "Reset your password",
    [
      `Hi ${name}, we received a request to reset your password.`,
      "If you did not ask for this, you can ignore this email. The link expires in 1 hour.",
    ],
    { label: "Choose a new password", url },
  );
}

export function reminderEmail(params: { heading: string; lines: string[]; url: string }): RenderedEmail {
  return render(params.heading, params.heading, params.lines, { label: "Open in JobTrack", url: params.url });
}
