import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";
import { GraduationCap, BookOpen, ArrowLeft } from "lucide-react";
import { checkLockout, recordFailure, clearAttempts } from "@/lib/login-throttle";
import { signInForPortal } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth/$role")({
  component: SignIn,
  beforeLoad: ({ params }) => {
    if (params.role !== "student" && params.role !== "tutor") {
      throw new Error("Unknown role");
    }
  },
});

function SignIn() {
  const { role } = Route.useParams() as { role: "student" | "tutor" };
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockMsLeft, setLockMsLeft] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  // Live lockout countdown — re-checks localStorage every second so the timer ticks down.
  useEffect(() => {
    const tick = () => {
      const lock = checkLockout(email);
      setLockMsLeft(lock.locked ? lock.msLeft : 0);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [email]);

  const fmtCountdown = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${ss.toString().padStart(2, "0")}`;
  };


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lock = checkLockout(email);
    if (lock.locked) {
      return toast.error(`Too many failed attempts. Please try again in about ${lock.minutesLeft} minute${lock.minutesLeft === 1 ? "" : "s"}.`);
    }
    setLoading(true);
    try {
      const result = await signInForPortal({ data: { email, password, role } });
      if (!result.ok) {
        setLoading(false);
        const isRoleDenied = result.message.includes("not registered as a Student") || result.message.includes("not registered as a Tutor");
        if (isRoleDenied) return toast.error(result.message);
        const r = recordFailure(email);
        setAttemptsLeft(r.attemptsLeft);
        if (r.locked) {
          setLockMsLeft(2 * 60 * 1000);
          return toast.error("Too many failed attempts. Sign-in is locked for 2 minutes.");
        }
        return toast.error(`${result.message} — ${r.attemptsLeft} attempt${r.attemptsLeft === 1 ? "" : "s"} left before a 2-minute lockout.`);
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      setLoading(false);
      if (sessionError) return toast.error(sessionError.message);
      clearAttempts(email);
      toast.success("Welcome back!");
      navigate({ to: role === "tutor" ? "/tutor" : "/student" });
    } catch (err: any) {
      setLoading(false);
      const message = err?.message ?? "Sign in failed";
      const isRoleDenied = message.includes("not registered as a Student") || message.includes("not registered as a Tutor");
      if (isRoleDenied) return toast.error(message);
      const r = recordFailure(email);
      setAttemptsLeft(r.attemptsLeft);
      if (r.locked) {
        setLockMsLeft(2 * 60 * 1000);
        return toast.error("Too many failed attempts. Sign-in is locked for 2 minutes.");
      }
      return toast.error(`${message} — ${r.attemptsLeft} attempt${r.attemptsLeft === 1 ? "" : "s"} left before a 2-minute lockout.`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl place-items-center px-4 py-10">
        <div className="w-full max-w-5xl">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => (window.history.length > 1 ? window.history.back() : navigate({ to: "/" }))}
            className="mb-4"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border shadow-soft md:grid-cols-2">
          <div className="hidden bg-primary p-10 text-primary-foreground md:block">
            <div className="mb-4 inline-grid h-11 w-11 place-items-center rounded-lg gradient-gold text-accent-foreground">
              {role === "tutor" ? <GraduationCap className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
            </div>
            <h2 className="font-display text-3xl font-semibold">Welcome back{role === "tutor" ? ", tutor" : ", student"}</h2>
            <p className="mt-3 max-w-sm text-sm text-white/80">
              {role === "tutor"
                ? "Manage requests, sessions and your student community."
                : "Continue learning, meet your tutors and study with your groups."}
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4 bg-card p-8">
            <div>
              <h1 className="font-display text-2xl font-semibold">Sign in</h1>
              <p className="mt-1 text-sm text-muted-foreground">Use your USIU email to continue.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@usiu.ac.ke" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {lockMsLeft > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                Locked out. Try again in <span className="font-mono font-semibold">{fmtCountdown(lockMsLeft)}</span>
              </div>
            )}
            {lockMsLeft === 0 && attemptsLeft !== null && attemptsLeft < 5 && (
              <p className="text-center text-xs text-muted-foreground">
                {attemptsLeft} attempt{attemptsLeft === 1 ? "" : "s"} left before a 2-minute lockout.
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading || lockMsLeft > 0}>
              {lockMsLeft > 0 ? `Locked (${fmtCountdown(lockMsLeft)})` : loading ? "Signing in…" : "Sign in"}
            </Button>

            <div className="text-center text-xs">
              <Link to="/forgot-password" className="text-muted-foreground underline-offset-4 hover:underline">Forgot password?</Link>
            </div>

            <div className="pt-2 text-center text-sm text-muted-foreground">
              {role === "student" ? "Are you a student?" : "Are you a tutor?"}{" "}
              <Link to="/register/$role" params={{ role }} className="font-medium text-primary underline-offset-4 hover:underline">Register here</Link>
            </div>
            <div className="text-center text-xs text-muted-foreground">
              Or sign in as{" "}
              <Link to="/auth/$role" params={{ role: role === "student" ? "tutor" : "student" }} className="underline">
                {role === "student" ? "tutor" : "student"}
              </Link>
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
}
