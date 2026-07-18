import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useTheme } from "@/lib/theme";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Moon, Sun, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/student/settings")({ component: Settings });

function Settings() {
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div>
      <PageHeader title="Settings" description="Personalise your Peer Connect." />
      <div className="card-elevated divide-y divide-border">
        <Row title="Appearance" description="Light or dark theme.">
          <div className="flex items-center gap-2"><Sun className="h-4 w-4" /><Switch checked={theme==="dark"} onCheckedChange={toggle} /><Moon className="h-4 w-4" /></div>
        </Row>
        <Row title="Notifications" description="Real-time messages, session reminders and requests are on by default.">
          <Switch defaultChecked />
        </Row>
        <Row title="Language" description="Coming soon.">
          <span className="text-sm text-muted-foreground">English</span>
        </Row>
        <Row title="Account" description="Sign out of Peer Connect.">
          <Button size="sm" variant="outline" onClick={async () => { await signOut(); nav({ to: "/" }); }}><LogOut className="mr-1 h-3 w-3" /> Sign out</Button>
        </Row>
      </div>
    </div>
  );
}

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <div><Label className="text-sm font-medium">{title}</Label><p className="text-xs text-muted-foreground">{description}</p></div>
      {children}
    </div>
  );
}
