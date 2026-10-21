'use client';

import type { ReactNode } from 'react';

export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-mask fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="modal-panel w-full max-w-md rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <span className="font-semibold">{title}</span>
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block text-gray-600">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
