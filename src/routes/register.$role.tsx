import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";
import { SCHOOLS, YEARS, LEARNING_STYLES, GENDERS } from "@/lib/schools";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, ArrowLeft } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/register/$role")({
  component: Register,
  beforeLoad: ({ params }) => {
    if (params.role !== "student" && params.role !== "tutor") throw new Error("Unknown role");
  },
});

function Register() {
  const { role } = Route.useParams() as { role: "student" | "tutor" };
  const navigate = useNavigate();
  const [programmes, setProgrammes] = useState<{ school: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("programmes").select("school,name").then(({ data }) => setProgrammes(data ?? []));
  }, []);

  // Common fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [gender, setGender] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [bio, setBio] = useState("");

  // Student
  const [usiuId, setUsiuId] = useState("");
  const [school, setSchool] = useState<string>("");
  const [programme, setProgramme] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [learningStyle, setLearningStyle] = useState<string>("");

  // Tutor
  const [tutorSchools, setTutorSchools] = useState<string[]>([]);
  const [tutorProgrammes, setTutorProgrammes] = useState<string[]>([]);
  const [specializations, setSpecializations] = useState<string>("");

  const [loading, setLoading] = useState(false);

  const filteredProgrammes = useMemo(
    () => (role === "student" ? programmes.filter((p) => p.school === school) : programmes.filter((p) => tutorSchools.includes(p.school))),
    [programmes, school, tutorSchools, role]
  );

  const onPhoto = (f: File | null) => {
    setPhotoFile(f);
    setPhotoPreview(f ? URL.createObjectURL(f) : "");
  };

  const toggleTutorSchool = (s: string, checked: boolean) => {
    setTutorSchools((prev) => {
      if (checked) return prev.length >= 2 ? prev : [...prev, s];
      return prev.filter((x) => x !== s);
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords don't match");
    if (role === "student" && (!school || !programme || !year)) return toast.error("Complete school, programme and year");
    if (role === "tutor" && (tutorSchools.length === 0 || tutorProgrammes.length === 0)) return toast.error("Pick your schools and programmes");

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { role, full_name: fullName },
      },
    });
    if (error || !data.user) { setLoading(false); return toast.error(error?.message ?? "Sign up failed"); }
    const uid = data.user.id;

    let photo_url: string | null = null;
    if (photoFile) {
      const ext = photoFile.name.split(".").pop() ?? "jpg";
      const path = `${uid}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, photoFile, { upsert: true });
      if (!upErr) {
        const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
        photo_url = signed?.signedUrl ?? null;
      }
    }

    const update: any = { full_name: fullName, email, photo_url, bio, gender: gender || null, role };
    if (role === "student") {
      update.usiu_id = usiuId;
      update.school = school;
      update.programme = programme;
      update.year_of_study = Number(year);
      update.learning_style = learningStyle || null;
    } else {
      update.tutor_schools = tutorSchools;
      update.tutor_programmes = tutorProgrammes;
      update.specializations = specializations.split(",").map((t) => t.trim()).filter(Boolean);
    }
    // Retry a couple times because trigger inserts the profile row asynchronously
    for (let i = 0; i < 3; i++) {
      const { error: uErr } = await supabase.from("profiles").update(update).eq("id", uid);
      if (!uErr) break;
      await new Promise((r) => setTimeout(r, 400));
    }

    setLoading(false);
    toast.success("Account created!");
    navigate({ to: role === "tutor" ? "/tutor" : "/student" });
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => (window.history.length > 1 ? window.history.back() : navigate({ to: "/" }))}
          className="mb-4"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold">Create your {role} account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/auth/$role" params={{ role }} className="text-primary underline-offset-4 hover:underline">Sign in</Link>
          </p>
        </div>

        <form onSubmit={submit} className="card-elevated space-y-5 p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={photoPreview} />
              <AvatarFallback><Camera className="h-6 w-6 text-muted-foreground" /></AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="photo">Profile photo</Label>
              <Input id="photo" type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0] ?? null)} className="mt-1" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name"><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
            <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            {role === "student" && (
              <>
                <Field label="USIU ID"><Input required value={usiuId} onChange={(e) => setUsiuId(e.target.value)} placeholder="e.g. 662XXX" /></Field>
                <Field label="Year of study">
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                    <SelectContent>{YEARS.map((y) => (<SelectItem key={y} value={String(y)}>Year {y}</SelectItem>))}</SelectContent>
                  </Select>
                </Field>
                <Field label="School">
                  <Select value={school} onValueChange={(v) => { setSchool(v); setProgramme(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                    <SelectContent>{SCHOOLS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                  </Select>
                </Field>
                <Field label="Programme">
                  <Select value={programme} onValueChange={setProgramme} disabled={!school}>
                    <SelectTrigger><SelectValue placeholder={school ? "Select programme" : "Pick a school first"} /></SelectTrigger>
                    <SelectContent>{filteredProgrammes.map((p) => (<SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>))}</SelectContent>
                  </Select>
                </Field>
                <Field label="Learning style">
                  <Select value={learningStyle} onValueChange={setLearningStyle}>
                    <SelectTrigger><SelectValue placeholder="How do you learn best?" /></SelectTrigger>
                    <SelectContent>{LEARNING_STYLES.map((l) => (<SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>))}</SelectContent>
                  </Select>
                </Field>
              </>
            )}
            <Field label="Gender">
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{GENDERS.map((g) => (<SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>))}</SelectContent>
              </Select>
            </Field>
          </div>

          {role === "tutor" && (
            <>
              <div>
                <Label>Schools you teach in (up to 2)</Label>
                <div className="mt-2 grid gap-2 rounded-md border border-border p-3 md:grid-cols-2">
                  {SCHOOLS.map((s) => {
                    const checked = tutorSchools.includes(s);
                    return (
                      <label key={s} className="flex items-start gap-2 text-sm">
                        <Checkbox checked={checked} onCheckedChange={(c) => toggleTutorSchool(s, !!c)} disabled={!checked && tutorSchools.length >= 2} />
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
                        <Checkbox checked={checked} onCheckedChange={(c) =>
                          setTutorProgrammes((prev) => c ? [...prev, p.name] : prev.filter((x) => x !== p.name))
                        } />
                        <span>{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <Field label="Specialized topics (comma separated)">
                <Input value={specializations} onChange={(e) => setSpecializations(e.target.value)} placeholder="e.g. Calculus, Data Structures, Marketing Analytics" />
              </Field>
              <Field label="Short bio"><Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Introduce yourself to future students…" /></Field>
            </>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Create password"><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <Field label="Confirm password"><Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating account…" : "Create account"}</Button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
