import {
  GoogleGenerativeAI,
  type GenerativeModel,
  type Part,
} from "@google/generative-ai";
import { AbortTaskRunError, task } from "@trigger.dev/sdk";

import { fetchToBuffer } from "@/lib/workflow/ffmpeg";
import { GEMINI_MODELS, type GeminiModel } from "@/lib/workflow/llm-models";
import {
  RunLlmPayloadSchema,
  type RunLlmOutput,
  type RunLlmPayload,
} from "@/trigger/schemas";

/**
 * Executes a Gemini prompt. Inputs may include multiple images (as URLs or
 * `data:` URLs). The returned `output` is the plain-text model response.
 *
 * Resilience strategy:
 *   1. Retry the user-selected model a few times with exponential backoff
 *      on 5xx (high-demand spikes clear in seconds).
 *   2. On 5xx exhausted OR 429 (per-model quota), fall through to the next
 *      model in `FALLBACK_CHAIN`. Free-tier quotas are per-model on Gemini,
 *      so 429 on Flash doesn't mean Pro is also exhausted.
 *   3. Config-level errors (400/401/403) abort immediately — retrying a
 *      bad API key or malformed request will never succeed.
 */
const PRIMARY_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1500;
const FALLBACK_CHAIN: readonly GeminiModel[] = GEMINI_MODELS.map(
  (m) => m.value,
);

export const runLlmTask = task({
  id: "nextflow.run-llm",
  maxDuration: 180,
  retry: {
    maxAttempts: 1,
  },
  run: async (rawPayload: RunLlmPayload): Promise<RunLlmOutput> => {
    const payload = RunLlmPayloadSchema.parse(rawPayload);
    const apiKey = requireEnv("GEMINI_API_KEY");

    const client = new GoogleGenerativeAI(apiKey);
    const parts = await buildPromptParts(payload);

    const modelsToTry = buildModelOrder(payload.model);
    let lastTransientError: unknown;

    for (const modelId of modelsToTry) {
      try {
        const text = await callWithRetry(client, modelId, payload, parts);
        return { output: text };
      } catch (error) {
        if (isConfigError(error)) {
          // Bad key / disabled API — no amount of fallback fixes it.
          throw new AbortTaskRunError(formatGeminiError(error));
        }
        // 429 (quota) + 5xx (overload) — try next model in chain.
        lastTransientError = error;
      }
    }

    throw new AbortTaskRunError(
      `All Gemini fallback models failed (${modelsToTry.join(
        ", ",
      )}). ${formatGeminiError(lastTransientError)}`,
    );
  },
});

async function buildPromptParts(payload: RunLlmPayload): Promise<Part[]> {
  const imageParts: Part[] = await Promise.all(
    payload.imageUrls.map(async (url) => {
      const { buffer, mimeType } = await fetchToBuffer(url);
      return {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType,
        },
      };
    }),
  );
  return [{ text: payload.userMessage }, ...imageParts];
}

async function callWithRetry(
  client: GoogleGenerativeAI,
  modelId: GeminiModel,
  payload: RunLlmPayload,
  parts: Part[],
): Promise<string> {
  const model: GenerativeModel = client.getGenerativeModel({
    model: modelId,
    systemInstruction: payload.systemPrompt ?? undefined,
  });

  let attempt = 0;
  while (true) {
    try {
      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (error) {
      attempt += 1;
      // Only 5xx is worth an in-model retry. 4xx (config or quota) doesn't
      // resolve by retrying the same model — surface it so the outer loop
      // either aborts (config) or moves to the next model (quota).
      if (!isTransientServerError(error) || attempt >= PRIMARY_RETRIES) {
        throw error;
      }
      await sleep(jitteredBackoff(attempt));
    }
  }
}

function buildModelOrder(preferred: string): readonly GeminiModel[] {
  const preferredAsKnown = FALLBACK_CHAIN.find((m) => m === preferred);
  if (!preferredAsKnown) return FALLBACK_CHAIN;
  return [
    preferredAsKnown,
    ...FALLBACK_CHAIN.filter((m) => m !== preferredAsKnown),
  ];
}

function jitteredBackoff(attempt: number): number {
  const base = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  return base + Math.random() * base * 0.5;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

/**
 * Gemini's SDK throws an Error whose message starts with the HTTP status.
 *   - 400 (malformed), 401 (bad key), 403 (disabled) = no recovery, abort.
 *   - 429 (quota) = per-model bucket, try next model in fallback chain.
 *   - 5xx / network = high-demand spike, in-model retry then fallback.
 */
function isConfigError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /\b(400|401|403)\b/.test(error.message);
}

function isTransientServerError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /\b5\d{2}\b/.test(error.message);
}

function formatGeminiError(error: unknown): string {
  if (!(error instanceof Error)) return "Gemini request failed";
  if (error.message.includes("429")) {
    return "Gemini free-tier quota exhausted on every fallback model. Wait a few minutes, enable billing on the Google Cloud project, or use a different API key.";
  }
  if (error.message.includes("403") || error.message.includes("401")) {
    return "Gemini API key rejected — check GEMINI_API_KEY.";
  }
  return error.message;
}
