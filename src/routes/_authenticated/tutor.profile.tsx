import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { SCHOOLS } from "@/lib/schools";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { LanguagePicker } from "@/components/LanguagePicker";
import { MyCourses } from "@/components/MyCourses";
import { RefineButton } from "@/components/RefineButton";

export const Route = createFileRoute("/_authenticated/tutor/profile")({ component: TutorProfile });

function TutorProfile() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState<any>({});
  const [programmes, setProgrammes] = useState<any[]>([]);

  useEffect(() => { setF(profile ?? {}); }, [profile]);
  useEffect(() => { supabase.from("programmes").select("school,name").then(({data}) => setProgrammes(data ?? [])); }, []);

  const toggleSchool = (s: string) => {
    const cur: string[] = f.tutor_schools ?? [];
    if (cur.includes(s)) setF({ ...f, tutor_schools: cur.filter((x) => x !== s) });
    else if (cur.length < 2) setF({ ...f, tutor_schools: [...cur, s] });
  };

  const toggleProgramme = (p: string) => {
    const cur: string[] = f.tutor_programmes ?? [];
    setF({ ...f, tutor_programmes: cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p] });
  };

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      full_name: f.full_name, bio: f.bio,
      tutor_schools: f.tutor_schools ?? [], tutor_programmes: f.tutor_programmes ?? [],
      specializations: [],
      languages: f.languages ?? [],
    }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Saved"); refreshProfile();
  };

  const uploadPhoto = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/avatar-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60*60*24*365);
    await supabase.from("profiles").update({ photo_url: data?.signedUrl }).eq("id", user.id);
    refreshProfile();
  };

  const deleteAccount = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ deleted_at: new Date().toISOString() }).eq("id", user.id);
    await signOut(); nav({ to: "/" });
  };

  const availableProgrammes = programmes.filter((p) => (f.tutor_schools ?? []).includes(p.school));

  return (
    <div>
      <PageHeader title="Profile" />
      <div className="card-elevated space-y-5 p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20"><AvatarImage src={f.photo_url ?? undefined} /><AvatarFallback>{(f.full_name ?? "T").slice(0,1)}</AvatarFallback></Avatar>
          <label><input type="file" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} /><Button asChild variant="outline" size="sm"><span>Change photo</span></Button></label>
        </div>
        <div><Label>Full name</Label><Input value={f.full_name ?? ""} onChange={(e) => setF({...f, full_name: e.target.value})} /></div>
        <div>
          <Label>Schools (up to 2)</Label>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {SCHOOLS.map((s) => {
              const checked = (f.tutor_schools ?? []).includes(s);
              return <label key={s} className="flex items-start gap-2 text-sm"><Checkbox checked={checked} onCheckedChange={() => toggleSchool(s)} disabled={!checked && (f.tutor_schools ?? []).length >= 2} /><span>{s}</span></label>;
            })}
          </div>
        </div>
        <div>
          <Label>Programmes you tutor</Label>
          <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto rounded-md border border-border p-3 md:grid-cols-2">
            {availableProgrammes.length === 0 && <p className="text-sm text-muted-foreground">Pick at least one school first.</p>}
            {availableProgrammes.map((p) => (
              <label key={p.name} className="flex items-start gap-2 text-sm">
                <Checkbox checked={(f.tutor_programmes ?? []).includes(p.name)} onCheckedChange={() => toggleProgramme(p.name)} />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
        </div>
        <LanguagePicker value={f.languages ?? []} onChange={(langs) => setF({ ...f, languages: langs })} />
        <MyCourses role="tutor" programmeCode={null} />
        <div>
          <div className="flex items-center justify-between">
            <Label>Bio</Label>
            <RefineButton value={f.bio ?? ""} onChange={(v) => setF({ ...f, bio: v })} context="Tutor bio for a peer-tutoring app" />
          </div>
          <Textarea rows={3} value={f.bio ?? ""} onChange={(e) => setF({...f, bio: e.target.value})} />
        </div>
        <div className="flex justify-between">
          <Button onClick={save}>Save changes</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={async () => { await signOut(); nav({ to: "/" }); }}>Sign out</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive">Delete account</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete account?</AlertDialogTitle><AlertDialogDescription>Your profile will be marked as deleted.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteAccount}>Delete</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
