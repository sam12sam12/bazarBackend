// Deletes every R2 object under `images/` that no user/store/product row
// references anymore and that's older than the grace period configured in
// utils/storage/instance.ts (see that file's comment on why age-gated, not
// immediate). Not wired to a scheduler in this codebase — run it by hand or
// wire it to whatever cron/ops trigger your deployment has:
//
//   bun run sweep-images
//
import { storage } from '../utils/storage/instance'

const { deleted, failed } = await storage.sweep()

console.log(
	`Swept ${deleted.length} orphaned image(s)${failed.length ? `, ${failed.length} failed to delete` : ''}.`,
)
if (deleted.length > 0) {
	console.log(deleted.map((key) => `  - ${key}`).join('\n'))
}
if (failed.length > 0) {
	console.log('Failed to delete:')
	console.log(failed.map((key) => `  - ${key}`).join('\n'))
}

process.exit(failed.length > 0 ? 1 : 0)
