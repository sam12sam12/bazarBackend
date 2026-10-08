import type { Context } from "hono";
import type { InsertItem, UpdateItem } from "../db/validation";
import { exampleService } from "../services/exampleService";
import { parseCursor } from "../utils/pagination";

// See exampleSchema.ts's header — the one worked example controller.
export const exampleController = {
  async list(c: Context) {
    const user = c.get("user");
    const limit = 20;
    const cursor = parseCursor(c.req.query("cursor"));

    const result = await exampleService.list(user.id, limit, cursor);
    return c.json({ success: true, data: result });
  },

  async getById(c: Context) {
    const user = c.get("user");
    const id = Number(c.req.param("id"));

    const item = await exampleService.getById(id, user.id);
    return c.json({ success: true, data: item });
  },

  async create(c: Context) {
    const user = c.get("user");
    const data = c.get("validated") as InsertItem;

    const item = await exampleService.create(user.id, data);
    return c.json({ success: true, data: item }, 201);
  },

  async update(c: Context) {
    const user = c.get("user");
    const id = Number(c.req.param("id"));
    const data = c.get("validated") as UpdateItem;

    const item = await exampleService.update(id, user.id, data);
    return c.json({ success: true, data: item });
  },

  async delete(c: Context) {
    const user = c.get("user");
    const id = Number(c.req.param("id"));

    await exampleService.delete(id, user.id);
    return c.json({ success: true, data: null });
  },
};
