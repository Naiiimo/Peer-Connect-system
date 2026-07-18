import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { TopBar } from "./TopBar";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export function DashboardShell({ items, children }: { items: NavItem[]; children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-20 flex flex-col gap-0.5">
            {items.map((it) => {
              const active = path === it.to || path.startsWith(it.to + "/");
              const Icon = it.icon;
              return (
                <Link key={it.to} to={it.to as any} className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}>
                  <Icon className="h-4 w-4" />{it.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-28 md:pb-6">{children}</main>
      </div>
      <MobileNav items={items} />
    </div>
  );
}

function MobileNav({ items }: { items: NavItem[] }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background/95 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:hidden">
      {items.slice(0, 5).map((it) => {
        const active = path === it.to || path.startsWith(it.to + "/");
        const Icon = it.icon;
        return (
          <Link key={it.to} to={it.to as any} className={cn("flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]", active ? "text-primary" : "text-muted-foreground")}>
            <Icon className="h-4 w-4" />{it.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
