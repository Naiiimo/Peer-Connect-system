import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/reset-password")({ component: Reset, ssr: false });

function Reset() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery link into a session automatically.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords don't match.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-md place-items-center px-4 py-10">
        <form onSubmit={submit} className="card-elevated w-full space-y-4 p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold">Set a new password</h1>
              <p className="text-xs text-muted-foreground">Choose a strong password you'll remember.</p>
            </div>
          </div>
          {!ready && <p className="text-sm text-muted-foreground">Verifying reset link…</p>}
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !ready}>{loading ? "Updating…" : "Update password"}</Button>
        </form>
      </div>
    </div>
  );
}
