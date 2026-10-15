import { expect, test, type Page } from "@playwright/test";
import { newAccount, register } from "./helpers/auth";

/**
 * The onboarding timezone select is rendered on the server, so on a slow connection a visitor
 * can pick a timezone before React hydrates the page. That pick must survive hydration instead
 * of being reset to the browser's timezone.
 */

// A browser timezone different from the one picked below, so a reset is visible.
const BROWSER_ZONE = "America/New_York";
test.use({ timezoneId: BROWSER_ZONE });

/** Opens onboarding with the page scripts held back, so the form is shown but not hydrated. */
async function openOnboardingBeforeHydration(page: Page): Promise<() => void> {
  // Verify normally: the redirect from the dashboard to onboarding runs in the browser.
  await page.goto(await register(page, newAccount("Onboarding")));
  await expect(page).toHaveURL(/\/onboarding/);

  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  // Scripts only: Next also serves CSS from /_next/static, and the form must still render.
  await page.route(
    (url) => url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js"),
    async (route) => {
      await released;
      await route.continue();
    },
  );
  await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Your timezone")).toBeVisible();
  return release;
}

/** Waits until React has hydrated the form and its effects have run. */
async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const select = document.getElementById("timezone");
    return !!select && Object.keys(select).some((key) => key.startsWith("__reactFiber"));
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50))),
      ),
  );
}

async function finishOnboardingAndReadTimezone(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/settings");
  return page.getByLabel("Timezone", { exact: true }).inputValue();
}

test("a timezone picked before hydration is kept", async ({ page }) => {
  const release = await openOnboardingBeforeHydration(page);
  const timezone = page.getByLabel("Your timezone");
  await timezone.selectOption("Asia/Manila"); // native select: works without React
  release();
  await waitForHydration(page);

  await expect(timezone).toHaveValue("Asia/Manila");
  expect(await finishOnboardingAndReadTimezone(page)).toBe("Asia/Manila");
});

test("an untouched form defaults to the browser's timezone after hydration", async ({ page }) => {
  const release = await openOnboardingBeforeHydration(page);
  release();
  await waitForHydration(page);

  await expect(page.getByLabel("Your timezone")).toHaveValue(BROWSER_ZONE);
  expect(await finishOnboardingAndReadTimezone(page)).toBe(BROWSER_ZONE);
});
