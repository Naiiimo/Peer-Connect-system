import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/groups/$id")({ component: GroupDetail });

function GroupDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data: g } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
    setGroup(g);
    const { data: m } = await supabase.from("group_messages").select("*, sender:profiles!group_messages_sender_id_fkey(full_name,photo_url)").eq("group_id", id).order("created_at");
    setMsgs(m ?? []);
    const { data: d } = await supabase.from("group_documents").select("*, uploader:profiles!group_documents_uploader_id_fkey(full_name)").eq("group_id", id).order("created_at", { ascending: false });
    setDocs(d ?? []);
  };
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    const ch = supabase.channel(`grp:${id}`).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${id}` },
      (p) => setMsgs((prev) => [...prev, p.new as any])
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !user) return;
    const { error } = await supabase.from("group_messages").insert({ group_id: id, sender_id: user.id, body });
    if (!error) setBody("");
  };

  const uploadDoc = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("library").upload(path, file);
    if (upErr) return toast.error(upErr.message);
    await supabase.from("group_documents").insert({ group_id: id, uploader_id: user.id, name: file.name, path });
    toast.success("Uploaded");
    load();
  };

  const openDoc = async (path: string) => {
    const { data } = await supabase.storage.from("library").createSignedUrl(path, 60 * 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div>
      <PageHeader title={group?.name ?? "Group"} description={group?.topic} />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="card-elevated flex min-h-0 flex-col overflow-hidden" style={{ height: "65vh" }}>
          <div className="flex-1 overflow-y-auto p-4">
            {msgs.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`mb-2 flex ${mine ? "justify-end" : ""}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    {!mine && <div className="text-[10px] font-medium opacity-70">{m.sender?.full_name}</div>}
                    {m.body}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
            <Input value={body} onChange={(e)=>setBody(e.target.value)} placeholder="Message the group…" />
            <Button size="icon" type="submit"><Send className="h-4 w-4" /></Button>
          </form>
        </section>

        <aside className="card-elevated p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium">Documents</h3>
            <label className="cursor-pointer">
              <input type="file" hidden onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0])} />
              <Button asChild size="sm" variant="outline"><span><Upload className="mr-1 h-3 w-3" /> Upload</span></Button>
            </label>
          </div>
          <ul className="space-y-2">
            {docs.length === 0 && <p className="text-xs text-muted-foreground">No documents shared yet.</p>}
            {docs.map((d) => (
              <li key={d.id}>
                <button onClick={() => openDoc(d.path)} className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-secondary/60">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{d.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
