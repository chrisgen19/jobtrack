import { expect, test, type Page } from "@playwright/test";
import { newAccount, registerAndOnboard } from "./helpers/auth";

const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

async function saveAppliedJob(page: Page) {
  await page.getByRole("button", { name: "Add a job" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Job title").fill("Full-Stack Developer");
  await dialog.getByLabel("Company").fill("Atlas Digital");
  await dialog.getByText("I've already applied to this job").click();
  await dialog.getByRole("button", { name: "Save job" }).click();
  await expect(dialog).toBeHidden();
  await page.goto("/jobs");
  await page.getByRole("link", { name: /Full-Stack Developer/ }).click();
  await page.getByRole("link", { name: /Attempt 1/ }).click();
  await expect(page).toHaveURL(/\/applications\//);
  return page.url();
}

test("upload a resume, attach it, record and accept an offer; documents stay private", async ({
  page,
  browser,
}) => {
  await registerAndOnboard(page, newAccount("Docs"));
  const applicationUrl = await saveAppliedJob(page);

  // Upload a private resume.
  await page.goto("/documents");
  await page.getByRole("button", { name: "Add document" }).click();
  const upload = page.getByRole("dialog", { name: "Add a document" });
  await upload
    .getByLabel("File")
    .setInputFiles({ name: "resume-v3.pdf", mimeType: "application/pdf", buffer: PDF });
  await upload.getByLabel("Name").fill("Full-Stack Resume");
  await upload.getByRole("button", { name: "Upload" }).click();
  await expect(upload).toBeHidden();
  await expect(page.getByRole("heading", { name: "Full-Stack Resume" })).toBeVisible();

  // Rejects a file that only pretends to be a PDF.
  await page.getByRole("button", { name: "Add document" }).click();
  await upload
    .getByLabel("File")
    .setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html></html>") });
  await upload.getByRole("button", { name: "Upload" }).click();
  await expect(upload.getByText("This file is not a valid PDF.")).toBeVisible();
  await upload.getByRole("button", { name: "Cancel" }).click();

  // The owner can download it.
  await page.getByRole("button", { name: "Details" }).click();
  const downloadHref = await page.getByRole("link", { name: "Download" }).getAttribute("href");
  expect(downloadHref).toMatch(/^\/api\/documents\/[0-9a-f-]{36}\/download$/);
  const ownerResponse = await page.request.get(downloadHref!);
  expect(ownerResponse.status()).toBe(200);
  expect(ownerResponse.headers()["content-type"]).toContain("application/pdf");
  expect(ownerResponse.headers()["content-disposition"]).toContain("attachment");
  await page.keyboard.press("Escape");

  // Attach the exact version to the application.
  await page.goto(`${applicationUrl}?tab=documents`);
  await page.getByLabel("Document version").selectOption({ label: "Full-Stack Resume · v1" });
  await page.getByRole("button", { name: "Attach" }).click();
  await expect(page.getByText("Full-Stack Resume · v1")).toBeVisible();
  await expect(page.getByText("Submitted", { exact: true })).toBeVisible();

  // Record an offer and accept it: the application closes as accepted.
  await page.getByRole("link", { name: "Offers", exact: true }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Record offer" }).click();
  const offerDialog = page.getByRole("dialog", { name: "Record an offer" });
  await offerDialog.getByLabel("Base salary").fill("165000");
  await offerDialog.getByLabel("Pay period").selectOption("MONTHLY");
  await offerDialog.getByRole("button", { name: "Save offer" }).click();
  await expect(offerDialog).toBeHidden();
  await expect(page.getByText("₱165,000/mo")).toBeVisible();
  await page.getByRole("button", { name: "Offer actions" }).click();
  await page.getByRole("menuitem", { name: "Accept offer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Accept offer" }).click();
  await expect(page.getByText("Accepted").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();

  // A different user gets 404 for the same document and cannot see the application.
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  const otherAccount = newAccount("Intruder");
  await registerAndOnboard(other, otherAccount);
  expect((await other.request.get(downloadHref!)).status()).toBe(404);
  await other.goto(applicationUrl);
  await expect(other.getByRole("heading", { name: "We couldn't find that" })).toBeVisible();

  // The other user deletes their account.
  await other.goto("/settings/account");
  await other.getByLabel(`Type ${otherAccount.email} to confirm`).fill(otherAccount.email);
  await other.getByLabel("Password").fill(otherAccount.password);
  await other.getByRole("button", { name: "Delete my account permanently" }).click();
  await expect(other).toHaveURL(/\/\?deleted=1/);
  await expect(other.getByText("Your account and its data were deleted.")).toBeVisible();
  await otherContext.close();
});
