import "server-only";
import { requireWorkspace } from "@/features/workspace/data";
import { DomainError, NotFoundError } from "@/lib/action-result";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { normalizeCompanyName } from "./normalize";
import type { CompanyInput } from "./schemas";

/** Returns the user's company with this name, creating it when missing. */
export async function findOrCreateCompany(
  tx: TransactionClient,
  userId: string,
  name: string,
): Promise<string> {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeCompanyName(trimmed);
  const company = await tx.company.upsert({
    where: { userId_normalizedName: { userId, normalizedName } },
    create: { userId, name: trimmed, normalizedName },
    update: {},
    select: { id: true },
  });
  return company.id;
}

/** Sets a company's website only when it has none (never overwrites what the user entered). */
export async function setCompanyWebsiteIfEmpty(
  tx: TransactionClient,
  userId: string,
  companyId: string,
  website: string,
): Promise<void> {
  await tx.company.updateMany({ where: { id: companyId, userId, website: null }, data: { website } });
}

export type CompanySummary = {
  id: string;
  name: string;
  website: string | null;
  location: string | null;
  industry: string | null;
  notes: string | null;
  opportunityCount: number;
  contactCount: number;
};

export async function listCompanies(): Promise<CompanySummary[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.company.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      website: true,
      location: true,
      industry: true,
      notes: true,
      _count: { select: { opportunities: true, contacts: true } },
    },
  });
  return rows.map(({ _count, ...company }) => ({
    ...company,
    opportunityCount: _count.opportunities,
    contactCount: _count.contacts,
  }));
}

/** Company names for autocomplete in job forms. */
export async function listCompanyNames(): Promise<string[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.company.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  return rows.map((row) => row.name);
}

export async function createCompany(input: CompanyInput): Promise<string> {
  const { user } = await requireWorkspace();
  const normalizedName = normalizeCompanyName(input.name);
  const existing = await prisma.company.findUnique({
    where: { userId_normalizedName: { userId: user.id, normalizedName } },
    select: { id: true },
  });
  if (existing) throw new DomainError("A company with this name already exists.");
  const company = await prisma.company.create({
    data: { userId: user.id, ...input, normalizedName },
    select: { id: true },
  });
  return company.id;
}

export async function updateCompany(companyId: string, input: CompanyInput): Promise<void> {
  const { user } = await requireWorkspace();
  const normalizedName = normalizeCompanyName(input.name);
  const clash = await prisma.company.findFirst({
    where: { userId: user.id, normalizedName, id: { not: companyId } },
    select: { id: true },
  });
  if (clash) throw new DomainError("Another company already uses this name.");
  const { count } = await prisma.company.updateMany({
    where: { id: companyId, userId: user.id },
    data: { ...input, normalizedName },
  });
  if (count === 0) throw new NotFoundError("Company");
}

/**
 * Deletes a company and its contacts. Refused while jobs still reference
 * it, so deleting a company can never wipe application histories.
 */
export async function deleteCompany(companyId: string): Promise<void> {
  const { user } = await requireWorkspace();
  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: user.id },
    select: { _count: { select: { opportunities: true } } },
  });
  if (!company) throw new NotFoundError("Company");
  if (company._count.opportunities > 0) {
    throw new DomainError("Move or delete this company's jobs before deleting the company.");
  }
  await prisma.company.deleteMany({ where: { id: companyId, userId: user.id } });
}
