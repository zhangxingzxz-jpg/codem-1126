import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const txId = Number(id);
  const db = getDb();
  const r = db.prepare('DELETE FROM blogger_trades WHERE id = ?').run(txId);
  if (r.changes === 0) {
    return NextResponse.json({ error: '调仓记录不存在' }, { status: 404 });
  }
  return NextResponse.json({ data: { deleted: txId } });
}
