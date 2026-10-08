import { Hono } from "hono";
import { chatController } from "../controllers/chatController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = new Hono();

// Every route here requires a real session (see authMiddleware.ts's
// comment) — unlike the rest of a typical API, there's no client-supplied
// user_id fallback for chat, since a WebSocket identity has to be real.
router.use("*", authMiddleware);

router.get("/", chatController.getConversations);
router.get("/:id/messages", chatController.getMessages);
router.get("/with/:userId/messages", chatController.getMessagesWithUser);
router.patch("/:id/read", chatController.markRead);

export default router;
