"use client";

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClosedBadge, PriorityBadge, SavedBadge, StageBadge, StatusBadge } from "@/components/shared/badges";
import { CompanyLogo } from "@/components/shared/company-logo";
import { formatDateOnly } from "@/lib/dates";
import { WORK_ARRANGEMENT_LABEL } from "@/lib/labels";
import { formatSalaryRange } from "@/lib/money";
import type { OpportunityListRow } from "../data";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});

const helper = createColumnHelper<typeof features, OpportunityListRow>();

const PRIORITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
const CATEGORY_RANK = { APPLIED: 1, SCREENING: 2, ASSESSMENT: 3, INTERVIEW: 4, OFFER: 5, OTHER: 0 } as const;

function stageRank(row: OpportunityListRow): number {
  const latest = row.latestApplication;
  if (!latest) return 0;
  if (latest.status === "CLOSED") return -1;
  return CATEGORY_RANK[latest.stage.category];
}

function StageCell({ row }: { row: OpportunityListRow }) {
  const latest = row.latestApplication;
  if (!latest) return <SavedBadge />;
  if (latest.status === "CLOSED") return <ClosedBadge outcome={latest.outcome} />;
  return (
    <span className="flex items-center gap-1.5">
      <StageBadge name={latest.stage.name} category={latest.stage.category} color={latest.stage.color} />
      {latest.status === "PAUSED" ? <StatusBadge label="Paused" tone="amber" /> : null}
    </span>
  );
}

const columns = helper.columns([
  helper.accessor((row) => `${row.title} ${row.companyName}`, {
    id: "job",
    header: "Job / company",
    sortFn: "alphanumeric",
    cell: ({ row }) => (
      <Link href={`/jobs/${row.original.id}`} className="flex min-w-0 items-center gap-2.5">
        <CompanyLogo name={row.original.companyName} />
        <span className="min-w-0">
          <strong className="block max-w-[260px] truncate text-xs font-bold text-[#243f32]">
            {row.original.title}
          </strong>
          <small className="mt-1 block max-w-[250px] truncate text-[10px] text-[#9aa69d]">
            {row.original.companyName}
            {row.original.location ? ` · ${row.original.location}` : ""}
          </small>
        </span>
      </Link>
    ),
  }),
  helper.accessor((row) => stageRank(row), {
    id: "stage",
    header: "Stage",
    cell: ({ row }) => <StageCell row={row.original} />,
  }),
  helper.accessor((row) => PRIORITY_RANK[row.priority], {
    id: "priority",
    header: "Priority",
    sortDescFirst: true,
    cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
  }),
  helper.accessor(
    (row) =>
      (row.salary.min ?? row.salary.max)
        ? `${row.salary.currency ?? ""}${(row.salary.min ?? row.salary.max)!.padStart(15, "0")}`
        : undefined,
    {
      id: "salary",
      header: "Salary",
      sortUndefined: "last",
      cell: ({ row }) => (
        <span className="text-xs font-bold tracking-[-0.1px] text-[#37483e]">
          {formatSalaryRange({ ...row.original.salary })}
        </span>
      ),
    },
  ),
  helper.accessor((row) => row.workArrangement ?? undefined, {
    id: "work",
    header: "Work type",
    sortUndefined: "last",
    cell: ({ row }) =>
      row.original.workArrangement ? WORK_ARRANGEMENT_LABEL[row.original.workArrangement] : "-",
  }),
  helper.accessor((row) => row.latestApplication?.appliedOn ?? undefined, {
    id: "applied",
    header: "Applied",
    sortDescFirst: true,
    sortUndefined: "last",
    cell: ({ row }) => {
      const latest = row.original.latestApplication;
      if (!latest) return "Not applied";
      return (
        <span>
          {formatDateOnly(latest.appliedOn, "MMM d")}
          {row.original.applicationCount > 1 ? (
            <span className="ml-1 text-[10px] text-faint">· {row.original.applicationCount} attempts</span>
          ) : null}
        </span>
      );
    },
  }),
]);

export function JobsTable({ rows }: { rows: OpportunityListRow[] }) {
  const router = useRouter();
  const table = useTable({
    features,
    columns,
    data: rows,
    initialState: { sorting: [{ id: "applied", desc: true }] },
    enableSortingRemoval: false,
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[850px] border-collapse text-left">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                    className="border-y border-line bg-[#fcfdfb] px-4 py-3 text-[10px] font-bold tracking-[0.5px] text-[#a7b1aa] uppercase first:min-w-[245px]"
                  >
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="inline-flex items-center gap-1 uppercase hover:text-ink"
                    >
                      <table.FlexRender header={header} />
                      {sorted === "asc" ? (
                        <ArrowUp className="size-3" aria-hidden />
                      ) : sorted === "desc" ? (
                        <ArrowDown className="size-3" aria-hidden />
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-40" aria-hidden />
                      )}
                    </button>
                  </th>
                );
              })}
              <th className="border-y border-line bg-[#fcfdfb] px-2" aria-hidden />
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("a,button")) return;
                router.push(`/jobs/${row.original.id}`);
              }}
              className="cursor-pointer border-b border-line-soft last:border-0 hover:bg-[#f9fbf8]"
            >
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3.5 text-[11px] whitespace-nowrap text-[#78877e]">
                  <table.FlexRender cell={cell} />
                </td>
              ))}
              <td className="px-2 text-[#9aa69d]">
                <ChevronRight className="size-4" aria-hidden />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
