import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  abstract: string | null;
  url: string | null;
  doi: string | null;
  cited_by: number;
  source: "Semantic Scholar" | "arXiv" | "CORE";
  open_access: boolean;
}

const SearchInput = z.object({ query: z.string().min(2).max(300), perPage: z.number().min(1).max(25).optional() });

type Result = { results: Paper[]; sources: string[] };

async function fromSemanticScholar(q: string, limit: number): Promise<Paper[]> {
  const fields = "title,abstract,year,authors,venue,externalIds,url,openAccessPdf,citationCount";
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=${limit}&fields=${fields}`;
  const res = await fetch(url, { headers: { "User-Agent": "USIU-Peer-Connect/1.0" } });
  if (!res.ok) return [];
  const j = (await res.json()) as any;
  return (j.data ?? []).map((w: any): Paper => ({
    id: `s2:${w.paperId ?? w.externalIds?.DOI ?? w.title}`,
    title: w.title ?? "Untitled",
    authors: (w.authors ?? []).map((a: any) => a.name).filter(Boolean),
    year: w.year ?? null,
    venue: w.venue ?? null,
    abstract: w.abstract ?? null,
    url: w.openAccessPdf?.url ?? w.url ?? (w.externalIds?.DOI ? `https://doi.org/${w.externalIds.DOI}` : null),
    doi: w.externalIds?.DOI ?? null,
    cited_by: w.citationCount ?? 0,
    source: "Semantic Scholar",
    open_access: !!w.openAccessPdf?.url,
  }));
}

async function fromArxiv(q: string, limit: number): Promise<Paper[]> {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const xml = await res.text();
  const entries = xml.split("<entry>").slice(1);
  return entries.map((raw): Paper => {
    const pick = (tag: string) => {
      const m = raw.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? m[1].replace(/\s+/g, " ").trim() : "";
    };
    const idUrl = pick("id");
    const title = pick("title");
    const summary = pick("summary");
    const published = pick("published");
    const year = published ? Number(published.slice(0, 4)) : null;
    const authors = Array.from(raw.matchAll(/<author>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/g)).map((m) => m[1].trim());
    return {
      id: `arxiv:${idUrl}`,
      title,
      authors,
      year,
      venue: "arXiv preprint",
      abstract: summary,
      url: idUrl,
      doi: null,
      cited_by: 0,
      source: "arXiv",
      open_access: true,
    };
  });
}

async function fromCore(q: string, limit: number): Promise<Paper[]> {
  // CORE public search — no key required for the search endpoint.
  const url = `https://api.core.ac.uk/v3/search/outputs?q=${encodeURIComponent(q)}&limit=${limit}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const j = (await res.json()) as any;
    return (j.results ?? []).slice(0, limit).map((w: any): Paper => ({
      id: `core:${w.id ?? w.doi ?? w.title}`,
      title: w.title ?? "Untitled",
      authors: (w.authors ?? []).map((a: any) => a.name ?? a).filter(Boolean),
      year: w.yearPublished ?? null,
      venue: w.publisher ?? w.sourceFulltextUrls?.[0] ?? null,
      abstract: w.abstract ?? null,
      url: w.downloadUrl ?? w.sourceFulltextUrls?.[0] ?? w.doi ?? null,
      doi: w.doi ?? null,
      cited_by: w.citationCount ?? 0,
      source: "CORE",
      open_access: true,
    }));
  } catch {
    return [];
  }
}

function dedupe(papers: Paper[]): Paper[] {
  const seen = new Set<string>();
  const out: Paper[] = [];
  for (const p of papers) {
    const key = (p.doi ?? p.title ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export const searchPapers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data }): Promise<Paper[]> => {
    const perSource = Math.max(3, Math.ceil((data.perPage ?? 15) / 2));
    const [s2, ax, core] = await Promise.all([
      fromSemanticScholar(data.query, perSource).catch(() => []),
      fromArxiv(data.query, perSource).catch(() => []),
      fromCore(data.query, perSource).catch(() => []),
    ]);
    return dedupe([...s2, ...ax, ...core]).slice(0, data.perPage ?? 15);
  });

const SummarizeInput = z.object({
  title: z.string(),
  abstract: z.string().nullable(),
  topic: z.string().optional(),
});

export const summarizePaper = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SummarizeInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const prompt = `You are an academic research assistant. Given a paper, produce:
1. A concise plain-language summary (3-4 sentences).
2. Key findings (bullet list, 3-5 items).
3. Why it is relevant to the student's topic${data.topic ? ` "${data.topic}"` : ""}.

Paper title: ${data.title}
Abstract: ${data.abstract ?? "(no abstract available — infer from the title)"}

Return clean markdown with headings: **Summary**, **Key findings**, **Relevance**.`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You help USIU students understand academic papers clearly." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (res.status === 429) throw new Error("Rate limit — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits.");
    if (!res.ok) throw new Error(`AI error: ${res.status}`);
    const j = (await res.json()) as any;
    return { content: j.choices?.[0]?.message?.content ?? "" };
  });
