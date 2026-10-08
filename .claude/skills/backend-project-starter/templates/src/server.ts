import { Hono } from "hono";
import { logger } from "hono/logger";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { checkDatabaseConnection, pool } from "./db/db";
import { auth } from "./lib/auth";
import { validateEnv } from "./lib/validateEnv";
import exampleRouter from "./routes/exampleRouter";
import uploadRouter from "./routes/uploadRouter";
import userRouter from "./routes/userRouter";
import { ApiError } from "./utils/ApiError";
import { handleDatabaseError } from "./utils/errorUtils";

// No `hono/bun`'s `websocket` import and no `Bun.serve({ websocket: ... })`
// here — this starter is plain HTTP. If chat is added later (see the
// realtime-chat-system skill), that skill's server-wiring.md walks through
// exactly what changes here: the `websocket` import, the `/ws` route mount,
// and swapping the plain `Bun.serve({ port, fetch })` below for the
// websocket-aware version plus `setLocalServer(server)`.

validateEnv();

export const app = new Hono();
const PORT = process.env.PORT || 8000;

app.use("*", logger());

// The only place that turns an error into an HTTP response — controllers/
// services only ever throw ApiError or return success data.
app.onError((err, c) => {
  const method = c.req.method;
  const path = c.req.path;

  if (err instanceof ApiError) {
    console.error(`[${method}] ${path} - API ERROR: ${err.message}`);
    return c.json({ success: false, message: err.message }, err.statusCode as ContentfulStatusCode);
  }

  const dbError = handleDatabaseError(err);
  if (dbError) {
    console.error(`[${method}] ${path} - DB ERROR: ${dbError.message}`);
    return c.json({ success: false, message: dbError.message }, dbError.status as ContentfulStatusCode);
  }

  console.error(`[${method}] ${path} - UNKNOWN ERROR:`, err);
  return c.json({ success: false, message: "Internal Server Error" }, 500);
});

await checkDatabaseConnection();

app.get("/", (c) => c.json({ status: "ok", timestamp: Date.now() }));

// better-auth's own handler, deliberately outside /api/v1 — see auth.ts's
// comment.
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/v1/users", userRouter);
app.route("/api/v1/uploads", uploadRouter);
app.route("/api/v1/items", exampleRouter); // the one example resource — see exampleSchema.ts

const server = Bun.serve({ port: PORT, fetch: app.fetch });

// Without this, a deploy/restart kills the process mid-request. `server.stop()`
// stops accepting new connections and resolves once existing ones finish;
// the pg pool is closed after so any request still finishing its DB work
// doesn't get cut off either.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received, shutting down gracefully...`);

  await server.stop();
  await pool.end();

  console.log("✅ Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default server;
