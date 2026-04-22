import { db } from '@/lib/db'
import { chatCompletion, classifyMemory } from '@/lib/ai'
import { getEmbedding, cosineSimilarity } from '@/lib/embedding'

// 确保默认用户存在
export async function ensureDefaultUser() {
  let user = await db.user.findFirst()
  if (!user) {
    user = await db.user.create({ data: { name: '默认用户' } })
  }
  return user
}

// ==================== 配置常量 ====================

// 记忆注入限制
const MAX_MEMORIES_PER_CATEGORY = 3
const MAX_MEMORIES_TOTAL = 18

// 混合评分权重
const KEYWORD_WEIGHT = 0.4
const SEMANTIC_WEIGHT = 0.6

// 对话历史窗口（最近N条消息）
const MAX_HISTORY_MESSAGES = 20

// 分类标签
const CATEGORY_LABELS: Record<string, string> = {
  profile: '👤 用户画像',
  preference: '偏好与习惯',
  goal: '🎯 目标与计划',
  project: '📋 项目信息',
  insight: '💡 洞察与观点',
  fact: '📌 事实记录',
}

// ==================== 智能提取触发 ====================

// 闲聊模式 — 不值得提取记忆的短消息
const CASUAL_PATTERNS = [
  /^(你好|hi|hello|嗨|hey|早上好|晚上好|早安|晚安)[\s!！。.]*$/i,
  /^(谢谢|感谢|多谢|thanks|thx)[\s!！。.]*$/i,
  /^(好的|好|行|ok|okay|嗯|哦|噢|了解|明白|知道|收到)[\s!！。.]*$/i,
  /^(不客气|没关系|没事|不用谢)[\s!！。.]*$/i,
  /^(对|是的|没错|对对|是是)[\s!！。.]*$/i,
  /^(继续|然后呢|还有吗|go on)[\s!！。.]*$/i,
]

// 判断消息是否值得提取记忆（轻量级预过滤，避免对闲聊消息调用AI）
function shouldExtractMemory(userMessage: string): boolean {
  const trimmed = userMessage.trim()

  // 过短的消息不值得提取
  if (trimmed.length < 4) return false

  // 匹配闲聊模式
  for (const pattern of CASUAL_PATTERNS) {
    if (pattern.test(trimmed)) return false
  }

  return true
}

// ==================== 记忆缓存 ====================

// 进程内记忆缓存，避免每次聊天都全量查DB
interface MemoryCacheEntry {
  memories: Awaited<ReturnType<typeof db.memory.findMany>>
  timestamp: number
}

let memoryCache: Map<string, MemoryCacheEntry> = new Map()
const CACHE_TTL = 30_000 // 30秒缓存

function getCachedMemories(userId: string) {
  const entry = memoryCache.get(userId)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.memories
  }
  return null
}

function setCachedMemories(userId: string, memories: Awaited<ReturnType<typeof db.memory.findMany>>) {
  memoryCache.set(userId, { memories, timestamp: Date.now() })
}

function invalidateMemoryCache(userId: string) {
  memoryCache.delete(userId)
}

// ==================== 关键词提取 ====================

// 中文停用词
const STOP_WORDS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
  '这', '中', '大', '为', '上', '个', '国', '们', '到', '说', '时', '也',
  '子', '得', '里', '去', '那', '要', '会', '对', '着', '能', '他', '她',
  '你', '它', '吗', '吧', '啊', '呢', '嗯', '哦', '把', '被', '让', '给',
  '很', '多', '什么', '怎么', '如何', '可以', '请', '帮', '想', '知道',
  '还是', '但是', '因为', '所以', '如果', '虽然', '可能', '应该', '已经',
  '一个', '一些', '这个', '那个', '这些', '那些', '自己', '没有', '不是',
])

// 从文本提取关键词
function extractKeywords(text: string): string[] {
  const cleaned = text.replace(/[，。！？、；：""''（）【】《》\s,.!?;:'"()\[\]{}<>]/g, ' ')
  const words = cleaned.split(/\s+/).filter(w => w.length > 0)

  const keywords: string[] = []
  for (const word of words) {
    if (STOP_WORDS.has(word) || word.length === 1) continue

    keywords.push(word.toLowerCase())

    // 中文2字滑动窗口
    if (/[\u4e00-\u9fa5]/.test(word) && word.length >= 3) {
      for (let i = 0; i < word.length - 1; i++) {
        const bigram = word.substring(i, i + 2)
        if (!STOP_WORDS.has(bigram) && bigram.length === 2) {
          keywords.push(bigram)
        }
      }
    }
  }

  return [...new Set(keywords)]
}

// 计算记忆与关键词的相关性分数
function calculateKeywordScore(memory: { key: string; value: string }, keywords: string[]): number {
  let score = 0
  const keyLower = memory.key.toLowerCase()
  const valueLower = memory.value.toLowerCase()

  for (const kw of keywords) {
    const keyword = kw.toLowerCase()
    if (keyLower === keyword) score += 10
    else if (keyLower.includes(keyword)) score += 5
    else if (valueLower.includes(keyword)) score += 3
  }

  return score
}

// ==================== Embedding 处理 ====================

// 异步为记忆生成并保存 embedding
async function saveEmbedding(memoryId: string, text: string) {
  try {
    const embedding = await getEmbedding(text)
    if (embedding) {
      await db.memory.update({
        where: { id: memoryId },
        data: { embedding: JSON.stringify(embedding) },
      })
    }
  } catch {
    // 不影响主流程
  }
}

// 批量为记忆生成 embedding（合并多次调用为一次排队处理）
const embeddingQueue: { memoryId: string; text: string }[] = []
let embeddingProcessing = false

function queueEmbedding(memoryId: string, text: string) {
  embeddingQueue.push({ memoryId, text })
  processEmbeddingQueue()
}

async function processEmbeddingQueue() {
  if (embeddingProcessing || embeddingQueue.length === 0) return
  embeddingProcessing = true

  try {
    // 每次取一批处理，间隔100ms避免打爆Ollama
    while (embeddingQueue.length > 0) {
      const batch = embeddingQueue.splice(0, 3) // 每批最多3个
      await Promise.allSettled(
        batch.map(async ({ memoryId, text }) => {
          try {
            const embedding = await getEmbedding(text)
            if (embedding) {
              await db.memory.update({
                where: { id: memoryId },
                data: { embedding: JSON.stringify(embedding) },
              })
            }
          } catch {
            // 单条失败不影响其他
          }
        })
      )
      // 批次间间隔
      if (embeddingQueue.length > 0) {
        await new Promise(r => setTimeout(r, 100))
      }
    }
  } finally {
    embeddingProcessing = false
  }
}

// ==================== 构建记忆 Prompt ====================

// 构建记忆prompt - 混合评分（关键词 + 语义相似度）+ 缓存
export async function buildMemoryPrompt(userId: string, userMessage?: string) {
  // 优先使用缓存
  let memories = getCachedMemories(userId)
  if (!memories) {
    memories = await db.memory.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })
    setCachedMemories(userId, memories)
  }

  if (memories.length === 0) {
    return {
      prompt: `你是一个智能助手，拥有跨对话的记忆能力。你可以记住用户告诉你的信息，在后续对话中主动运用这些记忆来提供更个性化的服务。

当前你还没有关于这个用户的记忆，请在对话中自然地了解用户信息。`,
    }
  }

  // 混合评分排序
  let sortedMemories = memories
  if (userMessage) {
    const keywords = extractKeywords(userMessage)

    let messageEmbedding: number[] | null = null
    try {
      messageEmbedding = await getEmbedding(userMessage)
    } catch {
      // embedding 不可用，只用关键词
    }

    const scored = memories.map(m => {
      const keywordScore = keywords.length > 0
        ? Math.min(calculateKeywordScore(m, keywords) / 20, 1)
        : 0

      let semanticScore = 0
      if (messageEmbedding && m.embedding) {
        try {
          const memEmbedding = JSON.parse(m.embedding) as number[]
          semanticScore = (cosineSimilarity(messageEmbedding, memEmbedding) + 1) / 2
        } catch {
          // 解析失败，忽略
        }
      }

      const hasEmbedding = messageEmbedding !== null && m.embedding !== null
      const relevance = hasEmbedding
        ? keywordScore * KEYWORD_WEIGHT + semanticScore * SEMANTIC_WEIGHT
        : keywordScore

      return { memory: m, relevance }
    })

    scored.sort((a, b) => b.relevance - a.relevance || b.memory.updatedAt.getTime() - a.memory.updatedAt.getTime())
    sortedMemories = scored.map(s => s.memory)
  }

  // 按分类分组，每个分类最多取 MAX_MEMORIES_PER_CATEGORY 条
  const categorized: Record<string, string[]> = {}
  const categoryCounts: Record<string, number> = {}
  let totalCount = 0

  for (const m of sortedMemories) {
    if (totalCount >= MAX_MEMORIES_TOTAL) break

    if (!categorized[m.category]) {
      categorized[m.category] = []
      categoryCounts[m.category] = 0
    }

    if (categoryCounts[m.category] >= MAX_MEMORIES_PER_CATEGORY) continue

    categorized[m.category].push(`- ${m.key}: ${m.value}`)
    categoryCounts[m.category]++
    totalCount++
  }

  let memorySection = ''
  for (const [cat, items] of Object.entries(categorized)) {
    const label = CATEGORY_LABELS[cat] || cat
    memorySection += `\n${label}:\n${items.join('\n')}\n`
  }

  const truncationNote = memories.length > MAX_MEMORIES_TOTAL
    ? `\n（注：你还有 ${memories.length - MAX_MEMORIES_TOTAL} 条记忆未显示，如需了解更多可以主动询问用户）\n`
    : ''

  return {
    prompt: `你是一个拥有跨对话记忆能力的智能助手。以下是你记住的关于用户的信息：

${memorySection}${truncationNote}
重要指令：
1. 在回复时，主动运用上述记忆信息，让用户感受到你"记得"他们
2. 如果用户的问题与记忆中有相关信息，自然地引用相关记忆
3. 不要生硬地罗列记忆，而是自然地融入对话中
4. 如果发现记忆中有过时或错误的信息，可以主动确认更新
5. 当用户告诉你新的个人信息、偏好、目标时，这些信息值得被记住`,
  }
}

// ==================== 对话历史窗口 ====================

// 截取最近N条消息，避免长对话超出上下文窗口
export function trimHistoryMessages(
  messages: Array<{ role: string; content: string }>,
  maxMessages: number = MAX_HISTORY_MESSAGES
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const filtered = messages.filter(m => m.role !== 'system')
  // 保留最近的消息
  const trimmed = filtered.slice(-maxMessages)
  return trimmed.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
}

// ==================== 记忆提取（带智能触发 + 去重增强） ====================

// 从对话中提取记忆（智能触发 + 跨分类去重）
export async function extractMemoriesFromMessage(
  userId: string,
  userMessage: string,
  assistantMessage: string
) {
  try {
    // 智能触发：闲聊消息直接跳过，不调AI
    if (!shouldExtractMemory(userMessage)) {
      return 0
    }

    const extractPrompt = `分析以下对话内容，提取值得长期记住的信息。

用户说: ${userMessage}
助手回复: ${assistantMessage}

请以JSON格式返回提取的记忆，格式如下:
{
  "memories": [
    {
      "category": "profile|preference|goal|project|insight|fact",
      "key": "简短描述（如：职业、技术偏好、当前项目）",
      "value": "具体内容"
    }
  ]
}

提取规则:
- 只提取有长期价值的信息，忽略临时性、闲聊性的内容
- category分类: profile(个人画像), preference(偏好习惯), goal(目标计划), project(项目信息), insight(洞察观点), fact(事实记录)
- 根据内容自动选择最合适的分类
- key要简明扼要，便于检索
- value要具体明确
- 如果没有值得记忆的信息，返回空数组
- 只返回JSON，不要其他文字`

    const content = await chatCompletion({
      messages: [
        { role: 'system', content: '你是一个信息提取助手，只返回JSON格式的结果。' },
        { role: 'user', content: extractPrompt },
      ],
      temperature: 0.3,
    })

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return 0

    const parsed = JSON.parse(jsonMatch[0])
    const extractedMemories = parsed.memories || []

    // 获取当前所有记忆用于去重（使用缓存）
    let existingMemories = getCachedMemories(userId)
    if (!existingMemories) {
      existingMemories = await db.memory.findMany({ where: { userId } })
      setCachedMemories(userId, existingMemories)
    }

    let savedCount = 0
    for (const mem of extractedMemories) {
      if (!mem.category || !mem.key || !mem.value) continue

      // 去重策略1: 精确匹配（同分类+同key）
      let existing = existingMemories.find(
        m => m.category === mem.category && m.key === mem.key
      )

      // 去重策略2: 跨分类key匹配（如"职业"在profile和fact中各有一条，合并到新分类）
      if (!existing) {
        existing = existingMemories.find(m => m.key === mem.key)
      }

      // 去重策略3: 语义相似key匹配（如"工作"和"职业"实际指同一件事）
      if (!existing) {
        const newKeyKeywords = extractKeywords(mem.key)
        for (const m of existingMemories) {
          const existKeyKeywords = extractKeywords(m.key)
          // 如果两个key有超过60%的关键词重叠，认为是同一记忆
          const overlap = newKeyKeywords.filter(k => existKeyKeywords.includes(k))
          const similarity = overlap.length / Math.max(newKeyKeywords.length, existKeyKeywords.length, 1)
          if (similarity >= 0.6) {
            existing = m
            break
          }
        }
      }

      if (existing) {
        // 更新已有记忆
        await db.memory.update({
          where: { id: existing.id },
          data: { value: mem.value, category: mem.category },
        })
        // 更新缓存中的对应条目
        const idx = existingMemories.findIndex(m => m.id === existing.id)
        if (idx >= 0) {
          existingMemories[idx] = { ...existingMemories[idx], value: mem.value, category: mem.category, updatedAt: new Date() }
        }
        queueEmbedding(existing.id, `${mem.key}: ${mem.value}`)
      } else {
        // 创建新记忆
        const newMemory = await db.memory.create({
          data: { userId, category: mem.category, key: mem.key, value: mem.value },
        })
        existingMemories.push(newMemory)
        queueEmbedding(newMemory.id, `${mem.key}: ${mem.value}`)
      }
      savedCount++
    }

    // 更新缓存
    setCachedMemories(userId, existingMemories)

    return savedCount
  } catch (error) {
    console.error('Memory extraction failed:', error)
    return 0
  }
}

// ==================== 回填 & 智能添加 ====================

// 回填已有记忆的 embedding
export async function backfillEmbeddings(userId: string) {
  const memories = await db.memory.findMany({
    where: { userId, embedding: null },
  })

  let count = 0
  // 批量处理，每批3个
  for (let i = 0; i < memories.length; i += 3) {
    const batch = memories.slice(i, i + 3)
    const results = await Promise.allSettled(
      batch.map(async (m) => {
        const embedding = await getEmbedding(`${m.key}: ${m.value}`)
        if (embedding) {
          await db.memory.update({
            where: { id: m.id },
            data: { embedding: JSON.stringify(embedding) },
          })
          return 1
        }
        return 0
      })
    )
    count += results.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0), 0)
  }

  // 回填后刷新缓存
  invalidateMemoryCache(userId)

  return { total: memories.length, processed: count }
}

// 智能添加记忆 — AI 自动分类 + 增强去重
export async function smartAddMemory(userId: string, key: string, value: string) {
  // AI 自动判断分类
  const category = await classifyMemory(key, value)

  // 获取现有记忆用于去重
  let existingMemories = getCachedMemories(userId)
  if (!existingMemories) {
    existingMemories = await db.memory.findMany({ where: { userId } })
    setCachedMemories(userId, existingMemories)
  }

  // 去重策略1: 精确key匹配
  let existing = existingMemories.find(m => m.key === key)

  // 去重策略2: 语义相似key匹配
  if (!existing) {
    const newKeyKeywords = extractKeywords(key)
    for (const m of existingMemories) {
      const existKeyKeywords = extractKeywords(m.key)
      const overlap = newKeyKeywords.filter(k => existKeyKeywords.includes(k))
      const similarity = overlap.length / Math.max(newKeyKeywords.length, existKeyKeywords.length, 1)
      if (similarity >= 0.6) {
        existing = m
        break
      }
    }
  }

  if (existing) {
    const updated = await db.memory.update({
      where: { id: existing.id },
      data: { value, category },
    })
    // 更新缓存
    const idx = existingMemories.findIndex(m => m.id === existing.id)
    if (idx >= 0) {
      existingMemories[idx] = { ...existingMemories[idx], value, category, updatedAt: new Date() }
      setCachedMemories(userId, existingMemories)
    }
    queueEmbedding(updated.id, `${key}: ${value}`)
    return updated
  }

  const newMemory = await db.memory.create({
    data: { userId, category, key, value },
  })
  existingMemories.push(newMemory)
  setCachedMemories(userId, existingMemories)
  queueEmbedding(newMemory.id, `${key}: ${value}`)
  return newMemory
}

// 导出缓存失效函数（供外部API调用后刷新）
export { invalidateMemoryCache }
