import { faker } from '@faker-js/faker'
import { db } from '../src/db/db'
import { notifications } from '../src/db/schema'
import type { InsertNotification } from '../src/db/validation'
import { getProductIds, getUserIds } from './index'

export function createRandomNotification(params: {
	userIds: string[]
	productIds: number[]
}): InsertNotification {
	const user_id = faker.helpers.arrayElement(params.userIds)
	const otherUsers = params.userIds.filter((id) => id !== user_id)
	const actor_id =
		otherUsers.length > 0 ? faker.helpers.arrayElement(otherUsers) : user_id

	const type = faker.helpers.arrayElement([
		'new_follower',
		'new_message',
		'new_similar_product',
		'bid_received',
		'offer_accepted',
		'order_status_changed',
		'review_received',
		'report_received',
	] as const)

	let product_id: number | null = null
	if (
		['bid_received', 'review_received', 'new_similar_product'].includes(type) &&
		params.productIds.length > 0
	) {
		product_id = faker.helpers.arrayElement(params.productIds)
	}

	const data = {
		title: faker.helpers.arrayElement([
			'New Follower',
			'New Message',
			'New Bid Received',
			'Order Status Update',
		]),
		subtitle: faker.hacker.phrase(),
		actor_name: faker.person.fullName(),
	}

	return {
		user_id,
		actor_id,
		type,
		product_id,
		data,
		is_read: faker.datatype.boolean(),
	}
}

export async function generateNotificationsFakerData() {
	const count = 20
	const userIds = await getUserIds()
	const productIds = await getProductIds()

	if (userIds.length === 0) {
		return
	}

	const notificationsFakerData: InsertNotification[] = Array.from(
		{ length: count },
		() =>
			createRandomNotification({
				userIds,
				productIds,
			}),
	)

	await db.insert(notifications).values(notificationsFakerData)
}
