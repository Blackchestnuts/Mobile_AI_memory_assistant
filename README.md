# AI记忆助手 - 移动端跨对话记忆系统

<div align="center">

**拥有跨对话记忆能力的AI助手，能记住你的偏好、目标和重要信息**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)
[![Ollama](https://img.shields.io/badge/Ollama-Local_AI-7C3AED?logo=ollama)](https://ollama.com/)
[![PWA](https://img.shields.io/badge/PWA-Installable-4285F4?logo=pwa)](https://web.dev/progressive-web-apps/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite)](https://www.sqlite.org/)

</div>

---

## 项目简介

AI记忆助手是一个基于本地大模型的智能对话系统，核心特性是**跨对话记忆**——无论你何时开始新对话，AI都能记住你的个人信息、偏好习惯、目标计划等，提供真正个性化的服务。

支持**PWA安装**，在手机浏览器中添加到桌面后，体验如同原生App，全屏运行、离线缓存、无地址栏。

## 核心功能

### 智能记忆系统
- **自动提取记忆** — 对话中AI自动识别并提取值得长期记住的信息
- **智能分类** — AI自动将记忆归入6大类别，无需手动分类
- **语义检索** — 混合评分（关键词40% + 语义相似度60%），精准匹配上下文
- **跨对话记忆** — 新对话中AI自动调用相关记忆，持续了解你

### 6大记忆分类

| 分类 | 说明 | 示例 |
|------|------|------|
| 用户画像 profile | 个人信息 | 姓名、年龄、职业 |
| 偏好习惯 preference | 喜好倾向 | 技术偏好、沟通风格 |
| 目标计划 goal | 目标愿望 | 学习计划、职业目标 |
| 项目信息 project | 工作项目 | 正在做的项目、任务 |
| 洞察观点 insight | 思考观点 | 对事物的看法 |
| 事实记录 fact | 客观事实 | 日期、数量、事件 |

### PWA 移动端适配
- **添加到桌面** — 手机浏览器安装后如同原生App
- **全屏运行** — 无浏览器地址栏，沉浸式体验
- **离线缓存** — Service Worker 缓存静态资源，弱网也能加载
- **响应式布局** — 侧边栏变覆盖层、记忆面板变底部弹出
- **安全区域适配** — 支持刘海屏、底部横条等异形屏

### 性能优化
- **智能提取触发** — 闲聊消息（"你好""谢谢"等）自动跳过，不浪费AI调用
- **对话历史窗口** — 只发送最近20条消息，避免长对话超出上下文
- **3层记忆去重** — 精确匹配 → 跨分类合并 → 语义相似合并
- **内存缓存** — 30秒记忆缓存，减少数据库查询
- **批量Embedding** — 队列式批量生成向量，减少API调用

## 技术架构

```
┌─────────────────────────────────────────────────┐
│                    前端 (React)                   │
│  ConversationSidebar  │  ChatArea  │ MemoryPanel │
│         Zustand 状态管理    │   shadcn/ui 组件     │
├─────────────────────────────────────────────────┤
│                   Next.js API Routes              │
│  /api/chat  │  /api/conversations  │  /api/memories │
├─────────────────────────────────────────────────┤
│                    核心模块                        │
│  memory.ts (记忆提取+检索)  │  ai.ts (AI调用)      │
│  embedding.ts (语义向量)    │  db.ts (Prisma ORM)  │
├─────────────────────────────────────────────────┤
│     SQLite (custom.db)     │     Ollama (本地AI)   │
│   User / Conversation     │    qwen2.5:7b (对话)   │
│   Message / Memory        │  nomic-embed-text (向量)│
└─────────────────────────────────────────────────┘
```

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 框架 | Next.js 16 (App Router) | React 全栈框架 |
| UI | shadcn/ui + Tailwind CSS 4 | 组件库 + 原子化CSS |
| 状态 | Zustand | 轻量级状态管理 |
| 数据库 | Prisma + SQLite | ORM + 嵌入式数据库 |
| AI模型 | Ollama (qwen2.5:7b) | 本地大语言模型 |
| 向量模型 | Ollama (nomic-embed-text) | 本地文本向量化 |
| PWA | Service Worker + Web Manifest | 离线缓存 + 可安装 |

## 快速开始

### 环境要求

- **Node.js** >= 18
- **Ollama** 已安装并运行（[下载地址](https://ollama.com)）
- 至少 8GB 内存（7B模型需要约5GB内存）

### 1. 克隆项目

```bash
git clone https://github.com/Blackchestnuts/Mobile_AI_memory_assistant.git
cd Mobile_AI_memory_assistant
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

创建 `.env` 文件：

```env
DATABASE_URL=file:./db/custom.db

# AI 对话模型配置（Ollama）
DEEPSEEK_API_KEY=ollama
DEEPSEEK_BASE_URL=http://localhost:11434/v1
DEEPSEEK_MODEL=qwen2.5:7b

# 向量模型配置（用于语义检索）
EMBEDDING_BASE_URL=http://localhost:11434/v1
EMBEDDING_API_KEY=ollama
EMBEDDING_MODEL=nomic-embed-text
```

### 4. 下载 Ollama 模型

```bash
# 安装 Ollama 后，拉取所需模型
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```

### 5. 初始化数据库

```bash
npx prisma generate
npx prisma db push
```

### 6. 启动项目

```bash
# 构建生产版本
npm run build

# 启动
npm start
```

浏览器访问 **http://localhost:3000** 即可使用。

## 手机端安装

### 前提条件

1. 电脑和手机连接**同一WiFi**
2. 电脑上 Ollama 和项目正在运行
3. 查看电脑局域网IP（Windows: `ipconfig`，找到 `192.168.x.x`）

### Android (Chrome)

1. 手机浏览器打开 `http://你的电脑IP:3000`
2. 点击底部弹出的 **"添加到主屏幕"** 提示
3. 或点击菜单 ⋮ → **"安装应用"**

### iPhone (Safari)

1. 手机Safari打开 `http://你的电脑IP:3000`
2. 点击底部 **分享按钮** 📤
3. 选择 **"添加到主屏幕"** → 点击"添加"

### 防火墙放行

如果手机无法访问，在电脑上以管理员身份运行：

```powershell
netsh advfirewall firewall add rule name="Next.js 3000" dir=in action=allow protocol=TCP localport=3000
```

## 项目结构

```
src/
├── app/
│   ├── layout.tsx              # 根布局（PWA注册、字体、视口配置）
│   ├── manifest.ts             # PWA Manifest 配置
│   ├── page.tsx                # 主页面（三栏响应式布局）
│   ├── globals.css             # 全局样式（主题、安全区域、iOS优化）
│   └── api/
│       ├── chat/route.ts       # 聊天接口（消息处理+记忆提取）
│       ├── conversations/      # 对话管理接口
│       ├── memories/           # 记忆CRUD接口
│       └── init/route.ts       # 初始化接口
├── components/
│   ├── chat/ChatArea.tsx       # 聊天区域（消息列表+输入框）
│   ├── memory/MemoryPanel.tsx  # 记忆面板（分类展示+增删改）
│   ├── sidebar/ConversationSidebar.tsx  # 对话侧边栏
│   └── ui/                     # shadcn/ui 组件库
├── lib/
│   ├── ai.ts                   # AI调用封装（chatCompletion + 智能分类）
│   ├── db.ts                   # Prisma 数据库客户端
│   ├── embedding.ts            # 向量语义检索（余弦相似度）
│   ├── memory.ts               # 核心记忆模块（提取+检索+缓存+去重）
│   └── utils.ts                # 工具函数
├── store/
│   └── useAppStore.ts          # Zustand 全局状态
└── hooks/
    ├── use-mobile.ts           # 移动端断点检测
    └── use-toast.ts            # Toast 通知

public/
├── sw.js                       # Service Worker（离线缓存策略）
├── icon-192.png                # PWA 图标 (192x192)
├── icon-512.png                # PWA 图标 (512x512, maskable)
├── apple-icon.png              # Apple Touch Icon (180x180)
├── favicon-16.png              # 网站图标
└── favicon-32.png              # 网站图标

prisma/
└── schema.prisma               # 数据库模型定义
```

## 数据模型

```prisma
User
  ├── Conversation[]    # 用户的所有对话
  │     └── Message[]   # 对话中的每条消息（user/assistant）
  └── Memory[]          # 用户的所有记忆（6大分类 + 语义向量）
```

### 数据存储

所有数据存储在项目根目录的 `db/custom.db`（SQLite文件）中，包括：
- **用户信息** — User表
- **对话记录** — Conversation表 + Message表
- **AI记忆** — Memory表（含embedding向量字段）

> 数据库文件不会上传到Git（已在.gitignore中排除），需本地运行后生成。

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/chat` | POST | 发送消息，获取AI回复，异步提取记忆 |
| `/api/conversations` | GET/POST | 获取对话列表 / 创建新对话 |
| `/api/conversations/[id]` | GET/DELETE | 获取对话详情 / 删除对话 |
| `/api/memories` | GET/POST | 获取所有记忆 / 智能添加记忆 |
| `/api/memories/[id]` | PUT/DELETE | 更新记忆 / 删除记忆 |
| `/api/memories/backfill` | POST | 回填已有记忆的embedding向量 |
| `/api/init` | GET | 获取用户信息和统计数据 |

## 性能优化详情

### 智能提取触发
通过正则匹配过滤6类闲聊消息（问候、感谢、确认等），短消息（<4字）直接跳过。避免对无实质内容的消息调用AI提取记忆，**减少50~80%的AI调用**。

### 对话历史窗口
只发送最近20条消息给AI模型，避免长对话（50+条）超出模型上下文窗口导致回复变慢或截断。历史消息中的关键信息已由记忆系统提取存储。

### 3层记忆去重
1. **精确匹配** — 同分类+同key，直接更新value
2. **跨分类合并** — 同key不同分类，合并到最新分类
3. **语义相似** — key的关键词重叠度>=60%则合并（如"工作"和"职业"）

### 记忆缓存
进程内30秒TTL缓存，避免每次聊天都全量查询数据库。增删改操作自动刷新缓存。

### 批量Embedding队列
新记忆的向量生成进入队列，每批最多3个并行处理，批次间隔100ms，避免短时间大量请求打爆Ollama。

## 常用命令

```bash
# 开发模式（仅限本机访问）
npm run dev

# 生产模式（允许局域网访问，手机可连接）
npm run build && npm start

# 数据库操作
npx prisma generate          # 生成Prisma客户端
npx prisma db push           # 同步数据库结构
npx prisma studio            # 打开数据库可视化管理界面

# 代码检查
npm run lint
```

## 注意事项

| 事项 | 说明 |
|------|------|
| **Ollama 必须运行** | AI计算依赖本地Ollama，关闭后项目无法生成回复（会显示友好提示） |
| **数据安全** | 所有数据存储在本地SQLite，不上传任何信息到云端 |
| **备份建议** | 定期备份 `db/custom.db` 文件，丢失则所有对话和记忆不可恢复 |
| **运行时勿改DB** | 项目运行时不要用外部工具修改数据库，可能导致锁冲突和数据损坏 |
| **电脑需在线** | 手机端只是前端界面，AI计算仍在电脑端运行 |

## 许可证

MIT License
