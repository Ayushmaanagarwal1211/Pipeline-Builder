/**
 * Gemini models exposed to the "Run Any LLM" node.
 * Keep as a single source of truth — dropdown options and the backend
 * execution task both read from here.
 */
export const GEMINI_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
] as const;

export type GeminiModel = (typeof GEMINI_MODELS)[number]["value"];

export const DEFAULT_GEMINI_MODEL: GeminiModel = "gemini-2.5-flash";
