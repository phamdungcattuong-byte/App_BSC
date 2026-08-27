import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { num } from '@/lib/money';
import { PageHeader } from '@/components/page-header';
import { PoForm } from './po-form';

export const metadata: Metadata = { title: 'Phát hành đơn hàng' };

export default async function NewPoPage({
  searchParams,
}: {
  searchParams: Promise<{ award?: string }>;
}) {
  const user = await requirePermission('purchaseOrder', 'create');
  const { award: awardId } = await searchParams;
  if (!awardId) notFound();

  const award = await prisma.award.findUnique({
    where: { id: awardId },
    include: {
      po: { select: { id: true } },
      quote: { include: { organization: true, lines: true } },
      rfq: {
        include: {
          lines: true,
          pr: { include: { project: true } },
        },
      },
    },
  });

  if (!award || award.rfq.organizationId !== user.organizationId) notFound();
  if (award.po) notFound();

  const total = award.rfq.lines.reduce((sum, line) => {
    const ql = award.quote.lines.find((q) => q.rfqLineId === line.id);
    if (!ql) return sum;
    return sum + num(line.quantity) * num(ql.unitPrice) * (1 + num(ql.taxRate));
  }, 0);

  return (
    <>
      <PageHeader
        title="Phát hành đơn hàng"
        description="Đơn hàng lấy nguyên số lượng và đơn giá từ báo giá trúng thầu, không nhập tay lại."
      />
      <PoForm
        awardId={award.id}
        supplierName={award.quote.organization.name}
        rfqCode={award.rfq.code}
        total={total}
        suggestedAddress={award.rfq.pr.project.location ?? ''}
      />
    </>
  );
}
