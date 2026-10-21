const typeTones: Record<string, string> = {
  股票: 'bg-red-50 text-red-600',
  混合: 'bg-purple-50 text-purple-600',
  债券: 'bg-blue-50 text-blue-600',
  货币: 'bg-emerald-50 text-emerald-600',
  指数: 'bg-indigo-50 text-indigo-600',
  QDII: 'bg-cyan-50 text-cyan-600',
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        typeTones[type] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {type}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: string | null }) {
  if (!risk) return <span className="text-gray-300">—</span>;
  let tone = 'bg-gray-100 text-gray-600';
  if (risk.includes('低')) tone = 'bg-emerald-50 text-emerald-600';
  else if (risk === '中高') tone = 'bg-orange-50 text-orange-600';
  else if (risk.includes('高')) tone = 'bg-red-50 text-red-600';
  else if (risk.includes('中')) tone = 'bg-amber-50 text-amber-600';
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {risk}
    </span>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      持有中
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
      已清仓
    </span>
  );
}

const tradeTypeMap = {
  buy: { label: '买入', tone: 'bg-red-50 text-red-600' },
  sell: { label: '卖出', tone: 'bg-emerald-50 text-emerald-600' },
  dividend: { label: '分红', tone: 'bg-amber-50 text-amber-600' },
} as const;

export function TradeTypeBadge({ type }: { type: keyof typeof tradeTypeMap }) {
  const { label, tone } = tradeTypeMap[type];
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
}
