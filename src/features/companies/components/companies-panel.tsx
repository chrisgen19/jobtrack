import { Building2, ExternalLink, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { CompanyLogo } from "@/components/shared/company-logo";
import { EmptyState } from "@/components/shared/empty-state";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import type { CompanySummary } from "../data";
import { CompanyDialog } from "./company-dialog";
import { DeleteCompanyButton } from "./delete-company-button";

export function CompaniesPanel({ companies }: { companies: CompanySummary[] }) {
  return (
    <Panel className="pb-3">
      <PanelHeader
        title="Companies"
        description={`${companies.length} compan${companies.length === 1 ? "y" : "ies"} in your workspace`}
        action={
          <CompanyDialog
            trigger={
              <Button variant="outline">
                <Plus aria-hidden /> Add company
              </Button>
            }
          />
        }
      />
      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Companies are created automatically when you save a job."
        />
      ) : (
        <ul>
          {companies.map((company) => (
            <li
              key={company.id}
              className="flex items-center gap-3 border-t border-[#f1f3f0] px-4 py-3 sm:px-6"
            >
              <CompanyLogo name={company.name} />
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-xs">{company.name}</strong>
                <span className="mt-1 block truncate text-[10px] text-[#9aa69d]">
                  {[company.industry, company.location].filter(Boolean).join(" · ") || "No details yet"}
                </span>
              </div>
              <Link
                href={`/jobs?q=${encodeURIComponent(company.name)}`}
                className="hidden text-[11px] font-semibold text-brand hover:underline sm:inline"
              >
                {company.opportunityCount} job{company.opportunityCount === 1 ? "" : "s"}
              </Link>
              <span className="hidden text-[11px] text-faint sm:inline">
                {company.contactCount} contact{company.contactCount === 1 ? "" : "s"}
              </span>
              {company.website ? (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  aria-label={`${company.name} website`}
                  className="text-[#9aa69d] hover:text-brand"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
              <CompanyDialog
                company={company}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${company.name}`}>
                    <Pencil aria-hidden />
                  </Button>
                }
              />
              <DeleteCompanyButton
                companyId={company.id}
                name={company.name}
                jobCount={company.opportunityCount}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
