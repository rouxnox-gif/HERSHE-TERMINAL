import React, { useState } from 'react';
import { Order } from '../types';
import { FileText, Printer, Trash2, Eye, X, AlertTriangle } from 'lucide-react';
import { formatTimeDisplay } from '../utils/storage';

interface ReceiptsHistoryViewProps {
  orders: Order[];
  onViewReceipt: (order: Order) => void;
  onDeleteOrder?: (orderId: string) => void;
}

export const ReceiptsHistoryView: React.FC<ReceiptsHistoryViewProps> = ({
  orders,
  onViewReceipt,
  onDeleteOrder,
}) => {
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);

  const confirmDelete = (orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletingOrderId(orderId);
  };

  const handleExecuteDelete = () => {
    if (deletingOrderId && onDeleteOrder) {
      onDeleteOrder(deletingOrderId);
      if (selectedOrderDetails?.orderId === deletingOrderId) {
        setSelectedOrderDetails(null);
      }
      setDeletingOrderId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-1.5 py-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="p-3 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Receipts Log History</h2>
              <p className="text-xs text-slate-400">Inspect, print, or manage thermal receipts for previous checkouts</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono font-bold border-b border-slate-800 text-[11px] sm:text-xs">
              <tr>
                <th className="px-2.5 sm:px-4 py-2.5 sm:py-3">Order ID</th>
                <th className="px-2.5 sm:px-4 py-2.5 sm:py-3">Payment Type</th>
                <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-right">Price</th>
                <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                    No receipt records logged yet.
                  </td>
                </tr>
              ) : (
                orders.map(o => (
                  <tr 
                    key={o.orderId} 
                    onClick={() => setSelectedOrderDetails(o)}
                    className="hover:bg-slate-800/40 transition cursor-pointer"
                  >
                    <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 font-mono font-bold text-emerald-400">{o.orderId}</td>
                    <td className="px-2.5 sm:px-4 py-2.5 sm:py-3">
                      <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 inline-block">
                        {o.paymentType}
                      </span>
                    </td>
                    <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-right font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                      ${o.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-center">
                      <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedOrderDetails(o)}
                          className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 transition cursor-pointer active:scale-95"
                          title="View receipt details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onViewReceipt(o)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold border border-slate-700 transition cursor-pointer active:scale-95"
                          title="Print thermal receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POP UP DETAILS MODAL FOR RECEIPTS */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono font-extrabold text-emerald-400 text-base">{selectedOrderDetails.orderId}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {selectedOrderDetails.paymentType}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{selectedOrderDetails.date} at {formatTimeDisplay(selectedOrderDetails.time)}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Order ID</div>
                  <div className="font-mono font-bold text-xs text-emerald-400 truncate">{selectedOrderDetails.orderId}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Payment</div>
                  <div className="font-bold text-xs text-slate-200 truncate">{selectedOrderDetails.paymentType}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Total Price</div>
                  <div className="font-mono font-bold text-xs text-emerald-400">${selectedOrderDetails.totalAmount.toFixed(2)}</div>
                </div>
              </div>

              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Itemized Purchased Products</div>
              <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/60 bg-slate-950">
                {selectedOrderDetails.items.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-100 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[10px] text-emerald-400 font-bold">{item.qty}x</span>
                        <span>{item.name}</span>
                      </div>
                      {item.addonString && item.addonString !== 'None' && (
                        <div className="text-[11px] text-emerald-400/80 font-medium pl-6">
                          + {item.addonString}
                        </div>
                      )}
                    </div>
                    <div className="font-mono font-bold text-slate-200">
                      ${item.lineTotal.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono">${selectedOrderDetails.subtotal.toFixed(2)}</span>
                </div>
                {selectedOrderDetails.discountValue > 0 && (
                  <div className="flex justify-between text-red-400 font-semibold">
                    <span>Discount applied:</span>
                    <span className="font-mono">-${selectedOrderDetails.discountValue.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                  <span>Total Paid:</span>
                  <span className="font-mono text-emerald-400">${selectedOrderDetails.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
              {onDeleteOrder && (
                <button
                  onClick={() => confirmDelete(selectedOrderDetails.orderId)}
                  className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => {
                    const ord = selectedOrderDetails;
                    setSelectedOrderDetails(null);
                    onViewReceipt(ord);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Thermal Receipt</span>
                </button>
                <button
                  onClick={() => setSelectedOrderDetails(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DIALOG MODAL */}
      {deletingOrderId && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Delete Receipt Record?</h3>
                <p className="text-xs text-slate-400 font-mono">Order ID: {deletingOrderId}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete this receipt record? It will be removed from your sales history and reports.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setDeletingOrderId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDelete}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-slate-950 font-black text-xs transition shadow-lg shadow-red-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
