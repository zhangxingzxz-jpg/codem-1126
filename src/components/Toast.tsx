'use client';

import { useEffect, useState } from 'react';

type ToastItem = {
  id: number;
  msg: string;
  type: 'success' | 'error';
};

/** 任意组件（含非 React 上下文）中调用：toast('已保存') / toast('失败', 'error') */
export function toast(msg: string, type: 'success' | 'error' = 'success') {
  window.dispatchEvent(
    new CustomEvent('app-toast', { detail: { msg, type } }),
  );
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { msg, type } = (e as CustomEvent<{ msg: string; type: 'success' | 'error' }>).detail;
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, msg, type }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 2500);
    };
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast-item rounded-full px-4 py-2 text-sm text-white shadow-lg ${
            t.type === 'error' ? 'bg-red-600' : 'bg-gray-900'
          }`}
        >
          {t.type === 'error' ? '❌ ' : '✓ '}
          {t.msg}
        </div>
      ))}
    </div>
  );
}
