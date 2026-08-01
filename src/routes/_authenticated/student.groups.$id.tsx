import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { ProfileDialog } from "@/components/ProfileDialog";

export const Route = createFileRoute("/_authenticated/student/groups/$id")({ component: GroupDetail });

function GroupDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const [viewProfile, setViewProfile] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data: g } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
    setGroup(g);
    const { data: m } = await supabase.from("group_messages").select("*, sender:profiles!group_messages_sender_id_fkey(full_name,photo_url)").eq("group_id", id).order("created_at");
    setMsgs(m ?? []);
    const { data: d } = await supabase.from("group_documents").select("*, uploader:profiles!group_documents_uploader_id_fkey(full_name)").eq("group_id", id).order("created_at", { ascending: false });
    setDocs(d ?? []);
    const { data: memberships } = await supabase.from("group_members").select("user_id").eq("group_id", id);
    const memberIds = (memberships ?? []).map((m: any) => m.user_id);
    const { data: memberProfiles } = memberIds.length
      ? await supabase.from("profiles").select("id,full_name,photo_url,role").in("id", memberIds)
      : { data: [] as any[] };
    setMembers(memberProfiles ?? []);
  };
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    const ch = supabase.channel(`grp:${id}`).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${id}` },
      () => load()
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !user) return;
    const { error } = await supabase.from("group_messages").insert({ group_id: id, sender_id: user.id, body });
    if (error) return toast.error(error.message);
    setBody("");
  };

  const uploadDoc = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("library").upload(path, file);
    if (upErr) return toast.error(upErr.message);
    const { error: docErr } = await supabase.from("group_documents").insert({ group_id: id, uploader_id: user.id, name: file.name, path });
    if (docErr) {
      await supabase.storage.from("library").remove([path]);
      return toast.error(docErr.message);
    }
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
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="card-elevated flex min-h-0 flex-col overflow-hidden" style={{ height: "65vh" }}>
          <div className="flex-1 overflow-y-auto p-4">
            {msgs.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`mb-2 flex ${mine ? "justify-end" : ""}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    {!mine && <button type="button" onClick={() => setViewProfile(m.sender_id)} className="text-[10px] font-medium opacity-70 hover:underline">{m.sender?.full_name ?? "Group member"}</button>}
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

        <aside className="space-y-5">
          <section className="card-elevated p-4">
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
          </section>
          <section className="card-elevated p-4">
            <h3 className="mb-2 font-medium">Members</h3>
            <ul className="space-y-1">
              {members.map((member) => (
                <li key={member.id}>
                  <Button variant="ghost" className="h-auto w-full justify-start gap-2 px-2 py-2" onClick={() => setViewProfile(member.id)}>
                    <img src={member.photo_url ?? `https://api.dicebear.com/9.x/initials/svg?seed=${member.full_name}`} className="h-7 w-7 rounded-full object-cover" alt="" />
                    <span className="min-w-0 truncate text-sm">{member.full_name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      <ProfileDialog userId={viewProfile} open={!!viewProfile} onOpenChange={(open) => !open && setViewProfile(null)} />
    </div>
  );
}
