"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { QuickAddOptions } from "../data";
import { QuickAddDialog } from "./quick-add-dialog";

export function QuickAddButton({ options }: { options: QuickAddOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} className="px-2.5 sm:px-3.5">
        <Plus aria-hidden /> <span className="sr-only sm:not-sr-only">Add a job</span>
      </Button>
      <QuickAddDialog options={options} open={open} onOpenChange={setOpen} />
    </>
  );
}
