import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Trash2, Pencil, Check, CheckCheck, X } from "lucide-react";
import { toast } from "sonner";

export function Messenger() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Contacts = accepted connections (both directions) + group members not implemented here (1:1 only)
      const { data: conns } = await supabase.from("connections").select("student_id,tutor_id,status").in("status", ["accepted","pending"]).or(`student_id.eq.${user.id},tutor_id.eq.${user.id}`);
      const ids = new Set<string>();
      (conns ?? []).forEach((c: any) => { ids.add(c.student_id === user.id ? c.tutor_id : c.student_id); });
      if (ids.size === 0) { setContacts([]); return; }
      const { data: profs } = await supabase.from("profiles").select("id,full_name,photo_url,role").in("id", Array.from(ids));
      setContacts(profs ?? []);
      if (!selected && profs?.[0]) setSelected(profs[0].id);
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !selected) return;
    (async () => {
      const { data } = await supabase.from("messages").select("*")
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${selected}),and(sender_id.eq.${selected},recipient_id.eq.${user.id})`)
        .order("created_at");
      setMessages(data ?? []);
      await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("recipient_id", user.id).eq("sender_id", selected).is("read_at", null);
    })();
    const ch = supabase.channel(`dm:${selected}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m: any = p.new;
        if ((m.sender_id === user.id && m.recipient_id === selected) || (m.sender_id === selected && m.recipient_id === user.id)) {
          setMessages((prev) => [...prev, m]);
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => {
        const m: any = p.old;
        setMessages((prev) => prev.filter((x) => x.id !== m.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, selected]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !user || !selected) return;
    const { error } = await supabase.from("messages").insert({ sender_id: user.id, recipient_id: selected, body });
    if (!error) {
      setBody("");
      // Route the recipient to their own messages inbox based on their role.
      const { data: rec } = await supabase.from("profiles").select("role").eq("id", selected).maybeSingle();
      const link = rec?.role === "tutor" ? "/tutor/messages" : rec?.role === "admin" ? "/admin" : "/student/messages";
      await supabase.from("notifications").insert({ user_id: selected, kind: "message", title: "New message", body: body.slice(0,120), link });
    }
  };

  return (
    <div className="card-elevated grid overflow-hidden md:grid-cols-[240px_1fr]" style={{ height: "70vh" }}>
      <aside className="border-r border-border">
        <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Conversations</div>
        <ul className="overflow-y-auto">
          {contacts.length === 0 && <li className="p-4 text-sm text-muted-foreground">No conversations yet.</li>}
          {contacts.map((c) => (
            <li key={c.id}>
              <button onClick={() => setSelected(c.id)} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/60 ${selected === c.id ? "bg-secondary" : ""}`}>
                <img src={c.photo_url ?? `https://api.dicebear.com/9.x/initials/svg?seed=${c.full_name}`} className="h-8 w-8 rounded-full object-cover" alt="" />
                <div className="min-w-0">
                  <div className="truncate">{c.full_name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.role}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="flex min-h-0 flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          {!selected && <p className="text-sm text-muted-foreground">Pick a conversation.</p>}
          {messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`group mb-2 flex items-end gap-1 ${mine ? "justify-end" : ""}`}>
                {mine && (
                  <button
                    type="button"
                    onClick={async () => {
                      const { error } = await supabase.from("messages").delete().eq("id", m.id);
                      if (error) return toast.error(error.message);
                      setMessages((prev) => prev.filter((x) => x.id !== m.id));
                    }}
                    className="opacity-0 transition group-hover:opacity-100"
                    aria-label="Delete message"
                    title="Delete message"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
                <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {m.body}
                  <div className="mt-0.5 text-[9px] opacity-70">{new Date(m.created_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</div>
                </div>
                {!mine && (
                  <button
                    type="button"
                    onClick={async () => {
                      const { error } = await supabase.from("messages").delete().eq("id", m.id);
                      if (error) return toast.error(error.message);
                      setMessages((prev) => prev.filter((x) => x.id !== m.id));
                    }}
                    className="opacity-0 transition group-hover:opacity-100"
                    aria-label="Delete message"
                    title="Delete message"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
          <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder={selected ? "Type a message…" : "Select a conversation"} disabled={!selected} />
          <Button type="submit" size="icon" disabled={!selected || !body.trim()}><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </div>
  );
}
