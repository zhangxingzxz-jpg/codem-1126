'use client';

import { useCallback, useEffect, useState } from 'react';
import Modal, { Field, inputClass } from '@/components/Modal';
import { RiskBadge, TypeBadge } from '@/components/Badge';
import { TableSkeleton } from '@/components/Skeleton';
import { useConfirm } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { FUND_TYPES } from '@/lib/validators';
import type { Fund } from '@/lib/types';

type FormState = {
  code: string;
  name: string;
  type: string;
  company: string;
  risk_level: string;
  remark: string;
};

const emptyForm: FormState = {
  code: '',
  name: '',
  type: '混合',
  company: '',
  risk_level: '',
  remark: '',
};

export default function FundsPage() {
  const [funds, setFunds] = useState<Fund[] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Fund | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const { confirm, confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    const res = await fetch('/api/funds');
    const json = await res.json();
    setFunds(json.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  }

  function openEdit(f: Fund) {
    setEditing(f);
    setForm({
      code: f.code,
      name: f.name,
      type: f.type,
      company: f.company ?? '',
      risk_level: f.risk_level ?? '',
      remark: f.remark ?? '',
    });
    setError('');
    setShowModal(true);
  }

  async function submit() {
    const payload = {
      ...form,
      company: form.company || null,
      risk_level: form.risk_level || null,
      remark: form.remark || null,
    };
    const res = await fetch(
      editing ? `/api/funds/${editing.id}` : '/api/funds',
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
    toast(editing ? '基金已更新' : '基金已创建');
    load();
  }

  async function remove(f: Fund) {
    const ok = await confirm({
      title: '删除基金',
      message: `确认删除基金「${f.name}（${f.code}）」？删除后不可恢复。`,
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/funds/${f.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json();
      toast(json.error ?? '删除失败', 'error');
      return;
    }
    toast('基金已删除');
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-xl font-bold">基金档案</h1>
        {funds !== null && (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
            共 {funds.length} 只
          </span>
        )}
        <button
          className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow-sm transition-colors hover:bg-blue-700"
          onClick={openCreate}
        >
          + 新增基金
        </button>
      </div>

      {funds === null ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">基金</th>
                <th className="px-4 py-3">类型</th>
                <th className="px-4 py-3">基金公司</th>
                <th className="px-4 py-3">风险等级</th>
                <th className="px-4 py-3">备注</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {funds.map((f) => (
                <tr
                  key={f.id}
                  className="border-t border-gray-100 transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{f.name}</div>
                    <div className="mt-0.5 font-mono text-xs text-gray-400">{f.code}</div>
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={f.type} />
                  </td>
                  <td className="px-4 py-3">{f.company ?? '—'}</td>
                  <td className="px-4 py-3">
                    <RiskBadge risk={f.risk_level} />
                  </td>
                  <td className="max-w-48 truncate px-4 py-3 text-gray-500">
                    {f.remark ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="mr-3 text-blue-600 hover:underline"
                      onClick={() => openEdit(f)}
                    >
                      编辑
                    </button>
                    <button
                      className="text-red-600 hover:underline"
                      onClick={() => remove(f)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {funds.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    <div className="text-3xl">📁</div>
                    <p className="mt-2 text-sm">暂无基金，点击右上角「新增基金」开始</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? '编辑基金' : '新增基金'}
          onClose={() => setShowModal(false)}
        >
          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <Field label="基金代码（6 位数字）">
            <input
              className={inputClass}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="如 110022"
            />
          </Field>
          <Field label="基金名称">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如 易方达消费行业股票"
            />
          </Field>
          <Field label="类型">
            <select
              className={inputClass}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {FUND_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="基金公司（选填）">
            <input
              className={inputClass}
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </Field>
          <Field label="风险等级（选填）">
            <input
              className={inputClass}
              value={form.risk_level}
              onChange={(e) => setForm({ ...form, risk_level: e.target.value })}
              placeholder="如 高 / 中 / 中低"
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
