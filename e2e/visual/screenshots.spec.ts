import { test, type Page } from "@playwright/test";
import { newAccount, registerAndOnboard } from "../helpers/auth";

// Manual visual check helper: `SCREENSHOTS=1 pnpm exec playwright test e2e/visual`.
test.skip(!process.env.SCREENSHOTS, "screenshots only on demand");

async function addJob(page: Page, title: string, company: string, applied: boolean) {
  await page.getByRole("button", { name: "Add a job" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Job title").fill(title);
  await dialog.getByLabel("Company").fill(company);
  await dialog.getByLabel("Minimum salary").fill("120000");
  await dialog.getByLabel("Maximum salary").fill("150000");
  await dialog.getByLabel("Salary period").selectOption("MONTHLY");
  await dialog.getByLabel("Work arrangement").selectOption("REMOTE");
  if (applied) await dialog.getByText("I've already applied to this job").click();
  await dialog.getByRole("button", { name: "Save job" }).click();
  await dialog.waitFor({ state: "hidden" });
}

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });
}

test("capture key screens", async ({ page }) => {
  await registerAndOnboard(page, newAccount("Shots"));
  await addJob(page, "Senior Frontend Engineer", "Northstar Labs", true);
  await addJob(page, "Full-Stack Developer", "Atlas Digital", true);
  await addJob(page, "Headless CMS Developer", "Monograph Works", false);
  for (const path of (
    process.env.SCREEN_PATHS ?? "/dashboard,/jobs,/pipeline,/settings/pipeline,/contacts"
  ).split(",")) {
    await page.goto(path);
    await shot(page, path.replaceAll("/", "_").slice(1) || "home");
  }
  await page.goto("/jobs");
  await page.getByRole("link", { name: /Senior Frontend Engineer/ }).click();
  await shot(page, "job-detail");
  await page.getByRole("link", { name: /Attempt 1/ }).click();
  await shot(page, "application");
});
