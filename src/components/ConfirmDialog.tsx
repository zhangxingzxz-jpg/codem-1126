'use client';

import { useCallback, useState } from 'react';
import Modal from './Modal';

type ConfirmOptions = {
  title: string;
  message: string;
  danger?: boolean;
};

type ConfirmState = ConfirmOptions & {
  resolve: (v: boolean) => void;
};

/** 用法：const { confirm, confirmDialog } = useConfirm(); …if (await confirm({...})) …；在页面根部渲染 {confirmDialog} */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  function settle(value: boolean) {
    state?.resolve(value);
    setState(null);
  }

  const confirmDialog = state ? (
    <Modal title={state.title} onClose={() => settle(false)}>
      <p className="mb-5 text-sm leading-6 text-gray-600">{state.message}</p>
      <div className="flex justify-end gap-3">
        <button
          className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => settle(false)}
        >
          取消
        </button>
        <button
          className={`rounded-lg px-4 py-1.5 text-sm text-white ${
            state.danger
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
          onClick={() => settle(true)}
        >
          确定
        </button>
      </div>
    </Modal>
  ) : null;

  return { confirm, confirmDialog };
}
