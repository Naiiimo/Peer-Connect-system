import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Upload, FileText, Trash2, Loader2, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";

const MAX_BYTES = 20 * 1024 * 1024;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function kindOf(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

export function LibraryBrowser({ title, description }: { title: string; description: string }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; url: string; kind: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name" | "type">("newest");


  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("library_documents").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    const rows = data ?? [];
    const signed = await Promise.all(rows.map(async (doc: any) => {
      if (kindOf(doc.name) !== "image") return doc;
      const result = await supabase.storage.from("library").createSignedUrl(doc.path, 3600);
      return { ...doc, preview_url: result.data?.signedUrl ?? null };
    }));
    setDocs(signed);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const upload = async (file: File) => {
    if (!user) return;
    if (file.size > MAX_BYTES) {
      return toast.error(`"${file.name}" is ${mb(file.size)} — the limit is 20 MB. Please compress it and try again.`);
    }
    if (file.size === 0) return toast.error(`"${file.name}" is empty and cannot be uploaded.`);
    setUploading(file.name);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("library").upload(path, file);
    if (error) { setUploading(null); return toast.error(error.message); }
    const { error: rowError } = await supabase.from("library_documents").insert({ owner_id: user.id, name: file.name, path, source: "upload" });
    setUploading(null);
    if (rowError) {
      await supabase.storage.from("library").remove([path]);
      return toast.error(rowError.message);
    }
    toast.success(`Uploaded ${file.name} (${mb(file.size)})`);
    load();
  };

  const openPreview = async (d: any) => {
    const { data, error } = await supabase.storage.from("library").createSignedUrl(d.path, 3600);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Could not open this file.");
    const kind = kindOf(d.name);
    if (kind === "other") { window.open(data.signedUrl, "_blank", "noopener"); return; }
    setPreview({ name: d.name, url: data.signedUrl, kind });
  };

  const confirmDelete = async () => {
    const d = pendingDelete;
    setPendingDelete(null);
    if (!d) return;
    const { error } = await supabase.storage.from("library").remove([d.path]);
    if (error) return toast.error(error.message);
    const { error: rowError } = await supabase.from("library_documents").delete().eq("id", d.id);
    if (rowError) return toast.error(rowError.message);
    toast.success("Deleted");
    load();
  };

  const visible = docs
    .filter((d) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return d.name.toLowerCase().includes(q) || kindOf(d.name).includes(q);
    })
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "type") return kindOf(a.name).localeCompare(kindOf(b.name)) || a.name.localeCompare(b.name);
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      return sort === "oldest" ? at - bt : bt - at;
    });


  return (
    <div>
      <PageHeader title={title} description={description} actions={
        <label>
          <input type="file" hidden disabled={!!uploading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
          <Button asChild disabled={!!uploading}>
            <span>{uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}{uploading ? "Uploading…" : "Upload"}</span>
          </Button>
        </label>
      } />
      <p className="mb-3 text-xs text-muted-foreground">Files up to 20 MB. Images and PDFs open in a preview; other files download.</p>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your files by name or type…" className="pl-9" />
        </div>
        <select
          aria-label="Sort files"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
          <option value="type">File type</option>
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {docs.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
        {docs.length > 0 && visible.length === 0 && <p className="text-sm text-muted-foreground">No files match "{query}".</p>}
        {visible.map((d) => (

          <div key={d.id} className="card-elevated flex items-center gap-3 p-4">
            {d.preview_url
              ? <img src={d.preview_url} alt="" className="h-12 w-12 shrink-0 rounded-md border border-border object-cover" />
              : <FileText className="h-8 w-8 shrink-0 text-primary" />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{d.name}</div>
              <div className="text-[10px] text-muted-foreground">{kindOf(d.name).toUpperCase()} · {new Date(d.created_at).toLocaleDateString()}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => openPreview(d)}>Open</Button>
            <Button size="icon" variant="ghost" onClick={() => setPendingDelete(d)} aria-label="Delete file">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle className="truncate pr-8">{preview?.name}</DialogTitle></DialogHeader>
          {preview?.kind === "image" && <img src={preview.url} alt={preview.name} className="max-h-[70vh] w-full rounded-md object-contain" />}
          {preview?.kind === "pdf" && <iframe src={preview.url} title={preview.name} className="h-[70vh] w-full rounded-md border border-border" />}
          {preview && (
            <div className="flex flex-wrap gap-3 text-xs text-primary">
              <a href={preview.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline"><ExternalLink className="mr-1 inline h-3 w-3" />Open in a new tab</a>
              <a href={preview.url} download={preview.name} className="underline-offset-4 hover:underline"><Download className="mr-1 inline h-3 w-3" />Download</a>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>The file is removed from your library and storage. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep file</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
