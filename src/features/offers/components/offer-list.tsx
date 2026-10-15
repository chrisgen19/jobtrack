"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, MoreHorizontal, Plus, Target } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { OfferStatus } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DetailFact } from "@/components/shared/detail-fact";
import { EmptyState } from "@/components/shared/empty-state";
import { fieldAria, FormField, SelectInput, TextArea, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormAlert } from "@/features/auth/components/auth-card";
import { formatDateOnly } from "@/lib/dates";
import { enumOptions, OFFER_STATUS_LABEL, SALARY_BASIS_LABEL } from "@/lib/labels";
import { COMMON_CURRENCIES, formatMoney, PERIOD_LABEL, PERIOD_SUFFIX } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createOfferAction, decideOfferAction, setOfferStatusAction } from "../actions";
import type { OfferDto } from "../data";
import { offerFormSchema, type OfferFormInput, type OfferFormOutput } from "../schemas";

const STATUS_TONE: Record<OfferStatus, "green" | "amber" | "neutral" | "red" | "blue"> = {
  RECEIVED: "blue",
  NEGOTIATING: "amber",
  ACCEPTED: "green",
  DECLINED: "neutral",
  EXPIRED: "neutral",
  RESCINDED: "red",
};

interface OfferListProps {
  applicationId: string;
  offers: OfferDto[];
  defaults: { positionTitle: string; currency: string; today: string };
  applicationClosed: boolean;
}

export function OfferList({ applicationId, offers, defaults, applicationClosed }: OfferListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [decision, setDecision] = useState<{ offer: OfferDto; decision: "ACCEPTED" | "DECLINED" } | null>(
    null,
  );
  const latest = offers[0];
  const decided = latest && (latest.status === "ACCEPTED" || latest.status === "DECLINED");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <strong className="text-[13px]">
          {offers.length === 0
            ? "No offer yet"
            : `${offers.length} revision${offers.length === 1 ? "" : "s"}`}
        </strong>
        {!decided ? (
          <Button variant="outline" onClick={() => setFormOpen(true)}>
            <Plus aria-hidden /> {latest ? "Record revised offer" : "Record offer"}
          </Button>
        ) : null}
      </div>
      {offers.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No offer recorded"
          description="When an offer arrives, record its amount, benefits and decision deadline here."
          className="py-8"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {offers.map((offer, index) => (
            <li
              key={offer.id}
              className={cn(
                "rounded-[11px] border border-[#e8eee6] p-4",
                index === 0 && "border-[#c8dccc] bg-[#fbfdfa]",
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <strong className="text-[13px]">{offer.positionTitle}</strong>
                  <span className="mt-0.5 block text-[10px] text-[#8b9f92]">
                    Revision {offer.revisionNumber} · received {formatDateOnly(offer.receivedOn)}
                    {index > 0 ? " · superseded" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusBadge label={OFFER_STATUS_LABEL[offer.status]} tone={STATUS_TONE[offer.status]} />
                  {index === 0 && (offer.status === "RECEIVED" || offer.status === "NEGOTIATING") ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Offer actions">
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setDecision({ offer, decision: "ACCEPTED" })}>
                          Accept offer
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setDecision({ offer, decision: "DECLINED" })}>
                          Decline offer
                        </DropdownMenuItem>
                        {offer.status !== "NEGOTIATING" ? (
                          <DropdownMenuItem onSelect={() => setStatus(offer.id, "NEGOTIATING")}>
                            Mark as negotiating
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onSelect={() => setStatus(offer.id, "EXPIRED")}>
                          Mark as expired
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStatus(offer.id, "RESCINDED")}>
                          Employer withdrew it
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <DetailFact label="Base salary">
                  {offer.baseSalary
                    ? `${formatMoney(offer.baseSalary, offer.currency)}${PERIOD_SUFFIX[offer.salaryPeriod]}`
                    : "Not recorded"}
                </DetailFact>
                <DetailFact label="Basis">{SALARY_BASIS_LABEL[offer.salaryBasis]}</DetailFact>
                <DetailFact label="Start date">
                  {offer.startDate ? formatDateOnly(offer.startDate) : "TBC"}
                </DetailFact>
                <DetailFact label="Decide by">
                  {offer.decisionDeadline ? formatDateOnly(offer.decisionDeadline) : "No deadline"}
                </DetailFact>
              </div>
              {offer.bonus || offer.equity || offer.benefits ? (
                <dl className="mt-3 grid gap-1.5 text-[11px] text-[#74877a]">
                  {offer.bonus ? <OfferLine label="Bonus" value={offer.bonus} /> : null}
                  {offer.equity ? <OfferLine label="Equity" value={offer.equity} /> : null}
                  {offer.benefits ? <OfferLine label="Benefits" value={offer.benefits} /> : null}
                </dl>
              ) : null}
              {offer.negotiationNotes ? (
                <p className="mt-3 rounded-[9px] bg-[#f4f7f2] p-2.5 text-[11px] whitespace-pre-wrap text-[#74877a]">
                  {offer.negotiationNotes}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{latest ? "Record a revised offer" : "Record an offer"}</DialogTitle>
            <DialogDescription className="text-xs">
              {latest
                ? "The previous revision is kept unchanged for your records."
                : "The application moves to your offer stage."}
            </DialogDescription>
          </DialogHeader>
          {formOpen ? (
            <OfferForm
              defaultValues={{
                positionTitle: latest?.positionTitle ?? defaults.positionTitle,
                baseSalary: latest?.baseSalary ?? "",
                currency: latest?.currency ?? defaults.currency,
                salaryPeriod: latest?.salaryPeriod ?? "ANNUALLY",
                salaryBasis: latest?.salaryBasis ?? "GROSS",
                bonus: latest?.bonus ?? "",
                equity: latest?.equity ?? "",
                benefits: latest?.benefits ?? "",
                startDate: latest?.startDate ?? "",
                decisionDeadline: latest?.decisionDeadline ?? "",
                receivedOn: defaults.today,
                negotiationNotes: "",
              }}
              onCancel={() => setFormOpen(false)}
              onSubmit={async (values) => {
                const result = await createOfferAction({ ...values, applicationId });
                if (result.ok) {
                  toast.success(latest ? "Revised offer recorded" : "Offer recorded");
                  setFormOpen(false);
                }
                return result;
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={decision !== null}
        onOpenChange={(open) => (open ? undefined : setDecision(null))}
        title={decision?.decision === "ACCEPTED" ? "Accept this offer?" : "Decline this offer?"}
        confirmLabel={decision?.decision === "ACCEPTED" ? "Accept offer" : "Decline offer"}
        description={
          applicationClosed
            ? `The application is already closed; its outcome will be set to “${decision?.decision === "ACCEPTED" ? "Accepted" : "Offer declined"}”. Your other applications are not changed.`
            : `This closes the application as “${decision?.decision === "ACCEPTED" ? "Accepted" : "Offer declined"}”. Your other applications are not changed.`
        }
        onConfirm={async () => {
          if (!decision) return;
          const result = await decideOfferAction({ offerId: decision.offer.id, decision: decision.decision });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(
            decision.decision === "ACCEPTED" ? "Congratulations on the new role!" : "Offer declined",
          );
          setDecision(null);
        }}
      />
    </div>
  );
}

async function setStatus(offerId: string, status: "NEGOTIATING" | "EXPIRED" | "RESCINDED") {
  const result = await setOfferStatusAction({ offerId, status });
  if (result.ok) toast.success("Offer updated");
  else toast.error(result.error);
}

function OfferLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 flex-none font-bold text-[#657c6b]">{label}</dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

function OfferForm({
  defaultValues,
  onSubmit,
  onCancel,
}: {
  defaultValues: OfferFormInput;
  onSubmit: (values: OfferFormOutput) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<OfferFormInput, unknown, OfferFormOutput>({
    resolver: zodResolver(offerFormSchema),
    defaultValues,
  });
  const { errors, isSubmitting } = form.formState;
  const err = (name: keyof OfferFormInput) => errors[name]?.message as string | undefined;

  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={form.handleSubmit(async (values) => {
        setError(null);
        const result = await onSubmit(values);
        if (!result.ok) setError(result.error ?? "Could not save the offer.");
      })}
    >
      {error ? (
        <div className="sm:col-span-2">
          <FormAlert>{error}</FormAlert>
        </div>
      ) : null}
      <FormField
        id="offer-title"
        label="Offered position"
        required
        error={err("positionTitle")}
        className="sm:col-span-2"
      >
        <TextInput {...fieldAria("offer-title", err("positionTitle"))} {...form.register("positionTitle")} />
      </FormField>
      <FormField id="offer-salary" label="Base salary" error={err("baseSalary")}>
        <TextInput
          inputMode="decimal"
          placeholder="1500000"
          {...fieldAria("offer-salary", err("baseSalary"))}
          {...form.register("baseSalary")}
        />
      </FormField>
      <FormField id="offer-currency" label="Currency" error={err("currency")}>
        <TextInput
          list="offer-currencies"
          maxLength={3}
          className="uppercase"
          {...fieldAria("offer-currency", err("currency"))}
          {...form.register("currency")}
        />
        <datalist id="offer-currencies">
          {COMMON_CURRENCIES.map((code) => (
            <option key={code} value={code} />
          ))}
        </datalist>
      </FormField>
      <FormField id="offer-period" label="Pay period">
        <SelectInput
          id="offer-period"
          options={Object.entries(PERIOD_LABEL).map(([value, label]) => ({ value, label }))}
          {...form.register("salaryPeriod")}
        />
      </FormField>
      <FormField id="offer-basis" label="Basis">
        <SelectInput
          id="offer-basis"
          options={enumOptions(SALARY_BASIS_LABEL)}
          {...form.register("salaryBasis")}
        />
      </FormField>
      <FormField id="offer-received" label="Received on" error={err("receivedOn")}>
        <TextInput
          type="date"
          {...fieldAria("offer-received", err("receivedOn"))}
          {...form.register("receivedOn")}
        />
      </FormField>
      <FormField id="offer-deadline" label="Decision deadline" error={err("decisionDeadline")}>
        <TextInput
          type="date"
          {...fieldAria("offer-deadline", err("decisionDeadline"))}
          {...form.register("decisionDeadline")}
        />
      </FormField>
      <FormField id="offer-start" label="Start date">
        <TextInput type="date" {...fieldAria("offer-start")} {...form.register("startDate")} />
      </FormField>
      <FormField id="offer-bonus" label="Bonus">
        <TextInput
          placeholder="e.g. 13th month + 10% annual"
          {...fieldAria("offer-bonus")}
          {...form.register("bonus")}
        />
      </FormField>
      <FormField id="offer-equity" label="Equity" className="sm:col-span-2">
        <TextInput {...fieldAria("offer-equity")} {...form.register("equity")} />
      </FormField>
      <FormField id="offer-benefits" label="Benefits" className="sm:col-span-2">
        <TextArea
          className="min-h-[60px]"
          placeholder="HMO, leave days, equipment..."
          {...fieldAria("offer-benefits")}
          {...form.register("benefits")}
        />
      </FormField>
      <FormField id="offer-notes" label="Negotiation notes" className="sm:col-span-2">
        <TextArea
          className="min-h-[60px]"
          {...fieldAria("offer-notes")}
          {...form.register("negotiationNotes")}
        />
      </FormField>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <BadgeCheck aria-hidden /> {isSubmitting ? "Saving..." : "Save offer"}
        </Button>
      </div>
    </form>
  );
}
