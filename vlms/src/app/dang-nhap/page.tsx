import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Đăng nhập' };

const DEMO_ACCOUNTS = [
  { email: 'denghi@cattuong.vn', role: 'Người đề nghị mua' },
  { email: 'muahang@cattuong.vn', role: 'Chuyên viên mua hàng' },
  { email: 'pheduyet@cattuong.vn', role: 'Người phê duyệt' },
  { email: 'nhanhang@cattuong.vn', role: 'Người nhận hàng' },
  { email: 'ketoan@cattuong.vn', role: 'Kế toán công nợ' },
  { email: 'ncc.thep@donga.vn', role: 'Nhà cung cấp thép' },
  { email: 'ncc.ximang@binhminh.vn', role: 'Nhà cung cấp xi măng' },
  { email: 'ncc.vlxd@namphat.vn', role: 'Nhà cung cấp tổng hợp' },
];

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/bang-dieu-khien');

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-800 px-4 py-12">
      <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-2">
        <section className="card p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">
            CTG BuildHub
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-navy-800">
            Sàn vật liệu xây dựng
          </h1>
          <p className="mt-1 mb-6 text-sm text-slate-600">
            Đăng nhập để tiếp tục quy trình mua hàng.
          </p>
          <LoginForm />
        </section>

        <section className="card bg-slate-50 p-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Tài khoản dùng thử
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Mật khẩu chung: <code className="rounded bg-white px-1.5 py-0.5 font-mono">matkhau123</code>
          </p>
          <ul className="mt-4 divide-y divide-slate-200 text-sm">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email} className="flex flex-col py-2">
                <span className="font-mono text-xs text-navy-700">{a.email}</span>
                <span className="text-slate-600">{a.role}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
