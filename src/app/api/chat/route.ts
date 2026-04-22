import { db } from '@/lib/db'
import { buildMemoryPrompt, extractMemoriesFromMessage, ensureDefaultUser } from '@/lib/memory'
import { chatCompletion } from '@/lib/ai'

export async function POST(request: Request) {
  try {
    const user = await ensureDefaultUser()
    const userId = user.id
    const body = await request.json()
    const { message, conversationId } = body

    if (!message || typeof message !== 'string') {
      return Response.json({ error: '消息内容不能为空' }, { status: 400 })
    }

    // 获取或创建对话
    let conversation
    if (conversationId) {
      conversation = await db.conversation.findFirst({
        where: { id: conversationId, userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })
    }

    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          userId,
          title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
        },
        include: { messages: true },
      })
    }

    // 保存用户消息
    await db.message.create({
      data: { conversationId: conversation.id, role: 'user', content: message },
    })

    // 构建带记忆的system prompt（传入用户消息以匹配相关记忆）
    const { prompt: systemPrompt } = await buildMemoryPrompt(userId, message)

    // 获取对话历史
    const historyMessages = conversation.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // 组装消息列表
    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...historyMessages,
      { role: 'user' as const, content: message },
    ]

    // 调用 DeepSeek LLM
    const result = await chatCompletion({
      messages: chatMessages,
      temperature: 0.7,
    })

    const assistantContent = result.content || '抱歉，我无法生成回复。'

    // 保存助手回复
    await db.message.create({
      data: { conversationId: conversation.id, role: 'assistant', content: assistantContent },
    })

    // 异步提取记忆
    extractMemoriesFromMessage(userId, message, assistantContent).catch((err) =>
      console.error('Background memory extraction failed:', err)
    )

    return Response.json({
      conversationId: conversation.id,
      reply: assistantContent,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return Response.json({ error: '服务器错误，请稍后重试' }, { status: 500 })
  }
}
