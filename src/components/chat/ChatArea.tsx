'use client'

import { useAppStore } from '@/store/useAppStore'
import { useRef, useEffect, useState } from 'react'
import { Send, Loader2, Brain, Sparkles, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export function ChatArea() {
  const {
    currentConversation,
    isSendingMessage,
    showMemoryPanel,
    sendMessage,
    toggleMemoryPanel,
    memories,
    showSidebar,
    setShowSidebar,
  } = useAppStore()

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const messages = currentConversation?.messages || []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSendingMessage])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isSendingMessage) return

    setInput('')
    await sendMessage(trimmed)

    // 重置textarea高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    // 自动调整高度
    const target = e.target
    target.style.height = 'auto'
    target.style.height = Math.min(target.scrollHeight, 200) + 'px'
  }

  const hasConversation = !!currentConversation

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* 顶部栏 */}
      <div className="h-14 border-b flex items-center justify-between px-3 md:px-4 shrink-0 gap-2 safe-top">
        <div className="flex items-center gap-2 min-w-0">
          {(
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 md:hidden"
              onClick={() => setShowSidebar(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          {!showSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 hidden md:flex"
              onClick={() => setShowSidebar(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <div className="font-medium truncate">
            {hasConversation ? currentConversation.title : 'AI记忆助手'}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-2', showMemoryPanel && 'bg-primary/10')}
          onClick={toggleMemoryPanel}
        >
          <Brain className="h-4 w-4" />
          <span className="hidden sm:inline">记忆</span>
          {memories.length > 0 && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
              {memories.length}
            </span>
          )}
        </Button>
      </div>

      {/* 消息区域 - 使用自定义滚动条 */}
      <div ref={scrollContainerRef} className="flex-1 p-4 custom-scrollbar overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          {!hasConversation ? (
            /* 欢迎页面 */
            <div className="flex flex-col items-center justify-center py-16">
              <div className="max-w-md text-center space-y-6">
                <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">AI记忆助手</h2>
                  <p className="text-muted-foreground">
                    我能记住你告诉我的一切，跨对话持续了解你。<br />
                    直接在下方输入开始聊天吧！
                  </p>
                </div>
                {memories.length > 0 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 text-primary font-medium mb-1">
                      <Sparkles className="h-4 w-4" />
                      我已记住你 {memories.length} 条信息
                    </div>
                    <p className="text-muted-foreground text-xs">
                      在新对话中，我会自动运用这些记忆
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 text-sm text-left">
                  {[
                    '你好，我叫张三，是一名产品经理',
                    '我正在做一个AI记忆系统项目',
                    '我喜欢简洁明了的技术回复',
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      className="p-3 rounded-lg border hover:bg-muted transition-colors text-left"
                      onClick={() => {
                        setInput(suggestion)
                        textareaRef.current?.focus()
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              开始你的对话吧！我会自动记住重要信息。
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      AI
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
                {msg.role === 'user' && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-secondary text-xs">
                      我
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))
          )}
          {isSendingMessage && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  AI
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区域 - 始终显示，移动端安全区域 */}
      <div className="border-t p-3 md:p-4 shrink-0 safe-bottom">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="resize-none min-h-[44px] max-h-[200px]"
            rows={1}
          />
          <Button
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || isSendingMessage}
          >
            {isSendingMessage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
