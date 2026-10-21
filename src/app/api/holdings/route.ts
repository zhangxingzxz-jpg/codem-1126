import { NextResponse } from 'next/server';
import { getHoldings } from '@/lib/holdings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const holdings = getHoldings();
  return NextResponse.json({ data: holdings });
}
