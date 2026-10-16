"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SettingsRow } from "@/features/settings/components/settings-card";
import { Button } from "@/components/ui/button";
import { revokeExtensionTokenAction } from "../actions";

export type ConnectionView = { id: string; name: string; connected: string; lastUsed: string };

export function ExtensionConnections({ connections }: { connections: ConnectionView[] }) {
  const [revoking, setRevoking] = useState<ConnectionView | null>(null);

  if (connections.length === 0) {
    return (
      <p className="border-t border-[#edf0eb] pt-4 text-xs text-[#98a69c]">No extensions are connected.</p>
    );
  }

  return (
    <>
      {connections.map((connection) => (
        <SettingsRow
          key={connection.id}
          title={connection.name}
          description={`Connected ${connection.connected} · Last used ${connection.lastUsed}`}
          action={
            <Button variant="outline" onClick={() => setRevoking(connection)}>
              Disconnect
            </Button>
          }
        />
      ))}
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Disconnect this extension?"
        description="It will stop saving jobs to your account right away. You can connect it again from the extension."
        confirmLabel="Disconnect"
        destructive
        onConfirm={async () => {
          if (!revoking) return;
          const result = await revokeExtensionTokenAction(revoking.id);
          if (result.ok) toast.success("Extension disconnected.");
          else toast.error(result.error);
          setRevoking(null);
        }}
      />
    </>
  );
}
