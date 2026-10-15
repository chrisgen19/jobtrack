import { revalidatePath } from "next/cache";

/**
 * Refreshes every workspace view after a mutation. User data is read per
 * request (not cached with "use cache"), so this mainly makes the client
 * router refetch the current page and previously visited ones.
 */
export function revalidateWorkspace(): void {
  revalidatePath("/", "layout");
}
