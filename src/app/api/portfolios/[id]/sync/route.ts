import { NextResponse } from 'next/server';
import { getPortfolio, syncQiemanPortfolio } from '@/lib/blogger';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** 手动触发且慢源同步：拉取长赢调仓记录并按 external_id 去重落库 */
export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const pid = Number(id);
  const portfolio = getPortfolio(pid);
  if (!portfolio) {
    return NextResponse.json({ error: '追踪组合不存在' }, { status: 404 });
  }
  if (portfolio.source !== 'qieman') {
    return NextResponse.json(
      { error: '仅且慢源支持自动同步，手动源请在调仓记录中录入' },
      { status: 400 },
    );
  }
  try {
    const result = await syncQiemanPortfolio(portfolio);
    return NextResponse.json({ data: result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '同步失败' },
      { status: 502 },
    );
  }
}
