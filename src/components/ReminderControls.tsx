import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const KEY = "pc.reminders";

type Prefs = { enabled: boolean; leadMinutes: number };

function read(): Prefs {
  if (typeof window === "undefined") return { enabled: false, leadMinutes: 30 };
  try {
    return { enabled: false, leadMinutes: 30, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { enabled: false, leadMinutes: 30 };
  }
}

/** Local reminder controls: browser notifications ahead of upcoming sessions. */
export function ReminderControls({ sessions }: { sessions: Array<{ id: string; topic?: string | null; start_at: string; cancelled_at?: string | null }> }) {
  const [prefs, setPrefs] = useState<Prefs>({ enabled: false, leadMinutes: 30 });

  useEffect(() => { setPrefs(read()); }, []);

  const save = (next: Prefs) => {
    setPrefs(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const toggle = async () => {
    if (!prefs.enabled) {
      if (typeof Notification === "undefined") return toast.error("This browser does not support reminders.");
      const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (perm !== "granted") return toast.error("Allow notifications to receive session reminders.");
      save({ ...prefs, enabled: true });
      toast.success(`Reminders on — ${prefs.leadMinutes} minutes before each session.`);
    } else {
      save({ ...prefs, enabled: false });
      toast.success("Reminders off.");
    }
  };

  // Schedule timers for upcoming sessions while the app is open.
  useEffect(() => {
    if (!prefs.enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const s of sessions) {
      if (s.cancelled_at) continue;
      const fireAt = new Date(s.start_at).getTime() - prefs.leadMinutes * 60_000;
      const delay = fireAt - Date.now();
      if (delay <= 0 || delay > 24 * 60 * 60 * 1000) continue;
      timers.push(setTimeout(() => {
        new Notification("Upcoming session", {
          body: `${s.topic ?? "Study session"} starts at ${new Date(s.start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
        });
      }, delay));
    }
    return () => { timers.forEach(clearTimeout); };
  }, [prefs, sessions]);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm">
      <Button size="sm" variant={prefs.enabled ? "default" : "outline"} onClick={toggle}>
        {prefs.enabled ? <Bell className="mr-1 h-3 w-3" /> : <BellOff className="mr-1 h-3 w-3" />}
        {prefs.enabled ? "Reminders on" : "Reminders off"}
      </Button>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Remind me
        <select
          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          value={prefs.leadMinutes}
          onChange={(e) => save({ ...prefs, leadMinutes: Number(e.target.value) })}
        >
          <option value={10}>10 min</option>
          <option value={30}>30 min</option>
          <option value={60}>1 hour</option>
          <option value={120}>2 hours</option>
        </select>
        before a session
      </label>
    </div>
  );
}
