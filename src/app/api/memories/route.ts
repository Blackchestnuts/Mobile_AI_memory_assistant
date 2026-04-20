import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'

// 获取用户所有记忆
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: '请先登录' }, { status: 401 })
    }

    const memories = await db.memory.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      include: { folder: true },
    })
    return Response.json(memories)
  } catch (error) {
    console.error('Get memories error:', error)
    return Response.json({ error: '获取记忆失败' }, { status: 500 })
  }
}

// 手动添加记忆
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: '请先登录' }, { status: 401 })
    }

    const body = await request.json()
    const { category, key, value, folderId } = body

    if (!category || !key || !value) {
      return Response.json({ error: '分类、键名和值都不能为空' }, { status: 400 })
    }

    const memory = await db.memory.create({
      data: {
        userId: session.user.id,
        category,
        key,
        value,
        folderId: folderId || null,
      },
    })
    return Response.json(memory)
  } catch (error) {
    console.error('Create memory error:', error)
    return Response.json({ error: '创建记忆失败' }, { status: 500 })
  }
}

// 批量删除记忆
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: '请先登录' }, { status: 401 })
    }

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: '请选择要删除的记忆' }, { status: 400 })
    }

    // 确保只能删除自己的记忆
    const result = await db.memory.deleteMany({
      where: {
        id: { in: ids },
        userId: session.user.id,
      },
    })

    return Response.json({ deleted: result.count })
  } catch (error) {
    console.error('Batch delete memories error:', error)
    return Response.json({ error: '批量删除记忆失败' }, { status: 500 })
  }
}
