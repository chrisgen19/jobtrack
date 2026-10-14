import { Link2, Mail, Pencil, Phone, Plus, UserRound } from "lucide-react";
import { StatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { CONTACT_KIND_LABEL } from "@/lib/labels";
import type { ContactDto } from "../data";
import { ContactDialog } from "./contact-dialog";
import { DeleteContactButton } from "./delete-contact-button";

export function ContactsPanel({
  contacts,
  companyNames,
}: {
  contacts: ContactDto[];
  companyNames: string[];
}) {
  return (
    <Panel className="pb-3">
      <PanelHeader
        title="Contacts"
        description={`${contacts.length} contact${contacts.length === 1 ? "" : "s"}`}
        action={
          <ContactDialog
            companyNames={companyNames}
            trigger={
              <Button>
                <Plus aria-hidden /> Add contact
              </Button>
            }
          />
        }
      />
      {contacts.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No contacts yet"
          description="Save recruiters and interviewers so you can link them to interviews and follow up."
        />
      ) : (
        <ul>
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className="flex flex-wrap items-center gap-3 border-t border-[#f1f3f0] px-4 py-3 sm:flex-nowrap sm:px-6"
            >
              <span
                className="grid size-9 flex-none place-items-center rounded-full bg-[#d9e9df] text-xs font-bold text-brand"
                aria-hidden
              >
                {contact.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() ?? "")
                  .join("")}
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-xs">{contact.name}</strong>
                <span className="mt-1 block truncate text-[10px] text-[#9aa69d]">
                  {[contact.title, contact.companyName].filter(Boolean).join(" · ")}
                  {contact.interviewCount > 0
                    ? ` · ${contact.interviewCount} interview${contact.interviewCount === 1 ? "" : "s"}`
                    : ""}
                </span>
              </div>
              <StatusBadge label={CONTACT_KIND_LABEL[contact.kind]} tone="purple" />
              <div className="flex items-center gap-0.5">
                {contact.email ? (
                  <Button asChild variant="ghost" size="icon-sm" aria-label={`Email ${contact.name}`}>
                    <a href={`mailto:${contact.email}`}>
                      <Mail aria-hidden />
                    </a>
                  </Button>
                ) : null}
                {contact.phone ? (
                  <Button asChild variant="ghost" size="icon-sm" aria-label={`Call ${contact.name}`}>
                    <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>
                      <Phone aria-hidden />
                    </a>
                  </Button>
                ) : null}
                {contact.linkedinUrl ? (
                  <Button asChild variant="ghost" size="icon-sm" aria-label={`${contact.name} on LinkedIn`}>
                    <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow">
                      <Link2 aria-hidden />
                    </a>
                  </Button>
                ) : null}
                <ContactDialog
                  contact={contact}
                  companyNames={companyNames}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${contact.name}`}>
                      <Pencil aria-hidden />
                    </Button>
                  }
                />
                <DeleteContactButton contactId={contact.id} name={contact.name} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
