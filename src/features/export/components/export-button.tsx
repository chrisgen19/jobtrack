import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Downloads the signed-in user's applications as CSV (owner-scoped route). */
export function ExportButton({ label = "Export CSV" }: { label?: string }) {
  return (
    <Button asChild variant="outline">
      <a href="/api/export/applications.csv" download>
        <Download aria-hidden /> {label}
      </a>
    </Button>
  );
}
