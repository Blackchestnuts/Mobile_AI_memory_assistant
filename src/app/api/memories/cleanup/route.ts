import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { markStaleMemories, cleanupExpiredMemories } from '@/lib/memory'

// 手动触发记忆清理
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: '请先登录' }, { status: 401 })
    }

    const staleCount = await markStaleMemories(session.user.id)
    const cleanupResult = await cleanupExpiredMemories(session.user.id)

    return Response.json({
      markedStale: staleCount,
      deletedExpired: cleanupResult.deleted,
      scheduledForExpiry: cleanupResult.scheduled,
    })
  } catch (error) {
    console.error('Memory cleanup error:', error)
    return Response.json({ error: '记忆清理失败' }, { status: 500 })
  }
}
