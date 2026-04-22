import { db } from '@/lib/db'
import { ensureDefaultUser, invalidateMemoryCache } from '@/lib/memory'
import { getEmbedding } from '@/lib/embedding'

// 更新记忆
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await ensureDefaultUser()
    const { id } = await params
    const body = await request.json()
    const { category, key, value } = body

    // 验证记忆属于当前用户
    const existing = await db.memory.findFirst({
      where: { id, userId: user.id },
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
        updatedAt: new Date(),
      },
    })

    // 如果 key 或 value 变了，重新生成 embedding
    if (key !== undefined || value !== undefined) {
      const text = `${memory.key}: ${memory.value}`
      getEmbedding(text).then(embedding => {
        if (embedding) {
          db.memory.update({
            where: { id },
            data: { embedding: JSON.stringify(embedding) },
          }).catch(() => {})
        }
      }).catch(() => {})
    }

    // 刷新缓存
    invalidateMemoryCache(user.id)

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
    const user = await ensureDefaultUser()
    const { id } = await params

    const existing = await db.memory.findFirst({
      where: { id, userId: user.id },
    })
    if (!existing) {
      return Response.json({ error: '记忆不存在或无权操作' }, { status: 403 })
    }

    await db.memory.delete({ where: { id } })

    // 刷新缓存
    invalidateMemoryCache(user.id)

    return Response.json({ success: true })
  } catch (error) {
    console.error('Delete memory error:', error)
    return Response.json({ error: '删除记忆失败' }, { status: 500 })
  }
}
