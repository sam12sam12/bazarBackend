import type { Context } from "hono";
import { userService } from "../services/userService";
import { ApiError } from "../utils/ApiError";

export const userController = {
  // Proves the whole auth chain actually works end-to-end: a real
  // better-auth session, read through authMiddleware, resolving a real row
  // in the `users` table via Drizzle.
  async me(c: Context) {
    const sessionUser = c.get("user");
    const user = await userService.getById(sessionUser.id);
    if (!user) throw ApiError.notFound("User not found");

    return c.json({ success: true, data: user });
  },
};
