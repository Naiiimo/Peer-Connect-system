import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Trash2, Pencil, Check, CheckCheck, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function Messenger() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    const { error } = await supabase.from("messages").delete().eq("id", target.id);
    if (error) return toast.error(error.message);
    setMessages((prev) => prev.filter((x) => x.id !== target.id));
    toast.success("Message deleted");
  };

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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (p) => {
        const m: any = p.new;
        if ((m.sender_id === user.id && m.recipient_id === selected) || (m.sender_id === selected && m.recipient_id === user.id)) {
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        }
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
            const isEditing = editingId === m.id;
            const doDelete = () => setPendingDelete(m);
            const startEdit = () => { setEditingId(m.id); setEditBody(m.body); };
            const saveEdit = async () => {
              const trimmed = editBody.trim();
              if (!trimmed) return;
              const { error } = await supabase.from("messages").update({ body: trimmed, edited_at: new Date().toISOString() }).eq("id", m.id);
              if (error) return toast.error(error.message);
              setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, body: trimmed, edited_at: new Date().toISOString() } : x)));
              setEditingId(null);
            };
            return (
              <div key={m.id} className={`group mb-2 flex items-end gap-1 ${mine ? "justify-end" : ""}`}>
                {mine && !isEditing && (
                  <div className="flex flex-col gap-1 opacity-0 transition group-hover:opacity-100">
                    <button type="button" onClick={startEdit} aria-label="Edit message" title="Edit message">
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                    </button>
                    <button type="button" onClick={doDelete} aria-label="Delete message" title="Delete message">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                )}
                <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditingId(null); }}
                        autoFocus
                        className="h-7 min-w-[160px] bg-background text-foreground"
                      />
                      <button type="button" onClick={saveEdit} aria-label="Save"><Check className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <>{m.body}</>
                  )}
                  <div className="mt-0.5 flex items-center gap-1 text-[9px] opacity-70">
                    <span>{new Date(m.created_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</span>
                    {m.edited_at && <span>· edited</span>}
                    {mine && (
                      m.read_at
                        ? <span className="ml-1 inline-flex items-center gap-0.5" title={`Read ${new Date(m.read_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`}><CheckCheck className="h-3 w-3" /> Read</span>
                        : <span className="ml-1 inline-flex items-center gap-0.5" title="Sent"><Check className="h-3 w-3" /> Sent</span>
                    )}
                  </div>
                </div>
                {!mine && !isEditing && (
                  <button
                    type="button"
                    onClick={doDelete}
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
