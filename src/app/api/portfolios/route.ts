import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { getPortfolios } from '@/lib/blogger';

export const dynamic = 'force-dynamic';

const portfolioSchema = z
  .object({
    name: z.string().trim().min(1, '名称不能为空').max(100),
    source: z.enum(['manual', 'qieman']),
    source_key: z.string().trim().max(50).optional().nullable(),
    qieman_token: z.string().trim().max(2000).optional().nullable(),
    remark: z.string().trim().max(500).optional().nullable(),
  })
  .refine((d) => d.source !== 'qieman' || !!d.source_key, {
    message: '且慢源必须提供 prodCode（source_key，如 LONG_WIN）',
  });

export async function GET() {
  const rows = getPortfolios();
  // token 脱敏：不回传原文，只回传是否已配置
  const data = rows.map(({ qieman_token, ...rest }) => ({
    ...rest,
    has_token: Boolean(qieman_token),
  }));
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = portfolioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数校验失败', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const db = getDb();
  const r = db
    .prepare(
      `INSERT INTO tracked_portfolios (name, source, source_key, qieman_token, remark)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      d.name,
      d.source,
      d.source_key ?? null,
      d.qieman_token ?? null,
      d.remark ?? null,
    );
  const row = db
    .prepare('SELECT * FROM tracked_portfolios WHERE id = ?')
    .get(Number(r.lastInsertRowid)) as {
    id: number;
    qieman_token: string | null;
  };
  const { qieman_token, ...rest } = row;
  return NextResponse.json(
    { data: { ...rest, has_token: Boolean(qieman_token) } },
    { status: 201 },
  );
}
