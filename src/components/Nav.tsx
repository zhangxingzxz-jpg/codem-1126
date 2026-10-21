'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: '持仓汇总' },
  { href: '/funds', label: '基金档案' },
  { href: '/transactions', label: '交易记录' },
  { href: '/portfolios', label: '博主追踪' },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {NAV.map((item) => {
        const active =
          item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3.5 py-1.5 transition-colors ${
              active
                ? 'bg-blue-50 font-medium text-blue-600'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
