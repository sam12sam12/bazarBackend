import {
	bigint,
	bigserial,
	foreignKey,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'
import {
	currencyEnum,
	orderStatusEnum,
	paymentMethodEnum,
	paymentStatusEnum,
	timestamps,
} from './_shared'
import { addresses } from './addressSchema'
import { products } from './productSchema'
import { stores } from './storeSchema'
import { users } from './userSchema'

// ==================== ORDERS TABLE ====================
// One order per store. A single checkout that spans multiple stores produces
// several orders that share the same `checkout_group_id`.
export const orders = pgTable(
	'orders',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),

		// Human-readable, app-generated, unique reference (e.g. ORD-LXY3-9F2A)
		order_number: varchar('order_number', { length: 30 }).notNull(),

		// Ties together the per-store orders created from one checkout
		checkout_group_id: uuid('checkout_group_id').notNull(),

		buyer_id: uuid('buyer_id').notNull(),
		store_id: bigint('store_id', { mode: 'number' }).notNull(),

		// ── Lifecycle ──
		status: orderStatusEnum('status').default('pending').notNull(),

		// ── Payment ──
		payment_method: paymentMethodEnum('payment_method')
			.default('cash_on_delivery')
			.notNull(),
		payment_status: paymentStatusEnum('payment_status')
			.default('unpaid')
			.notNull(),

		// ── Money (server-computed, never trusted from client) ──
		currency: currencyEnum('currency').default('AFN').notNull(),
		subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull(),
		shipping_fee: numeric('shipping_fee', { precision: 14, scale: 2 })
			.default('0')
			.notNull(),
		discount_total: numeric('discount_total', { precision: 14, scale: 2 })
			.default('0')
			.notNull(),
		total: numeric('total', { precision: 14, scale: 2 }).notNull(),
		item_count: integer('item_count').notNull(),

		// ── Shipping address: reference + immutable snapshot ──
		shipping_address_id: bigint('shipping_address_id', { mode: 'number' }),
		// Snapshot survives address edits/deletes.
		// Format: { name, phone, province_id, province_name, district, address_line, latitude, longitude }
		shipping_address: jsonb('shipping_address').notNull(),

		buyer_note: text('buyer_note'),
		cancel_reason: text('cancel_reason'),

		// ── Status timestamps ──
		confirmed_at: timestamp('confirmed_at', { withTimezone: true }),
		shipped_at: timestamp('shipped_at', { withTimezone: true }),
		delivered_at: timestamp('delivered_at', { withTimezone: true }),
		// Set only by the buyer's own "Mark as Received" confirmation — never
		// the seller. See ordersService's `updateStatus` authorization branch.
		completed_at: timestamp('completed_at', { withTimezone: true }),
		cancelled_at: timestamp('cancelled_at', { withTimezone: true }),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.buyer_id],
			foreignColumns: [users.id],
			name: 'orders_buyer_id_fkey',
		})
			.onDelete('restrict')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.store_id],
			foreignColumns: [stores.id],
			name: 'orders_store_id_fkey',
		})
			.onDelete('restrict')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.shipping_address_id],
			foreignColumns: [addresses.id],
			name: 'orders_shipping_address_id_fkey',
		})
			.onDelete('set null')
			.onUpdate('cascade'),

		// Unique human-readable reference
		uniqueIndex('orders_order_number_idx').on(table.order_number),

		// Buyer order history
		index('orders_buyer_pagination_idx').on(
			table.buyer_id,
			table.created_at.desc(),
			table.id.desc(),
		),

		// Seller order list
		index('orders_store_pagination_idx').on(
			table.store_id,
			table.created_at.desc(),
			table.id.desc(),
		),

		// Seller list filtered by status
		index('orders_store_status_pagination_idx').on(
			table.store_id,
			table.status,
			table.created_at.desc(),
			table.id.desc(),
		),

		// Fetch a whole checkout group
		index('orders_checkout_group_idx').on(table.checkout_group_id),
	],
)

// ==================== ORDER ITEMS TABLE ====================
export const orderItems = pgTable(
	'order_items',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		order_id: bigint('order_id', { mode: 'number' }).notNull(),

		// Nullable: order history survives product deletion thanks to the snapshot.
		product_id: bigint('product_id', { mode: 'number' }),

		// ── Snapshot at purchase time ──
		title: varchar('title', { length: 255 }).notNull(),
		image: text('image'),
		unit_price: numeric('unit_price', { precision: 14, scale: 2 }).notNull(),
		currency: currencyEnum('currency').notNull(),

		quantity: integer('quantity').notNull(),
		subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull(),

		// The buyer's picked value per variant attribute at checkout time (e.g.
		// { color: "navy", ram: "8GB" }), same code/value shape as
		// products.specifications — null when the product has no variant
		// attributes. A product+selected_options combination is what the
		// frontend cart treats as one distinct line (two different RAM
		// choices of the same product are two lines, not one with quantity 2),
		// so this is what lets checkout preserve that distinction instead of
		// collapsing every line of the same product into one row.
		selected_options: jsonb('selected_options').$type<Record<
			string,
			string
		> | null>(),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.order_id],
			foreignColumns: [orders.id],
			name: 'order_items_order_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.product_id],
			foreignColumns: [products.id],
			name: 'order_items_product_id_fkey',
		})
			.onDelete('set null')
			.onUpdate('cascade'),

		index('order_items_order_id_idx').on(table.order_id),
		index('order_items_product_id_idx').on(table.product_id),
	],
)
