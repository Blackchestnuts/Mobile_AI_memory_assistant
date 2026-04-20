import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'

// 更新记忆
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: '请先登录' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { category, key, value, folderId, isStale } = body

    // 验证记忆属于当前用户
    const existing = await db.memory.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) {
      return Response.json({ error: '记忆不存在或无权操作' }, { status: 403 })
    }

    const memory = await db.memory.update({
      where: { id },
      data: {
        ...(category !== undefined && { category }),
        ...(key !== undefined && { key }),
        ...(value !== undefined && { value }),
        ...(folderId !== undefined && { folderId }),
        ...(isStale !== undefined && { isStale }),
        updatedAt: new Date(),
      },
    })
    return Response.json(memory)
  } catch (error) {
    console.error('Update memory error:', error)
    return Response.json({ error: '更新记忆失败' }, { status: 500 })
  }
}

// 删除记忆
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: '请先登录' }, { status: 401 })
    }

    const { id } = await params

    // 验证记忆属于当前用户
    const existing = await db.memory.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) {
      return Response.json({ error: '记忆不存在或无权操作' }, { status: 403 })
    }

    await db.memory.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (error) {
    console.error('Delete memory error:', error)
    return Response.json({ error: '删除记忆失败' }, { status: 500 })
  }
}
