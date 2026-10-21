import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { getPortfolio } from '@/lib/blogger';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** 更新且慢 token（手动源也可以补充改造成且慢源） */
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const pid = Number(id);
  const existing = getPortfolio(pid);
  if (!existing) {
    return NextResponse.json({ error: '追踪组合不存在' }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      qieman_token: z.string().trim().max(2000).nullable(),
    })
    .safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数校验失败', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const db = getDb();
  db.prepare('UPDATE tracked_portfolios SET qieman_token = ? WHERE id = ?').run(
    parsed.data.qieman_token || null,
    pid,
  );
  return NextResponse.json({ data: { updated: pid } });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const pid = Number(id);
  const existing = getPortfolio(pid);
  if (!existing) {
    return NextResponse.json({ error: '追踪组合不存在' }, { status: 404 });
  }
  const db = getDb();
  db.prepare('DELETE FROM tracked_portfolios WHERE id = ?').run(pid);
  return NextResponse.json({ data: { deleted: pid } });
}
