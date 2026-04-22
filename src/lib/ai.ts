// AI 调用封装 - 支持 Ollama / DeepSeek / OpenAI 兼容接口

const AI_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const AI_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
const AI_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionOptions {
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
}

export async function chatCompletion(options: ChatCompletionOptions): Promise<string> {
  const { messages, temperature = 0.7, max_tokens = 4096 } = options

  if (!AI_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY 未配置，请在 .env 文件中设置')
  }

  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({ model: AI_MODEL, messages, temperature, max_tokens }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI API 调用失败 (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

// 检查 AI 模型是否可用（3秒超时）
export async function checkAIAvailable(): Promise<{ available: boolean; message: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${AI_BASE_URL}/models`, { signal: controller.signal })
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

// AI 智能分类 — 根据记忆内容自动判断分类
const CATEGORY_LIST = ['profile', 'preference', 'goal', 'project', 'insight', 'fact']

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  profile: '个人画像 — 姓名、年龄、职业、身份等个人信息',
  preference: '偏好习惯 — 喜好、风格、习惯等倾向性信息',
  goal: '目标计划 — 想要达成的目标、计划、愿望',
  project: '项目信息 — 正在做或做过的项目、工作任务',
  insight: '洞察观点 — 对事物的看法、观点、思考',
  fact: '事实记录 — 客观事实、日期、数量等确定性信息',
}

export async function classifyMemory(key: string, value: string): Promise<string> {
  try {
    const categoryListStr = CATEGORY_LIST.map(c => `${c}(${CATEGORY_DESCRIPTIONS[c]})`).join('、')
    const result = await chatCompletion({
      messages: [
        { role: 'system', content: '你是记忆分类助手，只返回分类名称，不要其他文字。' },
        {
          role: 'user',
          content: `请将以下记忆分类到最合适的类别中。\n\n可选分类: ${categoryListStr}\n\n记忆键名: ${key}\n记忆内容: ${value}\n\n只返回分类名称（如 profile），不要其他文字。`,
        },
      ],
      temperature: 0.1,
      max_tokens: 20,
    })

    const cleaned = result.trim().toLowerCase()
    // 从返回结果中提取有效分类
    const matched = CATEGORY_LIST.find(c => cleaned.includes(c))
    return matched || 'fact' // 默认归为事实记录
  } catch {
    return 'fact' // AI 不可用时默认归为事实记录
  }
}
