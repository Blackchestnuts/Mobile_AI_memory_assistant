import { db } from '@/lib/db'
import { chatCompletion } from '@/lib/ai'

// 确保默认用户存在
export async function ensureDefaultUser() {
  let user = await db.user.findFirst()
  if (!user) {
    user = await db.user.create({
      data: { name: '默认用户' },
    })
  }
  return user
}

// 记忆注入限制配置
const MAX_MEMORIES_PER_CATEGORY = 3  // 每个分类最多注入3条
const MAX_MEMORIES_TOTAL = 18         // 总共最多注入18条

// 中文停用词表（常见无意义词，不用于匹配）
const STOP_WORDS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
  '这', '中', '大', '为', '上', '个', '国', '们', '到', '说', '时', '也',
  '子', '得', '里', '去', '那', '要', '会', '对', '着', '能', '他', '她',
  '你', '它', '吗', '吧', '啊', '呢', '嗯', '哦', '把', '被', '让', '给',
  '很', '多', '什么', '怎么', '如何', '可以', '请', '帮', '想', '知道',
  '还是', '但是', '因为', '所以', '如果', '虽然', '可能', '应该', '已经',
  '一个', '一些', '这个', '那个', '这些', '那些', '自己', '没有', '不是',
])

// 从文本中提取关键词
function extractKeywords(text: string): string[] {
  // 移除标点符号，按空格和中文字符切分
  const cleaned = text.replace(/[，。！？、；：""''（）【】《》\s,.!?;:'"()\[\]{}<>]/g, ' ')
  const words = cleaned.split(/\s+/).filter(w => w.length > 0)

  const keywords: string[] = []
  for (const word of words) {
    // 跳过停用词和单字（除专有名词外）
    if (STOP_WORDS.has(word)) continue
    if (word.length === 1) continue

    keywords.push(word.toLowerCase())

    // 对中文文本做2-3字滑动窗口，提取子词
    // 例: "人工智能" → ["人工", "智能", "人工智能"]
    if (/[\u4e00-\u9fa5]/.test(word) && word.length >= 3) {
      for (let i = 0; i < word.length - 1; i++) {
        const bigram = word.substring(i, i + 2)
        if (!STOP_WORDS.has(bigram) && bigram.length === 2) {
          keywords.push(bigram)
        }
      }
    }
  }

  return [...new Set(keywords)]  // 去重
}

// 计算记忆与关键词的相关性分数
function calculateRelevance(memory: { key: string; value: string; category: string }, keywords: string[]): number {
  let score = 0
  const keyLower = memory.key.toLowerCase()
  const valueLower = memory.value.toLowerCase()
  const combined = `${keyLower} ${valueLower}`

  for (const keyword of keywords) {
    const kw = keyword.toLowerCase()
    // key 完全匹配 → 最高权重
    if (keyLower === kw) score += 10
    // key 包含关键词 → 高权重
    else if (keyLower.includes(kw)) score += 5
    // value 包含关键词 → 中等权重
    else if (valueLower.includes(kw)) score += 3
    // 组合文本包含 → 低权重
    else if (combined.includes(kw)) score += 1
  }

  return score
}

// 构建记忆prompt - 关键词相关性 + 数量限制
export async function buildMemoryPrompt(userId: string, userMessage?: string) {
  const memories = await db.memory.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })

  if (memories.length === 0) {
    return {
      prompt: `你是一个智能助手，拥有跨对话的记忆能力。你可以记住用户告诉你的信息，在后续对话中主动运用这些记忆来提供更个性化的服务。

当前你还没有关于这个用户的记忆，请在对话中自然地了解用户信息。`,
    }
  }

  const categoryLabels: Record<string, string> = {
    profile: '👤 用户画像',
    preference: '偏好与习惯',
    goal: '🎯 目标与计划',
    project: '📋 项目信息',
    insight: '💡 洞察与观点',
    fact: '📌 事实记录',
  }

  // 如果有用户消息，按关键词相关性排序
  let sortedMemories = memories
  if (userMessage) {
    const keywords = extractKeywords(userMessage)
    if (keywords.length > 0) {
      // 计算每条记忆的相关性分数
      const scored = memories.map(m => ({
        memory: m,
        relevance: calculateRelevance(m, keywords),
      }))
      // 先按相关性降序，相关性相同按更新时间降序
      scored.sort((a, b) => b.relevance - a.relevance || b.memory.updatedAt.getTime() - a.memory.updatedAt.getTime())
      sortedMemories = scored.map(s => s.memory)
    }
  }

  // 按分类分组，每个分类只取最新的 MAX_MEMORIES_PER_CATEGORY 条
  const categorized: Record<string, string[]> = {}
  const categoryCounts: Record<string, number> = {}
  let totalCount = 0

  for (const m of sortedMemories) {
    // 超过总量限制，停止添加
    if (totalCount >= MAX_MEMORIES_TOTAL) break

    if (!categorized[m.category]) {
      categorized[m.category] = []
      categoryCounts[m.category] = 0
    }

    // 每个分类只取最新的 N 条
    if (categoryCounts[m.category] >= MAX_MEMORIES_PER_CATEGORY) continue

    categorized[m.category].push(`- ${m.key}: ${m.value}`)
    categoryCounts[m.category]++
    totalCount++
  }

  let memorySection = ''
  for (const [cat, items] of Object.entries(categorized)) {
    const label = categoryLabels[cat] || cat
    memorySection += `\n${label}:\n${items.join('\n')}\n`
  }

  // 如果有记忆被截断，添加提示
  const totalMemories = memories.length
  const truncationNote = totalMemories > MAX_MEMORIES_TOTAL
    ? `\n（注：你还有 ${totalMemories - MAX_MEMORIES_TOTAL} 条记忆未显示，如需了解更多可以主动询问用户）\n`
    : ''

  return {
    prompt: `你是一个拥有跨对话记忆能力的智能助手。以下是你记住的关于用户的信息：

${memorySection}${truncationNote}
重要指令：
1. 在回复时，主动运用上述记忆信息，让用户感受到你"记得"他们
2. 如果用户的问题与记忆中的信息相关，自然地引用相关记忆
3. 不要生硬地罗列记忆，而是自然地融入对话中
4. 如果发现记忆中有过时或错误的信息，可以主动确认更新
5. 当用户告诉你新的个人信息、偏好、目标时，这些信息值得被记住`,
  }
}

// 从对话中提取记忆
export async function extractMemoriesFromMessage(
  userId: string,
  userMessage: string,
  assistantMessage: string
) {
  try {
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
- key要简明扼要，便于检索
- value要具体明确
- 如果没有值得记忆的信息，返回空数组
- 只返回JSON，不要其他文字`

    const result = await chatCompletion({
      messages: [
        { role: 'system', content: '你是一个信息提取助手，只返回JSON格式的结果。' },
        { role: 'user', content: extractPrompt },
      ],
      temperature: 0.3,
    })

    const content = result.content || ''

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

      if (existing) {
        await db.memory.update({
          where: { id: existing.id },
          data: { value: mem.value },
        })
      } else {
        await db.memory.create({
          data: {
            userId,
            category: mem.category,
            key: mem.key,
            value: mem.value,
          },
        })
      }
    }

    return memories.length
  } catch (error) {
    console.error('Memory extraction failed:', error)
    return 0
  }
}
