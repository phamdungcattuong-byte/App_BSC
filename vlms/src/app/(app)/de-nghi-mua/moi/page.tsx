import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { num } from '@/lib/money';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { RequisitionForm } from './requisition-form';

export const metadata: Metadata = { title: 'Tạo đề nghị mua' };

export default async function NewRequisitionPage({
  searchParams,
}: {
  searchParams: Promise<{ vatlieu?: string }>;
}) {
  const user = await requirePermission('requisition', 'create');
  const { vatlieu } = await searchParams;

  const project = await prisma.project.findFirst({
    where: { organizationId: user.organizationId, isActive: true },
    include: { wbsItems: { orderBy: { code: 'asc' } } },
    orderBy: { code: 'asc' },
  });

  if (!project) {
    return (
      <>
        <PageHeader title="Tạo đề nghị mua" />
        <div className="card">
          <EmptyState
            title="Chưa có dự án đang hoạt động"
            description="Cần có ít nhất một dự án kèm hạng mục WBS trước khi tạo đề nghị mua."
          />
        </div>
      </>
    );
  }

  const materials = await prisma.material.findMany({
    where: { isActive: true },
    include: { catalogItems: { where: { isPublished: true }, orderBy: { listPrice: 'asc' }, take: 1 } },
    orderBy: { code: 'asc' },
  });

  return (
    <>
      <PageHeader
        title="Tạo đề nghị mua"
        description="Đơn giá gợi ý lấy theo giá niêm yết tốt nhất trên sàn, chỉ để ước tính ngân sách."
      />
      <RequisitionForm
        projectId={project.id}
        projectName={`${project.code} — ${project.name}`}
        preselectedMaterialId={vatlieu}
        materials={materials.map((m) => ({
          id: m.id,
          code: m.code,
          name: m.name,
          uom: m.uom,
          suggestedPrice: m.catalogItems[0] ? num(m.catalogItems[0].listPrice) : 0,
        }))}
        wbsOptions={project.wbsItems.map((w) => ({
          id: w.id,
          code: w.code,
          name: w.name,
          available: num(w.budget) - num(w.committed),
        }))}
      />
    </>
  );
}
