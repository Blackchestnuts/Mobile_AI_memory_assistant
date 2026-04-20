import { db } from '@/lib/db'
import { buildMemoryPrompt, extractMemoriesFromMessage, getConversationHistory, markStaleMemories, cleanupExpiredMemories, TOKEN_BUDGET, estimateTokens } from '@/lib/memory'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: '请先登录' }, { status: 401 })
    }

    const userId = session.user.id
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

    // 构建带记忆的system prompt（滑动窗口 + 话题相关性）
    const { prompt: systemPrompt, tokenCount: systemTokenCount } = await buildMemoryPrompt(userId, message)

    // 获取对话历史（自动压缩 + token预算）
    const historyMessages = await getConversationHistory(conversation.id, systemTokenCount)

    // 如果对话有摘要，注入到system prompt中
    let finalSystemPrompt = systemPrompt
    if (conversation.summary) {
      finalSystemPrompt += `\n\n📋 早期对话摘要:\n${conversation.summary}`
    }

    // 组装消息列表
    const chatMessages = [
      { role: 'system' as const, content: finalSystemPrompt },
      ...historyMessages,
      { role: 'user' as const, content: message },
    ]

    // 调用LLM
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    const completion = await zai.chat.completions.create({
      messages: chatMessages,
      temperature: 0.7,
    })

    const assistantContent = completion.choices[0]?.message?.content || '抱歉，我无法生成回复。'

    // 保存助手回复
    await db.message.create({
      data: { conversationId: conversation.id, role: 'assistant', content: assistantContent },
    })

    // 异步提取记忆
    extractMemoriesFromMessage(userId, message, assistantContent).catch((err) =>
      console.error('Background memory extraction failed:', err)
    )

    // 异步清理过期记忆（低频执行，每次对话1%概率触发）
    if (Math.random() < 0.01) {
      cleanupExpiredMemories(userId).catch((err) =>
        console.error('Memory cleanup failed:', err)
      )
    }

    return Response.json({
      conversationId: conversation.id,
      reply: assistantContent,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return Response.json({ error: '服务器错误，请稍后重试' }, { status: 500 })
  }
}
