import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { refineText } from "@/lib/ai.functions";

/** Small inline "AI Refine" button used on textareas / inputs across the app. */
export function RefineButton({
  value,
  onChange,
  context,
  disabled,
  size = "sm",
}: {
  value: string;
  onChange: (next: string) => void;
  context?: string;
  disabled?: boolean;
  size?: "sm" | "xs";
}) {
  const refine = useServerFn(refineText);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!value?.trim()) return toast.info("Type something first.");
    setLoading(true);
    try {
      const { refined } = await refine({ data: { text: value, context } });
      onChange(refined);
      toast.success("Text refined");
    } catch (e: any) {
      toast.error(e.message ?? "Refine failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={size === "xs" ? "h-6 px-2 text-[11px]" : "h-7 px-2 text-xs"}
      onClick={run}
      disabled={loading || disabled}
      aria-label="AI Refine"
    >
      {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
      AI Refine
    </Button>
  );
}
