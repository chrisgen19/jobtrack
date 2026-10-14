import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { OUTBOX_DIR } from "./paths";

export type TestAccount = { name: string; email: string; password: string };

export function newAccount(label: string): TestAccount {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: `${label} Tester`,
    email: `${label.toLowerCase()}-${id}@example.test`,
    password: "correct-horse-battery-staple",
  };
}

/** Polls the development outbox for the newest email sent to `to`. */
export async function waitForEmail(
  to: string,
  subjectIncludes: string,
): Promise<{ text: string; subject: string }> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const files = readdirSync(OUTBOX_DIR).sort().reverse();
      for (const file of files) {
        const mail = JSON.parse(readFileSync(path.join(OUTBOX_DIR, file), "utf8")) as {
          to: string;
          subject: string;
          text: string;
        };
        if (mail.to === to && mail.subject.includes(subjectIncludes)) return mail;
      }
    } catch {
      // Outbox not created yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No "${subjectIncludes}" email for ${to} within 20s`);
}

export function linkFrom(text: string): string {
  const match = /https?:\/\/\S+/.exec(
    text
      .split("\n")
      .reverse()
      .find((line) => /https?:\/\//.test(line)) ?? "",
  );
  if (!match) throw new Error("No link found in email");
  return match[0];
}

/** Registers, verifies the email from the outbox and completes onboarding. */
export async function registerAndOnboard(
  page: Page,
  account: TestAccount,
  options = { timezone: "Asia/Manila", currency: "PHP" },
) {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(account.name);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByLabel("Confirm password").fill(account.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);

  const mail = await waitForEmail(account.email, "Verify");
  await page.goto(linkFrom(mail.text));
  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByLabel("Your timezone").selectOption(options.timezone);
  await page.getByLabel("Preferred currency").selectOption(options.currency);
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function signIn(page: Page, account: TestAccount) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
