import { db } from '@/lib/db'

// ==================== Token 预算管理 ====================
const TOKEN_BUDGET = {
  total: 4000,        // 总token预算（留出余量给LLM输出）
  systemRatio: 0.30,  // 30% 给 system prompt（含记忆）
  historyRatio: 0.50, // 50% 给对话历史
  userRatio: 0.20,    // 20% 给当前用户消息
}

// 粗略估算：1个中文字约1.5 token，1个英文单词约1 token
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars * 1.5 + otherChars * 0.25)
}

// ==================== 记忆滑动窗口 ====================
// 只注入与当前话题相关的记忆 + 最近的N条记忆
export async function buildMemoryPrompt(userId: string, currentMessage?: string) {
  const allMemories = await db.memory.findMany({
    where: {
      userId,
      isStale: false,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: [
      { accessCount: 'desc' },    // 优先高频使用的记忆
      { updatedAt: 'desc' },      // 然后按更新时间
    ],
  })

  if (allMemories.length === 0) {
    return {
      prompt: `你是一个智能助手，拥有跨对话的记忆能力。你可以记住用户告诉你的信息，在后续对话中主动运用这些记忆来提供更个性化的服务。

当前你还没有关于这个用户的记忆，请在对话中自然地了解用户信息。`,
      tokenCount: 0,
    }
  }

  const systemBudget = Math.floor(TOKEN_BUDGET.total * TOKEN_BUDGET.systemRatio)

  // 按分类组织记忆
  const categoryLabels: Record<string, string> = {
    profile: '👤 用户画像',
    preference: '偏好与习惯',
    goal: '🎯 目标与计划',
    project: '📋 项目信息',
    insight: '💡 洞察与观点',
    fact: '📌 事实记录',
  }

  // 关键词匹配：如果当前消息包含某些关键词，优先注入相关记忆
  let prioritizedMemories = allMemories
  if (currentMessage) {
    const msgLower = currentMessage.toLowerCase()
    const scored = allMemories.map((m) => {
      let score = m.accessCount
      // 关键词匹配加分
      const keywords = [m.key, m.value, m.category].join(' ').toLowerCase().split(/\s+/)
      for (const kw of keywords) {
        if (kw.length > 1 && msgLower.includes(kw)) {
          score += 10
        }
      }
      return { ...m, score }
    })
    scored.sort((a, b) => b.score - a.score)
    prioritizedMemories = scored
  }

  // 在token预算内，尽可能多地注入记忆
  const selectedMemories: typeof allMemories = []
  let usedTokens = 100 // 基础prompt的token估算

  for (const memory of prioritizedMemories) {
    const entry = `- ${memory.key}: ${memory.value}`
    const entryTokens = estimateTokens(entry)
    if (usedTokens + entryTokens > systemBudget) break
    usedTokens += entryTokens
    selectedMemories.push(memory)
  }

  // 按分类组织选中的记忆
  const categorized: Record<string, string[]> = {}
  for (const m of selectedMemories) {
    if (!categorized[m.category]) categorized[m.category] = []
    categorized[m.category].push(`- ${m.key}: ${m.value}`)
  }

  let memorySection = ''
  for (const [cat, items] of Object.entries(categorized)) {
    const label = categoryLabels[cat] || cat
    memorySection += `\n${label}:\n${items.join('\n')}\n`
  }

  // 标记被注入的记忆为"已访问"
  const memoryIds = selectedMemories.map((m) => m.id)
  await db.memory.updateMany({
    where: { id: { in: memoryIds } },
    data: {
      accessCount: { increment: 1 },
      lastAccessedAt: new Date(),
    },
  })

  const totalMemories = allMemories.length
  const injectedMemories = selectedMemories.length
  const note = totalMemories > injectedMemories
    ? `\n（注：你共有 ${totalMemories} 条记忆，本次根据相关性注入了 ${injectedMemories} 条）`
    : ''

  return {
    prompt: `你是一个拥有跨对话记忆能力的智能助手。以下是你记住的关于用户的信息：

${memorySection}
${note}
重要指令：
1. 在回复时，主动运用上述记忆信息，让用户感受到你"记得"他们
2. 如果用户的问题与记忆中的信息相关，自然地引用相关记忆
3. 不要生硬地罗列记忆，而是自然地融入对话中
4. 如果发现记忆中有过时或错误的信息，可以主动确认更新
5. 当用户告诉你新的个人信息、偏好、目标时，这些信息值得被记住`,
    tokenCount: usedTokens,
  }
}

// ==================== 对话历史压缩 ====================
const MAX_HISTORY_ROUNDS = 20 // 超过20轮（40条消息）时触发压缩
const KEEP_RECENT_ROUNDS = 6  // 始终保留最近6轮

export async function getConversationHistory(
  conversationId: string,
  systemTokenCount: number
) {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  if (!conversation) return []

  const messages = conversation.messages
  const historyBudget = Math.floor(TOKEN_BUDGET.total * TOKEN_BUDGET.historyRatio)

  // 如果消息数超过阈值，触发压缩
  if (messages.length > MAX_HISTORY_ROUNDS * 2) {
    await compressConversationHistory(conversationId, messages)
    // 重新获取（含压缩后的摘要）
    const updated = await db.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (updated) {
      return buildHistoryWithinBudget(updated.messages, historyBudget)
    }
  }

  return buildHistoryWithinBudget(messages, historyBudget)
}

function buildHistoryWithinBudget(
  messages: { role: string; content: string }[],
  budget: number
) {
  const result: { role: 'user' | 'assistant'; content: string }[] = []
  let usedTokens = 0

  // 从最新的消息开始，向前填充
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'system') continue
    const tokens = estimateTokens(msg.content)
    if (usedTokens + tokens > budget) break
    result.unshift({ role: msg.role as 'user' | 'assistant', content: msg.content })
    usedTokens += tokens
  }

  return result
}

async function compressConversationHistory(
  conversationId: string,
  messages: { id: string; role: string; content: string; createdAt: Date }[]
) {
  // 分离需要压缩的早期消息和保留的近期消息
  const keepFrom = messages.length - KEEP_RECENT_ROUNDS * 2
  const oldMessages = messages.slice(0, Math.max(0, keepFrom))

  if (oldMessages.length === 0) return

  // 用LLM生成摘要
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    const conversationText = oldMessages
      .map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
      .join('\n')

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: '你是一个对话摘要助手。请将以下对话历史压缩为简洁的摘要，保留关键信息、用户需求和重要结论。用中文输出，200字以内。',
        },
        { role: 'user', content: conversationText },
      ],
      temperature: 0.3,
    })

    const summary = completion.choices[0]?.message?.content || ''

    // 删除旧消息
    const oldIds = oldMessages.map((m) => m.id)
    await db.message.deleteMany({
      where: { id: { in: oldIds } },
    })

    // 将摘要写入对话的summary字段
    const existingSummary = (await db.conversation.findUnique({
      where: { id: conversationId },
      select: { summary: true },
    }))?.summary || ''

    await db.conversation.update({
      where: { id: conversationId },
      data: {
        summary: existingSummary ? `${existingSummary}\n\n${summary}` : summary,
      },
    })
  } catch (error) {
    console.error('History compression failed:', error)
  }
}

// ==================== 记忆过期与清理 ====================
const MEMORY_STALE_DAYS = 90        // 90天未被访问标记为过时
const MEMORY_EXPIRE_DAYS = 180      // 180天自动过期
const MEMORY_CLEANUP_BATCH = 50     // 每次清理的批量

// 标记过时记忆
export async function markStaleMemories(userId: string) {
  const staleThreshold = new Date()
  staleThreshold.setDate(staleThreshold.getDate() - MEMORY_STALE_DAYS)

  const result = await db.memory.updateMany({
    where: {
      userId,
      isStale: false,
      lastAccessedAt: { lt: staleThreshold },
      expiresAt: null,
    },
    data: { isStale: true },
  })

  return result.count
}

// 清理过期记忆
export async function cleanupExpiredMemories(userId: string) {
  // 删除已过期的记忆
  const deleted = await db.memory.deleteMany({
    where: {
      userId,
      expiresAt: { lt: new Date() },
    },
  })

  // 给长期未访问的过时记忆设置过期时间
  const expireThreshold = new Date()
  expireThreshold.setDate(expireThreshold.getDate() - MEMORY_EXPIRE_DAYS)

  const stale = await db.memory.findMany({
    where: {
      userId,
      isStale: true,
      lastAccessedAt: { lt: expireThreshold },
      expiresAt: null,
    },
    take: MEMORY_CLEANUP_BATCH,
  })

  for (const memory of stale) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 给7天宽限期
    await db.memory.update({
      where: { id: memory.id },
      data: { expiresAt },
    })
  }

  return { deleted: deleted.count, scheduled: stale.length }
}

// 自动为新提取的记忆设置过期时间
export function calculateMemoryExpiry(category: string): Date | null {
  const now = new Date()
  switch (category) {
    case 'profile':
      return null // 用户画像永不过期
    case 'preference':
      return new Date(now.setDate(now.getDate() + 365)) // 偏好1年
    case 'goal':
      return new Date(now.setDate(now.getDate() + 180)) // 目标6个月
    case 'project':
      return new Date(now.setDate(now.getDate() + 90)) // 项目3个月
    case 'insight':
      return new Date(now.setDate(now.getDate() + 180)) // 洞察6个月
    case 'fact':
      return new Date(now.setDate(now.getDate() + 365)) // 事实1年
    default:
      return new Date(now.setDate(now.getDate() + 180)) // 默认6个月
  }
}

// ==================== 记忆提取（增强版） ====================
export async function extractMemoriesFromMessage(
  userId: string,
  userMessage: string,
  assistantMessage: string
) {
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    const extractPrompt = `分析以下对话内容，提取值得长期记住的信息。

用户说: ${userMessage}
助手回复: ${assistantMessage}

请以JSON格式返回提取的记忆，格式如下:
{
  "memories": [
    {
      "category": "profile|preference|goal|project|insight|fact",
      "key": "简短描述（如：职业、技术偏好、当前项目）",
      "value": "具体内容",
      "importance": "high|medium|low"
    }
  ]
}

提取规则:
- 只提取有长期价值的信息，忽略临时性、闲聊性的内容
- category分类: profile(个人画像), preference(偏好习惯), goal(目标计划), project(项目信息), insight(洞察观点), fact(事实记录)
- importance: high=核心信息(姓名/职业等), medium=重要偏好/目标, low=一般事实
- key要简明扼要，便于检索
- value要具体明确
- 如果没有值得记忆的信息，返回空数组
- 只返回JSON，不要其他文字`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: '你是一个信息提取助手，只返回JSON格式的结果。' },
        { role: 'user', content: extractPrompt },
      ],
      temperature: 0.3,
    })

    const content = completion.choices[0]?.message?.content || ''

    let jsonStr = content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    const parsed = JSON.parse(jsonStr)
    const memories = parsed.memories || []

    for (const mem of memories) {
      if (!mem.category || !mem.key || !mem.value) continue

      const existing = await db.memory.findFirst({
        where: { userId, category: mem.category, key: mem.key },
      })

      const expiresAt = calculateMemoryExpiry(mem.category)

      if (existing) {
        await db.memory.update({
          where: { id: existing.id },
          data: {
            value: mem.value,
            expiresAt,
            isStale: false, // 更新时取消过时标记
            lastAccessedAt: new Date(),
            updatedAt: new Date(),
          },
        })
      } else {
        await db.memory.create({
          data: {
            userId,
            category: mem.category,
            key: mem.key,
            value: mem.value,
            expiresAt,
          },
        })
      }
    }

    // 每次提取后顺便执行一次过期检查
    await markStaleMemories(userId)

    return memories.length
  } catch (error) {
    console.error('Memory extraction failed:', error)
    return 0
  }
}

// ==================== 辅助函数 ====================
export { estimateTokens, TOKEN_BUDGET }
