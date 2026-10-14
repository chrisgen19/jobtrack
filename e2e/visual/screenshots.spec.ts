import { test } from "@playwright/test";
import { newAccount, registerAndOnboard } from "../helpers/auth";

// Manual visual check helper: `SCREENSHOTS=1 pnpm test:e2e e2e/visual`.
test.skip(!process.env.SCREENSHOTS, "screenshots only on demand");

test("capture key screens", async ({ page }) => {
  await page.goto("/login");
  await page.screenshot({ path: "test-results/screens/login.png", fullPage: true });
  await registerAndOnboard(page, newAccount("Shots"));
  for (const path of (process.env.SCREEN_PATHS ?? "/dashboard,/settings").split(",")) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `test-results/screens${path.replaceAll("/", "_")}.png`, fullPage: true });
  }
});
