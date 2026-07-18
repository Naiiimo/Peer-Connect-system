import { LANGUAGES } from "@/lib/languages";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function LanguagePicker({
  value,
  onChange,
  label = "Languages you speak",
}: {
  value: string[];
  onChange: (langs: string[]) => void;
  label?: string;
}) {
  const toggle = (lang: string, checked: boolean) => {
    onChange(checked ? Array.from(new Set([...value, lang])) : value.filter((l) => l !== lang));
  };
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 grid grid-cols-2 gap-2 rounded-md border border-border p-3 sm:grid-cols-4">
        {LANGUAGES.map((l) => (
          <label key={l} className="flex items-center gap-2 text-sm">
            <Checkbox checked={value.includes(l)} onCheckedChange={(c) => toggle(l, !!c)} />
            <span>{l}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
