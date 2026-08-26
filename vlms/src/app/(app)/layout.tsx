import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { roleLabel } from '@/lib/rbac';
import { logout } from '@/app/dang-nhap/actions';
import { SideNav, type NavItem } from './nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const role = user.role;

  // Menu hiển thị đúng những gì vai trò được phép xem.
  const items: NavItem[] = [{ href: '/bang-dieu-khien', label: 'Bảng điều khiển' }];
  if (can(role, 'catalog', 'view')) items.push({ href: '/vat-lieu', label: 'Danh mục vật liệu' });
  if (can(role, 'requisition', 'view')) items.push({ href: '/de-nghi-mua', label: 'Đề nghị mua' });
  if (can(role, 'rfq', 'view')) items.push({ href: '/hoi-gia', label: 'Hỏi giá (RFQ)' });
  if (can(role, 'quote', 'create')) items.push({ href: '/bao-gia', label: 'Báo giá của tôi' });
  if (can(role, 'purchaseOrder', 'view')) items.push({ href: '/don-hang', label: 'Đơn hàng' });
  if (can(role, 'grn', 'view')) items.push({ href: '/nhan-hang', label: 'Nhận hàng' });
  if (can(role, 'invoice', 'view')) items.push({ href: '/hoa-don', label: 'Hóa đơn' });
  if (can(role, 'bankAccount', 'view'))
    items.push({ href: '/tai-khoan-ngan-hang', label: 'Tài khoản ngân hàng' });
  if (can(role, 'paymentRequest', 'view'))
    items.push({ href: '/de-nghi-thanh-toan', label: 'Đề nghị thanh toán' });
  if (can(role, 'debt', 'view')) items.push({ href: '/cong-no', label: 'Công nợ' });
  if (can(role, 'audit', 'view')) items.push({ href: '/nhat-ky', label: 'Nhật ký kiểm toán' });

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Một khối điều hướng duy nhất: cột dọc trên màn hình lớn, thanh ngang cuộn được trên màn hình nhỏ. */}
      <aside className="flex w-full shrink-0 flex-col gap-3 bg-navy-800 p-4 lg:h-screen lg:w-64 lg:gap-0">
        <Link href="/bang-dieu-khien" className="block lg:mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">
            CTG BuildHub
          </p>
          <p className="text-lg font-semibold text-white">Sàn vật liệu</p>
        </Link>
        <SideNav items={items} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user.fullName}</p>
              <p className="text-xs text-slate-500">
                {roleLabel(user.role)} · {user.organization.name}
              </p>
            </div>
            <form action={logout}>
              <button type="submit" className="btn-ghost">
                Đăng xuất
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
