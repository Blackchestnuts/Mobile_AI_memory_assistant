import { ensureDefaultUser, backfillEmbeddings } from '@/lib/memory'

// 回填已有记忆的 embedding 向量
export async function POST() {
  try {
    const user = await ensureDefaultUser()
    const result = await backfillEmbeddings(user.id)
    return Response.json({
      message: `回填完成：共处理 ${result.processed}/${result.total} 条记忆`,
      ...result,
    })
  } catch (error) {
    console.error('Backfill embeddings error:', error)
    return Response.json({ error: '回填 embedding 失败' }, { status: 500 })
  }
}
