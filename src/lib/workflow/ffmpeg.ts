import { spawn } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import ffmpegStatic from "ffmpeg-static";

/**
 * Absolute path to the bundled FFmpeg binary. Resolved once per process.
 * `ffmpeg-static`'s default export is the path (a string) at runtime,
 * but its TS typing resolves to `unknown` depending on bundler — hence the cast.
 */
const FFMPEG_PATH = (ffmpegStatic as unknown as string | null) ?? "ffmpeg";

interface RunFfmpegOptions {
  readonly args: readonly string[];
  readonly inputBuffer: Buffer;
  readonly inputExtension: string;
  readonly outputExtension: string;
}

/**
 * Runs FFmpeg with `args`, feeding `inputBuffer` via a temp file and
 * returning the produced output file as a Buffer. Temp files are cleaned up
 * in `finally` so failures don't leak disk space.
 *
 * We materialize the input to disk rather than piping via stdin because many
 * FFmpeg operations (seek, stream mapping) rely on a seekable source.
 */
async function runFfmpeg({
  args,
  inputBuffer,
  inputExtension,
  outputExtension,
}: RunFfmpegOptions): Promise<Buffer> {
  const runId = randomUUID();
  const inputPath = join(tmpdir(), `nextflow-in-${runId}.${inputExtension}`);
  const outputPath = join(tmpdir(), `nextflow-out-${runId}.${outputExtension}`);

  await writeFile(inputPath, inputBuffer);

  try {
    const fullArgs = [
      "-y", // overwrite
      "-i",
      inputPath,
      ...args,
      outputPath,
    ];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(FFMPEG_PATH, fullArgs, { windowsHide: true });
      let stderr = "";
      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-500)}`));
      });
    });

    return await readFile(outputPath);
  } finally {
    await Promise.allSettled([unlink(inputPath), unlink(outputPath)]);
  }
}

/**
 * Download a URL to a Buffer. Supports `data:` URLs (used when upstream
 * nodes return base64-encoded intermediate outputs).
 */
export async function fetchToBuffer(url: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;,]+)(?:;base64)?,(.*)$/);
    if (!match) throw new Error("Invalid data URL");
    const [, mimeType, data] = match;
    const isBase64 = url.includes(";base64,");
    const buffer = Buffer.from(data, isBase64 ? "base64" : "utf8");
    return { buffer, mimeType };
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType =
    response.headers.get("content-type") ?? "application/octet-stream";
  return { buffer, mimeType };
}

export interface ProcessedAsset {
  readonly buffer: Buffer;
  readonly mimeType: string;
  readonly fileName: string;
}

export interface CropImageOptions {
  readonly imageUrl: string;
  readonly xPercent: number;
  readonly yPercent: number;
  readonly widthPercent: number;
  readonly heightPercent: number;
}

/**
 * Crop an image using FFmpeg's `crop` filter driven by percentages.
 * Returns the PNG bytes so the caller can upload them to persistent
 * storage (Transloadit). The spec explicitly requires a Transloadit URL
 * output, not a data URL.
 */
export async function cropImageToBuffer({
  imageUrl,
  xPercent,
  yPercent,
  widthPercent,
  heightPercent,
}: CropImageOptions): Promise<ProcessedAsset> {
  const { buffer, mimeType } = await fetchToBuffer(imageUrl);
  const ext = extensionForMime(mimeType, "png");

  const output = await runFfmpeg({
    args: [
      "-vf",
      `crop=iw*${pctToUnit(widthPercent)}:ih*${pctToUnit(
        heightPercent,
      )}:iw*${pctToUnit(xPercent)}:ih*${pctToUnit(yPercent)}`,
      "-frames:v",
      "1",
    ],
    inputBuffer: buffer,
    inputExtension: ext,
    outputExtension: "png",
  });

  return {
    buffer: output,
    mimeType: "image/png",
    fileName: `cropped-${Date.now()}.png`,
  };
}

export interface ExtractFrameOptions {
  readonly videoUrl: string;
  /** `"50%"` or a number of seconds like `"2.5"`. */
  readonly timestamp: string;
}

/**
 * Extract a single frame from a video at the given timestamp. Returns the
 * JPEG bytes so the caller can upload them to persistent storage.
 */
export async function extractFrameToBuffer({
  videoUrl,
  timestamp,
}: ExtractFrameOptions): Promise<ProcessedAsset> {
  const { buffer } = await fetchToBuffer(videoUrl);
  const seekSeconds = await resolveTimestampSeconds(buffer, timestamp);

  const output = await runFfmpeg({
    args: ["-ss", seekSeconds.toFixed(3), "-frames:v", "1", "-q:v", "2"],
    inputBuffer: buffer,
    inputExtension: "mp4",
    outputExtension: "jpg",
  });

  return {
    buffer: output,
    mimeType: "image/jpeg",
    fileName: `frame-${Date.now()}.jpg`,
  };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function pctToUnit(pct: number): string {
  const clamped = Math.min(Math.max(pct, 0), 100) / 100;
  return clamped.toFixed(4);
}

function extensionForMime(mime: string, fallback: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/x-m4v": "m4v",
  };
  return map[mime.toLowerCase()] ?? fallback;
}

/**
 * Convert a user-supplied timestamp string (`"50%"` or `"2.5"`) into seconds.
 * Percentage inputs probe the video duration via ffprobe-like metadata parsing
 * — here we parse ffmpeg's own stderr to extract duration since `ffprobe` is
 * a separate binary not bundled by `ffmpeg-static`.
 */
async function resolveTimestampSeconds(
  videoBuffer: Buffer,
  timestamp: string,
): Promise<number> {
  const trimmed = timestamp.trim();
  if (trimmed.endsWith("%")) {
    const pct = Math.max(
      0,
      Math.min(100, Number.parseFloat(trimmed.slice(0, -1))),
    );
    if (Number.isNaN(pct)) return 0;
    const durationSeconds = await probeVideoDuration(videoBuffer);
    return (pct / 100) * durationSeconds;
  }
  const seconds = Number.parseFloat(trimmed);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

async function probeVideoDuration(videoBuffer: Buffer): Promise<number> {
  const inputPath = join(tmpdir(), `nextflow-probe-${randomUUID()}.mp4`);
  await writeFile(inputPath, videoBuffer);

  try {
    return await new Promise<number>((resolve) => {
      const proc = spawn(
        FFMPEG_PATH,
        ["-i", inputPath, "-f", "null", "-"],
        { windowsHide: true },
      );
      let stderr = "";
      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      proc.on("close", () => {
        const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
        if (!match) return resolve(0);
        const [, h, m, s] = match;
        resolve(Number(h) * 3600 + Number(m) * 60 + Number(s));
      });
      proc.on("error", () => resolve(0));
    });
  } finally {
    await unlink(inputPath).catch(() => undefined);
  }
}
