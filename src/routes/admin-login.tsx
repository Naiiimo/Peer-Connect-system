import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { checkLockout, recordFailure, clearAttempts } from "@/lib/login-throttle";

export const Route = createFileRoute("/admin-login")({ component: AdminLogin });

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lock = checkLockout(email);
    if (lock.locked) {
      return toast.error(`Too many failed attempts. Please try again in about ${lock.hoursLeft} hour${lock.hoursLeft === 1 ? "" : "s"} (24-hour lockout).`);
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      const r = recordFailure(email);
      if (r.locked) {
        return toast.error("Too many failed attempts. Admin sign-in is locked for 24 hours.");
      }
      return toast.error(`${error.message} — ${r.attemptsLeft} attempt${r.attemptsLeft === 1 ? "" : "s"} left before a 24-hour lockout.`);
    }

    const { data: prof } = await supabase
      .from("profiles").select("role").eq("id", data.user!.id).maybeSingle();
    setLoading(false);

    if (prof?.role !== "admin" && prof?.role !== "super_admin") {
      await supabase.auth.signOut();
      return toast.error("This account is not an administrator.");
    }
    clearAttempts(email);
    toast.success("Welcome, admin");
    navigate({ to: "/admin" });
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-md place-items-center px-4 py-10">
        <div className="w-full">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => (window.history.length > 1 ? window.history.back() : navigate({ to: "/" }))}
            className="mb-4"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>

          <form onSubmit={submit} className="card-elevated space-y-4 p-8">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold">Admin sign in</h1>
                <p className="text-xs text-muted-foreground">Restricted access. Authorized administrators only.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@usiu.ac.ke" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in as admin"}</Button>

            <div className="text-center text-xs">
              <Link to="/forgot-password" className="text-muted-foreground underline-offset-4 hover:underline">Forgot password?</Link>
            </div>

            <p className="pt-2 text-center text-[11px] text-muted-foreground">
              Admin accounts cannot be self-registered. Contact a super administrator to be granted access.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
