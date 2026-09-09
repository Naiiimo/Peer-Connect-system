import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    let query = supabase.from("profiles").select("id,full_name,email,role,status,gender,created_at,deleted_at").order("created_at", { ascending: false }).limit(200);
    const { data } = await query;
    let list = data ?? [];
    if (q.trim()) {
      const lc = q.toLowerCase();
      list = list.filter((r: any) => (r.full_name ?? "").toLowerCase().includes(lc) || (r.email ?? "").toLowerCase().includes(lc));
    }
    setRows(list);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const act = async (r: any, status: "active"|"suspended"|"banned") => {
    const patch: any = { status };
    if (status === "suspended") patch.suspended_until = new Date(Date.now() + 7 * 86400000).toISOString();
    const { error } = await supabase.from("profiles").update(patch).eq("id", r.id);
    if (error) return toast.error(error.message);
    if (user) await supabase.from("admin_actions").insert({ admin_id: user.id, target_id: r.id, action: status });
    toast.success(`User ${status}`); load();
  };

  const changeRole = async (r: any, role: string) => {
    if (role === r.role) return;
    const { error } = await (supabase.rpc as any)("admin_set_user_role", { _user_id: r.id, _role: role });
    if (error) return toast.error(error.message);
    toast.success(`${r.full_name ?? "User"} is now a ${role.replace("_", " ")}`);
    load();
  };


  return (
    <div>
      <PageHeader title="Users" description="Suspend or ban misbehaving accounts." />
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="mb-4 flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" />
        <Button type="submit">Search</Button>
      </form>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3">{r.full_name ?? "—"} {r.deleted_at && <Badge variant="destructive" className="ml-1 text-[10px]">Deleted</Badge>}</td>
                <td className="p-3 text-muted-foreground">{r.email}</td>
                <td className="p-3 capitalize">{r.role}</td>
                <td className="p-3"><Badge variant={r.status==="active"?"secondary":r.status==="suspended"?"outline":"destructive"} className="capitalize">{r.status}</Badge></td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-1">
                    {r.status !== "active" && <Button size="sm" variant="outline" onClick={() => act(r, "active")}>Reinstate</Button>}
                    {r.status !== "suspended" && <Button size="sm" variant="outline" onClick={() => act(r, "suspended")}>Suspend</Button>}
                    {r.status !== "banned" && <Button size="sm" variant="destructive" onClick={() => act(r, "banned")}>Ban</Button>}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No users.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
