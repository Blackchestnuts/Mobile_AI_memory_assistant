'use client'

import { ConversationSidebar } from '@/components/sidebar/ConversationSidebar'
import { ChatArea } from '@/components/chat/ChatArea'
import { MemoryPanel } from '@/components/memory/MemoryPanel'
import { useAppStore } from '@/store/useAppStore'
import { useEffect } from 'react'

export default function Home() {
  const { showSidebar, showMemoryPanel, fetchMemories } = useAppStore()

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  return (
    <div className="h-dvh flex bg-background overflow-hidden">
      {/* 桌面端侧边栏 */}
      {showSidebar && (
        <div className="hidden md:block shrink-0 h-full">
          <ConversationSidebar />
        </div>
      )}

      {/* 移动端侧边栏 - 全屏覆盖 */}
      {showSidebar && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => useAppStore.getState().setShowSidebar(false)} />
          <div className="relative h-full w-72">
            <ConversationSidebar />
          </div>
        </div>
      )}

      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <ChatArea />
      </div>

      {/* 桌面端记忆面板 - 右侧面板 */}
      {showMemoryPanel && (
        <div className="hidden md:block shrink-0 h-full">
          <MemoryPanel />
        </div>
      )}

      {/* 移动端记忆面板 - 底部弹出 */}
      {showMemoryPanel && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => useAppStore.getState().toggleMemoryPanel()} />
          <div className="absolute bottom-0 left-0 right-0 h-[85dvh] rounded-t-2xl overflow-hidden">
            <MemoryPanel />
          </div>
        </div>
      )}
    </div>
  )
}
