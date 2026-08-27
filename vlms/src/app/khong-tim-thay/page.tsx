import type { Metadata } from 'next';
import { AppLink as Link } from '@/components/app-link';

export const metadata: Metadata = { title: 'Không tìm thấy' };

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">404</p>
        <h1 className="mt-2 text-xl font-semibold text-navy-800">Không tìm thấy trang</h1>
        <p className="mt-2 text-sm text-slate-600">
          Trang này không tồn tại hoặc không thuộc phạm vi truy cập của vai trò bạn đang dùng.
        </p>
        <Link href="/bang-dieu-khien" className="btn-primary mt-6">
          Về bảng điều khiển
        </Link>
      </div>
    </main>
  );
}
