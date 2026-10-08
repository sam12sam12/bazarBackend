import { Hono } from "hono";
import { presignUploadSchema } from "../db/validation";
import { presignUpload } from "../utils/storage/instance";
import { authMiddleware } from "../middlewares/authMiddleware";
import { rateLimit } from "../middlewares/rateLimiter";
import { validate } from "../middlewares/validator";

const router = new Hono();

// Real session required (see authMiddleware.ts's comment) — an R2
// presigned URL is a write credential, even if a narrowly-scoped one, so
// this can't be left open. Must run before `rateLimit` — that middleware
// reads `c.get('user')`.
router.use("*", authMiddleware);

// Bounds how many presigned URLs one user can mint — each one is a free
// write credential against the bucket, so without this a signed-in user
// could script unlimited presign+PUT cycles and run up real storage costs.
// 30 per 10 minutes comfortably covers a real user attaching several
// photos/voice notes in one sitting.
router.post(
  "/presign",
  rateLimit({ windowMs: 10 * 60 * 1000, max: 30 }),
  validate(presignUploadSchema, "json"),
  presignUpload,
);

export default router;
