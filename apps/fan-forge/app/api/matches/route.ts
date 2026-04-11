import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const matches = await prisma.match.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(matches)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { name, ownerWallet } = body as { name: string; ownerWallet: string }

  if (!name?.trim() || !ownerWallet?.trim()) {
    return NextResponse.json({ error: 'name and ownerWallet are required' }, { status: 400 })
  }

  const match = await prisma.match.create({
    data: { name: name.trim(), ownerWallet: ownerWallet.trim() },
  })

  return NextResponse.json(match, { status: 201 })
}
