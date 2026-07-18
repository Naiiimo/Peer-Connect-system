import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Messenger } from "@/components/Messenger";

export const Route = createFileRoute("/_authenticated/student/messages")({ component: () => (
  <div><PageHeader title="Messages" description="Chat with tutors and study partners." /><Messenger /></div>
) });
