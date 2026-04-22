import { db } from '@/lib/db'
import { buildMemoryPrompt, extractMemoriesFromMessage, ensureDefaultUser, trimHistoryMessages } from '@/lib/memory'
import { chatCompletion, checkAIAvailable } from '@/lib/ai'

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

    // 检查 AI 是否可用
    const aiStatus = await checkAIAvailable()
    if (!aiStatus.available) {
      const assistantContent = `⚠️ ${aiStatus.message}`

      await db.message.create({
        data: { conversationId: conversation.id, role: 'assistant', content: assistantContent },
      })

      return Response.json({
        conversationId: conversation.id,
        reply: assistantContent,
      })
    }

    // 构建带记忆的system prompt
    const { prompt: systemPrompt } = await buildMemoryPrompt(userId, message)

    // 获取对话历史（使用窗口限制，只保留最近20条，避免context过长）
    const historyMessages = trimHistoryMessages(
      conversation.messages.map(m => ({ role: m.role, content: m.content }))
    )

    // 组装消息列表
    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...historyMessages,
      { role: 'user' as const, content: message },
    ]

    // 调用 LLM
    const assistantContent = await chatCompletion({
      messages: chatMessages,
      temperature: 0.7,
    }) || '抱歉，我无法生成回复。'

    // 保存助手回复
    await db.message.create({
      data: { conversationId: conversation.id, role: 'assistant', content: assistantContent },
    })

    // 异步提取记忆（内置智能触发，闲聊消息自动跳过）
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
