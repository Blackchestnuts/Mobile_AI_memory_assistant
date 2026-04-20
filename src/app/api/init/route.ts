import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'

// 获取当前用户信息和统计
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: '请先登录' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, occupation: true },
    })

    if (!user) {
      return Response.json({ error: '用户不存在' }, { status: 404 })
    }

    const memoryCount = await db.memory.count({ where: { userId: user.id } })
    const conversationCount = await db.conversation.count({ where: { userId: user.id } })

    return Response.json({
      user,
      stats: { memoryCount, conversationCount },
    })
  } catch (error) {
    console.error('Init error:', error)
    return Response.json({ error: '初始化失败' }, { status: 500 })
  }
}
