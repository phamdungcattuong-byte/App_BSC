'use client';

import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useHydrated } from '@/components/action-form';
import { createRequisitionAction, type ActionState } from '../actions';

export interface MaterialOption {
  id: string;
  code: string;
  name: string;
  uom: string;
  suggestedPrice: number;
}

export interface WbsOption {
  id: string;
  code: string;
  name: string;
  available: number;
}

interface Line {
  key: number;
  materialId: string;
  wbsId: string;
  quantity: string;
  estPrice: string;
}

export function RequisitionForm({
  projectId,
  projectName,
  materials,
  wbsOptions,
  preselectedMaterialId,
}: {
  projectId: string;
  projectName: string;
  materials: MaterialOption[];
  wbsOptions: WbsOption[];
  preselectedMaterialId?: string;
}) {
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const [navigating, setNavigating] = useState(false);
  const hydrated = useHydrated();
  const router = useRouter();
  const disabled = pending || navigating || !hydrated;

  useEffect(() => {
    if (state.redirectTo) {
      setNavigating(true);
      router.push(state.redirectTo);
    }
  }, [state.redirectTo, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => setState(await createRequisitionAction({}, formData)));
  }

  const firstMaterial =
    materials.find((m) => m.id === preselectedMaterialId) ?? materials[0];

  const [lines, setLines] = useState<Line[]>([
    {
      key: 1,
      materialId: firstMaterial?.id ?? '',
      wbsId: wbsOptions[0]?.id ?? '',
      quantity: '',
      estPrice: String(firstMaterial?.suggestedPrice ?? 0),
    },
  ]);

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // Đổi vật liệu thì gợi ý lại đơn giá theo giá tốt nhất trên sàn.
        if (patch.materialId) {
          const m = materials.find((x) => x.id === patch.materialId);
          if (m) next.estPrice = String(m.suggestedPrice);
        }
        return next;
      }),
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: Math.max(0, ...prev.map((l) => l.key)) + 1,
        materialId: materials[0]?.id ?? '',
        wbsId: wbsOptions[0]?.id ?? '',
        quantity: '',
        estPrice: String(materials[0]?.suggestedPrice ?? 0),
      },
    ]);
  }

  function removeLine(key: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  const total = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.estPrice) || 0),
    0,
  );

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="projectId" value={projectId} />

      <div className="card p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label">Dự án</span>
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{projectName}</p>
          </div>
          <div>
            <label className="label" htmlFor="neededBy">
              Cần hàng trước ngày
            </label>
            <input
              id="neededBy"
              name="neededBy"
              type="date"
              required
              defaultValue={tomorrow}
              min={tomorrow}
              className="input"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="label" htmlFor="note">
            Ghi chú
          </label>
          <input id="note" name="note" className="input" placeholder="Ví dụ: phục vụ đổ sàn tầng 3" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Danh sách vật tư</h2>
          <button type="button" onClick={addLine} className="btn-ghost">
            Thêm dòng
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="min-w-[220px]">Vật tư</th>
                <th className="min-w-[180px]">Hạng mục WBS</th>
                <th className="min-w-[110px]">Số lượng</th>
                <th className="min-w-[140px]">Đơn giá ước tính</th>
                <th className="num">Thành tiền</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const material = materials.find((m) => m.id === line.materialId);
                const amount = (Number(line.quantity) || 0) * (Number(line.estPrice) || 0);
                return (
                  <tr key={line.key}>
                    <td>
                      <select
                        name="materialId"
                        value={line.materialId}
                        onChange={(e) => updateLine(line.key, { materialId: e.target.value })}
                        className="input"
                        aria-label="Vật tư"
                      >
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.code} — {m.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        name="wbsId"
                        value={line.wbsId}
                        onChange={(e) => updateLine(line.key, { wbsId: e.target.value })}
                        className="input"
                        aria-label="Hạng mục WBS"
                      >
                        {wbsOptions.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.code} — {w.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        name="quantity"
                        type="number"
                        step="0.001"
                        min="0.001"
                        required
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        className="input"
                        aria-label="Số lượng"
                      />
                      <span className="mt-1 block text-xs text-slate-500">{material?.uom}</span>
                    </td>
                    <td>
                      <input
                        name="estPrice"
                        type="number"
                        step="1"
                        min="0"
                        required
                        value={line.estPrice}
                        onChange={(e) => updateLine(line.key, { estPrice: e.target.value })}
                        className="input"
                        aria-label="Đơn giá ước tính"
                      />
                    </td>
                    <td className="num tabular-nums">{amount.toLocaleString('vi-VN')} ₫</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="btn-ghost"
                        disabled={lines.length === 1}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right text-sm font-medium text-slate-700">
                  Tổng giá trị ước tính
                </td>
                <td className="num px-3 py-2 text-base font-semibold text-navy-800">
                  {total.toLocaleString('vi-VN')} ₫
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={disabled}>
          {pending ? 'Đang lưu...' : 'Lưu đề nghị mua'}
        </button>
      </div>
    </form>
  );
}
