import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { GraduationCap, Moon, Sun, Settings as SettingsIcon, LogOut, Bell, User as UserIcon, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function TopBar({ showNav = true }: { showNav?: boolean }) {
  const { theme, toggle } = useTheme();
  const { user, profile, roles, isTutor, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Base area follows the URL the user is currently in, so dual-role users see the right dashboard link.
  const inTutor = path.startsWith("/tutor");
  const inAdmin = path.startsWith("/admin");
  const base = inTutor ? "/tutor" : inAdmin ? "/admin" : "/student";
  const canSwitchToTutor = isTutor && !inTutor;
  const canSwitchToStudent = !inAdmin && (roles.includes("student") || !isTutor) && inTutor;
  const canBecomeTutor = !isTutor && !isAdmin;

  const doSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-display font-bold">
          <div className="grid h-9 w-9 place-items-center rounded-md gradient-hero text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm">USIU</div>
            <div className="text-[10px] font-medium tracking-widest text-muted-foreground">PEER CONNECT</div>
          </div>
        </Link>

        {showNav && user && (
          <nav className="ml-6 hidden gap-1 md:flex">
            <Link to={base as any} className={`rounded-md px-3 py-1.5 text-sm ${path === base ? "bg-secondary" : "hover:bg-secondary/60"}`}>Dashboard</Link>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user && (
            <Link to={`${base}/notifications` as any}>
              <Button variant="ghost" size="icon" aria-label="Notifications"><Bell className="h-4 w-4" /></Button>
            </Link>
          )}
          <Link to={user ? (`${base}/settings` as any) : "/settings"}>
            <Button variant="ghost" size="icon" aria-label="Settings"><SettingsIcon className="h-4 w-4" /></Button>
          </Link>
          {user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.photo_url ?? undefined} />
                      <AvatarFallback>{(profile?.full_name ?? user.email ?? "U").slice(0,1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{profile?.full_name ?? user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ to: `${base}/profile` as any })}>
                    <UserIcon className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: `${base}/settings` as any })}>
                    <SettingsIcon className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  {(canSwitchToTutor || canSwitchToStudent || canBecomeTutor) && <DropdownMenuSeparator />}
                  {canSwitchToTutor && (
                    <DropdownMenuItem onClick={() => navigate({ to: "/tutor" })}>
                      <GraduationCap className="mr-2 h-4 w-4" /> Switch to tutor dashboard
                    </DropdownMenuItem>
                  )}
                  {canSwitchToStudent && (
                    <DropdownMenuItem onClick={() => navigate({ to: "/student" })}>
                      <BookOpen className="mr-2 h-4 w-4" /> Switch to student dashboard
                    </DropdownMenuItem>
                  )}
                  {canBecomeTutor && (
                    <DropdownMenuItem onClick={() => navigate({ to: "/become-tutor" })}>
                      <Sparkles className="mr-2 h-4 w-4" /> Become a tutor
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={doSignOut}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" onClick={doSignOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="ml-2 flex gap-1">
              <Link to="/auth/$role" params={{ role: "student" }}><Button variant="ghost" size="sm">Sign in</Button></Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
