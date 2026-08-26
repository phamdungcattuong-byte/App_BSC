import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { roleLabel } from '@/lib/rbac';
import { formatDateTime } from '@/lib/money';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';

export const metadata: Metadata = { title: 'Nhật ký kiểm toán' };

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Tạo mới',
  SUBMIT: 'Trình duyệt',
  APPROVE: 'Phê duyệt',
  REJECT: 'Từ chối',
  ISSUE: 'Phát hành',
  ACKNOWLEDGE: 'Xác nhận',
  AWARD: 'Chọn nhà cung cấp',
  RECEIVE: 'Nhận hàng',
  THREE_WAY_MATCH: 'Đối chiếu ba chiều',
  POST: 'Ghi sổ',
  DECLARE: 'Khai tài khoản',
  VERIFY: 'Xác minh tài khoản',
  EXECUTE: 'Phát lệnh chi',
};

const ENTITY_LABELS: Record<string, string> = {
  PurchaseRequisition: 'Đề nghị mua',
  Rfq: 'Yêu cầu báo giá',
  Quote: 'Báo giá',
  Award: 'Kết quả lựa chọn',
  PurchaseOrder: 'Đơn hàng',
  Grn: 'Phiếu nhận hàng',
  Invoice: 'Hóa đơn',
  SupplierBankAccount: 'Tài khoản ngân hàng',
  PaymentRequest: 'Đề nghị thanh toán',
  Payment: 'Lệnh chi',
};

export default async function AuditPage() {
  const user = await requirePermission('audit', 'view');

  const logs = await prisma.auditLog.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const actorIds = [...new Set(logs.map((l) => l.actorId))];
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, fullName: true },
  });
  const actorName = new Map(actors.map((a) => [a.id, a.fullName]));

  return (
    <>
      <PageHeader
        title="Nhật ký kiểm toán"
        description="Mọi chuyển trạng thái đều ghi lại ai làm, lúc nào, trên chứng từ nào và vì lý do gì. Bản ghi không sửa và không xóa được."
      />

      <div className="card overflow-hidden">
        {logs.length === 0 ? (
          <EmptyState title="Chưa có hoạt động nào được ghi nhận" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Người thực hiện</th>
                  <th>Chứng từ</th>
                  <th>Hành động</th>
                  <th>Chuyển trạng thái</th>
                  <th>Lý do</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-xs">{formatDateTime(log.createdAt)}</td>
                    <td>
                      <span className="font-medium text-slate-800">
                        {actorName.get(log.actorId) ?? log.actorId}
                      </span>
                      <span className="block text-xs text-slate-500">{roleLabel(log.actorRole)}</span>
                    </td>
                    <td>{ENTITY_LABELS[log.entityType] ?? log.entityType}</td>
                    <td>{ACTION_LABELS[log.action] ?? log.action}</td>
                    <td className="whitespace-nowrap">
                      {log.fromState ? (
                        <>
                          <StatusBadge status={log.fromState} />
                          <span className="mx-1 text-slate-400">→</span>
                        </>
                      ) : null}
                      {log.toState ? <StatusBadge status={log.toState} /> : '—'}
                    </td>
                    <td className="max-w-xs text-xs">{log.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
