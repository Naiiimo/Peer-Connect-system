import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useTheme } from "@/lib/theme";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Moon, Sun, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/tutor/settings")({ component: Settings });

function Settings() {
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div>
      <PageHeader title="Settings" description="Customise your Peer Connect." />
      <div className="card-elevated divide-y divide-border">
        <div className="flex items-center justify-between gap-4 p-5">
          <div><Label className="text-sm font-medium">Appearance</Label><p className="text-xs text-muted-foreground">Light or dark theme.</p></div>
          <div className="flex items-center gap-2"><Sun className="h-4 w-4" /><Switch checked={theme==="dark"} onCheckedChange={toggle} /><Moon className="h-4 w-4" /></div>
        </div>
        <div className="flex items-center justify-between gap-4 p-5">
          <div><Label className="text-sm font-medium">Notifications</Label><p className="text-xs text-muted-foreground">Requests, messages and session reminders.</p></div>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between gap-4 p-5">
          <div><Label className="text-sm font-medium">Account</Label><p className="text-xs text-muted-foreground">Sign out.</p></div>
          <Button size="sm" variant="outline" onClick={async () => { await signOut(); nav({ to: "/" }); }}><LogOut className="mr-1 h-3 w-3" /> Sign out</Button>
        </div>
      </div>
    </div>
  );
}
