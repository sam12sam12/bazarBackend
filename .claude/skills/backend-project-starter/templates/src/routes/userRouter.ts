import { Hono } from "hono";
import { userController } from "../controllers/userController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = new Hono();

router.use("*", authMiddleware);
router.get("/me", userController.me);

export default router;
