"use client";

import { useSearchParams } from "next/navigation";

export function DeletedNotice() {
  if (useSearchParams().get("deleted") !== "1") return null;
  return (
    <p
      role="status"
      className="mx-auto mt-2 max-w-6xl rounded-xl border border-[#dce9df] bg-[#eef6ef] px-4 py-3 text-xs text-[#246449]"
    >
      Your account and its data were deleted. Thanks for using JobTrack.
    </p>
  );
}
