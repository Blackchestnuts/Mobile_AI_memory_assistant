import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: '请先登录' }, { status: 401 })
    }

    const conversations = await db.conversation.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    return Response.json(conversations)
  } catch (error) {
    console.error('Get conversations error:', error)
    return Response.json({ error: '获取对话列表失败' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: '请先登录' }, { status: 401 })
    }

    const conversation = await db.conversation.create({
      data: { userId: session.user.id, title: '新对话' },
    })
    return Response.json(conversation)
  } catch (error) {
    console.error('Create conversation error:', error)
    return Response.json({ error: '创建对话失败' }, { status: 500 })
  }
}
