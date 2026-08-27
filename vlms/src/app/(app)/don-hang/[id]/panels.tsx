'use client';

import { useState } from 'react';
import { ActionForm } from '@/components/action-form';
import {
  acknowledgePoAction,
  receiveGoodsAction,
  receiveInvoiceAction,
} from '../actions';

export interface LineOption {
  poLineId: string;
  materialName: string;
  materialCode: string;
  uom: string;
  orderedQty: number;
  receivedQty: number;
  invoicedQty: number;
  unitPrice: number;
}

export function AcknowledgePanel({ poId, canAck }: { poId: string; canAck: boolean }) {
  return (
    <ActionForm action={acknowledgePoAction}>
      {(disabled) => (
        <>
          <input type="hidden" name="poId" value={poId} />
          <button type="submit" className="btn-primary" disabled={disabled || !canAck}>
            Xác nhận đơn hàng
          </button>
          <p className="mt-2 text-xs text-slate-500">
            {canAck
              ? 'Xác nhận nghĩa là bạn chấp nhận số lượng, đơn giá và thời hạn giao trên đơn hàng.'
              : 'Đơn hàng này đã được xác nhận.'}
          </p>
        </>
      )}
    </ActionForm>
  );
}

export function ReceiveGoodsPanel({
  poId,
  lines,
  toleranceRate,
}: {
  poId: string;
  lines: LineOption[];
  toleranceRate: number;
}) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState<Record<string, { delivered: string; accepted: string }>>(
    Object.fromEntries(lines.map((l) => [l.poLineId, { delivered: '', accepted: '' }])),
  );

  return (
    <ActionForm action={receiveGoodsAction} className="space-y-4">
      {(disabled) => (
        <>
          <input type="hidden" name="poId" value={poId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Vật tư</th>
                  <th className="num">Còn phải nhận</th>
                  <th className="min-w-[130px]">Số lượng giao</th>
                  <th className="min-w-[130px]">Chấp nhận</th>
                  <th className="min-w-[160px]">Lý do nếu từ chối</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const remaining = l.orderedQty - l.receivedQty;
                  const maxAccept = l.orderedQty * (1 + toleranceRate) - l.receivedQty;
                  const v = values[l.poLineId] ?? { delivered: '', accepted: '' };
                  const overTolerance = Number(v.accepted) > maxAccept + 1e-9;

                  return (
                    <tr key={l.poLineId}>
                      <td>
                        <span className="font-medium text-slate-800">{l.materialName}</span>
                        <span className="block font-mono text-xs text-slate-500">
                          {l.materialCode}
                        </span>
                      </td>
                      <td className="num">
                        {remaining.toLocaleString('vi-VN')} {l.uom}
                        <span className="block text-xs text-slate-500">
                          tối đa {maxAccept.toLocaleString('vi-VN')} kể cả dung sai
                        </span>
                      </td>
                      <td>
                        <input type="hidden" name="poLineId" value={l.poLineId} />
                        <input
                          name="deliveredQty"
                          type="number"
                          step="0.001"
                          min="0"
                          value={v.delivered}
                          onChange={(e) =>
                            setValues((s) => ({
                              ...s,
                              [l.poLineId]: {
                                delivered: e.target.value,
                                // Mặc định chấp nhận đúng bằng số giao, người nhận sửa nếu có hàng lỗi.
                                accepted: e.target.value,
                              },
                            }))
                          }
                          className="input"
                          placeholder="0"
                          aria-label={`Số lượng giao ${l.materialName}`}
                        />
                      </td>
                      <td>
                        <input
                          name="acceptedQty"
                          type="number"
                          step="0.001"
                          min="0"
                          value={v.accepted}
                          onChange={(e) =>
                            setValues((s) => ({
                              ...s,
                              [l.poLineId]: { ...v, accepted: e.target.value },
                            }))
                          }
                          className={`input ${overTolerance ? 'border-red-400 bg-red-50' : ''}`}
                          placeholder="0"
                          aria-label={`Số lượng chấp nhận ${l.materialName}`}
                        />
                        {overTolerance ? (
                          <span className="mt-1 block text-xs text-red-600">
                            Vượt dung sai, hệ thống sẽ chặn
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <input
                          name="reason"
                          className="input"
                          placeholder="Hàng vỡ, sai quy cách..."
                          aria-label={`Lý do từ chối ${l.materialName}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="vehicleNo">
                Biển số xe giao hàng
              </label>
              <input id="vehicleNo" name="vehicleNo" className="input" placeholder="51C-123.45" />
            </div>
            <div>
              <label className="label" htmlFor="note">
                Ghi chú
              </label>
              <input id="note" name="note" className="input" placeholder="Giao đúng hẹn" />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={disabled}>
            {disabled ? 'Đang ghi nhận...' : 'Ghi nhận nhận hàng'}
          </button>
          <p className="text-xs text-slate-500">
            Hệ thống chặn nhận vượt số lượng đơn hàng ngoài dung sai{' '}
            {(toleranceRate * 100).toFixed(1)}%. Không có quyền ghi đè.
          </p>
        </>
      )}
    </ActionForm>
  );
}

export function InvoicePanel({ poId, lines }: { poId: string; lines: LineOption[] }) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [rows, setRows] = useState<Record<string, { qty: string; price: string }>>(
    Object.fromEntries(
      lines.map((l) => [
        l.poLineId,
        {
          // Mặc định lập hóa đơn theo số đã thực nhận và đơn giá trên đơn hàng.
          qty: String(Math.max(0, l.receivedQty - l.invoicedQty)),
          price: String(l.unitPrice),
        },
      ]),
    ),
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <ActionForm action={receiveInvoiceAction} className="space-y-4">
      {(disabled) => (
        <>
          <input type="hidden" name="poId" value={poId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="invoiceCode">
                Số hóa đơn
              </label>
              <input
                id="invoiceCode"
                name="invoiceCode"
                required
                className="input"
                placeholder="HD-00012345"
              />
            </div>
            <div>
              <label className="label" htmlFor="issueDate">
                Ngày phát hành
              </label>
              <input
                id="issueDate"
                name="issueDate"
                type="date"
                required
                defaultValue={today}
                className="input"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Vật tư</th>
                  <th className="num">Đã nhận</th>
                  <th className="num">Đã xuất hóa đơn</th>
                  <th className="min-w-[120px]">Số lượng</th>
                  <th className="min-w-[140px]">Đơn giá</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const r = rows[l.poLineId] ?? { qty: '0', price: '0' };
                  return (
                    <tr key={l.poLineId}>
                      <td>{l.materialName}</td>
                      <td className="num">
                        {l.receivedQty.toLocaleString('vi-VN')} {l.uom}
                      </td>
                      <td className="num">{l.invoicedQty.toLocaleString('vi-VN')}</td>
                      <td>
                        <input type="hidden" name="poLineId" value={l.poLineId} />
                        <input
                          name="quantity"
                          type="number"
                          step="0.001"
                          min="0"
                          value={r.qty}
                          onChange={(e) =>
                            setRows((s) => ({ ...s, [l.poLineId]: { ...r, qty: e.target.value } }))
                          }
                          className="input"
                          aria-label={`Số lượng hóa đơn ${l.materialName}`}
                        />
                      </td>
                      <td>
                        <input
                          name="unitPrice"
                          type="number"
                          step="1"
                          min="0"
                          value={r.price}
                          onChange={(e) =>
                            setRows((s) => ({ ...s, [l.poLineId]: { ...r, price: e.target.value } }))
                          }
                          className="input"
                          aria-label={`Đơn giá hóa đơn ${l.materialName}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="submit" className="btn-primary" disabled={disabled}>
            {disabled ? 'Đang đối chiếu...' : 'Tiếp nhận và đối chiếu ba chiều'}
          </button>
          <p className="text-xs text-slate-500">
            Hệ thống tự so khớp hóa đơn với đơn hàng và phiếu nhận hàng. Lệch ngoài dung sai thì
            hóa đơn bị đánh dấu sai lệch và không được ghi sổ.
          </p>
        </>
      )}
    </ActionForm>
  );
}
