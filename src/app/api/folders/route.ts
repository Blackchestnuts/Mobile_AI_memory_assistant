import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'

// 获取所有文件夹
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: '请先登录' }, { status: 401 })
    }

    const folders = await db.memoryFolder.findMany({
      where: { userId: session.user.id },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { memories: true } },
      },
    })
    return Response.json(folders)
  } catch (error) {
    console.error('Get folders error:', error)
    return Response.json({ error: '获取文件夹失败' }, { status: 500 })
  }
}

// 创建文件夹
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: '请先登录' }, { status: 401 })
    }

    const body = await request.json()
    const { name, icon, color } = body

    if (!name || !name.trim()) {
      return Response.json({ error: '文件夹名称不能为空' }, { status: 400 })
    }

    // 获取当前最大sortOrder
    const maxSort = await db.memoryFolder.findFirst({
      where: { userId: session.user.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    const folder = await db.memoryFolder.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        icon: icon || '📁',
        color: color || 'bg-gray-500/10 text-gray-600 border-gray-500/20',
        sortOrder: (maxSort?.sortOrder ?? -1) + 1,
      },
    })
    return Response.json(folder)
  } catch (error) {
    console.error('Create folder error:', error)
    return Response.json({ error: '创建文件夹失败' }, { status: 500 })
  }
}
