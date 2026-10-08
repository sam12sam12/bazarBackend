import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { items } from "./schema";

// ==================== UPLOADS ====================
// `kind` picks which R2 key prefix/content-type `utils/storage/instance.ts`'s
// `storage` signs for (see its comment).
export const presignUploadSchema = z
  .object({
    kind: z.enum(["image", "voice"]).default("image"),
  })
  .strict();

export type PresignUpload = z.infer<typeof presignUploadSchema>;

// ==================== ITEMS (example schema — see exampleSchema.ts) ====================
export const selectItemSchema = createSelectSchema(items);

// `user_id` is never in the body — it comes from the authenticated session
// (`c.get('user').id`, see middlewares/authMiddleware.ts), never a
// client-supplied value. This is the one deliberate difference from
// patterns in older pre-auth codebases where an owner id travels in the
// request body.
export const insertItemSchema = createInsertSchema(items, {
  title: () => z.string().trim().min(1).max(255),
  body: () => z.string().trim().max(4000).optional(),
})
  .omit({
    id: true,
    user_id: true,
    created_at: true,
    updated_at: true,
  })
  .strict();

export const updateItemSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    body: z.string().trim().max(4000).nullable().optional(),
  })
  .strict();

export type InsertItem = z.infer<typeof insertItemSchema>;
export type UpdateItem = z.infer<typeof updateItemSchema>;
