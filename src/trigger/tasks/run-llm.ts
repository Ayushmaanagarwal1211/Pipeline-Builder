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
 * Resilience strategy (Gemini flagship models hit 503 "high demand" spikes
 * regularly on the free tier):
 *   1. Retry the user-selected model a few times with exponential backoff.
 *   2. If still 5xx, fall back to the next model in `FALLBACK_CHAIN`.
 *   3. Account-level errors (400/401/403/429) abort immediately — no retry,
 *      no fallback, since the message already explains the user-actionable
 *      cause (bad key, exhausted quota).
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
        if (isAccountLevelError(error)) {
          throw new AbortTaskRunError(formatGeminiError(error));
        }
        lastTransientError = error;
      }
    }

    throw new AbortTaskRunError(
      `Gemini overloaded across all fallback models (${modelsToTry.join(
        ", ",
      )}). Try again in a minute. Last error: ${
        lastTransientError instanceof Error
          ? lastTransientError.message
          : String(lastTransientError)
      }`,
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
      if (isAccountLevelError(error) || attempt >= PRIMARY_RETRIES) throw error;
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
 * Account-level: 400 (invalid key/request), 401, 403 (disabled), 429 (quota).
 * Transient (retry / fallback worthy): 5xx, network.
 */
function isAccountLevelError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /\b(400|401|403|429)\b/.test(error.message);
}

function formatGeminiError(error: unknown): string {
  if (!(error instanceof Error)) return "Gemini request failed";
  if (error.message.includes("429")) {
    return "Gemini quota exhausted — try a different model or enable billing on your Google Cloud project.";
  }
  if (error.message.includes("403") || error.message.includes("401")) {
    return "Gemini API key rejected — check GEMINI_API_KEY in .env.";
  }
  return error.message;
}
