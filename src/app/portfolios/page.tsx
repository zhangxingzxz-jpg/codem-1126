'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal, { Field, inputClass } from '@/components/Modal';
import { TradeTypeBadge } from '@/components/Badge';
import { TableSkeleton } from '@/components/Skeleton';
import { useConfirm } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';

type Portfolio = {
  id: number;
  name: string;
  source: 'manual' | 'qieman';
  source_key: string | null;
  last_synced_at: string | null;
  remark: string | null;
  created_at: string;
  trade_count: number;
  has_token: boolean;
};

type BTrade = {
  id: number;
  portfolio_id: number;
  portfolio_name: string;
  fund_code: string;
  fund_name: string;
  trade_type: 'buy' | 'sell';
  trade_date: string;
  weight: number | null;
  amount_desc: string | null;
  source: string;
  remark: string | null;
  owned: boolean;
};

type PortfolioForm = {
  name: string;
  source: 'manual' | 'qieman';
  source_key: string;
  qieman_token: string;
  remark: string;
};

type TradeForm = {
  portfolio_id: string;
  fund_code: string;
  trade_type: 'buy' | 'sell';
  trade_date: string;
  weight: string;
  amount_desc: string;
  remark: string;
};

const emptyPortfolioForm: PortfolioForm = {
  name: '',
  source: 'manual',
  source_key: '',
  qieman_token: '',
  remark: '',
};

const emptyTradeForm: TradeForm = {
  portfolio_id: '',
  fund_code: '',
  trade_type: 'buy',
  trade_date: new Date().toISOString().slice(0, 10),
  weight: '',
  amount_desc: '',
  remark: '',
};

export default function PortfoliosPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[] | null>(null);
  const [trades, setTrades] = useState<BTrade[] | null>(null);
  const [filterPortfolio, setFilterPortfolio] = useState('');
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [portfolioForm, setPortfolioForm] = useState<PortfolioForm>(emptyPortfolioForm);
  const [tradeForm, setTradeForm] = useState<TradeForm>(emptyTradeForm);
  const [error, setError] = useState('');
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [tokenFor, setTokenFor] = useState<Portfolio | null>(null);
  const [tokenValue, setTokenValue] = useState('');
  const { confirm, confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    const [pRes, tRes] = await Promise.all([
      fetch('/api/portfolios'),
      fetch('/api/blogger-trades'),
    ]);
    const pJson = await pRes.json();
    const tJson = await tRes.json();
    setPortfolios(pJson.data ?? []);
    setTrades(tJson.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleTrades = useMemo(() => {
    if (trades === null) return null;
    if (!filterPortfolio) return trades;
    return trades.filter((t) => String(t.portfolio_id) === filterPortfolio);
  }, [trades, filterPortfolio]);

  const stats = useMemo(() => {
    const s = { portfolios: 0, count: 0, buy: 0, sell: 0, owned: 0 };
    s.portfolios = portfolios?.length ?? 0;
    for (const t of visibleTrades ?? []) {
      s.count++;
      if (t.trade_type === 'buy') s.buy++;
      else s.sell++;
      if (t.owned) s.owned++;
    }
    return s;
  }, [portfolios, visibleTrades]);

  function openPortfolioModal() {
    setPortfolioForm(emptyPortfolioForm);
    setError('');
    setShowPortfolioModal(true);
  }

  function openTradeModal(portfolio?: Portfolio) {
    const list = portfolios ?? [];
    const target = portfolio ?? list[0];
    setTradeForm({
      ...emptyTradeForm,
      portfolio_id: target ? String(target.id) : '',
    });
    setError('');
    setShowTradeModal(true);
  }

  async function submitPortfolio() {
    const payload = {
      ...portfolioForm,
      source_key: portfolioForm.source_key || null,
      qieman_token: portfolioForm.qieman_token || null,
      remark: portfolioForm.remark || null,
    };
    const res = await fetch('/api/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? '保存失败');
      return;
    }
    setShowPortfolioModal(false);
    toast('博主已添加');
    load();
  }

  async function submitTrade() {
    const payload = {
      portfolio_id: Number(tradeForm.portfolio_id),
      fund_code: tradeForm.fund_code,
      trade_type: tradeForm.trade_type,
      trade_date: tradeForm.trade_date,
      weight: tradeForm.weight ? Number(tradeForm.weight) : null,
      amount_desc: tradeForm.amount_desc || null,
      remark: tradeForm.remark || null,
    };
    const res = await fetch('/api/blogger-trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? '保存失败');
      return;
    }
    setShowTradeModal(false);
    toast('调仓已录入');
    load();
  }

  async function submitToken() {
    if (!tokenFor) return;
    const res = await fetch(`/api/portfolios/${tokenFor.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qieman_token: tokenValue || null }),
    });
    if (!res.ok) {
      toast('token 保存失败', 'error');
      return;
    }
    setTokenFor(null);
    setTokenValue('');
    toast('token 已保存，可点击「同步」拉取');
    load();
  }

  async function sync(p: Portfolio) {
    if (!p.has_token) {
      setTokenFor(p);
      setTokenValue('');
      return;
    }
    setSyncingId(p.id);
    try {
      const res = await fetch(`/api/portfolios/${p.id}/sync`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error ?? '同步失败', 'error');
        return;
      }
      toast(`同步完成：新增 ${json.data.inserted} 条，去重跳过 ${json.data.skipped} 条`);
      load();
    } finally {
      setSyncingId(null);
    }
  }

  async function removePortfolio(p: Portfolio) {
    const ok = await confirm({
      title: '删除追踪博主',
      message: `确认删除「${p.name}」及其全部 ${p.trade_count} 条调仓记录？删除后不可恢复。`,
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/portfolios/${p.id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast('删除失败', 'error');
      return;
    }
    toast('博主已删除');
    load();
  }

  async function removeTrade(t: BTrade) {
    const ok = await confirm({
      title: '删除调仓记录',
      message: `确认删除「${t.portfolio_name}」${t.trade_date} 的${t.trade_type === 'buy' ? '买入' : '卖出'}记录（${t.fund_name}）？`,
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/blogger-trades/${t.id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast('删除失败', 'error');
      return;
    }
    toast('调仓记录已删除');
    load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">博主实盘追踪</h1>
        <select
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          value={filterPortfolio}
          onChange={(e) => setFilterPortfolio(e.target.value)}
        >
          <option value="">全部博主</option>
          {(portfolios ?? []).map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow-sm transition-colors hover:bg-blue-700"
          onClick={() => openTradeModal()}
          disabled={(portfolios?.length ?? 0) === 0}
        >
          + 录入调仓
        </button>
        <button
          className="rounded-lg border border-blue-600 px-4 py-2 text-sm text-blue-600 transition-colors hover:bg-blue-50"
          onClick={openPortfolioModal}
        >
          + 添加博主
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="追踪博主" value={`${stats.portfolios} 位`} />
        <StatCard label="调仓记录" value={`${stats.count} 条`} />
        <StatCard label="买入信号" value={`${stats.buy} 条`} tone="text-red-600" />
        <StatCard label="卖出信号" value={`${stats.sell} 条`} tone="text-emerald-600" />
        <StatCard label="涉及自选基金" value={`${stats.owned} 条`} tone="text-blue-600" />
      </div>

      {visibleTrades === null || portfolios === null ? (
        <TableSkeleton rows={6} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {portfolios.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                      <SourceBadge source={p.source} />
                      {p.source_key && <span className="font-mono">{p.source_key}</span>}
                      <span>· {p.trade_count} 条调仓</span>
                    </div>
                  </div>
                </div>
                {p.remark && (
                  <p className="mt-2 line-clamp-2 text-xs text-gray-500">{p.remark}</p>
                )}
                {p.source === 'qieman' && (
                  <p className="mt-2 text-xs text-gray-400">
                    {p.last_synced_at ? `上次同步：${p.last_synced_at}` : '尚未同步'}
                    {p.has_token ? ' · token 已配置' : ' · 未配置 token'}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <button
                    className="rounded-lg bg-blue-50 px-2.5 py-1.5 font-medium text-blue-600 hover:bg-blue-100"
                    onClick={() => openTradeModal(p)}
                  >
                    录入调仓
                  </button>
                  {p.source === 'qieman' && (
                    <>
                      <button
                        className="rounded-lg bg-emerald-50 px-2.5 py-1.5 font-medium text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                        onClick={() => sync(p)}
                        disabled={syncingId === p.id}
                      >
                        {syncingId === p.id ? '同步中…' : '同步'}
                      </button>
                      <button
                        className="rounded-lg bg-gray-100 px-2.5 py-1.5 font-medium text-gray-600 hover:bg-gray-200"
                        onClick={() => {
                          setTokenFor(p);
                          setTokenValue('');
                        }}
                      >
                        Token
                      </button>
                    </>
                  )}
                  <button
                    className="rounded-lg bg-red-50 px-2.5 py-1.5 font-medium text-red-600 hover:bg-red-100"
                    onClick={() => removePortfolio(p)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
            {portfolios.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-white px-4 py-12 text-center text-gray-400">
                <div className="text-3xl">👀</div>
                <p className="mt-2 text-sm">还没有追踪任何博主，点击右上角「添加博主」开始</p>
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3">日期</th>
                  <th className="px-4 py-3">博主</th>
                  <th className="px-4 py-3">基金</th>
                  <th className="px-4 py-3">类型</th>
                  <th className="px-4 py-3 text-right">目标仓位</th>
                  <th className="px-4 py-3">金额/说明</th>
                  <th className="px-4 py-3">备注</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleTrades.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t border-gray-100 transition-colors hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3">{t.trade_date}</td>
                    <td className="px-4 py-3">{t.portfolio_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-medium">
                        {t.fund_name}
                        {t.owned && (
                          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                            已自选
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-gray-400">{t.fund_code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <TradeTypeBadge type={t.trade_type} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {t.weight !== null && t.weight > 0 ? `${t.weight}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.amount_desc ?? '—'}</td>
                    <td className="max-w-40 truncate px-4 py-3 text-gray-500">{t.remark ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => removeTrade(t)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleTrades.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      <div className="text-3xl">📡</div>
                      <p className="mt-2 text-sm">
                        {filterPortfolio ? '该博主暂无调仓记录' : '暂无调仓记录'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showPortfolioModal && (
        <Modal title="添加追踪博主" onClose={() => setShowPortfolioModal(false)}>
          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <Field label="博主/组合名称">
            <input
              className={inputClass}
              value={portfolioForm.name}
              onChange={(e) => setPortfolioForm({ ...portfolioForm, name: e.target.value })}
              placeholder="如 E大-长赢指数投资计划"
            />
          </Field>
          <Field label="数据来源">
            <select
              className={inputClass}
              value={portfolioForm.source}
              onChange={(e) =>
                setPortfolioForm({
                  ...portfolioForm,
                  source: e.target.value as 'manual' | 'qieman',
                  source_key: e.target.value === 'qieman' ? 'LONG_WIN' : '',
                })
              }
            >
              <option value="manual">手动录入（看到博主发车后手动记录）</option>
              <option value="qieman">且慢（自动拉取长赢计划调仓）</option>
            </select>
          </Field>
          {portfolioForm.source === 'qieman' && (
            <>
              <Field label="prodCode">
                <input
                  className={inputClass}
                  value={portfolioForm.source_key}
                  onChange={(e) => setPortfolioForm({ ...portfolioForm, source_key: e.target.value })}
                  placeholder="LONG_WIN（150份）或 LONG_WIN_S（S定投）"
                />
              </Field>
              <Field label="且慢登录 token（选填，之后也可在卡片上配置）">
                <input
                  className={inputClass}
                  value={portfolioForm.qieman_token}
                  onChange={(e) => setPortfolioForm({ ...portfolioForm, qieman_token: e.target.value })}
                  placeholder="浏览器登录且慢后 F12 → Network → Authorization 中的 Bearer 值"
                />
              </Field>
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                且慢自动拉取需要登录态 token（公开接口已全部关闭匿名访问）；不填 token 时只能手动录入调仓。
              </p>
            </>
          )}
          <Field label="备注（选填）">
            <input
              className={inputClass}
              value={portfolioForm.remark}
              onChange={(e) => setPortfolioForm({ ...portfolioForm, remark: e.target.value })}
            />
          </Field>
          <div className="mt-4 flex justify-end gap-3">
            <button
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => setShowPortfolioModal(false)}
            >
              取消
            </button>
            <button
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
              onClick={submitPortfolio}
            >
              保存
            </button>
          </div>
        </Modal>
      )}

      {showTradeModal && (
        <Modal title="录入博主调仓" onClose={() => setShowTradeModal(false)}>
          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <Field label="博主">
            <select
              className={inputClass}
              value={tradeForm.portfolio_id}
              onChange={(e) => setTradeForm({ ...tradeForm, portfolio_id: e.target.value })}
            >
              {(portfolios ?? []).map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="基金代码（6 位数字）">
            <input
              className={inputClass}
              value={tradeForm.fund_code}
              onChange={(e) => setTradeForm({ ...tradeForm, fund_code: e.target.value })}
              placeholder="如 000051；已自选的基金会自动带出名称"
            />
          </Field>
          <Field label="调仓方向">
            <select
              className={inputClass}
              value={tradeForm.trade_type}
              onChange={(e) =>
                setTradeForm({ ...tradeForm, trade_type: e.target.value as 'buy' | 'sell' })
              }
            >
              <option value="buy">买入</option>
              <option value="sell">卖出</option>
            </select>
          </Field>
          <Field label="调仓日期">
            <input
              type="date"
              className={inputClass}
              value={tradeForm.trade_date}
              onChange={(e) => setTradeForm({ ...tradeForm, trade_date: e.target.value })}
            />
          </Field>
          <Field label="目标仓位 %（选填）">
            <input
              type="number"
              step="0.1"
              className={inputClass}
              value={tradeForm.weight}
              onChange={(e) => setTradeForm({ ...tradeForm, weight: e.target.value })}
            />
          </Field>
          <Field label="金额/说明（选填）">
            <input
              className={inputClass}
              value={tradeForm.amount_desc}
              onChange={(e) => setTradeForm({ ...tradeForm, amount_desc: e.target.value })}
              placeholder="如 每份买入1000元"
            />
          </Field>
          <Field label="备注（选填）">
            <input
              className={inputClass}
              value={tradeForm.remark}
              onChange={(e) => setTradeForm({ ...tradeForm, remark: e.target.value })}
            />
          </Field>
          <div className="mt-4 flex justify-end gap-3">
            <button
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => setShowTradeModal(false)}
            >
              取消
            </button>
            <button
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
              onClick={submitTrade}
            >
              保存
            </button>
          </div>
        </Modal>
      )}

      {tokenFor && (
        <Modal title={`配置 token · ${tokenFor.name}`} onClose={() => setTokenFor(null)}>
          <p className="mb-3 text-xs leading-5 text-gray-500">
            且慢公开接口已关闭匿名访问，自动拉取需要登录态。步骤：浏览器登录且慢 →
            F12 打开开发者工具 → Network 任选一个请求 → 复制请求头 Authorization 中
            Bearer 后面的字符串，粘贴到此处。
          </p>
          <Field label="Bearer token">
            <input
              className={inputClass}
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              placeholder="粘贴 token；留空提交则清除"
            />
          </Field>
          <div className="mt-4 flex justify-end gap-3">
            <button
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => setTokenFor(null)}
            >
              取消
            </button>
            <button
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
              onClick={submitToken}
            >
              保存
            </button>
          </div>
        </Modal>
      )}

      {confirmDialog}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold ${tone ?? ''}`}>{value}</div>
    </div>
  );
}

function SourceBadge({ source }: { source: 'manual' | 'qieman' }) {
  return source === 'manual' ? (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      手动
    </span>
  ) : (
    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
      且慢
    </span>
  );
}
