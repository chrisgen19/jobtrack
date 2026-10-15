import { expect, test } from "@playwright/test";
import { newAccount, registerAndOnboard } from "./helpers/auth";

test("mobile navigation opens the sidebar sheet and navigates", async ({ page }) => {
  await registerAndOnboard(page, newAccount("Mobile"));
  await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  const nav = page.getByRole("dialog").getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole("dialog")).toBeHidden();
});
