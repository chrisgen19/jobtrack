import { expect, test, type Page } from "@playwright/test";
import { newAccount, registerAndOnboard, signIn } from "./helpers/auth";

/**
 * The workflow from the project brief's "Definition of Done", end to end in a
 * production build with a real worker and PostgreSQL.
 */

const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

function zoned(timeZone: string, minutesFromNow: number): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(Date.now() + minutesFromNow * 60_000));
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

async function scheduleInterview(
  page: Page,
  title: string,
  when: { date: string; time: string },
  reminder = "1440",
) {
  await page.getByRole("button", { name: "Schedule interview" }).click();
  const form = page.getByRole("dialog", { name: "Schedule an interview" });
  await form.getByLabel("Interview round").fill(title);
  await form.getByLabel("Date").fill(when.date);
  await form.getByLabel("Start time").fill(when.time);
  await form.getByLabel("Reminder").selectOption(reminder);
  await form.getByRole("button", { name: "Save interview" }).click();
  await expect(form).toBeHidden();
}

test("definition of done: full job search workflow with isolation", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const TZ = "Asia/Manila";
  const account = newAccount("Done");

  // 1. Register (with email verification and onboarding).
  await registerAndOnboard(page, account, { timezone: TZ, currency: "PHP" });

  // 2. Sign in again from a fresh session.
  await page.getByRole("button", { name: new RegExp(account.name) }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await signIn(page, account);

  // 3-4. Save a Full-Stack Developer opportunity with company, salary and description.
  await page.getByRole("button", { name: "Add a job" }).click();
  const quickAdd = page.getByRole("dialog", { name: "Add a new opportunity" });
  await quickAdd.getByLabel("Job title").fill("Full-Stack Developer");
  await quickAdd.getByLabel("Company").fill("Northstar Labs");
  await quickAdd.getByLabel("Minimum salary").fill("150000");
  await quickAdd.getByLabel("Maximum salary").fill("185000");
  await quickAdd.getByLabel("Salary period").selectOption("MONTHLY");
  await quickAdd.getByLabel("Job source").fill("LinkedIn");
  await quickAdd
    .getByLabel("Job description")
    .fill("Build and ship product features across the stack with Next.js and PostgreSQL.");
  await quickAdd.getByRole("button", { name: "Save job" }).click();
  await expect(quickAdd).toBeHidden();

  await page.goto("/jobs");
  await page.getByRole("link", { name: /Full-Stack Developer/ }).click();
  // Next keeps the jobs list mounted but hidden, and it shows the salary too.
  await expect(page.getByText("₱150K–185K/mo").filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/Build and ship product features/).filter({ visible: true })).toBeVisible();

  // 5. Mark as applied.
  await page.getByRole("button", { name: "Mark as applied" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Record application" }).click();
  await expect(page).toHaveURL(/\/applications\//);
  const applicationUrl = page.url().split("?")[0]!;

  // 6. Attach a resume (upload to the private library, then attach the exact version).
  await page.goto("/documents");
  await page.getByRole("button", { name: "Add document" }).click();
  const upload = page.getByRole("dialog", { name: "Add a document" });
  await upload
    .getByLabel("File")
    .setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: PDF });
  await upload.getByLabel("Name").fill("Full-Stack Resume");
  await upload.getByRole("button", { name: "Upload" }).click();
  await expect(upload).toBeHidden();
  await page.getByRole("button", { name: "Details" }).click();
  const downloadHref = await page.getByRole("link", { name: "Download" }).getAttribute("href");
  await page.keyboard.press("Escape");
  await page.goto(`${applicationUrl}?tab=documents`);
  await page.getByLabel("Document version").selectOption({ label: "Full-Stack Resume · v1" });
  await page.getByRole("button", { name: "Attach" }).click();
  await expect(page.getByText("Full-Stack Resume · v1")).toBeVisible();

  // 7. Update the hiring stage.
  await page.goto(applicationUrl);
  await page.getByRole("combobox", { name: "Stage" }).selectOption({ label: "Technical Interview" });
  await expect(page.getByText("Moved to Technical Interview")).toBeVisible();

  // 8. Schedule multiple interviews (one soon, so its reminder is due now).
  await page.goto(`${applicationUrl}?tab=interviews`);
  await scheduleInterview(page, "Technical Round 1", zoned(TZ, 3 * 24 * 60));
  await scheduleInterview(page, "Recruiter Sync", zoned(TZ, 30), "60");
  await expect(page.getByText("2 interview rounds")).toBeVisible();

  // 9. Reschedule an interview.
  await page.getByRole("button", { name: "Actions for Technical Round 1" }).click();
  await page.getByRole("menuitem", { name: "Edit or reschedule" }).click();
  const edit = page.getByRole("dialog", { name: "Edit interview" });
  await edit.getByLabel("Date").fill(zoned(TZ, 4 * 24 * 60).date);
  await edit.getByLabel("Reason for rescheduling").fill("Hiring manager travelling");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByText("Rescheduled 1 time")).toBeVisible();

  // 10. Receive a reminder (delivered by the background worker). Generous on purpose: a
  // busy CI runner can take a while to deliver it, and this test allows 180 s overall.
  await expect(async () => {
    await page.goto("/notifications");
    await expect(page.getByText("Upcoming interview: Recruiter Sync with Northstar Labs")).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ intervals: [1_000, 2_000, 5_000], timeout: 90_000 });

  // 11. Create and complete a follow-up task.
  await page.goto("/tasks");
  await page.getByRole("button", { name: "New task" }).click();
  const taskDialog = page.getByRole("dialog", { name: "Create a task" });
  await taskDialog.getByLabel("Task title").fill("Send thank-you note to Northstar");
  await taskDialog.getByLabel("Type").selectOption("FOLLOW_UP");
  await taskDialog
    .getByLabel("Related application")
    .selectOption({ label: "Full-Stack Developer · Northstar Labs" });
  await taskDialog.getByRole("button", { name: "Add task" }).click();
  await expect(taskDialog).toBeHidden();
  await page.getByRole("button", { name: "Mark complete: Send thank-you note to Northstar" }).click();
  await expect(
    page.getByRole("region", { name: "Completed recently" }).getByText("Send thank-you note to Northstar"),
  ).toBeVisible();

  // 12. Receive and record a job offer.
  await page.goto(`${applicationUrl}?tab=offers`);
  await page.getByRole("button", { name: "Record offer" }).click();
  const offer = page.getByRole("dialog", { name: "Record an offer" });
  await offer.getByLabel("Base salary").fill("170000");
  await offer.getByLabel("Pay period").selectOption("MONTHLY");
  await offer.getByLabel("Decision deadline").fill(zoned(TZ, 5 * 24 * 60).date);
  await offer.getByRole("button", { name: "Save offer" }).click();
  await expect(offer).toBeHidden();
  await expect(page.getByText("₱170,000/mo")).toBeVisible();

  // 13. Analytics reflect it (one application, interviewed, offered).
  await page.goto("/analytics");
  await expect(page.getByText("Applications sent")).toBeVisible();
  await expect(page.getByText("1 of 1 applications").first()).toBeVisible();
  await expect(page.getByText("100%").first()).toBeVisible();

  // Timeline recorded every step.
  await page.goto(`${applicationUrl}?tab=timeline`);
  for (const entry of [
    "Application submitted",
    "Moved from Applied to Technical Interview",
    "Offer received: ₱170,000/mo",
  ]) {
    await expect(page.getByText(entry)).toBeVisible();
  }
  await expect(page.getByText(/Rescheduled Technical Round 1/)).toBeVisible();

  // 14. A different user cannot access any of it.
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await registerAndOnboard(other, newAccount("Outsider"));
  await other.goto(applicationUrl);
  await expect(other.getByRole("heading", { name: "We couldn't find that" })).toBeVisible();
  expect((await other.request.get(downloadHref!)).status()).toBe(404);
  await other.goto("/jobs");
  await expect(other.getByText("Save your first job")).toBeVisible();
  const exported = await (await other.request.get("/api/export/workspace.json")).text();
  expect(exported).not.toContain("Northstar");
  await otherContext.close();
});
