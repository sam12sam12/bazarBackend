import { eq } from "drizzle-orm";
import { db } from "../db/db";
import { users } from "../db/schema";

export const userService = {
  // The signed-in user's own profile — no password column exists (no
  // email/password flow is enabled in auth.ts), so nothing sensitive to
  // withhold here beyond the usual timestamps.
  async getById(id: string) {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatar: users.avatar,
        created_at: users.created_at,
      })
      .from(users)
      .where(eq(users.id, id));
    return user;
  },
};
