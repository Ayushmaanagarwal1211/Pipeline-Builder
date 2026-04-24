import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * In development, HMR causes the module to re-evaluate, which would spawn a
 * new connection pool on every edit. Caching on `globalThis` keeps a single
 * client alive across reloads. In production the module is loaded once so
 * the cache is skipped.
 */

declare global {
  // eslint-disable-next-line no-var
  var __nextflowPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__nextflowPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__nextflowPrisma = prisma;
}
