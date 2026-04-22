// AI 调用封装 - 支持 DeepSeek / OpenAI 兼容接口

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionOptions {
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
}

interface ChatCompletionResult {
  content: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export async function chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
  const { messages, temperature = 0.7, max_tokens = 4096 } = options

  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY 未配置，请在 .env 文件中设置')
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature,
      max_tokens,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('DeepSeek API error:', response.status, errorText)
    throw new Error(`DeepSeek API 调用失败 (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  const content = data.choices?.[0]?.message?.content || ''
  const usage = data.usage

  return { content, usage }
}
