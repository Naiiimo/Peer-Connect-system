import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Messenger } from "@/components/Messenger";

export const Route = createFileRoute("/_authenticated/tutor/messages")({ component: () => (
  <div><PageHeader title="Messages" description="Chat with your students." /><Messenger /></div>
) });
