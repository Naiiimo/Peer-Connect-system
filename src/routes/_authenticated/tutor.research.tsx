import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, FileText, Copy, Download, ExternalLink, Bookmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { searchPapers, summarizePaper, type Paper } from "@/lib/research.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/tutor/research")({ component: ResearchPage });

type CiteStyle = "APA" | "MLA" | "IEEE" | "Harvard";

function formatAuthors(authors: string[], style: CiteStyle): string {
  if (!authors.length) return "Unknown Author";
  const surnameFirst = (name: string) => {
    const parts = name.trim().split(/\s+/);
    const last = parts.pop() ?? name;
    const initials = parts.map((p) => `${p[0]}.`).join(" ");
    return initials ? `${last}, ${initials}` : last;
  };
  if (style === "APA" || style === "Harvard") {
    if (authors.length === 1) return surnameFirst(authors[0]);
    if (authors.length === 2) return `${surnameFirst(authors[0])}, & ${surnameFirst(authors[1])}`;
    return `${surnameFirst(authors[0])}, et al.`;
  }
  if (style === "MLA") {
    if (authors.length === 1) return surnameFirst(authors[0]);
    if (authors.length === 2) return `${surnameFirst(authors[0])}, and ${authors[1]}`;
    return `${surnameFirst(authors[0])}, et al.`;
  }
  // IEEE
  const ieee = (n: string) => {
    const parts = n.trim().split(/\s+/);
    const last = parts.pop() ?? n;
    const initials = parts.map((p) => `${p[0]}.`).join(" ");
    return initials ? `${initials} ${last}` : last;
  };
  if (authors.length <= 3) return authors.map(ieee).join(", ");
  return `${ieee(authors[0])} et al.`;
}

function buildCitation(p: Paper, style: CiteStyle): string {
  const yr = p.year ?? "n.d.";
  const venue = p.venue ?? "";
  const url = p.doi ?? p.url ?? "";
  const a = formatAuthors(p.authors, style);
  switch (style) {
    case "APA":
      return `${a} (${yr}). ${p.title}. ${venue}${venue ? "." : ""} ${url}`.trim();
    case "MLA":
      return `${a}. "${p.title}." ${venue}${venue ? ", " : ""}${yr}${url ? `, ${url}` : ""}.`;
    case "IEEE":
      return `${a}, "${p.title}," ${venue}${venue ? ", " : ""}${yr}. [Online]. Available: ${url}`;
    case "Harvard":
      return `${a} ${yr}, '${p.title}', ${venue}${url ? `, viewed at ${url}` : ""}.`;
  }
}

function inTextCitation(p: Paper, style: CiteStyle): string {
  const first = p.authors[0]?.split(/\s+/).pop() ?? "Anon";
  const yr = p.year ?? "n.d.";
  const etal = p.authors.length > 1 ? " et al." : "";
  if (style === "IEEE") return `[cite]`;
  if (style === "MLA") return `(${first}${etal})`;
  return `(${first}${etal}, ${yr})`;
}

function ResearchPage() {
  const { user } = useAuth();
  const search = useServerFn(searchPapers);
  const summarize = useServerFn(summarizePaper);
  const [query, setQuery] = useState("");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [style, setStyle] = useState<CiteStyle>("APA");

  const runSearch = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const results = await search({ data: { query: query.trim() } });
      setPapers(results);
      if (!results.length) toast.info("No papers found — try broader keywords.");
    } catch (e: any) {
      toast.error(e.message ?? "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const runSummary = async (p: Paper) => {
    setSummarizing(p.id);
    try {
      const { content } = await summarize({ data: { title: p.title, abstract: p.abstract, topic: query } });
      setSummaries((s) => ({ ...s, [p.id]: content }));
    } catch (e: any) {
      toast.error(e.message ?? "AI summary failed");
    } finally {
      setSummarizing(null);
    }
  };

  const copyText = async (text: string, label = "Copied") => {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const downloadCitation = (p: Paper) => {
    const text = buildCitation(p, style);
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${p.title.slice(0, 40).replace(/[^a-z0-9]+/gi, "_")}-${style}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const savePaper = async (p: Paper) => {
    if (!user) return;
    const body = [
      `Title: ${p.title}`,
      `Authors: ${p.authors.join(", ")}`,
      `Year: ${p.year ?? ""}`,
      `Venue: ${p.venue ?? ""}`,
      `URL: ${p.url ?? ""}`,
      "",
      `Abstract: ${p.abstract ?? ""}`,
      "",
      `Citation (${style}): ${buildCitation(p, style)}`,
    ].join("\n");
    const path = `${user.id}/research/${Date.now()}-${p.title.slice(0, 40).replace(/[^a-z0-9]+/gi, "_")}.txt`;
    const { error } = await supabase.storage.from("library").upload(path, new Blob([body], { type: "text/plain" }));
    if (error) return toast.error(error.message);
    await supabase.from("library_documents").insert({
      owner_id: user.id, name: `${p.title.slice(0, 80)}.txt`, path, source: "research",
    });
    toast.success("Saved to your library");
  };

  return (
    <div>
      <PageHeader
        title="Research assistant"
        description="Find credible academic sources, get AI summaries, and generate citations — all in one place."
      />

      <div className="card-elevated mb-6 flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder='e.g. "The impact of AI in education"'
            className="pl-9"
          />
        </div>
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as CiteStyle)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-label="Citation style"
        >
          <option value="APA">APA</option>
          <option value="MLA">MLA</option>
          <option value="IEEE">IEEE</option>
          <option value="Harvard">Harvard</option>
        </select>
        <Button onClick={runSearch} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Find sources
        </Button>
      </div>

      {papers.length === 0 && !loading && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Start by searching for a topic. Results come from OpenAlex — millions of peer-reviewed papers.
        </div>
      )}

      <div className="space-y-4">
        {papers.map((p) => {
          const isOpen = expanded === p.id;
          const citation = buildCitation(p, style);
          return (
            <article key={p.id} className="card-elevated p-4">
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold leading-snug">{p.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.authors.slice(0, 4).join(", ")}{p.authors.length > 4 ? " et al." : ""}
                    {p.year ? ` · ${p.year}` : ""}{p.venue ? ` · ${p.venue}` : ""}
                    {p.cited_by ? ` · cited by ${p.cited_by}` : ""}
                  </p>
                </div>
              </header>

              {p.abstract && (
                <p className={`mt-3 text-sm text-muted-foreground ${isOpen ? "" : "line-clamp-3"}`}>{p.abstract}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setExpanded(isOpen ? null : p.id)}>
                  <FileText className="mr-1 h-4 w-4" /> {isOpen ? "Hide details" : "View details"}
                </Button>
                <Button size="sm" onClick={() => runSummary(p)} disabled={summarizing === p.id}>
                  {summarizing === p.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                  Summarize
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyText(citation, `${style} citation copied`)}>
                  <Copy className="mr-1 h-4 w-4" /> Copy citation
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyText(inTextCitation(p, style), "In-text citation copied")}>
                  In-text
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadCitation(p)}>
                  <Download className="mr-1 h-4 w-4" /> Download
                </Button>
                <Button size="sm" variant="outline" onClick={() => savePaper(p)}>
                  <Bookmark className="mr-1 h-4 w-4" /> Save
                </Button>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost">
                      <ExternalLink className="mr-1 h-4 w-4" /> Open
                    </Button>
                  </a>
                )}
              </div>

              {isOpen && (
                <div className="mt-4 rounded-md bg-muted/40 p-3 text-xs">
                  <div className="mb-2 font-semibold uppercase tracking-wider text-muted-foreground">{style} citation</div>
                  <p className="font-mono text-[11px] leading-relaxed">{citation}</p>
                </div>
              )}

              {summaries[p.id] && (
                <div className="mt-4 rounded-md border border-mint bg-mint/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" /> AI summary
                  </div>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-foreground">
                    {summaries[p.id]}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
