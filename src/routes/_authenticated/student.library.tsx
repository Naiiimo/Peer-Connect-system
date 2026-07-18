import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/library")({ component: Library });

function Library() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("library_documents").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
    setDocs(data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const upload = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("library").upload(path, file);
    if (error) return toast.error(error.message);
    await supabase.from("library_documents").insert({ owner_id: user.id, name: file.name, path, source: "upload" });
    toast.success("Uploaded"); load();
  };

  const open = async (path: string) => {
    const { data } = await supabase.storage.from("library").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const remove = async (d: any) => {
    await supabase.storage.from("library").remove([d.path]);
    await supabase.from("library_documents").delete().eq("id", d.id);
    load();
  };

  return (
    <div>
      <PageHeader title="Library" description="Your documents, notes and shared resources." actions={
        <label>
          <input type="file" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button asChild><span><Upload className="mr-1 h-4 w-4" /> Upload</span></Button>
        </label>
      } />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {docs.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
        {docs.map((d) => (
          <div key={d.id} className="card-elevated flex items-center gap-3 p-4">
            <FileText className="h-8 w-8 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{d.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{d.source ?? "upload"}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => open(d.path)}>Open</Button>
            <Button size="icon" variant="ghost" onClick={() => remove(d)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
