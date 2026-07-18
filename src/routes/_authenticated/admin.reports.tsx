import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/reports")({ component: Reports });

function Reports() {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("reports").select("*, reporter:profiles!reports_reporter_id_fkey(full_name), target:profiles!reports_target_id_fkey(full_name)").order("created_at",{ascending:false});
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);
  const resolve = async (id: string, status: "resolved"|"dismissed") => {
    await supabase.from("reports").update({ status }).eq("id", id); load();
  };
  return (
    <div>
      <PageHeader title="Reports & complaints" />
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No reports.</p>}
        {rows.map((r) => (
          <div key={r.id} className="card-elevated p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm"><span className="font-medium">{r.reporter?.full_name ?? "User"}</span> reported <span className="font-medium">{r.target?.full_name ?? "—"}</span></div>
              <Badge variant={r.status==="open"?"secondary":r.status==="resolved"?"default":"outline"} className="capitalize">{r.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground"><span className="font-medium">Reason:</span> {r.reason}</p>
            {r.details && <p className="mt-1 text-sm text-muted-foreground">{r.details}</p>}
            {r.status === "open" && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => resolve(r.id, "resolved")}>Mark resolved</Button>
                <Button size="sm" variant="outline" onClick={() => resolve(r.id, "dismissed")}>Dismiss</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
