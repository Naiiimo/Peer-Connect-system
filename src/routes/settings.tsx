import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/TopBar";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Moon, Sun } from "lucide-react";

export const Route = createFileRoute("/settings")({ component: PublicSettings });

function PublicSettings() {
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Personalise your experience.</p>

        <div className="card-elevated mt-6 divide-y divide-border">
          <Row title="Appearance" description="Switch between light and dark themes.">
            <div className="flex items-center gap-3">
              <Sun className={`h-4 w-4 ${theme === "light" ? "text-primary" : "text-muted-foreground"}`} />
              <Switch checked={theme === "dark"} onCheckedChange={toggle} />
              <Moon className={`h-4 w-4 ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`} />
            </div>
          </Row>
          <Row title="Language" description="More languages coming soon.">
            <span className="text-sm text-muted-foreground">English</span>
          </Row>
          <Row title="Account" description="Sign in to manage your profile and notifications.">
            <Link to="/auth/$role" params={{ role: "student" }}><Button size="sm" variant="outline">Sign in</Button></Link>
          </Row>
        </div>
      </div>
    </div>
  );
}

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <div>
        <Label className="text-sm font-medium">{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
