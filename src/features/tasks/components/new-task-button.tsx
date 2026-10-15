"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TaskTarget } from "../data";
import { TaskDialog } from "./task-dialog";

interface NewTaskButtonProps {
  targets: TaskTarget[];
  defaultDueDate: string;
  defaultReminderMinutes: number;
  applicationId?: string;
  label?: string;
}

export function NewTaskButton({
  targets,
  defaultDueDate,
  defaultReminderMinutes,
  applicationId,
  label = "New task",
}: NewTaskButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> {label}
      </Button>
      <TaskDialog
        open={open}
        onOpenChange={setOpen}
        targets={targets}
        defaultValues={{
          title: "",
          type: applicationId ? "FOLLOW_UP" : "OTHER",
          priority: "MEDIUM",
          dueDate: defaultDueDate,
          dueTime: "",
          applicationId: applicationId ?? "",
          reminderMinutesBefore: String(defaultReminderMinutes),
        }}
      />
    </>
  );
}
