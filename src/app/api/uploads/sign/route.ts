import { NextResponse } from "next/server";

import { handleError } from "@/lib/api/handler-utils";
import { ensureCurrentUser } from "@/lib/auth/current-user";
import { createSignedUploadParams } from "@/lib/uploads/transloadit";

/**
 * Returns a short-lived signed params blob that the client uses to upload
 * directly to Transloadit. Requires an authenticated user so anonymous
 * traffic can't burn the Transloadit quota.
 */
export async function POST() {
  try {
    await ensureCurrentUser();
    return NextResponse.json(createSignedUploadParams());
  } catch (error) {
    return handleError(error);
  }
}
