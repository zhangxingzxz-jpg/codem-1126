import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBloggerTrades, insertManualTrade } from '@/lib/blogger';

export const dynamic = 'force-dynamic';

const bloggerTradeSchema = z.object({
  portfolio_id: z.number({ invalid_type_error: 'portfolio_id 须为整数' }).int().positive(),
  fund_code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, '基金代码须为 6 位数字'),
  fund_name: z.string().trim().max(100).optional().nullable(),
  trade_type: z.enum(['buy', 'sell']),
  trade_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '交易日期须为 YYYY-MM-DD'),
  weight: z.number().nonnegative('仓位占比不能为负').max(100).optional().nullable(),
  amount_desc: z.string().trim().max(100).optional().nullable(),
  remark: z.string().trim().max(500).optional().nullable(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const portfolioId = searchParams.get('portfolio_id');
  const data = getBloggerTrades(portfolioId ? Number(portfolioId) : undefined);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bloggerTradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数校验失败', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const trade = insertManualTrade(parsed.data);
  if (!trade) {
    return NextResponse.json(
      { error: '录入失败：组合不存在，或基金名称缺失（可在基金档案先添加该基金）' },
      { status: 400 },
    );
  }
  return NextResponse.json({ data: trade }, { status: 201 });
}
