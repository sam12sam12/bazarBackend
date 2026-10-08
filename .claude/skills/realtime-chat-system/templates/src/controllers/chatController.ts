import type { Context } from "hono";
import { chatService } from "../services/chatService";
import { parseCursor, parseId, parseUuid } from "../utils/pagination";

export const chatController = {
  async getConversations(c: Context) {
    const user = c.get("user");
    const limit = 20;
    const parsedCursor = parseCursor(c.req.query("cursor"));

    const result = await chatService.listConversations(user.id, limit, parsedCursor);
    return c.json({ success: true, data: result });
  },

  async getMessages(c: Context) {
    const user = c.get("user");
    const conversationId = parseId(c);
    const limit = 30;
    const parsedCursor = parseCursor(c.req.query("cursor"));

    const result = await chatService.getMessages(conversationId, user.id, limit, parsedCursor);
    return c.json({ success: true, data: result });
  },

  async getMessagesWithUser(c: Context) {
    const user = c.get("user");
    const otherUserId = parseUuid(c, "userId");
    const limit = 30;
    const parsedCursor = parseCursor(c.req.query("cursor"));

    const result = await chatService.getMessagesWithUser(user.id, otherUserId, limit, parsedCursor);
    return c.json({ success: true, data: result });
  },

  async markRead(c: Context) {
    const user = c.get("user");
    const conversationId = parseId(c);

    const result = await chatService.markRead(conversationId, user.id);
    return c.json({ success: true, data: result });
  },
};
