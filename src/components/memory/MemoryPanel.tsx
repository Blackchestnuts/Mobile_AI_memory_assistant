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
  CheckSquare,
  Square,
  AlertTriangle,
  Clock,
  RefreshCw,
  CheckCheck,
  XSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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

function ExpiryBadge({ memory }: { memory: MemoryItem }) {
  if (memory.isStale) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
        <AlertTriangle className="h-2.5 w-2.5" />
        过时
      </span>
    )
  }

  if (memory.expiresAt) {
    const expiresAt = new Date(memory.expiresAt)
    const now = new Date()
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysLeft <= 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-red-500/10 text-red-600 border border-red-500/20">
          <Clock className="h-2.5 w-2.5" />
          已过期
        </span>
      )
    }

    if (daysLeft <= 30) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-orange-500/10 text-orange-600 border border-orange-500/20">
          <Clock className="h-2.5 w-2.5" />
          {daysLeft}天过期
        </span>
      )
    }
  }

  // 永不过期
  return null
}

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
    // 多选功能
    selectedMemoryIds,
    isMultiSelectMode,
    toggleMultiSelectMode,
    toggleMemorySelection,
    selectAllMemories,
    clearMemorySelection,
    batchDeleteMemories,
    // 清理功能
    cleanupMemories,
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
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)

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
      : activeFolderId === 'stale'
        ? memories.filter((m) => m.isStale)
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

  const handleCleanup = async () => {
    setIsCleaningUp(true)
    setCleanupResult(null)
    try {
      const result = await cleanupMemories()
      if (result) {
        setCleanupResult(
          `已标记 ${result.markedStale} 条过时，删除 ${result.deletedExpired} 条过期，${result.scheduledForExpiry} 条即将过期`
        )
        setTimeout(() => setCleanupResult(null), 5000)
      }
    } finally {
      setIsCleaningUp(false)
    }
  }

  const handleBatchDelete = async () => {
    await batchDeleteMemories()
    setShowBatchDeleteConfirm(false)
  }

  const unsortedCount = memories.filter((m) => !m.folderId).length
  const staleCount = memories.filter((m) => m.isStale).length

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
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isMultiSelectMode && "bg-primary/10 text-primary")}
              onClick={toggleMultiSelectMode}
              title="多选模式"
            >
              <CheckSquare className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCleanup} disabled={isCleaningUp} title="清理过期记忆">
              <RefreshCw className={cn("h-4 w-4", isCleaningUp && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowFolderDialog(true)}>
              <FolderPlus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setIsAdding(true); setNewFolderId(activeFolderId === 'all' || activeFolderId === 'unsorted' || activeFolderId === 'stale' ? null : activeFolderId) }}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMemoryPanel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 多选操作栏 */}
        {isMultiSelectMode && (
          <div className="mt-2 flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={selectAllMemories}>
              <CheckCheck className="h-3 w-3" /> 全选
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={clearMemorySelection}>
              <XSquare className="h-3 w-3" /> 取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs gap-1 ml-auto"
              disabled={selectedMemoryIds.size === 0}
              onClick={() => setShowBatchDeleteConfirm(true)}
            >
              <Trash2 className="h-3 w-3" /> 删除({selectedMemoryIds.size})
            </Button>
          </div>
        )}

        {/* 清理结果提示 */}
        {cleanupResult && (
          <div className="mt-2 text-xs bg-green-500/10 text-green-600 border border-green-500/20 rounded px-2 py-1.5">
            {cleanupResult}
          </div>
        )}
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

          {/* 过时记忆 */}
          {staleCount > 0 && (
            <button
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                activeFolderId === 'stale' ? 'bg-amber-500/10 text-amber-600 font-medium' : 'hover:bg-muted'
              )}
              onClick={() => setActiveFolderId('stale')}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">过时记忆</span>
              <span className="text-xs text-amber-600">{staleCount}</span>
            </button>
          )}

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
              <p>{activeFolderId === 'stale' ? '没有过时的记忆' : activeFolderId === 'all' ? '还没有记忆' : '此文件夹为空'}</p>
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
                      <Card key={memory.id} className={cn(
                        "group",
                        memory.isStale && "border-amber-500/30 bg-amber-500/5",
                        selectedMemoryIds.has(memory.id) && "ring-2 ring-primary"
                      )}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            {/* 多选复选框 */}
                            {isMultiSelectMode && (
                              <div className="pt-0.5 shrink-0">
                                <Checkbox
                                  checked={selectedMemoryIds.has(memory.id)}
                                  onCheckedChange={() => toggleMemorySelection(memory.id)}
                                  className="h-4 w-4"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <span className={cn('text-xs px-1.5 py-0.5 rounded border', config.color)}>
                                  {memory.key}
                                </span>
                                <ExpiryBadge memory={memory} />
                                {memory.folder && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                    <Folder className="h-3 w-3" />
                                    {memory.folder.icon} {memory.folder.name}
                                  </span>
                                )}
                                {memory.accessCount > 3 && (
                                  <span className="text-[10px] text-muted-foreground" title={`被引用${memory.accessCount}次`}>
                                    x{memory.accessCount}
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
                                <p className={cn(
                                  "text-sm break-words",
                                  memory.isStale ? "text-muted-foreground line-through" : "text-foreground/80"
                                )}>
                                  {memory.value}
                                </p>
                              )}
                            </div>
                            {!isMultiSelectMode && (
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
                            )}
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
        记忆在每次对话后自动提取 | 点击 <RefreshCw className="h-3 w-3 inline" /> 清理过期
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

      {/* 批量删除确认对话框 */}
      <AlertDialog open={showBatchDeleteConfirm} onOpenChange={setShowBatchDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedMemoryIds.size} 条记忆吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
