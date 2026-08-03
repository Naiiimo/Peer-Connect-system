import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ProfileDialog } from "@/components/ProfileDialog";

export const Route = createFileRoute("/_authenticated/student/groups/$id")({ component: GroupDetail });

const MAX_DOC_BYTES = 20 * 1024 * 1024;

function GroupDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, any>>({});
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewProfile, setViewProfile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  const hydrateProfiles = useCallback(async (ids: string[]) => {
    const missing = ids.filter((x) => x && !profileMap[x]);
    if (missing.length === 0) return profileMap;
    const { data } = await supabase.from("profiles").select("id,full_name,photo_url,role").in("id", Array.from(new Set(missing)));
    const next = { ...profileMap, ...Object.fromEntries((data ?? []).map((p: any) => [p.id, p])) };
    setProfileMap(next);
    return next;
  }, [profileMap]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: g, error: gErr } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
    if (gErr) toast.error(`Could not open this group: ${gErr.message}`);
    setGroup(g);

    const { data: m, error: mErr } = await supabase.from("group_messages").select("*").eq("group_id", id).order("created_at");
    if (mErr) toast.error(mErr.message);
    setMsgs(m ?? []);

    const { data: d, error: dErr } = await supabase.from("group_documents").select("*").eq("group_id", id).order("created_at", { ascending: false });
    if (dErr) toast.error(dErr.message);
    setDocs(d ?? []);

    const { data: memberships } = await supabase.from("group_members").select("user_id").eq("group_id", id);
    const memberIds = (memberships ?? []).map((x: any) => x.user_id);
    const ids = Array.from(new Set([...memberIds, ...(m ?? []).map((x: any) => x.sender_id), ...(d ?? []).map((x: any) => x.uploader_id)]));
    const map = await hydrateProfiles(ids);
    setMembers(memberIds.map((uid: string) => map[uid]).filter(Boolean));
    setLoading(false);
  }, [id, hydrateProfiles]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    const ch = supabase
      .channel(`grp:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${id}` }, async (p) => {
        const m: any = p.new;
        await hydrateProfiles([m.sender_id]);
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") toast.error("Live chat disconnected. Reopen the group to reconnect.");
      });
    return () => { supabase.removeChannel(ch); };
  }, [id, hydrateProfiles]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !user || sending) return;
    setSending(true);
    const { data, error } = await supabase.from("group_messages").insert({ group_id: id, sender_id: user.id, body: body.trim() }).select().maybeSingle();
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
    if (data) setMsgs((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
  };

  const uploadDoc = async (file: File) => {
    if (!user) return;
    if (file.size === 0) return toast.error(`"${file.name}" is empty and cannot be uploaded.`);
    if (file.size > MAX_DOC_BYTES) {
      return toast.error(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 20 MB.`);
    }
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("library").upload(path, file);
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error: docErr } = await supabase.from("group_documents").insert({ group_id: id, uploader_id: user.id, name: file.name, path });
    setUploading(false);
    if (docErr) {
      await supabase.storage.from("library").remove([path]);
      return toast.error(docErr.message);
    }
    toast.success(`Uploaded ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
    load();
  };

  const openDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("library").createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Could not open this file.");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-2">
        <Link to="/student/groups"><ArrowLeft className="mr-1 h-4 w-4" /> Study groups</Link>
      </Button>
      <PageHeader title={group?.name ?? "Group"} description={group?.topic} />
      {loading && <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Opening group chat…</p>}
      {!loading && !group && <p className="mb-3 text-sm text-destructive">This group is unavailable or you no longer have access.</p>}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="card-elevated flex min-h-0 flex-col overflow-hidden" style={{ height: "65vh" }}>
          <div className="flex-1 overflow-y-auto p-4">
            {msgs.length === 0 && <p className="text-sm text-muted-foreground">No messages yet — say hello.</p>}
            {msgs.map((m) => {
              const mine = m.sender_id === user?.id;
              const sender = profileMap[m.sender_id];
              return (
                <div key={m.id} className={`mb-2 flex ${mine ? "justify-end" : ""}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    {!mine && (
                      <button type="button" onClick={() => setViewProfile(m.sender_id)} className="block text-[10px] font-medium opacity-70 hover:underline">
                        {sender?.full_name ?? "Group member"}
                      </button>
                    )}
                    {m.body}
                    <div className="mt-0.5 text-[9px] opacity-60">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
            <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message the group…" />
            <Button size="icon" type="submit" disabled={sending || !body.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </section>

        <aside className="space-y-5">
          <section className="card-elevated p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium">Documents</h3>
              <label className="cursor-pointer">
                <input type="file" hidden disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadDoc(f); }} />
                <Button asChild size="sm" variant="outline" disabled={uploading}>
                  <span>{uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />} {uploading ? "Uploading…" : "Upload"}</span>
                </Button>
              </label>
            </div>
            <p className="mb-2 text-[10px] text-muted-foreground">Max 20 MB per file.</p>
            <ul className="space-y-2">
              {docs.length === 0 && <p className="text-xs text-muted-foreground">No documents shared yet.</p>}
              {docs.map((d) => (
                <li key={d.id}>
                  <button onClick={() => openDoc(d.path)} className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-secondary/60">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {d.name}
                      <span className="block text-[10px] text-muted-foreground">{profileMap[d.uploader_id]?.full_name ?? "Member"}</span>
                    </span>
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
