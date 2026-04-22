import { db } from '@/lib/db'
import { buildMemoryPrompt, extractMemoriesFromMessage, ensureDefaultUser } from '@/lib/memory'
import { chatCompletion } from '@/lib/ai'

// 检查 AI 模型是否可用
async function checkAIAvailable(): Promise<{ available: boolean; message: string }> {
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'http://localhost:11434/v1'
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${baseUrl}/models`, { signal: controller.signal })
    clearTimeout(timeout)
    if (res.ok) return { available: true, message: '' }
    return { available: false, message: 'AI 模型服务响应异常' }
  } catch {
    return {
      available: false,
      message: 'AI 模型服务未启动。请确保 Ollama 已安装并运行：\n1. 安装 Ollama → ollama.com\n2. 运行 ollama serve\n3. 下载模型 → ollama pull qwen2.5:7b\n4. 在 .env 中配置 DEEPSEEK_BASE_URL=http://localhost:11434/v1',
    }
  }
}

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
      // AI 不可用时，返回友好提示而不是崩溃
      const assistantContent = `⚠️ ${aiStatus.message}`

      await db.message.create({
        data: { conversationId: conversation.id, role: 'assistant', content: assistantContent },
      })

      return Response.json({
        conversationId: conversation.id,
        reply: assistantContent,
      })
    }

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

    // 调用 LLM
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
