import "server-only";
import type { ContactKind } from "@/generated/prisma/enums";
import { findOrCreateCompany } from "@/features/companies/data";
import { requireWorkspace } from "@/features/workspace/data";
import { NotFoundError } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import type { ContactInput } from "./schemas";

export type ContactDto = {
  id: string;
  name: string;
  title: string | null;
  kind: ContactKind;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  companyId: string;
  companyName: string;
  interviewCount: number;
};

export async function listContacts(): Promise<ContactDto[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.contact.findMany({
    where: { userId: user.id },
    orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      title: true,
      kind: true,
      email: true,
      phone: true,
      linkedinUrl: true,
      notes: true,
      companyId: true,
      company: { select: { name: true } },
      _count: { select: { interviews: true } },
    },
  });
  return rows.map(({ company, _count, ...contact }) => ({
    ...contact,
    companyName: company.name,
    interviewCount: _count.interviews,
  }));
}

/** Contacts at one company (interview attendee picker). */
export async function listCompanyContacts(
  companyId: string,
): Promise<{ id: string; name: string; title: string | null }[]> {
  const { user } = await requireWorkspace();
  return prisma.contact.findMany({
    where: { userId: user.id, companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, title: true },
  });
}

function columns(input: ContactInput) {
  return {
    name: input.name,
    title: input.title ?? null,
    kind: input.kind,
    email: input.email ?? null,
    phone: input.phone ?? null,
    linkedinUrl: input.linkedinUrl ?? null,
    notes: input.notes ?? null,
  };
}

export async function createContact(input: ContactInput): Promise<string> {
  const { user } = await requireWorkspace();
  return prisma.$transaction(async (tx) => {
    const companyId = await findOrCreateCompany(tx, user.id, input.companyName);
    const contact = await tx.contact.create({
      data: { userId: user.id, companyId, ...columns(input) },
      select: { id: true },
    });
    return contact.id;
  });
}

export async function updateContact(contactId: string, input: ContactInput): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.contact.findFirst({
      where: { id: contactId, userId: user.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Contact");
    const companyId = await findOrCreateCompany(tx, user.id, input.companyName);
    await tx.contact.update({ where: { id: existing.id }, data: { companyId, ...columns(input) } });
  });
}

export async function deleteContact(contactId: string): Promise<void> {
  const { user } = await requireWorkspace();
  const { count } = await prisma.contact.deleteMany({ where: { id: contactId, userId: user.id } });
  if (count === 0) throw new NotFoundError("Contact");
}
