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
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/groups")({ component: Groups });

function Groups() {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [myIds, setMyIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [topic, setTopic] = useState("");

  const load = async () => {
    const { data } = await supabase.from("groups").select("id,name,description,topic,school,programme,created_at").order("created_at",{ascending:false}).limit(100);
    setGroups(data ?? []);
    if (user) {
      const { data: m } = await supabase.from("group_members").select("group_id").eq("user_id", user.id);
      setMyIds(new Set((m ?? []).map((x: any) => x.group_id)));
    }
  };
  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user || !name) return;
    const { data, error } = await supabase.from("groups").insert({ name, description: desc, topic, school: profile?.school, programme: profile?.programme, created_by: user.id }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id });
    toast.success("Group created");
    setOpen(false); setName(""); setDesc(""); setTopic(""); load();
  };

  const toggleJoin = async (g: any) => {
    if (!user) return;
    if (myIds.has(g.id)) {
      await supabase.from("group_members").delete().eq("group_id", g.id).eq("user_id", user.id);
    } else {
      await supabase.from("group_members").insert({ group_id: g.id, user_id: user.id });
    }
    load();
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
        {groups.length === 0 && <p className="text-sm text-muted-foreground">No groups yet — start one!</p>}
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
              <Button size="sm" variant={myIds.has(g.id) ? "outline" : "default"} onClick={() => toggleJoin(g)}>
                {myIds.has(g.id) ? "Leave" : "Join"}
              </Button>
              {myIds.has(g.id) && <Link to="/student/groups/$id" params={{ id: g.id }}><Button size="sm" variant="secondary">Open</Button></Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
