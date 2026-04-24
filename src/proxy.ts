import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";

/**
 * Next.js 16 renamed `middleware` to `proxy` and forces the Node.js runtime.
 * Clerk's helper still works unchanged — only the file/export names differ.
 *
 * Pages without a session redirect to `/sign-in`. API routes skip the
 * redirect so their route handlers can return structured 401 JSON via
 * `ensureCurrentUser()` — otherwise a fetch from an expired session would
 * receive an HTML redirect and fail to parse.
 */
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const isApiRoute = createRouteMatcher(["/api/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req) || isApiRoute(req)) return;
  await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
