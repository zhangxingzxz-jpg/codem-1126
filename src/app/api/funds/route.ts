import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fundSchema } from '@/lib/validators';
import type { Fund } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const funds = db
    .prepare('SELECT * FROM funds ORDER BY code')
    .all() as Fund[];
  return NextResponse.json({ data: funds });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = fundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数校验失败', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const db = getDb();
  try {
    const r = db
      .prepare(
        `INSERT INTO funds (code, name, type, company, risk_level, remark)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(d.code, d.name, d.type, d.company ?? null, d.risk_level ?? null, d.remark ?? null);
    const fund = db
      .prepare('SELECT * FROM funds WHERE id = ?')
      .get(Number(r.lastInsertRowid)) as Fund;
    return NextResponse.json({ data: fund }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return NextResponse.json(
        { error: `基金代码 ${d.code} 已存在` },
        { status: 409 },
      );
    }
    throw e;
  }
}
