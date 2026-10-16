import { extensionJson, withExtensionAuth } from "@/features/extension/api";
import { getExtensionProfile } from "@/features/extension/data";

/** Profile, default currency and pipeline stages for the extension popup. */
export async function GET(request: Request) {
  return withExtensionAuth(request, async ({ workspace }) =>
    extensionJson(await getExtensionProfile(workspace)),
  );
}
