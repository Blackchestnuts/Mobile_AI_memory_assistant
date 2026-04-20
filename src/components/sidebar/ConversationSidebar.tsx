'use client'

import { useAppStore } from '@/store/useAppStore'
import { useEffect, useState } from 'react'
import { Plus, MessageSquare, Trash2, ChevronLeft, Menu, Brain, LogOut, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useSession, signOut } from 'next-auth/react'

export function ConversationSidebar() {
  const {
    conversations,
    currentConversation,
    isLoadingConversations,
    showSidebar,
    fetchConversations,
    fetchConversation,
    deleteConversation,
    setShowSidebar,
    fetchMemories,
    setCurrentConversation,
  } = useAppStore()

  const { data: session } = useSession()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetchConversations()
    fetchMemories()
  }, [fetchConversations, fetchMemories])

  const handleNewConversation = async () => {
    setCurrentConversation(null)
  }

  const handleSelectConversation = async (id: string) => {
    await fetchConversation(id)
    // 移动端自动收起侧边栏
    if (window.innerWidth < 768) {
      setShowSidebar(false)
    }
  }

  const handleDelete = async () => {
    if (deleteId) {
      await deleteConversation(deleteId)
      setDeleteId(null)
    }
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString('zh-CN')
  }

  const userName = session?.user?.name || '用户'
  const userEmail = session?.user?.email || ''
  const userInitial = userName.charAt(0).toUpperCase()

  if (!showSidebar) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 bg-background shadow-md border"
        onClick={() => setShowSidebar(true)}
      >
        <Menu className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <>
      <div className="w-72 border-r bg-muted/30 flex flex-col h-full shrink-0">
        {/* 头部 */}
        <div className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h1 className="font-bold text-lg">AI记忆助手</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSidebar(false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <Button
            className="w-full gap-2"
            onClick={handleNewConversation}
          >
            <Plus className="h-4 w-4" />
            新对话
          </Button>
        </div>

        {/* 对话列表 - 自定义滚动条 */}
        <div className="flex-1 custom-scrollbar overflow-y-auto">
          <div className="p-2 space-y-1">
            {isLoadingConversations ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                加载中...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                暂无对话<br />点击上方按钮开始新对话
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    'group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors',
                    currentConversation?.id === conv.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{conv.title}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(conv.updatedAt)}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteId(conv.id)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 底部用户信息 */}
        <div className="p-3 border-t shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted transition-colors text-left">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{userName}</div>
                  <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="gap-2" disabled>
                <UserIcon className="h-4 w-4" />
                <span className="truncate">{userName}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个对话吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
