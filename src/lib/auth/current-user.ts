import { auth, currentUser } from "@clerk/nextjs/server";

import { ApiError } from "@/lib/api/api-error";
import { prisma } from "@/lib/db/prisma";

/**
 * Clerk-backed auth for the API layer. Read the Clerk session, mirror the
 * user into Postgres on first access so every row that foreign-keys to
 * `users.id` has a valid target, then hand the Clerk user id back to the
 * caller. Unauthenticated calls surface as 401 via `ApiError`.
 *
 * The page layer's middleware (`proxy.ts`) already redirects unauthenticated
 * browser navigations — `ensureCurrentUser` covers the narrow window where an
 * expired token reaches an API route directly.
 */
export async function getCurrentUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw ApiError.unauthorized();
  return userId;
}

/**
 * Returns the Clerk user id and guarantees a matching `users` row exists.
 * Idempotent — the first call populates name/email from Clerk, subsequent
 * calls skip the Clerk roundtrip.
 */
export async function ensureCurrentUser(): Promise<string> {
  const id = await getCurrentUserId();

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (existing) return id;

  const clerkUser = await currentUser();
  await prisma.user.create({
    data: {
      id,
      email: clerkUser?.primaryEmailAddress?.emailAddress ?? null,
      name: deriveDisplayName(clerkUser),
    },
  });
  return id;
}

function deriveDisplayName(
  user: Awaited<ReturnType<typeof currentUser>>,
): string | null {
  if (!user) return null;
  if (user.fullName) return user.fullName;
  if (user.firstName || user.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(" ");
  }
  return user.username ?? null;
}
