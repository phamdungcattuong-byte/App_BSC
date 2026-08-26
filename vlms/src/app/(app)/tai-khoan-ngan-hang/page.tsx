import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDateTime } from '@/lib/money';
import { Flash } from '@/components/flash';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';
import { DeclareAccountForm, VerifyAccountPanel } from './panels';

export const metadata: Metadata = { title: 'Tài khoản ngân hàng' };

export default async function BankAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tb?: string }>;
}) {
  const user = await requirePermission('bankAccount', 'view');
  const { tb } = await searchParams;
  const isSupplier = user.organization.type === 'SUPPLIER';

  const accounts = await prisma.supplierBankAccount.findMany({
    where: isSupplier ? { organizationId: user.organizationId } : {},
    include: { organization: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const actorIds = [
    ...new Set(accounts.flatMap((a) => [a.declaredById, a.verifiedById].filter(Boolean) as string[])),
  ];
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, fullName: true },
  });
  const actorName = new Map(actors.map((a) => [a.id, a.fullName]));

  const canVerify = can(user.role, 'bankAccount', 'verify');

  return (
    <>
      <PageHeader
        title="Tài khoản ngân hàng nhà cung cấp"
        description="Tiền chỉ được chi vào tài khoản đã qua xác minh độc lập. Đây là chốt chặn gian lận đổi tài khoản."
      />

      <Flash code={tb} />

      {isSupplier ? (
        <div className="card mb-5 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Khai tài khoản nhận tiền</h2>
          <DeclareAccountForm />
        </div>
      ) : null}

      <div className="space-y-4">
        {accounts.length === 0 ? (
          <div className="card">
            <EmptyState
              title="Chưa có tài khoản ngân hàng nào"
              description={
                isSupplier
                  ? 'Khai tài khoản nhận tiền ở form phía trên để bên mua xác minh.'
                  : 'Nhà cung cấp chưa khai tài khoản nhận tiền nào.'
              }
            />
          </div>
        ) : (
          accounts.map((account) => (
            <div key={account.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-800">{account.organization.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {account.bankName}
                    {account.branch ? ` — ${account.branch}` : ''}
                  </p>
                  <p className="font-mono text-sm text-navy-700">{account.accountNumber}</p>
                  <p className="text-sm text-slate-600">{account.accountHolder}</p>
                </div>
                <StatusBadge status={account.status} />
              </div>

              <dl className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                <div>
                  <dt className="inline">Người khai: </dt>
                  <dd className="inline font-medium text-slate-700">
                    {actorName.get(account.declaredById) ?? account.declaredById}
                  </dd>
                  <span> · {formatDateTime(account.createdAt)}</span>
                </div>
                {account.verifiedById ? (
                  <div>
                    <dt className="inline">Người xác minh: </dt>
                    <dd className="inline font-medium text-slate-700">
                      {actorName.get(account.verifiedById) ?? account.verifiedById}
                    </dd>
                    <span> · {formatDateTime(account.verifiedAt)}</span>
                  </div>
                ) : null}
              </dl>

              {account.rejectReason ? (
                <p className="mt-2 text-sm text-red-700">Lý do từ chối: {account.rejectReason}</p>
              ) : null}

              {canVerify && account.status === 'PENDING' ? (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <VerifyAccountPanel accountId={account.id} />
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Người xác minh tài khoản không được phê duyệt lệnh chi vào chính tài khoản đó. Hệ thống chặn
        ở tầng nghiệp vụ, không phụ thuộc giao diện.
      </p>
    </>
  );
}
