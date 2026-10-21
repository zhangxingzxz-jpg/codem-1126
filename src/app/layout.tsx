import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Nav from '@/components/Nav';
import { ToastHost } from '@/components/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: '基金管理平台',
  description: '基金档案与持仓交易管理',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <span className="text-lg font-bold">📊 基金管理平台</span>
            <Nav />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <ToastHost />
      </body>
    </html>
  );
}
