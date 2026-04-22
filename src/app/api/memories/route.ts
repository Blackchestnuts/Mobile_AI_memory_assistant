import { db } from '@/lib/db'
import { ensureDefaultUser } from '@/lib/memory'
import { getEmbedding } from '@/lib/embedding'

// 获取所有记忆
export async function GET() {
  try {
    const user = await ensureDefaultUser()

    const memories = await db.memory.findMany({
      where: { userId: user.id },
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
    const user = await ensureDefaultUser()

    const body = await request.json()
    const { category, key, value, folderId } = body

    if (!category || !key || !value) {
      return Response.json({ error: '分类、键名和值都不能为空' }, { status: 400 })
    }

    const memory = await db.memory.create({
      data: {
        userId: user.id,
        category,
        key,
        value,
        folderId: folderId || null,
      },
    })

    // 异步生成 embedding
    getEmbedding(`${key}: ${value}`)
      .then(embedding => {
        if (embedding) {
          db.memory.update({
            where: { id: memory.id },
            data: { embedding: JSON.stringify(embedding) },
          }).catch(() => {})
        }
      })
      .catch(() => {})

    return Response.json(memory)
  } catch (error) {
    console.error('Create memory error:', error)
    return Response.json({ error: '创建记忆失败' }, { status: 500 })
  }
}
