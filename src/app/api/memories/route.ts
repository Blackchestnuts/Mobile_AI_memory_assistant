import { db } from '@/lib/db'
import { ensureDefaultUser, smartAddMemory } from '@/lib/memory'

// 获取所有记忆
export async function GET() {
  try {
    const user = await ensureDefaultUser()

    const memories = await db.memory.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })
    return Response.json(memories)
  } catch (error) {
    console.error('Get memories error:', error)
    return Response.json({ error: '获取记忆失败' }, { status: 500 })
  }
}

// 智能添加记忆 — 只需提供键名和值，AI自动分类
export async function POST(request: Request) {
  try {
    const user = await ensureDefaultUser()

    const body = await request.json()
    const { key, value, category } = body

    if (!key || !value) {
      return Response.json({ error: '键名和值都不能为空' }, { status: 400 })
    }

    // 如果前端传了category则使用，否则AI自动分类
    let memory
    if (category) {
      // 手动指定分类（兼容旧调用）
      const existing = await db.memory.findFirst({
        where: { userId: user.id, category, key },
      })
      if (existing) {
        memory = await db.memory.update({
          where: { id: existing.id },
          data: { value },
        })
      } else {
        memory = await db.memory.create({
          data: { userId: user.id, category, key, value },
        })
      }
    } else {
      // AI 智能分类
      memory = await smartAddMemory(user.id, key, value)
    }

    return Response.json(memory)
  } catch (error) {
    console.error('Create memory error:', error)
    return Response.json({ error: '创建记忆失败' }, { status: 500 })
  }
}
