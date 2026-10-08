import { eq } from "drizzle-orm";
import { db } from "../db/db";
import { items } from "../db/schema";
import type { InsertItem, UpdateItem } from "../db/validation";
import { ApiError } from "../utils/ApiError";
import { definedFields } from "../utils/helpers";
import { cursorOrderBy, type CursorData, paginateResults, withCursor } from "../utils/pagination";

// See exampleSchema.ts's header — this whole file is the one worked
// example of a service, not a real domain. Delete it alongside that file.
export const exampleService = {
  // Scoped to the signed-in user — this starter has no "browse everyone
  // else's items" surface, so there's no public list to also support.
  async list(userId: string, limit: number, cursor?: CursorData) {
    const whereCondition = withCursor(items, cursor, eq(items.user_id, userId));

    const results = await db
      .select()
      .from(items)
      .where(whereCondition)
      .orderBy(...cursorOrderBy(items))
      .limit(limit + 1);

    const { list, nextCursor, hasMore } = paginateResults(results, limit);
    return { items: list, nextCursor, hasMore };
  },

  async getById(id: number, userId: string) {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    if (!item) throw ApiError.notFound("Item not found");
    if (item.user_id !== userId) throw ApiError.forbidden("Only the owner can view this item");
    return item;
  },

  async create(userId: string, data: InsertItem) {
    const [item] = await db
      .insert(items)
      .values({ ...data, user_id: userId })
      .returning();
    return item;
  },

  async update(id: number, userId: string, data: UpdateItem) {
    const [current] = await db.select().from(items).where(eq(items.id, id));
    if (!current) throw ApiError.notFound("Item not found");
    if (current.user_id !== userId) throw ApiError.forbidden("Only the owner can edit this item");

    const [updated] = await db
      .update(items)
      .set(definedFields(data))
      .where(eq(items.id, id))
      .returning();
    return updated;
  },

  async delete(id: number, userId: string) {
    const [current] = await db.select().from(items).where(eq(items.id, id));
    if (!current) throw ApiError.notFound("Item not found");
    if (current.user_id !== userId) throw ApiError.forbidden("Only the owner can delete this item");

    await db.delete(items).where(eq(items.id, id));
  },
};
