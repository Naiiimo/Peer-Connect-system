import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LEARNING_STYLES, SCHOOLS, YEARS } from "@/lib/schools";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { LanguagePicker } from "@/components/LanguagePicker";
import { MyCourses } from "@/components/MyCourses";
import { RefineButton } from "@/components/RefineButton";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/student/profile")({ component: StudentProfile });

function StudentProfile() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState<any>({});
  const [programmes, setProgrammes] = useState<any[]>([]);

  useEffect(() => { setF(profile ?? {}); }, [profile]);
  useEffect(() => { supabase.from("programmes").select("school,name").then(({data}) => setProgrammes(data ?? [])); }, []);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      full_name: f.full_name, bio: f.bio, school: f.school, programme: f.programme,
      year_of_study: f.year_of_study, learning_style: f.learning_style, usiu_id: f.usiu_id,
      languages: f.languages ?? [],
    }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Saved"); refreshProfile();
  };

  const uploadPhoto = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Profile photos must be 5 MB or smaller.");
    const path = `${user.id}/avatar-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data, error: urlError } = await supabase.storage.from("avatars").createSignedUrl(path, 60*60*24*365);
    if (urlError || !data?.signedUrl) return toast.error(urlError?.message ?? "Could not open the uploaded photo.");
    const { error: profileError } = await supabase.from("profiles").update({ photo_url: data.signedUrl }).eq("id", user.id);
    if (profileError) return toast.error(profileError.message);
    setF((current: any) => ({ ...current, photo_url: data.signedUrl }));
    await refreshProfile();
    toast.success("Profile photo updated");
  };

  const deleteAccount = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ deleted_at: new Date().toISOString() }).eq("id", user.id);
    await signOut();
    toast.success("Account marked for deletion");
    nav({ to: "/" });
  };

  return (
    <div>
      <PageHeader title="Profile" />
      <div className="card-elevated space-y-5 p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20"><AvatarImage src={f.photo_url ?? undefined} /><AvatarFallback>{(f.full_name ?? "U").slice(0,1)}</AvatarFallback></Avatar>
          <label><input type="file" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} /><Button asChild variant="outline" size="sm"><span>Change photo</span></Button></label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Full name</Label><Input value={f.full_name ?? ""} onChange={(e) => setF({...f, full_name: e.target.value})} /></div>
          <div><Label>USIU ID</Label><Input value={f.usiu_id ?? ""} onChange={(e) => setF({...f, usiu_id: e.target.value})} /></div>
          <div><Label>School</Label>
            <Select value={f.school ?? ""} onValueChange={(v) => setF({...f, school: v, programme: ""})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SCHOOLS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Programme</Label>
            <Select value={f.programme ?? ""} onValueChange={(v) => setF({...f, programme: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{programmes.filter(p => p.school === f.school).map((p) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Year of study</Label>
            <Select value={String(f.year_of_study ?? "")} onValueChange={(v) => setF({...f, year_of_study: Number(v)})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Learning style</Label>
            <Select value={f.learning_style ?? ""} onValueChange={(v) => setF({...f, learning_style: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LEARNING_STYLES.map(l => <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <LanguagePicker value={f.languages ?? []} onChange={(langs) => setF({ ...f, languages: langs })} />
        <MyCourses
          role="student"
          programmeCode={useMemo(() => {
            const p = programmes.find((x: any) => x.name === f.programme);
            return p?.code ?? null;
          }, [programmes, f.programme])}
        />
        <div>
          <div className="flex items-center justify-between">
            <Label>Bio</Label>
            <RefineButton value={f.bio ?? ""} onChange={(v) => setF({ ...f, bio: v })} context="Student bio for a peer-learning app" />
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
                <AlertDialogHeader><AlertDialogTitle>Delete account?</AlertDialogTitle><AlertDialogDescription>Your profile will be marked as deleted. This can't be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteAccount}>Delete</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
