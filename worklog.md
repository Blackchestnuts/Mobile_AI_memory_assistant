---
Task ID: 1
Agent: Main Agent
Task: 修复所有API路由 — 用auth session替换ensureDefaultUser，添加userId验证

Work Log:
- 更新 /api/memories/route.ts — 用 getServerSession 替代 ensureDefaultUser，添加批量删除API
- 更新 /api/memories/[id]/route.ts — 添加用户验证，确保只能操作自己的记忆
- 更新 /api/folders/route.ts — 用 auth session 替代 ensureDefaultUser
- 更新 /api/folders/[id]/route.ts — 添加用户验证
- 更新 /api/conversations/[id]/route.ts — 添加用户验证
- 更新 /api/init/route.ts — 用 auth session 替代 ensureDefaultUser
- 新增 /api/memories/cleanup/route.ts — 手动触发记忆清理
- 移除 memory.ts 中的废弃 ensureDefaultUser 函数

Stage Summary:
- 所有API路由已使用 auth session 认证
- 每个路由都验证 userId，确保数据隔离
- 批量删除API和记忆清理API已添加

---
Task ID: 2
Agent: Main Agent
Task: 添加多选删除UI + 过期状态展示 + 用户登录系统

Work Log:
- 更新 useAppStore.ts — 添加 selectedMemoryIds, isMultiSelectMode, batchDeleteMemories, cleanupMemories 等状态和操作
- 更新 MemoryItem 接口 — 添加 accessCount, lastAccessedAt, expiresAt, isStale 字段
- 更新 MemoryPanel.tsx — 添加多选模式、批量删除、过期状态展示（ExpiryBadge）、清理按钮、过时记忆过滤
- 更新 ConversationSidebar.tsx — 添加用户信息显示和登出按钮（使用 next-auth useSession）
- 创建 AuthProvider.tsx — 封装 SessionProvider
- 更新 layout.tsx — 包裹 AuthProvider
- 创建 types/next-auth.d.ts — 扩展 NextAuth 类型定义
- 修复 middleware.ts — 从 getServerSession 改为 cookie-based 检查，解决 Edge Runtime 兼容性问题

Stage Summary:
- 多选删除功能完成：多选模式开关、全选/取消、批量删除确认对话框
- 记忆过期状态展示：过时标签(amber)、即将过期标签(orange)、已过期标签(red)
- 过时记忆单独过滤视图
- 记忆清理按钮（手动触发 markStale + cleanup）
- 用户信息展示和登出功能
- NextAuth SessionProvider 集成完成
- Middleware 修复：使用 cookie 检查替代 getServerSession，避免 Edge Runtime 崩溃
