import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";
import { ArrowLeft, KeyRound } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({ component: Forgot });

function Forgot() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Check your email for a reset link.");
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-md place-items-center px-4 py-10">
        <div className="w-full">
          <Button type="button" variant="ghost" size="sm"
            onClick={() => (window.history.length > 1 ? window.history.back() : navigate({ to: "/" }))}
            className="mb-4">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <form onSubmit={submit} className="card-elevated space-y-4 p-8">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold">Forgot password</h1>
                <p className="text-xs text-muted-foreground">We'll email you a reset link.</p>
              </div>
            </div>
            {sent ? (
              <p className="text-sm text-muted-foreground">
                If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@usiu.ac.ke" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</Button>
              </>
            )}
            <p className="pt-2 text-center text-xs text-muted-foreground">
              Remembered it? <Link to="/" className="underline">Go back home</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
