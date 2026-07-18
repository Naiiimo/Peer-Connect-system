import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { GraduationCap, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SCHOOLS } from "@/lib/schools";
import { LanguagePicker } from "@/components/LanguagePicker";

export const Route = createFileRoute("/_authenticated/become-tutor")({ component: BecomeTutor });

function BecomeTutor() {
  const { user, profile, isTutor, refreshProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [programmes, setProgrammes] = useState<{ school: string; name: string }[]>([]);
  const [tutorSchools, setTutorSchools] = useState<string[]>([]);
  const [tutorProgrammes, setTutorProgrammes] = useState<string[]>([]);
  const [specializations, setSpecializations] = useState("");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [languages, setLanguages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("programmes").select("school,name").then(({ data }) => setProgrammes(data ?? []));
  }, []);

  useEffect(() => {
    // If they already have the tutor role, just send them in.
    if (!loading && isTutor) navigate({ to: "/tutor", replace: true });
  }, [loading, isTutor, navigate]);

  const filteredProgrammes = useMemo(
    () => programmes.filter((p) => tutorSchools.includes(p.school)),
    [programmes, tutorSchools],
  );

  const toggleSchool = (s: string, checked: boolean) =>
    setTutorSchools((prev) => (checked ? (prev.length >= 2 ? prev : [...prev, s]) : prev.filter((x) => x !== s)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (tutorSchools.length === 0 || tutorProgrammes.length === 0) return toast.error("Pick your schools and programmes.");
    if (!bio.trim()) return toast.error("Add a short bio so students know how you can help.");

    setSubmitting(true);
    // 1. Update tutor-specific profile fields (does NOT change the primary role).
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        tutor_schools: tutorSchools,
        tutor_programmes: tutorProgrammes,
        specializations: specializations.split(",").map((t) => t.trim()).filter(Boolean),
        bio,
        ...(languages.length ? { languages } : {}),
      })
      .eq("id", user.id);
    if (pErr) { setSubmitting(false); return toast.error(pErr.message); }

    // 2. Grant the 'tutor' role via user_roles (RLS allows self-grant of tutor only).
    const { error: rErr } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: "tutor" });
    if (rErr && !rErr.message.toLowerCase().includes("duplicate")) {
      setSubmitting(false);
      return toast.error(rErr.message);
    }

    await refreshProfile();
    toast.success("You're now a tutor — welcome to the tutor dashboard!");
    navigate({ to: "/tutor", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/student" })} className="mb-4">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to student dashboard
        </Button>

        <div className="mb-6 flex items-start gap-4 rounded-xl border border-border bg-secondary/40 p-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg gradient-gold text-accent-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">Become a tutor</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You haven't registered as a tutor yet. Complete your tutor profile to access tutor features.
              Your student account stays the same — you'll be able to switch between the two dashboards from the top bar.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="card-elevated space-y-5 p-6">
          <div>
            <Label>Schools you can tutor in (up to 2)</Label>
            <div className="mt-2 grid gap-2 rounded-md border border-border p-3 md:grid-cols-2">
              {SCHOOLS.map((s) => {
                const checked = tutorSchools.includes(s);
                return (
                  <label key={s} className="flex items-start gap-2 text-sm">
                    <Checkbox checked={checked} onCheckedChange={(c) => toggleSchool(s, !!c)} disabled={!checked && tutorSchools.length >= 2} />
                    <span>{s}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Programmes you can tutor</Label>
            <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto rounded-md border border-border p-3 md:grid-cols-2">
              {filteredProgrammes.length === 0 && <p className="text-sm text-muted-foreground">Pick at least one school first.</p>}
              {filteredProgrammes.map((p) => {
                const checked = tutorProgrammes.includes(p.name);
                return (
                  <label key={p.name} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) =>
                        setTutorProgrammes((prev) => (c ? [...prev, p.name] : prev.filter((x) => x !== p.name)))
                      }
                    />
                    <span>{p.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spec">Topics you specialise in</Label>
            <Input id="spec" value={specializations} onChange={(e) => setSpecializations(e.target.value)} placeholder="e.g. Calculus, Data Structures, Marketing Analytics" />
            <p className="text-xs text-muted-foreground">Comma separated — these help students find you.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Short bio</Label>
            <Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Introduce yourself, your experience and how you help students learn." required />
          </div>

          <LanguagePicker value={languages} onChange={setLanguages} label="Languages you can tutor in" />

          <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>By becoming a tutor you agree to respond to requests, uphold USIU Peer Connect community guidelines, and keep your availability up to date.</p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link to="/student"><Button type="button" variant="outline" className="w-full sm:w-auto">Not now</Button></Link>
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? "Creating tutor profile…" : "Complete tutor registration"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
