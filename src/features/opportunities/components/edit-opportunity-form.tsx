"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOpportunityAction } from "../actions";
import type { QuickAddFormValues } from "../schemas";
import { OpportunityForm } from "./opportunity-form";

interface EditOpportunityFormProps {
  opportunityId: string;
  companyNames: string[];
  defaultValues: Partial<QuickAddFormValues>;
}

export function EditOpportunityForm({
  opportunityId,
  companyNames,
  defaultValues,
}: EditOpportunityFormProps) {
  const router = useRouter();
  return (
    <OpportunityForm
      mode="edit"
      opportunityId={opportunityId}
      companyNames={companyNames}
      defaultValues={defaultValues}
      expanded
      submitLabel="Save changes"
      onCancel={() => router.push(`/jobs/${opportunityId}`)}
      onSubmit={async (values) => {
        const result = await updateOpportunityAction(opportunityId, values);
        if (result.ok) {
          toast.success("Job updated");
          router.push(`/jobs/${opportunityId}`);
        }
        return result;
      }}
    />
  );
}
