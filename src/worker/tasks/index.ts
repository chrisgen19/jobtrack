import type { TaskList } from "graphile-worker";
import type { JobName } from "@/lib/jobs/types";
import { deleteUserFilesTask } from "./delete-user-files";
import { sendEmailTask } from "./send-email";

/** Every task the worker can run, keyed by the identifiers in JobPayloads. */
export const taskList: Partial<Record<JobName, TaskList[string]>> = {
  send_email: sendEmailTask,
  delete_user_files: deleteUserFilesTask,
};
