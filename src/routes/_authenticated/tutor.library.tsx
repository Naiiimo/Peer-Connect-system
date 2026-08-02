import { createFileRoute } from "@tanstack/react-router";
import { LibraryBrowser } from "@/components/LibraryBrowser";

export const Route = createFileRoute("/_authenticated/tutor/library")({ component: Lib });

function Lib() {
  return <LibraryBrowser title="Teaching library" description="Materials you share with students." />;
}
