import { prisma } from "@/lib/db/prisma";

/**
 * Login has been removed from the app — there is no Clerk session and every
 * request is treated as the same single local user. These helpers keep the
 * existing API surface (`getCurrentUserId` / `ensureCurrentUser`) so route
 * handlers stay unchanged, while resolving to a fixed user id that every row
 * foreign-keying to `users.id` can safely reference.
 */
const LOCAL_USER = {
  id: "local-user",
  email: "local@nextflow.app",
  name: "Local User",
} as const;

/** Returns the fixed local user id. Never throws — there is no auth to fail. */
export async function getCurrentUserId(): Promise<string> {
  return LOCAL_USER.id;
}

/**
 * Guarantees the single local `users` row exists and returns its id.
 * Idempotent via upsert, so concurrent first-access calls are safe.
 */
export async function ensureCurrentUser(): Promise<string> {
  await prisma.user.upsert({
    where: { id: LOCAL_USER.id },
    update: {},
    create: { id: LOCAL_USER.id, email: LOCAL_USER.email, name: LOCAL_USER.name },
  });
  return LOCAL_USER.id;
}
