import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { transactionSchema } from '@/lib/validators';
import type { Transaction } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const txId = Number(id);
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM transactions WHERE id = ?')
    .get(txId) as Transaction | undefined;
  if (!existing) {
    return NextResponse.json({ error: '交易记录不存在' }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = transactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数校验失败', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const fund = db
    .prepare('SELECT id FROM funds WHERE id = ?')
    .get(d.fund_id) as { id: number } | undefined;
  if (!fund) {
    return NextResponse.json(
      { error: `基金 id=${d.fund_id} 不存在` },
      { status: 400 },
    );
  }
  db.prepare(
    `UPDATE transactions SET fund_id = ?, trade_type = ?, trade_date = ?, amount = ?, shares = ?, fee = ?, remark = ?
     WHERE id = ?`,
  ).run(
    d.fund_id,
    d.trade_type,
    d.trade_date,
    d.amount,
    d.shares,
    d.fee,
    d.remark ?? null,
    txId,
  );
  const tx = db
    .prepare('SELECT * FROM transactions WHERE id = ?')
    .get(txId) as Transaction;
  return NextResponse.json({ data: tx });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const txId = Number(id);
  const db = getDb();
  const r = db.prepare('DELETE FROM transactions WHERE id = ?').run(txId);
  if (r.changes === 0) {
    return NextResponse.json({ error: '交易记录不存在' }, { status: 404 });
  }
  return NextResponse.json({ data: { deleted: txId } });
}
