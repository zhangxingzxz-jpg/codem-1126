'use client';

import { useCallback, useEffect, useState } from 'react';
import { RiskBadge, StatusBadge, TypeBadge } from '@/components/Badge';
import { TableSkeleton } from '@/components/Skeleton';
import type { Holding } from '@/lib/types';

export default function HoldingsPage() {
  const [holdings, setHoldings] = useState<Holding[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/holdings');
    const json = await res.json();
    setHoldings(json.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (holdings === null) {
    return (
      <div>
        <div className="mb-6 h-7 w-36 animate-pulse rounded bg-gray-200" />
        <TableSkeleton rows={6} />
      </div>
    );
  }

  const totalShares = holdings.reduce((s, h) => s + h.shares, 0);
  const totalInvested = holdings.reduce((s, h) => s + h.net_invested, 0);
  const heldCount = holdings.filter((h) => h.shares > 0).length;

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">持仓汇总</h1>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard icon="🏦" tone="blue" label="持仓基金数" value={`${heldCount} 只`} />
        <SummaryCard icon="📈" tone="indigo" label="总持仓份额" value={fmt(totalShares, 2)} />
        <SummaryCard icon="💰" tone="emerald" label="累计净投入" value={`¥ ${fmt(totalInvested, 2)}`} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3">基金</th>
              <th className="px-4 py-3">类型</th>
              <th className="px-4 py-3">风险</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3 text-right">持仓份额</th>
              <th className="px-4 py-3 text-right">净投入</th>
              <th className="px-4 py-3 text-right">持仓成本（元/份）</th>
              <th className="px-4 py-3">最近交易</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr
                key={h.fund_id}
                className={`border-t border-gray-100 transition-colors hover:bg-gray-50 ${
                  h.shares > 0 ? '' : 'opacity-50'
                }`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{h.name}</div>
                  <div className="mt-0.5 font-mono text-xs text-gray-400">{h.code}</div>
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={h.type} />
                </td>
                <td className="px-4 py-3">
                  <RiskBadge risk={h.risk_level} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge active={h.shares > 0} />
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {h.shares > 0 ? fmt(h.shares, 2) : '—'}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono ${
                    h.net_invested >= 0 ? '' : 'text-red-600'
                  }`}
                >
                  {fmt(h.net_invested, 2)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {h.shares > 0 ? fmt(h.avg_cost, 4) : '—'}
                </td>
                <td className="px-4 py-3">
                  {h.last_trade_date ? (
                    <div>
                      <div>{h.last_trade_date}</div>
                      <div className="mt-0.5 text-xs text-gray-400">
                        共 {h.transaction_count} 笔
                      </div>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {holdings.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  <div className="text-3xl">🗂️</div>
                  <p className="mt-2 text-sm">暂无基金，请先到「基金档案」添加</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const toneClasses: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
};

function SummaryCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: string;
  tone: keyof typeof toneClasses;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${toneClasses[tone]}`}
      >
        {icon}
      </div>
      <div>
        <div className="text-sm text-gray-500">{label}</div>
        <div className="mt-0.5 text-xl font-semibold">{value}</div>
      </div>
    </div>
  );
}

function fmt(n: number, digits: number): string {
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
