import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { transactionSchema } from '@/lib/validators';
import type { Transaction } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const fundId = searchParams.get('fund_id');

  let rows: Transaction[];
  if (fundId) {
    rows = db
      .prepare(
        `SELECT * FROM transactions WHERE fund_id = ?
         ORDER BY trade_date DESC, id DESC`,
      )
      .all(Number(fundId)) as Transaction[];
  } else {
    rows = db
      .prepare('SELECT * FROM transactions ORDER BY trade_date DESC, id DESC')
      .all() as Transaction[];
  }
  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = transactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数校验失败', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const db = getDb();
  const fund = db
    .prepare('SELECT id FROM funds WHERE id = ?')
    .get(d.fund_id) as { id: number } | undefined;
  if (!fund) {
    return NextResponse.json(
      { error: `基金 id=${d.fund_id} 不存在` },
      { status: 400 },
    );
  }
  const r = db
    .prepare(
      `INSERT INTO transactions (fund_id, trade_type, trade_date, amount, shares, fee, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      d.fund_id,
      d.trade_type,
      d.trade_date,
      d.amount,
      d.shares,
      d.fee,
      d.remark ?? null,
    );
  const tx = db
    .prepare('SELECT * FROM transactions WHERE id = ?')
    .get(Number(r.lastInsertRowid)) as Transaction;
  return NextResponse.json({ data: tx }, { status: 201 });
}
