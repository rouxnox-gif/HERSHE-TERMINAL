import React, { useState } from 'react';
import { PendingOrder } from '../types';
import { Clock, CheckCircle2, XCircle, CheckCheck, Eye, X, FileText, User, Loader2, Phone, ShoppingBag, MessageSquare } from 'lucide-react';
import { formatTimeDisplay } from '../utils/storage';

interface PendingApprovalsViewProps {
  pendingOrders: PendingOrder[];
  onApproveOrder: (pending: PendingOrder) => void;
  onRejectOrder: (orderId: string) => void;
  onApproveAll: () => void;
}

export const PendingApprovalsView: React.FC<PendingApprovalsViewProps> = ({
  pendingOrders,
  onApproveOrder,
  onRejectOrder,
  onApproveAll,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedPending, setSelectedPending] = useState<PendingOrder | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSingleApprove = async (order: PendingOrder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (processingIds.has(order.orderId)) return;

    setProcessingIds(prev => new Set(prev).add(order.orderId));
    try {
      await onApproveOrder(order);
      if (selectedPending?.orderId === order.orderId) {
        setSelectedPending(null);
      }
      showToast(`Approved order ${order.orderId}`);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(order.orderId);
        return next;
      });
    }
  };

  const handleSingleReject = async (orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (processingIds.has(orderId)) return;

    setProcessingIds(prev => new Set(prev).add(orderId));
    try {
      await onRejectOrder(orderId);
      if (selectedPending?.orderId === orderId) {
        setSelectedPending(null);
      }
      showToast(`Rejected order ${orderId}`);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleBatchApprove = async () => {
    if (pendingOrders.length === 0 || isProcessingBatch) return;
    setIsProcessingBatch(true);
    try {
      const count = pendingOrders.length;
      await onApproveAll();
      showToast(`Approved ${count} order${count !== 1 ? 's' : ''}`);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-1.5 py-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-extrabold px-5 py-3 rounded-xl shadow-2xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="p-3 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Pending Approvals & Pre-Orders</h2>
              <p className="text-xs text-slate-400">Review and approve customer WhatsApp pre-orders and staff orders</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchApprove}
              disabled={pendingOrders.length === 0 || isProcessingBatch}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              {isProcessingBatch ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4" />
              )}
              APPROVE ALL ({pendingOrders.length})
            </button>
          </div>
        </div>

        {/* Streamlined Table: Shows Order ID, Staff/Customer Name, Payment Type, Price */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono font-bold border-b border-slate-800 text-[11px] sm:text-xs">
              <tr>
                <th className="px-2.5 sm:px-4 py-2.5 sm:py-3">Order ID</th>
                <th className="px-2.5 sm:px-4 py-2.5 sm:py-3">Source / Customer</th>
                <th className="px-2.5 sm:px-4 py-2.5 sm:py-3">Payment Type</th>
                <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-right">Price</th>
                <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {pendingOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    No pending pre-orders or approvals at the moment. All caught up! 🥤
                  </td>
                </tr>
              ) : (
                pendingOrders.map(p => {
                  const isProcessing = processingIds.has(p.orderId);
                  const isCustomerPreOrder = Boolean(p.customerName || p.source?.includes('Customer') || p.source?.includes('WhatsApp'));
                  const cleanPhone = (p.customerPhone || '').replace(/[^0-9]/g, '');

                  return (
                    <tr 
                      key={p.orderId}
                      onClick={() => setSelectedPending(p)}
                      className="hover:bg-slate-800/40 transition cursor-pointer"
                    >
                      <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 font-mono font-bold text-amber-400">
                        <div className="flex items-center gap-1.5">
                          <span>{p.orderId}</span>
                          {p.pickupTime && (
                            <span className="text-[10px] text-emerald-400 font-sans font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                              🕒 {p.pickupTime}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2.5 sm:px-4 py-2.5 sm:py-3">
                        {isCustomerPreOrder ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                              <ShoppingBag className="w-3 h-3 text-emerald-400 shrink-0" />
                              {p.customerName || 'Customer Pre-Order'}
                            </span>
                            {p.customerPhone && (
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 pl-1">
                                <Phone className="w-2.5 h-2.5 text-emerald-400" />
                                <span>{p.customerPhone}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-sky-500/10 text-sky-300 border border-sky-500/20 inline-flex items-center gap-1">
                            <User className="w-3 h-3 text-sky-400 shrink-0" />
                            {p.source ? p.source.replace(/^Staff\s*\((.*)\)$/i, '$1') : 'Staff'}
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 sm:px-4 py-2.5 sm:py-3">
                        <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold inline-block border
                          ${p.paymentType === 'Binti Gym Transfer'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-extrabold'
                            : p.paymentType?.includes('Bank')
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                          }
                        `}>
                          {p.paymentType}
                        </span>
                      </td>
                      <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-right font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                        ${p.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                                `Hi ${p.customerName || 'there'}! Your HERSHE Drinks pre-order #${p.orderId} is being prepared! 🥤`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition cursor-pointer"
                              title="Chat with customer on WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <button
                            onClick={() => setSelectedPending(p)}
                            className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 transition cursor-pointer active:scale-95"
                            title="View order details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleSingleApprove(p, e)}
                            disabled={isProcessing}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs transition flex items-center gap-1 cursor-pointer"
                            title="Approve order & deduct stock"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={(e) => handleSingleReject(p.orderId, e)}
                            disabled={isProcessing}
                            className="px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 text-red-400 border border-red-500/30 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                            title="Reject order"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POP UP DETAILS MODAL FOR PENDING ORDER */}
      {selectedPending && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono font-extrabold text-amber-400 text-base">{selectedPending.orderId}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border
                      ${selectedPending.paymentType === 'Binti Gym Transfer'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-extrabold'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                      }
                    `}>
                      {selectedPending.paymentType}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{selectedPending.date} at {formatTimeDisplay(selectedPending.time)} • Source: {selectedPending.source}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPending(null)}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* Customer pre-order details card if applicable */}
              {(selectedPending.customerName || selectedPending.customerPhone || selectedPending.pickupTime) && (
                <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-300 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Customer Pre-Order Details
                    </span>
                    {selectedPending.customerPhone && (
                      <a
                        href={`https://wa.me/${selectedPending.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Hi ${selectedPending.customerName || ''}! This is HERSHE Drinks regarding your pre-order #${selectedPending.orderId}.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[10px] flex items-center gap-1 border border-emerald-500/30"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Chat Customer</span>
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px]">
                    <div>
                      <span className="text-slate-500 font-bold block">Customer Name:</span>
                      <span className="font-extrabold text-white">{selectedPending.customerName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block">Pickup Time:</span>
                      <span className="font-extrabold text-emerald-400">{selectedPending.pickupTime || 'N/A'}</span>
                    </div>
                    {selectedPending.customerPhone && (
                      <div className="col-span-2">
                        <span className="text-slate-500 font-bold block">WhatsApp Number:</span>
                        <span className="font-mono text-white">{selectedPending.customerPhone}</span>
                      </div>
                    )}
                    {selectedPending.customerNotes && (
                      <div className="col-span-2 pt-1 border-t border-emerald-500/20">
                        <span className="text-slate-500 font-bold block">Customer Note:</span>
                        <span className="italic text-emerald-200">{selectedPending.customerNotes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Order ID</div>
                  <div className="font-mono font-bold text-xs text-amber-400 truncate">{selectedPending.orderId}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Payment</div>
                  <div className="font-bold text-xs text-slate-200 truncate">{selectedPending.paymentType}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Price</div>
                  <div className="font-mono font-bold text-xs text-emerald-400">${selectedPending.totalAmount.toFixed(2)}</div>
                </div>
              </div>

              {selectedPending.paymentType === 'Binti Gym Transfer' && (
                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-200 text-xs flex items-center justify-between">
                  <span className="font-bold text-purple-300">Binti Gym Transfer Notice</span>
                  <span className="text-[11px] font-semibold text-purple-200">Will be recorded as Cash on approval</span>
                </div>
              )}

              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ordered Items</div>
              <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/60 bg-slate-950">
                {selectedPending.items.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-100 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[10px] text-amber-400 font-bold">{item.qty}x</span>
                        <span>{item.name}</span>
                      </div>
                      {item.addonString && item.addonString !== 'None' && (
                        <div className="text-[11px] text-emerald-400/80 font-medium pl-6">
                          + {item.addonString}
                        </div>
                      )}
                    </div>
                    <div className="font-mono font-bold text-slate-200">
                      ${(item.lineTotal || item.price * item.qty).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-base font-extrabold text-white">
                  <span>Total Amount Due:</span>
                  <span className="font-mono text-emerald-400">${selectedPending.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={(e) => handleSingleReject(selectedPending.orderId, e)}
                disabled={processingIds.has(selectedPending.orderId)}
                className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 text-red-400 border border-red-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                {processingIds.has(selectedPending.orderId) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                <span>Reject Order</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleSingleApprove(selectedPending, e)}
                  disabled={processingIds.has(selectedPending.orderId)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  {processingIds.has(selectedPending.orderId) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Approve & Deduct Stock</span>
                </button>
                <button
                  onClick={() => setSelectedPending(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

