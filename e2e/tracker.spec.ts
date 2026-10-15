import { expect, test, type Page } from "@playwright/test";
import { newAccount, registerAndOnboard } from "./helpers/auth";

async function quickAdd(page: Page, title: string, company: string, extra?: (page: Page) => Promise<void>) {
  await page.getByRole("button", { name: "Add a job" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a new opportunity" });
  await dialog.getByLabel("Job title").fill(title);
  await dialog.getByLabel("Company").fill(company);
  if (extra) await extra(page);
  await dialog.getByRole("button", { name: "Save job" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("core job tracker", () => {
  test("save, apply, move through custom stages on the table and the board", async ({ page }) => {
    await registerAndOnboard(page, newAccount("Tracker"));

    // Save a job with only the required fields plus salary.
    await quickAdd(page, "Full-Stack Developer", "Acme Labs", async (p) => {
      const dialog = p.getByRole("dialog");
      await dialog.getByLabel("Minimum salary").fill("150000");
      await dialog.getByLabel("Maximum salary").fill("185000");
      await dialog.getByLabel("Salary period").selectOption("MONTHLY");
    });
    await quickAdd(page, "Senior Engineer", "Beta Corp");

    await page.goto("/jobs");
    await expect(page.getByRole("link", { name: /Full-Stack Developer/ })).toBeVisible();
    await expect(page.getByText("₱150K–185K/mo")).toBeVisible();
    await page.getByRole("link", { name: "Saved", exact: true }).filter({ visible: true }).click();
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();

    // Duplicate warning is advisory.
    await page.getByRole("button", { name: "Add a job" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Job title").fill("Full-Stack Developer");
    await dialog.getByLabel("Company").fill("acme labs");
    await expect(dialog.getByText("You may have saved this job already")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // Mark as applied from the job page.
    await page.goto("/jobs");
    await page.getByRole("link", { name: /Full-Stack Developer/ }).click();
    await page.getByRole("button", { name: "Mark as applied" }).click();
    await page.getByRole("dialog").getByLabel("Date applied").fill("2026-10-01");
    await page.getByRole("dialog").getByRole("button", { name: "Record application" }).click();
    await expect(page).toHaveURL(/\/applications\//);

    // Change stage with the accessible select and confirm the timeline entry.
    await page.getByRole("combobox", { name: "Stage" }).selectOption({ label: "Recruiter Screening" });
    await expect(page.getByText("Moved to Recruiter Screening")).toBeVisible();
    await page.getByRole("link", { name: "Timeline", exact: true }).filter({ visible: true }).click();
    await expect(page.getByText("Moved from Applied to Recruiter Screening")).toBeVisible();

    // Add a custom stage.
    await page.goto("/settings/pipeline");
    await page.getByLabel("New stage").fill("Coding Challenge");
    await page.getByLabel("Counts as").selectOption("ASSESSMENT");
    await page.getByRole("button", { name: "Add stage" }).click();
    await expect(page.getByRole("textbox", { name: "Stage name" }).last()).toHaveValue("Coding Challenge");

    // Kanban: move with the "Move to" menu (keyboard/screen-reader path).
    await page.goto("/pipeline");
    await expect(page.getByRole("region", { name: /Coding Challenge column, 0 cards/ })).toBeVisible();

    // Kanban: cards share the DndContext's stable describedby id, so SSR and hydration markup match.
    const cards = page.locator('[aria-roledescription="Draggable job card"]');
    await expect(cards).toHaveCount(2);
    for (const boardCard of await cards.all()) {
      await expect(boardCard).toHaveAttribute("aria-describedby", "pipeline-board");
    }
    await expect(page.locator("#pipeline-board")).toBeAttached();

    await page
      .getByRole("button", { name: "Move Full-Stack Developer to another stage", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Coding Challenge" }).click();
    await expect(page.getByRole("region", { name: /Coding Challenge column, 1 card/ })).toBeVisible();

    // Kanban: drag with the mouse.
    const card = page.getByRole("button", { name: "Full-Stack Developer at Acme Labs", exact: true });
    await card.scrollIntoViewIfNeeded();
    const target = page.getByRole("region", { name: /Job Offer column/ });
    const from = await card.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error("board not rendered");
    await page.mouse.move(from.x + 40, from.y + 20);
    await page.mouse.down();
    await page.mouse.move(from.x + 60, from.y + 30, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 15 });
    await page.mouse.up();
    await expect(page.getByRole("region", { name: /Job Offer column, 1 card/ })).toBeVisible();
    await expect(page.getByText(/moved to Job Offer/)).toBeVisible();

    // Kanban: the card title opens a summary drawer over the board; Escape returns to it.
    await page.getByRole("link", { name: "Full-Stack Developer", exact: true }).click();
    const peek = page.getByRole("dialog", { name: "Full-Stack Developer" });
    await expect(peek).toBeVisible();
    await expect(page).toHaveURL(/\/applications\//);
    await expect(peek.getByRole("link", { name: "Open full page" })).toBeVisible();
    // The board stays the current section while the drawer masks the URL.
    await expect(page.locator('nav[aria-label="Main"] a[aria-current="page"]')).toHaveAttribute(
      "href",
      "/pipeline",
    );
    await expect(page.locator('nav[aria-label="Breadcrumb"] strong')).toHaveText("Pipeline");
    await page.keyboard.press("Escape");
    await expect(peek).toBeHidden();
    await expect(page).toHaveURL(/\/pipeline$/);
  });
});
