import { expect, test } from "@playwright/test";
import { newAccount, registerAndOnboard } from "./helpers/auth";

/** Wall-clock date and HH:mm in a timezone, `minutes` from now. */
function zonedSoon(timeZone: string, minutes: number): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(Date.now() + minutes * 60_000));
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

test("an imminent interview produces an in-app reminder delivered by the worker", async ({ page }) => {
  await registerAndOnboard(page, newAccount("Reminders"), { timezone: "Asia/Manila", currency: "PHP" });

  await page.getByRole("button", { name: "Add a job" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Job title").fill("Platform Engineer");
  await dialog.getByLabel("Company").fill("Harbor Cloud");
  await dialog.getByText("I've already applied to this job").click();
  await dialog.getByRole("button", { name: "Save job" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/jobs");
  await page.getByRole("link", { name: /Platform Engineer/ }).click();
  await page.getByRole("link", { name: /Attempt 1/ }).click();
  await page.getByRole("link", { name: "Interviews", exact: true }).filter({ visible: true }).click();

  // Starts in 30 minutes with a 1-hour reminder: the reminder is due now.
  const soon = zonedSoon("Asia/Manila", 30);
  await page.getByRole("button", { name: "Schedule interview" }).click();
  const form = page.getByRole("dialog", { name: "Schedule an interview" });
  await form.getByLabel("Interview round").fill("Recruiter Screen");
  await form.getByLabel("Date").fill(soon.date);
  await form.getByLabel("Start time").fill(soon.time);
  await form.getByLabel("Reminder").selectOption("60");
  await form.getByRole("button", { name: "Save interview" }).click();
  await expect(form).toBeHidden();

  // The worker delivers it; poll the inbox page.
  await expect(async () => {
    await page.goto("/notifications");
    await expect(page.getByText("Upcoming interview: Recruiter Screen with Harbor Cloud")).toBeVisible({
      timeout: 1_000,
    });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByText(/In-app · /)).toBeVisible();
  await expect(page.getByText("sent", { exact: true })).toBeVisible();

  // Bell shows it as unread; opening it navigates to the interview.
  await page.getByRole("button", { name: /Notifications, 1 unread/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Upcoming interview: Recruiter Screen/ })
    .click();
  await expect(page).toHaveURL(/tab=interviews/);

  // Integrations page reports Google Calendar as not configured (no credentials in tests).
  await page.goto("/settings/integrations");
  await expect(page.getByText("Not configured on this server")).toBeVisible();
});
