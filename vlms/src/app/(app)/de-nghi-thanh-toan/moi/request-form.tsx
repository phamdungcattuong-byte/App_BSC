'use client';

import { useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { createPaymentRequestAction } from '../actions';

export interface PayableInvoice {
  id: string;
  code: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  issueDate: string;
  hasVerifiedAccount: boolean;
}

export function PaymentRequestForm({ invoices }: { invoices: PayableInvoice[] }) {
  const [selected, setSelected] = useState<string[]>([]);

  // Mỗi đề nghị chỉ gồm hóa đơn của một nhà cung cấp; khóa các NCC khác khi đã chọn.
  const lockedSupplier =
    selected.length > 0 ? invoices.find((i) => i.id === selected[0])?.supplierId : undefined;

  const total = invoices
    .filter((i) => selected.includes(i.id))
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <ActionForm action={createPaymentRequestAction} className="space-y-4">
      {(disabled) => (
        <>
          <div className="card overflow-hidden">
            <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
              Hóa đơn đã ghi sổ, chờ thanh toán
            </h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10" />
                    <th>Số hóa đơn</th>
                    <th>Nhà cung cấp</th>
                    <th>Ngày phát hành</th>
                    <th className="num">Số tiền</th>
                    <th>Tài khoản nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const blockedBySupplier =
                      lockedSupplier !== undefined && invoice.supplierId !== lockedSupplier;
                    const blocked = blockedBySupplier || !invoice.hasVerifiedAccount;

                    return (
                      <tr key={invoice.id} className={blocked ? 'opacity-50' : undefined}>
                        <td>
                          <input
                            type="checkbox"
                            name="invoiceId"
                            value={invoice.id}
                            className="h-4 w-4"
                            disabled={blocked}
                            checked={selected.includes(invoice.id)}
                            onChange={(e) =>
                              setSelected((prev) =>
                                e.target.checked
                                  ? [...prev, invoice.id]
                                  : prev.filter((id) => id !== invoice.id),
                              )
                            }
                            aria-label={`Chọn hóa đơn ${invoice.code}`}
                          />
                        </td>
                        <td className="font-mono text-xs">{invoice.code}</td>
                        <td>{invoice.supplierName}</td>
                        <td>{invoice.issueDate}</td>
                        <td className="num font-medium">
                          {invoice.amount.toLocaleString('vi-VN')} ₫
                        </td>
                        <td className="text-xs">
                          {invoice.hasVerifiedAccount ? (
                            <span className="text-emerald-700">Đã xác minh</span>
                          ) : (
                            <span className="text-amber-700">Chưa xác minh, không chi được</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right font-medium text-slate-700">
                      Tổng đề nghị
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

          <div className="card p-4">
            <label className="label" htmlFor="note">
              Ghi chú
            </label>
            <input id="note" name="note" className="input" placeholder="Thanh toán đợt 1 tháng 8" />
          </div>

          <button type="submit" className="btn-primary" disabled={disabled || selected.length === 0}>
            Lập đề nghị thanh toán
          </button>
          {lockedSupplier ? (
            <p className="text-xs text-slate-500">
              Đang chọn hóa đơn của một nhà cung cấp. Hóa đơn của nhà cung cấp khác tạm khóa vì mỗi
              đề nghị chỉ chi cho một bên nhận.
            </p>
          ) : null}
        </>
      )}
    </ActionForm>
  );
}
