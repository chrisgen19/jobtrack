import { expect, test, type Page } from "@playwright/test";
import { newAccount, registerAndOnboard } from "./helpers/auth";

async function saveAppliedJob(page: Page, title: string, company: string) {
  await page.getByRole("button", { name: "Add a job" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Job title").fill(title);
  await dialog.getByLabel("Company").fill(company);
  await dialog.getByText("I've already applied to this job").click();
  await dialog.getByRole("button", { name: "Save job" }).click();
  await expect(dialog).toBeHidden();
}

async function scheduleInterview(page: Page, title: string, date: string, time: string) {
  await page.getByRole("button", { name: "Schedule interview" }).click();
  const dialog = page.getByRole("dialog", { name: "Schedule an interview" });
  await dialog.getByLabel("Interview round").fill(title);
  await dialog.getByLabel("Date").fill(date);
  await dialog.getByLabel("Start time").fill(time);
  await dialog.getByRole("button", { name: "Save interview" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

test("schedule several interviews, reschedule one, and manage follow-up tasks", async ({ page }) => {
  await registerAndOnboard(page, newAccount("Interviews"), { timezone: "Asia/Manila", currency: "PHP" });
  await saveAppliedJob(page, "Full-Stack Developer", "Northstar Labs");

  await page.goto("/jobs");
  await page.getByRole("link", { name: /Full-Stack Developer/ }).click();
  await page.getByRole("link", { name: /Attempt 1/ }).click();
  await page.getByRole("link", { name: "Interviews", exact: true }).filter({ visible: true }).click();

  await scheduleInterview(page, "Recruiter Screen", "2026-11-03", "10:00");
  await scheduleInterview(page, "Technical Round 1", "2026-11-05", "14:00");
  await scheduleInterview(page, "Technical Round 2", "2026-11-10", "14:00");
  await expect(page.getByText("3 interview rounds")).toBeVisible();

  // Reschedule Technical Round 1 by editing its time.
  await page.getByRole("button", { name: "Actions for Technical Round 1" }).click();
  await page.getByRole("menuitem", { name: "Edit or reschedule" }).click();
  const edit = page.getByRole("dialog", { name: "Edit interview" });
  await edit.getByLabel("Date").fill("2026-11-06");
  await edit.getByLabel("Reason for rescheduling").fill("Interviewer out sick");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByText("Rescheduled", { exact: true }).first()).toBeVisible();
  await page.getByText("Rescheduled 1 time").click();
  await expect(page.getByText(/Nov 5, 2:00 PM → Nov 6, 2:00 PM · Interviewer out sick/)).toBeVisible();

  // Complete the screen: a thank-you follow-up is suggested.
  await page.getByRole("button", { name: "Actions for Recruiter Screen" }).click();
  await page.getByRole("menuitem", { name: "Mark as completed" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Awaiting feedback")).toBeVisible();

  // Timeline shows the reschedule.
  await page.getByRole("link", { name: "Timeline", exact: true }).filter({ visible: true }).click();
  await expect(
    page.getByText(/Rescheduled Technical Round 1 from Thu, Nov 5 at 2:00 PM to Fri, Nov 6 at 2:00 PM/),
  ).toBeVisible();

  // Tasks: accept the suggestion, add a task, complete it.
  await page.goto("/tasks");
  await expect(page.getByRole("region", { name: "Suggested for you" })).toBeVisible();
  await page
    .getByRole("region", { name: "Suggested for you" })
    .getByRole("button", { name: "Accept" })
    .first()
    .click();
  await page.getByRole("button", { name: "New task" }).click();
  const taskDialog = page.getByRole("dialog", { name: "Create a task" });
  await taskDialog.getByLabel("Task title").fill("Email recruiter about salary band");
  await taskDialog
    .getByLabel("Related application")
    .selectOption({ label: "Full-Stack Developer · Northstar Labs" });
  await taskDialog.getByRole("button", { name: "Add task" }).click();
  await expect(taskDialog).toBeHidden();
  await page.getByRole("button", { name: "Mark complete: Email recruiter about salary band" }).click();
  await expect(
    page.getByRole("region", { name: "Completed recently" }).getByText("Email recruiter about salary band"),
  ).toBeVisible();

  // Calendar shows the rescheduled interview on its new date.
  await page.goto("/calendar?month=2026-11&day=2026-11-06");
  await expect(page.getByRole("link", { name: "Technical Round 1", exact: true })).toBeVisible();
  await expect(page.getByText("2:00 PM", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reschedule" })).toBeVisible();
});
