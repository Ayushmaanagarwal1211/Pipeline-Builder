import "server-only";

import { createHmac } from "node:crypto";

import { ApiError } from "@/lib/api/api-error";

/**
 * Transloadit signed upload.
 *
 * We never proxy files through our server — the client uploads directly to
 * `api2.transloadit.com` using params we sign on the server. This keeps the
 * auth secret out of the browser and off the hot path for large files.
 *
 * Flow:
 *   1. Client POSTs /api/uploads/sign
 *   2. Server builds `params` JSON (auth + template + expiry) and signs it
 *   3. Server returns { endpoint, params, signature }
 *   4. Client POSTs FormData { params, signature, file } to endpoint
 *   5. With `?wait=true`, Transloadit blocks until the assembly finishes and
 *      returns result URLs in the response body.
 */

const ASSEMBLY_ENDPOINT = "https://api2.transloadit.com/assemblies";

/** How long a signed params blob is valid before Transloadit rejects it. */
const SIGNATURE_TTL_MS = 60 * 60 * 1000; // 1h

export interface SignedUploadParams {
  readonly endpoint: string;
  readonly params: string;
  readonly signature: string;
}

export function createSignedUploadParams(): SignedUploadParams {
  const authKey = process.env.TRANSLOADIT_AUTH_KEY;
  const authSecret = process.env.TRANSLOADIT_AUTH_SECRET;
  const templateId = process.env.TRANSLOADIT_TEMPLATE_ID;

  if (!authKey || !authSecret || !templateId) {
    throw ApiError.badRequest(
      "Transloadit not configured — set TRANSLOADIT_AUTH_KEY, TRANSLOADIT_AUTH_SECRET, and TRANSLOADIT_TEMPLATE_ID",
    );
  }

  const params = JSON.stringify({
    auth: {
      key: authKey,
      expires: formatTransloaditExpiry(new Date(Date.now() + SIGNATURE_TTL_MS)),
    },
    template_id: templateId,
  });

  const signature = `sha384:${createHmac("sha384", authSecret)
    .update(params)
    .digest("hex")}`;

  return { endpoint: ASSEMBLY_ENDPOINT, params, signature };
}

/** Transloadit expects `YYYY/MM/DD HH:mm:ss+00:00` in UTC. */
function formatTransloaditExpiry(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}` +
    ` ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}+00:00`
  );
}

// -----------------------------------------------------------------------------
// Server-side upload (used by Trigger.dev tasks whose output is a Buffer)
// -----------------------------------------------------------------------------

/**
 * Upload an in-memory buffer to Transloadit and return its public URL.
 * Unlike the browser XHR path, we don't need progress events here — we just
 * POST once with `wait=true` and read the resulting assembly JSON.
 *
 * Used by FFmpeg-backed tasks (crop-image, extract-frame) so their output
 * is a persistent CDN URL rather than a giant `data:` URL that bloats the
 * database and chokes downstream LLM payloads.
 */
export async function uploadBufferToTransloadit({
  buffer,
  fileName,
  mimeType,
}: {
  readonly buffer: Buffer;
  readonly fileName: string;
  readonly mimeType: string;
}): Promise<{ url: string; mimeType: string | null }> {
  const signed = createSignedUploadParams();

  const form = new FormData();
  form.append("params", signed.params);
  form.append("signature", signed.signature);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = new Blob([buffer as any], { type: mimeType });
  form.append("file", blob, fileName);

  const response = await fetch(`${signed.endpoint}?wait=true`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const body = await safeReadText(response);
    throw new Error(
      `Transloadit upload failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }

  const assembly: unknown = await response.json();
  const extracted = extractFirstResultFile(assembly);
  if (!extracted) {
    throw new Error(
      "Transloadit returned no file URL for server-side upload — check the template's export step",
    );
  }
  return extracted;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unreadable response body>";
  }
}

interface TransloaditResultFile {
  readonly ssl_url?: string;
  readonly url?: string;
  readonly mime?: string;
}

interface TransloaditAssembly {
  readonly error?: string;
  readonly message?: string;
  readonly results?: Record<string, readonly TransloaditResultFile[]>;
  readonly uploads?: readonly TransloaditResultFile[];
}

function extractFirstResultFile(
  assembly: unknown,
): { url: string; mimeType: string | null } | null {
  if (!assembly || typeof assembly !== "object") return null;
  const { results, uploads, error, message } = assembly as TransloaditAssembly;
  if (error) {
    throw new Error(`Transloadit: ${error}${message ? ` — ${message}` : ""}`);
  }

  if (results) {
    const names = Object.keys(results);
    const processed = names.filter((name) => name !== ":original");
    const ordered = [...processed, ...names.filter((n) => !processed.includes(n))];
    for (const name of ordered) {
      const picked = pickFileUrl(results[name]);
      if (picked) return picked;
    }
  }
  return pickFileUrl(uploads);
}

function pickFileUrl(
  files: readonly TransloaditResultFile[] | undefined,
): { url: string; mimeType: string | null } | null {
  if (!files || files.length === 0) return null;
  const [first] = files;
  const url = first.ssl_url ?? first.url;
  if (!url) return null;
  return { url, mimeType: first.mime ?? null };
}
