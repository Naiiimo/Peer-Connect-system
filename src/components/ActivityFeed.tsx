import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Bell, Check, CalendarClock, MessageSquare, UserPlus, Star, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ICON: Record<string, any> = {
  message: MessageSquare,
  connection: UserPlus,
  session: CalendarClock,
  session_cancelled: CalendarClock,
  session_rescheduled: CalendarClock,
  review: Star,
  payment: Wallet,
};

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Bell with live unread count and a dropdown activity feed of everything happening around you. */
export function ActivityFeed({ base }: { base: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(15);
    setRows(data ?? []);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`activity-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user]);

  const unread = rows.filter((r) => !r.read_at).length;

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    load();
  };

  const openItem = async (n: any) => {
    if (!n.read_at) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
    setOpen(false);
    navigate({ to: (n.link || `${base}/notifications`) as any });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Activity</span>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markAll}>
              <Check className="mr-1 h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {rows.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nothing yet — activity will show up here.</li>}
          {rows.map((n) => {
            const Icon = ICON[n.kind] ?? Bell;
            return (
              <li key={n.id}>
                <button onClick={() => openItem(n)} className={`flex w-full gap-2 border-b border-border/60 p-3 text-left hover:bg-secondary/50 ${n.read_at ? "opacity-60" : ""}`}>
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary"><Icon className="h-3.5 w-3.5" /></div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{n.title}</div>
                    {n.body && <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{ago(n.created_at)}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <button onClick={() => { setOpen(false); navigate({ to: `${base}/notifications` as any }); }} className="w-full p-2 text-center text-xs text-primary hover:underline">
          View all notifications
        </button>
      </PopoverContent>
    </Popover>
  );
}
