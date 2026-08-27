import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { RfqForm } from './rfq-form';

export const metadata: Metadata = { title: 'Tạo yêu cầu báo giá' };

export default async function NewRfqPage({
  searchParams,
}: {
  searchParams: Promise<{ pr?: string }>;
}) {
  const user = await requirePermission('rfq', 'create');
  const { pr: prId } = await searchParams;
  if (!prId) notFound();

  const pr = await prisma.purchaseRequisition.findFirst({
    where: { id: prId, organizationId: user.organizationId },
    include: { lines: true, rfqs: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!pr) notFound();

  // Đề nghị mua đã chuyển thành yêu cầu báo giá thì đưa thẳng tới yêu cầu đó,
  // thay vì trả 404 khi người dùng tải lại trang hoặc bấm quay lại.
  if (pr.rfqs.length > 0) redirect(`/hoi-gia/${pr.rfqs[0].id}`);

  if (pr.status !== 'APPROVED') {
    return (
      <>
        <PageHeader title="Tạo yêu cầu báo giá" />
        <div className="card p-6 text-sm text-slate-600">
          Chỉ đề nghị mua đã được phê duyệt mới chuyển thành yêu cầu báo giá được. Đề nghị mua{' '}
          <span className="font-mono">{pr.code}</span> đang ở trạng thái khác.
        </div>
      </>
    );
  }

  const materialIds = pr.lines.map((l) => l.materialId);

  const suppliers = await prisma.organization.findMany({
    where: { type: 'SUPPLIER', status: 'VERIFIED' },
    include: {
      catalogItems: {
        where: { materialId: { in: materialIds }, isPublished: true },
        select: { id: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return (
    <>
      <PageHeader
        title="Tạo yêu cầu báo giá"
        description="Chỉ nhà cung cấp đã được xác minh mới xuất hiện trong danh sách mời."
      />
      <RfqForm
        prId={pr.id}
        prCode={pr.code}
        suppliers={suppliers.map((s) => ({
          id: s.id,
          name: s.name,
          matchedItems: s.catalogItems.length,
        }))}
      />
    </>
  );
}
