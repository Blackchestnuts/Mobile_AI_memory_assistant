import { create } from 'zustand'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: Message[]
}

export interface MemoryItem {
  id: string
  category: string
  key: string
  value: string
  createdAt: string
  updatedAt: string
}

interface AppState {
  // 对话
  conversations: Conversation[]
  currentConversation: Conversation | null
  isLoadingConversations: boolean
  isSendingMessage: boolean

  // 记忆
  memories: MemoryItem[]
  isLoadingMemories: boolean

  // UI状态
  showMemoryPanel: boolean
  showSidebar: boolean

  // Setters
  setCurrentConversation: (conversation: Conversation | null) => void
  toggleMemoryPanel: () => void
  toggleSidebar: () => void
  setShowSidebar: (v: boolean) => void

  // 对话 Actions
  fetchConversations: () => Promise<void>
  fetchConversation: (id: string) => Promise<void>
  sendMessage: (message: string) => Promise<string | null>
  deleteConversation: (id: string) => Promise<void>

  // 记忆 Actions
  fetchMemories: () => Promise<void>
  deleteMemory: (id: string) => Promise<void>
  updateMemory: (id: string, data: Partial<MemoryItem>) => Promise<void>
  addMemory: (data: { key: string; value: string }) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  isLoadingConversations: false,
  isSendingMessage: false,
  memories: [],
  isLoadingMemories: false,
  showMemoryPanel: false,
  showSidebar: true,

  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),
  toggleMemoryPanel: () => set((s) => ({ showMemoryPanel: !s.showMemoryPanel })),
  toggleSidebar: () => set((s) => ({ showSidebar: !s.showSidebar })),
  setShowSidebar: (v) => set({ showSidebar: v }),

  fetchConversations: async () => {
    set({ isLoadingConversations: true })
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      set({ conversations: Array.isArray(data) ? data : [], isLoadingConversations: false })
    } catch {
      set({ isLoadingConversations: false })
    }
  },

  fetchConversation: async (id) => {
    try {
      const res = await fetch(`/api/conversations/${id}`)
      const data = await res.json()
      set({ currentConversation: data })
    } catch {
      // ignore
    }
  },

  fetchMemories: async () => {
    set({ isLoadingMemories: true })
    try {
      const res = await fetch('/api/memories')
      const data = await res.json()
      set({ memories: Array.isArray(data) ? data : [], isLoadingMemories: false })
    } catch {
      set({ isLoadingMemories: false })
    }
  },

  sendMessage: async (message) => {
    const { currentConversation } = get()
    set({ isSendingMessage: true })

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationId: currentConversation?.id || null,
        }),
      })

      const data = await res.json()

      if (data.error) {
        set({ isSendingMessage: false })
        return null
      }

      await get().fetchConversations()
      if (data.conversationId) {
        await get().fetchConversation(data.conversationId)
      }

      // 延迟刷新记忆（等待后台提取完成）
      setTimeout(() => get().fetchMemories(), 2000)

      set({ isSendingMessage: false })
      return data.reply
    } catch {
      set({ isSendingMessage: false })
      return null
    }
  },

  deleteConversation: async (id) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      const { currentConversation } = get()
      if (currentConversation?.id === id) {
        set({ currentConversation: null })
      }
      await get().fetchConversations()
    } catch {
      // ignore
    }
  },

  deleteMemory: async (id) => {
    try {
      await fetch(`/api/memories/${id}`, { method: 'DELETE' })
      set((s) => ({ memories: s.memories.filter((m) => m.id !== id) }))
    } catch {
      // ignore
    }
  },

  updateMemory: async (id, data) => {
    try {
      await fetch(`/api/memories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      await get().fetchMemories()
    } catch {
      // ignore
    }
  },

  addMemory: async (data) => {
    try {
      await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      await get().fetchMemories()
    } catch {
      // ignore
    }
  },
}))
