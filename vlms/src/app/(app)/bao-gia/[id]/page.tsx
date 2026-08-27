import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { formatVnd, formatDateTime, num } from '@/lib/money';
import { Flash } from '@/components/flash';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { QuoteForm } from './quote-form';

export const metadata: Metadata = { title: 'Nộp báo giá' };

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tb?: string }>;
}) {
  const user = await requirePermission('quote', 'view');
  const { id: rfqId } = await params;
  const { tb } = await searchParams;

  const rfq = await prisma.rfq.findFirst({
    where: { id: rfqId, invitations: { some: { organizationId: user.organizationId } } },
    include: {
      organization: { select: { name: true } },
      lines: { include: { material: true } },
      quotes: {
        where: { organizationId: user.organizationId },
        include: { lines: true },
      },
    },
  });

  if (!rfq) notFound();

  const myQuote = rfq.quotes[0];
  const expired = rfq.closingAt.getTime() < Date.now();
  const canQuote = !myQuote && rfq.status === 'ISSUED' && !expired;

  const catalog = await prisma.catalogItem.findMany({
    where: {
      organizationId: user.organizationId,
      materialId: { in: rfq.lines.map((l) => l.materialId) },
    },
  });

  return (
    <>
      <PageHeader
        title={`Yêu cầu báo giá ${rfq.code}`}
        description={`Bên mời: ${rfq.organization.name} · Hạn nhận báo giá ${formatDateTime(rfq.closingAt)}`}
      />

      <Flash code={tb} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={rfq.status} />
        {rfq.terms ? <span className="text-sm text-slate-600">{rfq.terms}</span> : null}
      </div>

      <QuoteForm
        rfqId={rfq.id}
        canQuote={canQuote}
        closedReason={
          myQuote
            ? 'Báo giá đã nộp nên bị khóa, không sửa được. Liên hệ bên mời thầu nếu cần làm rõ.'
            : expired
              ? 'Đã quá hạn nhận báo giá cho yêu cầu này.'
              : 'Yêu cầu báo giá này không còn nhận báo giá mới.'
        }
        submitted={
          myQuote
            ? {
                code: myQuote.code,
                totalValue: num(myQuote.totalValue),
                prices: Object.fromEntries(
                  myQuote.lines.map((l) => [l.rfqLineId, num(l.unitPrice)]),
                ),
              }
            : null
        }
        lines={rfq.lines.map((l) => {
          const item = catalog.find((c) => c.materialId === l.materialId);
          return {
            rfqLineId: l.id,
            materialName: l.material.name,
            materialCode: l.material.code,
            quantity: num(l.quantity),
            uom: l.uom,
            listPrice: item ? num(item.listPrice) : null,
          };
        })}
      />

      {myQuote ? (
        <p className="mt-3 text-sm text-slate-600">
          Trạng thái báo giá của bạn: <StatusBadge status={myQuote.status} /> · Tổng đã gồm thuế{' '}
          {formatVnd(myQuote.totalValue)}
        </p>
      ) : null}

    </>
  );
}
