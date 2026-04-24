import { defineConfig } from "@trigger.dev/sdk";
import { ffmpeg } from "@trigger.dev/build/extensions/core";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

/**
 * Trigger.dev v3 project configuration. The `project` ref is set from the
 * environment so local dev and deployed environments can point to different
 * projects without committing the value.
 *
 * Tasks are discovered under `src/trigger/**` by convention.
 *
 * FFmpeg integration:
 *   - `build.external: ["ffmpeg-static"]` keeps the `ffmpeg-static` package
 *     out of the esbuild output. The package's `index.js` resolves the
 *     binary via `path.join(__dirname, 'ffmpeg.exe')`; if we bundle it, the
 *     resolved path points at the build tmp dir where the .exe was never
 *     copied, producing ENOENT at runtime. External = runtime uses real
 *     node_modules where the binary sits next to the JS.
 *   - `extensions: [ffmpeg()]` only kicks in for cloud deploys; it adds a
 *     Linux apt install step to the container image and sets FFMPEG_PATH.
 *     Our ffmpeg wrapper already honors that env var via `ffmpeg-static`.
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_nextflow",
  runtime: "node",
  logLevel: "log",
  maxDuration: 300,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  build: {
    external: ["ffmpeg-static"],
    extensions: [
      ffmpeg(),
      prismaExtension({
        mode: "legacy",
        schema: "prisma/schema.prisma",
        directUrlEnvVarName: "DIRECT_URL",
      }),
    ],
  },
});
