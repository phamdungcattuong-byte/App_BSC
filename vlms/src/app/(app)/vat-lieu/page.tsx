import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { formatVnd, num } from '@/lib/money';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';

export const metadata: Metadata = { title: 'Danh mục vật liệu' };

interface SearchParams {
  q?: string;
  nhom?: string;
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission('catalog', 'view');
  const { q = '', nhom = '' } = await searchParams;

  const [categories, materials] = await Promise.all([
    prisma.materialCategory.findMany({ orderBy: { name: 'asc' } }),
    prisma.material.findMany({
      where: {
        isActive: true,
        ...(nhom ? { category: { code: nhom } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { code: { contains: q, mode: 'insensitive' as const } },
                { spec: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: {
        category: true,
        catalogItems: {
          where: { isPublished: true },
          include: { organization: { select: { name: true } } },
          orderBy: { listPrice: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Danh mục vật liệu"
        description="Vật liệu chuẩn của sàn kèm giá tham khảo từ các nhà cung cấp đã được xác minh."
      />

      <form className="card mb-5 flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-[240px] flex-1">
          <label className="label" htmlFor="q">
            Tìm kiếm
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            className="input"
            placeholder="Tên vật liệu, mã vật tư hoặc quy cách"
          />
        </div>
        <div className="min-w-[200px]">
          <label className="label" htmlFor="nhom">
            Nhóm vật tư
          </label>
          <select id="nhom" name="nhom" defaultValue={nhom} className="input">
            <option value="">Tất cả nhóm</option>
            {categories.map((c) => (
              <option key={c.id} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Lọc
        </button>
        {q || nhom ? (
          <Link href="/vat-lieu" className="btn-ghost">
            Xóa lọc
          </Link>
        ) : null}
      </form>

      {materials.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Không tìm thấy vật liệu phù hợp"
            description="Thử đổi từ khóa hoặc chọn nhóm vật tư khác."
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {materials.map((m) => {
            const best = m.catalogItems[0];
            const supplierCount = m.catalogItems.length;
            return (
              <Link
                key={m.id}
                href={`/vat-lieu/${m.id}`}
                className="card flex flex-col p-4 transition-shadow hover:shadow-md"
              >
                <span className="text-xs font-medium uppercase tracking-wide text-teal-700">
                  {m.category.name}
                </span>
                <span className="mt-1 font-medium text-slate-900">{m.name}</span>
                <span className="mt-0.5 font-mono text-xs text-slate-500">{m.code}</span>
                {m.spec ? (
                  <span className="mt-2 line-clamp-2 text-sm text-slate-600">{m.spec}</span>
                ) : null}

                <div className="mt-auto pt-4">
                  {best ? (
                    <>
                      <span className="text-lg font-semibold text-navy-800">
                        {formatVnd(num(best.listPrice))}
                      </span>
                      <span className="text-sm text-slate-500"> / {m.uom}</span>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Giá tốt nhất trong {supplierCount} nhà cung cấp
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">Chưa có nhà cung cấp niêm yết</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
