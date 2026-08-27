import type { Metadata } from 'next';
import { AppLink as Link } from '@/components/app-link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { formatVnd, formatQty, num } from '@/lib/money';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'Chi tiết vật liệu' };

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission('catalog', 'view');
  const { id } = await params;

  const material = await prisma.material.findUnique({
    where: { id },
    include: {
      category: true,
      catalogItems: {
        where: { isPublished: true },
        include: { organization: { select: { name: true, code: true } } },
        orderBy: { listPrice: 'asc' },
      },
    },
  });

  if (!material) notFound();

  const canRequest = user.role === 'REQUESTER';

  return (
    <>
      <PageHeader
        title={material.name}
        description={`${material.category.name} · Mã vật tư ${material.code} · Đơn vị tính ${material.uom}`}
        actions={
          canRequest ? (
            <Link href={`/de-nghi-mua/moi?vatlieu=${material.id}`} className="btn-accent">
              Thêm vào đề nghị mua
            </Link>
          ) : (
            <Link href="/vat-lieu" className="btn-ghost">
              Quay lại danh mục
            </Link>
          )
        }
      />

      {material.spec ? (
        <div className="card mb-5 p-4">
          <h2 className="text-sm font-semibold text-slate-700">Quy cách kỹ thuật</h2>
          <p className="mt-1 text-sm text-slate-600">{material.spec}</p>
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Nhà cung cấp niêm yết ({material.catalogItems.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Nhà cung cấp</th>
                <th>Mã SKU</th>
                <th>Thương hiệu</th>
                <th className="num">Giá niêm yết</th>
                <th className="num">Đặt tối thiểu</th>
                <th className="num">Giao trong</th>
                <th>Chứng chỉ</th>
              </tr>
            </thead>
            <tbody>
              {material.catalogItems.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium text-slate-800">{item.organization.name}</td>
                  <td className="font-mono text-xs">{item.sku}</td>
                  <td>{item.brand ?? '—'}</td>
                  <td className="num font-medium">{formatVnd(num(item.listPrice))}</td>
                  <td className="num">
                    {formatQty(num(item.minOrderQty))} {material.uom}
                  </td>
                  <td className="num">{item.leadTimeDays} ngày</td>
                  <td>{item.certification ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Giá niêm yết chỉ để tham khảo. Giá có hiệu lực thương mại được xác lập qua quy trình hỏi
        giá và phê duyệt lựa chọn nhà cung cấp.
      </p>
    </>
  );
}
