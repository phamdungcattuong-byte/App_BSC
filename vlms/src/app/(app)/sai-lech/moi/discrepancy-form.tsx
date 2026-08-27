'use client';

import { useState } from 'react';
import type { DiscrepancyType } from '@prisma/client';
import { ActionForm } from '@/components/action-form';
import { DISCREPANCY_TYPE_LABEL, DISCREPANCY_TYPES } from '@/features/discrepancy/labels';
import { createDiscrepancyAction } from '../actions';

export interface ReceiptLineOption {
  id: string;
  label: string;
  uom: string;
  deliveredQty: number;
  acceptedQty: number;
  summary: string;
}

export function DiscrepancyForm({ lines }: { lines: ReceiptLineOption[] }) {
  const [lineId, setLineId] = useState(lines[0]?.id ?? '');
  const [type, setType] = useState<DiscrepancyType>('SHORTAGE');
  const line = lines.find((l) => l.id === lineId);

  // Trần số lượng theo đúng quy tắc của dịch vụ: hàng giao thừa lấy theo số giao,
  // các loại còn lại lấy theo số lớn hơn giữa số giao và số chấp nhận.
  const ceiling = line
    ? type === 'OVERAGE'
      ? line.deliveredQty
      : Math.max(line.deliveredQty, line.acceptedQty)
    : 0;

  return (
    <ActionForm action={createDiscrepancyAction} className="space-y-4">
      {(disabled) => (
        <div className="card max-w-2xl space-y-4 p-5">
          <div>
            <label className="label" htmlFor="grnLineId">
              Dòng nhận hàng
            </label>
            <select
              id="grnLineId"
              name="grnLineId"
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              className="input"
              required
            >
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            {line ? <p className="mt-1 text-xs text-slate-500">{line.summary}</p> : null}
          </div>

          <div>
            <label className="label" htmlFor="type">
              Loại sai lệch
            </label>
            <select
              id="type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as DiscrepancyType)}
              className="input"
            >
              {DISCREPANCY_TYPES.map((value) => (
                <option key={value} value={value}>
                  {DISCREPANCY_TYPE_LABEL[value]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="quantity">
              Số lượng sai lệch{line ? ` (${line.uom})` : ''}
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={0.001}
              step="any"
              max={ceiling}
              required
              className="input"
            />
            <p className="mt-1 text-xs text-slate-500">
              Không vượt quá {ceiling} {line?.uom ?? ''} của dòng nhận hàng này.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="description">
              Mô tả sai lệch
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              required
              className="input"
              placeholder="Thép D12 bị cong vênh, không đạt yêu cầu nghiệm thu tại công trường."
            />
          </div>

          <button type="submit" className="btn-primary" disabled={disabled || !line}>
            Ghi nhận sai lệch
          </button>
        </div>
      )}
    </ActionForm>
  );
}
