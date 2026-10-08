import type { Context, Next } from "hono";
import { auth } from "../lib/auth";
import { ApiError } from "../utils/ApiError";

// The first real session-based auth in the project (see CLAUDE.md's "Auth"
// section) — scoped to the chat feature for now, since chat needs a real
// identity to open a WebSocket as (a client-supplied `user_id`, the pattern
// every other resource still uses, can't mean anything for "who is this
// socket connected as"). Older endpoints aren't retrofitted to this by this
// change; see CLAUDE.md for the plan to do that incrementally.
export interface AuthedUser {
  id: string;
  name: string;
  email: string;
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthedUser;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) throw ApiError.unauthorized("Sign in required");

  c.set("user", {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  await next();
}
