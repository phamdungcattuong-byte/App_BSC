'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
}

export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Điều hướng chính"
      className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0 lg:space-y-1 lg:overflow-visible"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`block whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-navy-700 font-medium text-white'
                : 'text-navy-100 hover:bg-navy-700/50 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
