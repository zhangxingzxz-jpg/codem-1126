'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal, { Field, inputClass } from '@/components/Modal';
import { TradeTypeBadge } from '@/components/Badge';
import { TableSkeleton } from '@/components/Skeleton';
import { useConfirm } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import type { Fund, Transaction, TradeType } from '@/lib/types';

const TRADE_TYPES: Array<{ value: TradeType; label: string }> = [
  { value: 'buy', label: '买入' },
  { value: 'sell', label: '卖出' },
  { value: 'dividend', label: '分红' },
];

type FormState = {
  fund_id: string;
  trade_type: TradeType;
  trade_date: string;
  amount: string;
  shares: string;
  fee: string;
  remark: string;
};

const emptyForm: FormState = {
  fund_id: '',
  trade_type: 'buy',
  trade_date: new Date().toISOString().slice(0, 10),
  amount: '',
  shares: '',
  fee: '0',
  remark: '',
};

export default function TransactionsPage() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [filterFund, setFilterFund] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const { confirm, confirmDialog } = useConfirm();

  const fundMap = useMemo(
    () => new Map(funds.map((f) => [f.id, f])),
    [funds],
  );

  const load = useCallback(async () => {
    const [fundsRes, txRes] = await Promise.all([
      fetch('/api/funds'),
      fetch('/api/transactions'),
    ]);
    const fundsJson = await fundsRes.json();
    const txJson = await txRes.json();
    setFunds(fundsJson.data ?? []);
    setTransactions(txJson.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    if (transactions === null) return null;
    if (!filterFund) return transactions;
    return transactions.filter((t) => String(t.fund_id) === filterFund);
  }, [transactions, filterFund]);

  const stats = useMemo(() => {
    const s = { count: 0, buy: 0, sell: 0, dividend: 0 };
    for (const t of rows ?? []) {
      s.count++;
      if (t.trade_type === 'buy') s.buy += t.amount;
      else if (t.trade_type === 'sell') s.sell += t.amount;
      else s.dividend += t.amount;
    }
    return s;
  }, [rows]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, fund_id: funds[0] ? String(funds[0].id) : '' });
    setError('');
    setShowModal(true);
  }

  function openEdit(t: Transaction) {
    setEditing(t);
    setForm({
      fund_id: String(t.fund_id),
      trade_type: t.trade_type,
      trade_date: t.trade_date,
      amount: String(t.amount),
      shares: String(t.shares),
      fee: String(t.fee),
      remark: t.remark ?? '',
    });
    setError('');
    setShowModal(true);
  }

  async function submit() {
    const payload = {
      fund_id: Number(form.fund_id),
      trade_type: form.trade_type,
      trade_date: form.trade_date,
      amount: Number(form.amount),
      shares: Number(form.shares || 0),
      fee: Number(form.fee || 0),
      remark: form.remark || null,
    };
    const res = await fetch(
      editing ? `/api/transactions/${editing.id}` : '/api/transactions',
      {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? '保存失败');
      return;
    }
    setShowModal(false);
    toast(editing ? '交易已更新' : '交易已录入');
    load();
  }

  async function remove(t: Transaction) {
    const name = fundMap.get(t.fund_id)?.name ?? `基金 ${t.fund_id}`;
    const ok = await confirm({
      title: '删除交易',
      message: `确认删除「${name}」${t.trade_date} 的这笔${typeLabel(t.trade_type)}记录？删除后不可恢复。`,
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/transactions/${t.id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast('删除失败', 'error');
      return;
    }
    toast('交易已删除');
    load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">交易记录</h1>
        <select
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          value={filterFund}
          onChange={(e) => setFilterFund(e.target.value)}
        >
          <option value="">全部基金</option>
          {funds.map((f) => (
            <option key={f.id} value={String(f.id)}>
              {f.name}
            </option>
          ))}
        </select>
        <button
          className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow-sm transition-colors hover:bg-blue-700 disabled:bg-gray-300"
          onClick={openCreate}
          disabled={funds.length === 0}
        >
          + 新增交易
        </button>
      </div>

      {funds.length === 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          请先到「基金档案」添加基金，再录入交易。
        </p>
      )}

      {rows !== null && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="交易笔数" value={String(stats.count)} />
          <StatCard label="总买入（元）" value={fmt(stats.buy)} tone="text-red-600" />
          <StatCard label="总卖出（元）" value={fmt(stats.sell)} tone="text-emerald-600" />
          <StatCard label="总分红（元）" value={fmt(stats.dividend)} tone="text-amber-600" />
        </div>
      )}

      {rows === null ? (
        <TableSkeleton rows={7} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">交易日期</th>
                <th className="px-4 py-3">基金</th>
                <th className="px-4 py-3">类型</th>
                <th className="px-4 py-3 text-right">金额（元）</th>
                <th className="px-4 py-3 text-right">份额</th>
                <th className="px-4 py-3 text-right">手续费</th>
                <th className="px-4 py-3">备注</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const fund = fundMap.get(t.fund_id);
                return (
                  <tr
                    key={t.id}
                    className="border-t border-gray-100 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{t.trade_date}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {fund?.name ?? `基金 ${t.fund_id}`}
                      </div>
                      {fund && (
                        <div className="mt-0.5 font-mono text-xs text-gray-400">
                          {fund.code}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <TradeTypeBadge type={t.trade_type} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {t.amount.toLocaleString('zh-CN', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {t.shares > 0
                        ? t.shares.toLocaleString('zh-CN', {
                            minimumFractionDigits: 2,
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{t.fee}</td>
                    <td className="max-w-40 truncate px-4 py-3 text-gray-500">
                      {t.remark ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        className="mr-3 text-blue-600 hover:underline"
                        onClick={() => openEdit(t)}
                      >
                        编辑
                      </button>
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => remove(t)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <div className="text-3xl">🧾</div>
                    <p className="mt-2 text-sm">
                      {filterFund ? '该基金暂无交易记录' : '暂无交易记录'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? '编辑交易' : '新增交易'}
          onClose={() => setShowModal(false)}
        >
          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <Field label="基金">
            <select
              className={inputClass}
              value={form.fund_id}
              onChange={(e) => setForm({ ...form, fund_id: e.target.value })}
            >
              {funds.map((f) => (
                <option key={f.id} value={String(f.id)}>
                  {f.name}（{f.code}）
                </option>
              ))}
            </select>
          </Field>
          <Field label="交易类型">
            <select
              className={inputClass}
              value={form.trade_type}
              onChange={(e) =>
                setForm({ ...form, trade_type: e.target.value as TradeType })
              }
            >
              {TRADE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="交易日期">
            <input
              type="date"
              className={inputClass}
              value={form.trade_date}
              onChange={(e) => setForm({ ...form, trade_date: e.target.value })}
            />
          </Field>
          <Field label="金额（元）">
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="买入/卖出金额，或分红金额"
            />
          </Field>
          <Field label="份额（分红可不填）">
            <input
              type="number"
              step="0.0001"
              className={inputClass}
              value={form.shares}
              onChange={(e) => setForm({ ...form, shares: e.target.value })}
            />
          </Field>
          <Field label="手续费（元）">
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={form.fee}
              onChange={(e) => setForm({ ...form, fee: e.target.value })}
            />
          </Field>
          <Field label="备注（选填）">
            <input
              className={inputClass}
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
            />
          </Field>
          <div className="mt-4 flex justify-end gap-3">
            <button
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => setShowModal(false)}
            >
              取消
            </button>
            <button
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
              onClick={submit}
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

function fmt(n: number): string {
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function typeLabel(t: TradeType): string {
  return TRADE_TYPES.find((x) => x.value === t)?.label ?? t;
}
