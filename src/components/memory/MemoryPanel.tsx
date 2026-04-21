'use client'

import { useAppStore, type MemoryItem, type MemoryFolder } from '@/store/useAppStore'
import { useState, useEffect } from 'react'
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
  FolderPlus,
  Folder,
  ChevronRight,
  Inbox,
  Layers,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

// 格式化时间
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

  if (year === now.getFullYear()) {
    return `${month}-${day} ${h}:${m}`
  }
  return `${year}-${month}-${day} ${h}:${m}`
}

function formatFullTime(dateStr: string) {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${h}:${m}:${s}`
}

const folderIconOptions = ['📁', '🗂️', '📋', '📌', '🎯', '💡', '🔥', '⭐', '❤️', '🚀', '🎨', '📦']

const folderColorOptions = [
  { label: '灰色', value: 'bg-gray-500/10 text-gray-600 border-gray-500/20' },
  { label: '蓝色', value: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { label: '绿色', value: 'bg-green-500/10 text-green-600 border-green-500/20' },
  { label: '橙色', value: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  { label: '粉色', value: 'bg-pink-500/10 text-pink-600 border-pink-500/20' },
  { label: '紫色', value: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  { label: '黄色', value: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
]

export function MemoryPanel() {
  const {
    memories,
    folders,
    activeFolderId,
    showMemoryPanel,
    toggleMemoryPanel,
    deleteMemory,
    addMemory,
    updateMemory,
    moveMemoryToFolder,
    createFolder,
    updateFolder,
    deleteFolder,
    setActiveFolderId,
    fetchFolders,
  } = useAppStore()

  const [isAdding, setIsAdding] = useState(false)
  const [newCategory, setNewCategory] = useState('profile')
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newFolderId, setNewFolderId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderIcon, setFolderIcon] = useState('📁')
  const [folderColor, setFolderColor] = useState('bg-gray-500/10 text-gray-600 border-gray-500/20')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)

  useEffect(() => {
    if (showMemoryPanel) {
      fetchFolders()
    }
  }, [showMemoryPanel, fetchFolders])

  if (!showMemoryPanel) return null

  // 按当前活跃文件夹过滤记忆
  const filteredMemories = activeFolderId === 'all'
    ? memories
    : activeFolderId === 'unsorted'
      ? memories.filter((m) => !m.folderId)
      : memories.filter((m) => m.folderId === activeFolderId)

  // 按分类分组
  const grouped = filteredMemories.reduce<Record<string, MemoryItem[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = []
    acc[m.category].push(m)
    return acc
  }, {})

  const handleAdd = async () => {
    if (!newKey.trim() || !newValue.trim()) return
    await addMemory({ category: newCategory, key: newKey.trim(), value: newValue.trim(), folderId: newFolderId })
    setNewKey('')
    setNewValue('')
    setNewFolderId(null)
    setIsAdding(false)
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

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return
    if (editingFolderId) {
      await updateFolder(editingFolderId, { name: folderName.trim(), icon: folderIcon, color: folderColor })
      setEditingFolderId(null)
    } else {
      await createFolder({ name: folderName.trim(), icon: folderIcon, color: folderColor })
    }
    setFolderName('')
    setFolderIcon('📁')
    setFolderColor('bg-gray-500/10 text-gray-600 border-gray-500/20')
    setShowFolderDialog(false)
  }

  const handleEditFolder = (folder: MemoryFolder) => {
    setEditingFolderId(folder.id)
    setFolderName(folder.name)
    setFolderIcon(folder.icon)
    setFolderColor(folder.color)
    setShowFolderDialog(true)
  }

  const unsortedCount = memories.filter((m) => !m.folderId).length

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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowFolderDialog(true)}>
              <FolderPlus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setIsAdding(true); setNewFolderId(activeFolderId === 'all' || activeFolderId === 'unsorted' ? null : activeFolderId) }}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMemoryPanel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 文件夹导航 */}
      <div className="border-b shrink-0">
        <div className="p-2 space-y-0.5">
          {/* 全部记忆 */}
          <button
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
              activeFolderId === 'all' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
            )}
            onClick={() => setActiveFolderId('all')}
          >
            <Layers className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">全部记忆</span>
            <span className="text-xs text-muted-foreground">{memories.length}</span>
          </button>

          {/* 未分类 */}
          <button
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
              activeFolderId === 'unsorted' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
            )}
            onClick={() => setActiveFolderId('unsorted')}
          >
            <Inbox className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">未分类</span>
            <span className="text-xs text-muted-foreground">{unsortedCount}</span>
          </button>

          {/* 文件夹列表 */}
          {folders.map((folder) => {
            const count = memories.filter((m) => m.folderId === folder.id).length
            return (
              <div key={folder.id} className="group relative">
                <button
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                    activeFolderId === folder.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                  )}
                  onClick={() => setActiveFolderId(folder.id)}
                >
                  <span className="text-base leading-none">{folder.icon}</span>
                  <span className="flex-1 text-left truncate">{folder.name}</span>
                  <span className="text-xs text-muted-foreground">{count}</span>
                </button>
                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                      <DropdownMenuItem onClick={() => handleEditFolder(folder)}>
                        <Pencil className="h-3 w-3 mr-2" /> 编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteFolder(folder.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-2" /> 删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 添加记忆 */}
      {isAdding && (
        <div className="p-3 border-b bg-background space-y-2 shrink-0">
          <div className="flex gap-2">
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="h-8 text-sm flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={newFolderId || '__none__'} onValueChange={(v) => setNewFolderId(v === '__none__' ? null : v)}>
              <SelectTrigger className="h-8 text-sm flex-1">
                <SelectValue placeholder="选择文件夹" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">未分类</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.icon} {f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8" onClick={handleAdd}>添加</Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => setIsAdding(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* 记忆列表 */}
      <div className="flex-1 custom-scrollbar overflow-y-auto">
        <div className="p-3 space-y-4">
          {filteredMemories.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>{activeFolderId === 'all' ? '还没有记忆' : '此文件夹为空'}</p>
              <p className="text-xs mt-1">和我聊天时，我会自动记住重要信息</p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => {
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
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <span className={cn('text-xs px-1.5 py-0.5 rounded border', config.color)}>
                                  {memory.key}
                                </span>
                                {memory.folder && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                    <Folder className="h-3 w-3" />
                                    {memory.folder.icon} {memory.folder.name}
                                  </span>
                                )}
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
                                  <span>创建: {formatTime(memory.createdAt)}</span>
                                </div>
                                {memory.updatedAt !== memory.createdAt && (
                                  <div className="flex items-center gap-1" title={`修改时间: ${formatFullTime(memory.updatedAt)}`}>
                                    <Pencil className="h-3 w-3" />
                                    <span>修改: {formatTime(memory.updatedAt)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              {/* 移动到文件夹 */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <Folder className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => moveMemoryToFolder(memory.id, null)}>
                                    <Inbox className="h-3 w-3 mr-2" /> 未分类
                                  </DropdownMenuItem>
                                  {folders.map((f) => (
                                    <DropdownMenuItem
                                      key={f.id}
                                      onClick={() => moveMemoryToFolder(memory.id, f.id)}
                                    >
                                      <span className="mr-2">{f.icon}</span> {f.name}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
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
        记忆在每次对话后自动提取
      </div>

      {/* 创建/编辑文件夹对话框 */}
      <Dialog open={showFolderDialog} onOpenChange={(open) => {
        setShowFolderDialog(open)
        if (!open) {
          setEditingFolderId(null)
          setFolderName('')
          setFolderIcon('📁')
          setFolderColor('bg-gray-500/10 text-gray-600 border-gray-500/20')
        }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingFolderId ? '编辑文件夹' : '新建文件夹'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 文件夹图标选择 */}
            <div>
              <label className="text-sm font-medium mb-2 block">图标</label>
              <div className="flex flex-wrap gap-1.5">
                {folderIconOptions.map((icon) => (
                  <button
                    key={icon}
                    className={cn(
                      'w-9 h-9 rounded-md border text-lg flex items-center justify-center transition-colors',
                      folderIcon === icon ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                    )}
                    onClick={() => setFolderIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* 文件夹颜色选择 */}
            <div>
              <label className="text-sm font-medium mb-2 block">颜色</label>
              <div className="flex flex-wrap gap-1.5">
                {folderColorOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className={cn(
                      'px-3 py-1.5 rounded-md border text-xs transition-colors',
                      opt.value,
                      folderColor === opt.value ? 'ring-2 ring-primary ring-offset-1' : ''
                    )}
                    onClick={() => setFolderColor(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 文件夹名称 */}
            <div>
              <label className="text-sm font-medium mb-2 block">名称</label>
              <Input
                placeholder="输入文件夹名称"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderDialog(false)}>取消</Button>
            <Button onClick={handleCreateFolder} disabled={!folderName.trim()}>
              {editingFolderId ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
