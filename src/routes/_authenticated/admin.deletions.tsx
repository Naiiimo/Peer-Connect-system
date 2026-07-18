import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/deletions")({ component: Deletions });

function Deletions() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("id,full_name,email,role,deleted_at").not("deleted_at","is",null).order("deleted_at",{ascending:false}).then(({data}) => setRows(data ?? []));
  }, []);
  return (
    <div>
      <PageHeader title="Deleted accounts" description="Users who removed their accounts." />
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Deleted</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No deletions.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3">{r.full_name ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{r.email}</td>
                <td className="p-3"><Badge variant="secondary" className="capitalize">{r.role}</Badge></td>
                <td className="p-3 text-muted-foreground">{new Date(r.deleted_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
