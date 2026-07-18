export const LANGUAGES = [
  "English",
  "Swahili",
  "Somali",
  "Chinese",
  "French",
  "Spanish",
  "Japanese",
  "Arabic",
] as const;
export type Language = (typeof LANGUAGES)[number];
