import { Hono } from "hono";
import { insertItemSchema, updateItemSchema } from "../db/validation";
import { exampleController } from "../controllers/exampleController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validator";

// See exampleSchema.ts's header — the one worked example router, mounted at
// /api/v1/items in server.ts. Every route requires a real session, since
// every operation here is scoped to "the signed-in user's own items".
const router = new Hono();

router.use("*", authMiddleware);

router.get("/", exampleController.list);
router.get("/:id", exampleController.getById);
router.post("/", validate(insertItemSchema, "json"), exampleController.create);
router.patch("/:id", validate(updateItemSchema, "json"), exampleController.update);
router.delete("/:id", exampleController.delete);

export default router;
