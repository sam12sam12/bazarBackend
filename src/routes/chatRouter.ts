import { Hono } from 'hono'
import { chatController } from '../controllers/chatController.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'

const router = new Hono()

// Chat is 100% private — every route here needs a real session, unlike the
// "public reads" default the rest of /api/v1 opts into.
router.use('*', authMiddleware)

router.get('/', chatController.listConversations)
router.get('/with/:userId/messages', chatController.getMessagesWithUser)
router.get('/:id/messages', chatController.getMessages)
router.patch('/:id/read', chatController.markRead)

export default router
