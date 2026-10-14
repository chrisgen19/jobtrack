import { expect, test } from "@playwright/test";
import { newAccount, registerAndOnboard, signIn, waitForEmail, linkFrom } from "./helpers/auth";

test.describe("authentication", () => {
  test("register, verify email, onboard and reach the private dashboard", async ({ page }) => {
    const account = newAccount("Ada");
    await registerAndOnboard(page, account);
    await expect(page.getByRole("heading", { name: "A clearer path to your next role." })).toBeVisible();
    await expect(page.getByText("Active applications", { exact: true })).toBeVisible();
    await expect(page.getByText("No active applications yet")).toBeVisible();
  });

  test("unverified accounts cannot sign in", async ({ page }) => {
    const account = newAccount("Unverified");
    await page.goto("/register");
    await page.getByLabel("Full name").fill(account.name);
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByLabel("Confirm password").fill(account.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/verify-email/);

    await page.goto("/login");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Please verify your email address before signing in.")).toBeVisible();
  });

  test("protected routes redirect anonymous visitors to sign in", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/login\?next=%2Fjobs/);
  });

  test("sign out, then reset the password and sign in with the new one", async ({ page }) => {
    const account = newAccount("Reset");
    await registerAndOnboard(page, account);

    await page.getByRole("button", { name: new RegExp(account.name) }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(account.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/If an account exists/)).toBeVisible();

    const mail = await waitForEmail(account.email, "Reset");
    await page.goto(linkFrom(mail.text));
    const newPassword = "another-correct-horse-42";
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page).toHaveURL(/\/login\?reset=1/);

    await signIn(page, { ...account, password: newPassword });
  });
});
