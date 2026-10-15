"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { fieldAria, FormField, SelectInput, TextArea, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormAlert } from "@/features/auth/components/auth-card";
import { enumOptions, PRIORITY_LABEL, TASK_TYPE_LABEL } from "@/lib/labels";
import { createTaskAction, updateTaskAction } from "../actions";
import type { TaskTarget } from "../data";
import { createTaskSchema, type CreateTaskInput, type TaskFormValues } from "../schemas";

export const TASK_REMINDER_OPTIONS = [
  { value: "", label: "No reminder" },
  { value: "0", label: "At the due time" },
  { value: "15", label: "15 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
];

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: TaskTarget[];
  /** Present when editing. */
  taskId?: string;
  defaultValues: TaskFormValues;
  title?: string;
}

export function TaskDialog({ open, onOpenChange, targets, taskId, defaultValues, title }: TaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{title ?? (taskId ? "Edit task" : "Create a task")}</DialogTitle>
          <DialogDescription className="text-xs">
            Keep the next step visible and actionable.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <TaskForm
            targets={targets}
            taskId={taskId}
            defaultValues={defaultValues}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({
  targets,
  taskId,
  defaultValues,
  onDone,
}: {
  targets: TaskTarget[];
  taskId?: string;
  defaultValues: TaskFormValues;
  onDone: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<TaskFormValues, unknown, CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues,
  });
  const { errors, isSubmitting } = form.formState;

  async function submit(values: CreateTaskInput) {
    setServerError(null);
    const result = taskId ? await updateTaskAction({ ...values, taskId }) : await createTaskAction(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    toast.success(taskId ? "Task updated" : "Task added");
    onDone();
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate className="grid gap-4 sm:grid-cols-2">
      {serverError ? (
        <div className="sm:col-span-2">
          <FormAlert>{serverError}</FormAlert>
        </div>
      ) : null}
      <FormField
        id="task-title"
        label="Task title"
        required
        error={errors.title?.message}
        className="sm:col-span-2"
      >
        <TextInput
          placeholder="e.g. Follow up after technical interview"
          {...fieldAria("task-title", errors.title?.message)}
          {...form.register("title")}
        />
      </FormField>
      <FormField id="task-due" label="Due date" error={errors.dueDate?.message}>
        <TextInput
          type="date"
          {...fieldAria("task-due", errors.dueDate?.message)}
          {...form.register("dueDate")}
        />
      </FormField>
      <FormField id="task-time" label="Due time" hint="Optional, defaults to 9:00 AM.">
        <TextInput type="time" {...fieldAria("task-time", undefined, true)} {...form.register("dueTime")} />
      </FormField>
      <FormField id="task-type" label="Type">
        <SelectInput id="task-type" options={enumOptions(TASK_TYPE_LABEL)} {...form.register("type")} />
      </FormField>
      <FormField id="task-priority" label="Priority">
        <SelectInput
          id="task-priority"
          options={enumOptions(PRIORITY_LABEL).reverse()}
          {...form.register("priority")}
        />
      </FormField>
      <FormField id="task-related" label="Related application" className="sm:col-span-2">
        <SelectInput
          id="task-related"
          placeholder="General task"
          options={targets.map((target) => ({ value: target.applicationId, label: target.label }))}
          {...form.register("applicationId")}
        />
      </FormField>
      <FormField
        id="task-reminder"
        label="Reminder"
        hint="Delivered in-app (and by email if you enabled it)."
      >
        <SelectInput
          id="task-reminder"
          options={TASK_REMINDER_OPTIONS}
          {...form.register("reminderMinutesBefore")}
        />
      </FormField>
      <FormField id="task-description" label="Details" className="sm:col-span-2">
        <TextArea id="task-description" className="min-h-[70px]" {...form.register("description")} />
      </FormField>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : taskId ? "Save task" : "Add task"}
        </Button>
      </div>
    </form>
  );
}
