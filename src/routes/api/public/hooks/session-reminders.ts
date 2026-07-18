import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Session = {
  id: string;
  tutor_id: string;
  student_id: string;
  topic: string | null;
  start_at: string;
  reminders_sent: string[];
};

const WINDOWS: { tag: string; label: string; minsBefore: number; toleranceMin: number }[] = [
  { tag: "24h", label: "in 24 hours", minsBefore: 24 * 60, toleranceMin: 10 },
  { tag: "1h",  label: "in 1 hour",   minsBefore: 60,       toleranceMin: 10 },
  { tag: "10m", label: "in 10 minutes", minsBefore: 10,      toleranceMin: 6 },
];

export const Route = createFileRoute("/api/public/hooks/session-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        if (!url || !key) return new Response("Missing env", { status: 500 });
        const admin = createClient(url, key, { auth: { persistSession: false } });

        const nowMs = Date.now();
        const horizonMs = nowMs + 25 * 60 * 60 * 1000;

        const { data: rows, error } = await admin
          .from("sessions")
          .select("id,tutor_id,student_id,topic,start_at,reminders_sent")
          .is("cancelled_at", null)
          .gte("start_at", new Date(nowMs - 5 * 60 * 1000).toISOString())
          .lte("start_at", new Date(horizonMs).toISOString());
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        let sent = 0;
        for (const s of (rows ?? []) as Session[]) {
          const startMs = new Date(s.start_at).getTime();
          const minsUntil = (startMs - nowMs) / 60000;
          for (const w of WINDOWS) {
            if (s.reminders_sent?.includes(w.tag)) continue;
            if (Math.abs(minsUntil - w.minsBefore) <= w.toleranceMin && minsUntil > -w.toleranceMin) {
              const when = new Date(s.start_at).toLocaleString();
              const title = `Session reminder — ${w.label}`;
              const body = `${s.topic ?? "Your session"} · ${when}`;
              await admin.from("notifications").insert([
                { user_id: s.tutor_id,   kind: "session_reminder", title, body, link: "/tutor/sessions" },
                { user_id: s.student_id, kind: "session_reminder", title, body, link: "/student/schedule" },
              ]);
              await admin
                .from("sessions")
                .update({ reminders_sent: [...(s.reminders_sent ?? []), w.tag] })
                .eq("id", s.id);
              sent += 2;
            }
          }
        }

        return new Response(JSON.stringify({ ok: true, checked: rows?.length ?? 0, notifications: sent }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
