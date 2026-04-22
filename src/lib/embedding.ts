// 向量语义检索模块 - 使用 Ollama Embedding 实现语义匹配

const EMBEDDING_BASE_URL = process.env.EMBEDDING_BASE_URL || 'http://localhost:11434/v1'
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || 'ollama'
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text'

/** 计算两个向量的余弦相似度，返回值范围 [-1, 1] */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/** 调用 Embedding API 生成文本向量，失败返回 null */
export async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMBEDDING_API_KEY}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
    })

    if (!response.ok) return null

    const data = await response.json()
    return data.data?.[0]?.embedding || null
  } catch {
    return null
  }
}
