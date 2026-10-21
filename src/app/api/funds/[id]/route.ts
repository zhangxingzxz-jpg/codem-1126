import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fundSchema } from '@/lib/validators';
import type { Fund } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

async function getFund(id: number): Promise<Fund | undefined> {
  const db = getDb();
  return db.prepare('SELECT * FROM funds WHERE id = ?').get(id) as
    | Fund
    | undefined;
}

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const fund = await getFund(Number(id));
  if (!fund) {
    return NextResponse.json({ error: '基金不存在' }, { status: 404 });
  }
  return NextResponse.json({ data: fund });
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const fundId = Number(id);
  const db = getDb();
  const existing = await getFund(fundId);
  if (!existing) {
    return NextResponse.json({ error: '基金不存在' }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = fundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数校验失败', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  try {
    db.prepare(
      `UPDATE funds SET code = ?, name = ?, type = ?, company = ?, risk_level = ?, remark = ?
       WHERE id = ?`,
    ).run(d.code, d.name, d.type, d.company ?? null, d.risk_level ?? null, d.remark ?? null, fundId);
  } catch (e) {
    if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return NextResponse.json(
        { error: `基金代码 ${d.code} 已存在` },
        { status: 409 },
      );
    }
    throw e;
  }
  const fund = await getFund(fundId);
  return NextResponse.json({ data: fund });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const fundId = Number(id);
  const db = getDb();
  const existing = await getFund(fundId);
  if (!existing) {
    return NextResponse.json({ error: '基金不存在' }, { status: 404 });
  }
  const txCount = (
    db
      .prepare('SELECT COUNT(*) AS c FROM transactions WHERE fund_id = ?')
      .get(fundId) as { c: number }
  ).c;
  if (txCount > 0) {
    return NextResponse.json(
      {
        error: `该基金存在 ${txCount} 笔交易记录，请先删除交易记录`,
      },
      { status: 409 },
    );
  }
  db.prepare('DELETE FROM funds WHERE id = ?').run(fundId);
  return NextResponse.json({ data: { deleted: fundId } });
}
