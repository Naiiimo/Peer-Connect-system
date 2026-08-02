import { createFileRoute } from "@tanstack/react-router";
import { LibraryBrowser } from "@/components/LibraryBrowser";

export const Route = createFileRoute("/_authenticated/student/library")({ component: Library });

function Library() {
  return <LibraryBrowser title="Library" description="Your documents, notes and shared resources." />;
}
