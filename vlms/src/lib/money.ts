import { Prisma } from '@prisma/client';

export type Numeric = Prisma.Decimal | number | string;

/** Ép mọi kiểu số của Prisma về number để tính toán và hiển thị. */
export function num(value: Numeric | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value.toString());
}

const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function formatVnd(value: Numeric | null | undefined): string {
  return vnd.format(num(value));
}

const qty = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });

export function formatQty(value: Numeric | null | undefined): string {
  return qty.format(num(value));
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(d);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}
