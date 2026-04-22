'use client'

import { useAppStore, type MemoryItem } from '@/store/useAppStore'
import { useState } from 'react'
import {
  Brain,
  Plus,
  Trash2,
  User,
  Heart,
  Target,
  FolderKanban,
  Lightbulb,
  Pin,
  X,
  Pencil,
  Check,
  Clock,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  profile: { label: '用户画像', icon: <User className="h-3.5 w-3.5" />, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  preference: { label: '偏好习惯', icon: <Heart className="h-3.5 w-3.5" />, color: 'bg-pink-500/10 text-pink-600 border-pink-500/20' },
  goal: { label: '目标计划', icon: <Target className="h-3.5 w-3.5" />, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  project: { label: '项目信息', icon: <FolderKanban className="h-3.5 w-3.5" />, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  insight: { label: '洞察观点', icon: <Lightbulb className="h-3.5 w-3.5" />, color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  fact: { label: '事实记录', icon: <Pin className="h-3.5 w-3.5" />, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')

  if (year === now.getFullYear()) return `${month}-${day} ${h}:${m}`
  return `${year}-${month}-${day} ${h}:${m}`
}

function formatFullTime(dateStr: string) {
  const date = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function MemoryPanel() {
  const {
    memories,
    showMemoryPanel,
    toggleMemoryPanel,
    deleteMemory,
    addMemory,
    updateMemory,
  } = useAppStore()

  const [isAdding, setIsAdding] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [isClassifying, setIsClassifying] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  if (!showMemoryPanel) return null

  // 按分类分组
  const grouped = memories.reduce<Record<string, MemoryItem[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = []
    acc[m.category].push(m)
    return acc
  }, {})

  // 按分类定义顺序排序
  const categoryOrder = ['profile', 'preference', 'goal', 'project', 'insight', 'fact']
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  )

  const handleAdd = async () => {
    if (!newKey.trim() || !newValue.trim()) return
    setIsClassifying(true)
    try {
      // 只传 key 和 value，AI 自动分类
      await addMemory({ key: newKey.trim(), value: newValue.trim() })
      setNewKey('')
      setNewValue('')
      setIsAdding(false)
    } finally {
      setIsClassifying(false)
    }
  }

  const handleStartEdit = (memory: MemoryItem) => {
    setEditingId(memory.id)
    setEditValue(memory.value)
  }

  const handleSaveEdit = async (id: string) => {
    if (editValue.trim()) {
      await updateMemory(id, { value: editValue.trim() })
    }
    setEditingId(null)
  }

  return (
    <div className="w-80 border-l bg-muted/30 flex flex-col h-full shrink-0">
      {/* 头部 */}
      <div className="p-4 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="font-bold">AI记忆</h2>
            <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
              {memories.length}
            </span>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMemoryPanel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 智能添加记忆 */}
      {isAdding && (
        <div className="p-3 border-b bg-background space-y-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Sparkles className="h-3 w-3" />
            <span>只需输入内容，AI自动分类</span>
          </div>
          <Input
            placeholder="键名（如：职业）"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="h-8 text-sm"
          />
          <Input
            placeholder="值（如：产品经理）"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newKey.trim() && newValue.trim()) handleAdd()
            }}
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8 gap-1.5" onClick={handleAdd} disabled={isClassifying}>
              {isClassifying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  AI分类中...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  智能添加
                </>
              )}
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => { setIsAdding(false); setNewKey(''); setNewValue('') }}>
              取消
            </Button>
          </div>
        </div>
      )}

      {/* 记忆列表 */}
      <div className="flex-1 custom-scrollbar overflow-y-auto">
        <div className="p-3 space-y-4">
          {memories.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>还没有记忆</p>
              <p className="text-xs mt-1">和我聊天时，我会自动记住重要信息</p>
            </div>
          ) : (
            sortedCategories.map((category) => {
              const items = grouped[category]
              const config = categoryConfig[category] || {
                label: category,
                icon: <Pin className="h-3.5 w-3.5" />,
                color: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
              }

              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    {config.icon}
                    <span className="text-sm font-medium">{config.label}</span>
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((memory) => (
                      <Card key={memory.id} className="group">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={cn('text-xs px-1.5 py-0.5 rounded border', config.color)}>
                                  {memory.key}
                                </span>
                              </div>
                              {editingId === memory.id ? (
                                <div className="flex gap-1">
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="h-7 text-sm"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit(memory.id)
                                      if (e.key === 'Escape') setEditingId(null)
                                    }}
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 shrink-0"
                                    onClick={() => handleSaveEdit(memory.id)}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-sm text-foreground/80 break-words">
                                  {memory.value}
                                </p>
                              )}
                              {/* 时间信息 */}
                              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1" title={`创建时间: ${formatFullTime(memory.createdAt)}`}>
                                  <Clock className="h-3 w-3" />
                                  <span>{formatTime(memory.createdAt)}</span>
                                </div>
                                {memory.updatedAt !== memory.createdAt && (
                                  <div className="flex items-center gap-1" title={`修改时间: ${formatFullTime(memory.updatedAt)}`}>
                                    <Pencil className="h-3 w-3" />
                                    <span>{formatTime(memory.updatedAt)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleStartEdit(memory)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => deleteMemory(memory.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Separator className="mt-3" />
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 底部提示 */}
      <div className="p-3 border-t text-xs text-muted-foreground text-center shrink-0">
        <Sparkles className="h-3 w-3 inline-block mr-1" />
        记忆由AI自动提取并分类
      </div>
    </div>
  )
}
