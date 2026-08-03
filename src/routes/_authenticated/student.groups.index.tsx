import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowRight, Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/groups/")({ component: Groups });

function Groups() {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [myIds, setMyIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("groups").select("id,name,description,topic,school,programme,created_at").order("created_at",{ascending:false}).limit(100);
    if (error) {
      setLoading(false);
      return toast.error(`Could not load study groups: ${error.message}`);
    }
    setGroups(data ?? []);
    if (user) {
      const { data: m, error: memberError } = await supabase.from("group_members").select("group_id").eq("user_id", user.id);
      if (memberError) toast.error(`Could not load your memberships: ${memberError.message}`);
      setMyIds(new Set((m ?? []).map((x: any) => x.group_id)));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user || !name) return;
    const { data, error } = await supabase.from("groups").insert({ name, description: desc, topic, school: profile?.school, programme: profile?.programme, created_by: user.id }).select().single();
    if (error) return toast.error(error.message);
    const { error: memberError } = await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id });
    if (memberError) return toast.error(`Group created, but joining failed: ${memberError.message}`);
    toast.success("Group created");
    setOpen(false); setName(""); setDesc(""); setTopic(""); load();
  };

  const toggleJoin = async (g: any) => {
    if (!user) return;
    setJoiningId(g.id);
    if (myIds.has(g.id)) {
      const { error } = await supabase.from("group_members").delete().eq("group_id", g.id).eq("user_id", user.id);
      if (error) { setJoiningId(null); return toast.error(`Could not leave group: ${error.message}`); }
    } else {
      const { error } = await supabase.from("group_members").insert({ group_id: g.id, user_id: user.id });
      if (error) { setJoiningId(null); return toast.error(`Could not join group: ${error.message}`); }
    }
    await load();
    setJoiningId(null);
  };

  return (
    <div>
      <PageHeader title="Study groups" description="Browse and create study groups." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> New group</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New group</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e)=>setName(e.target.value)} /></div>
              <div><Label>Topic</Label><Input value={topic} onChange={(e)=>setTopic(e.target.value)} placeholder="e.g. Data Structures Week 5" /></div>
              <div><Label>Description</Label><Textarea rows={3} value={desc} onChange={(e)=>setDesc(e.target.value)} /></div>
              <Button onClick={create} className="w-full">Create group</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />

      <div className="grid gap-4 md:grid-cols-2">
        {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading groups…</p>}
        {!loading && groups.length === 0 && <p className="text-sm text-muted-foreground">No groups yet — start one!</p>}
        {groups.map((g) => (
          <div key={g.id} className="card-elevated p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-medium">{g.name}</h3>
                {g.topic && <p className="text-xs text-muted-foreground">{g.topic}</p>}
                {g.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>}
                {g.programme && <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{g.programme}</p>}
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant={myIds.has(g.id) ? "outline" : "default"} disabled={joiningId === g.id} onClick={() => toggleJoin(g)}>
                {joiningId === g.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {myIds.has(g.id) ? "Leave" : "Join"}
              </Button>
              {myIds.has(g.id) && (
                <Button asChild size="sm" variant="secondary">
                  <Link to="/student/groups/$id" params={{ id: g.id }}>Open chat <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
