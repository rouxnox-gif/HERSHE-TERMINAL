import React, { useState, useMemo } from 'react';
import { PendingOrder } from '../types';
import {
  Clock,
  CheckCircle2,
  XCircle,
  CheckCheck,
  Eye,
  X,
  FileText,
  User,
  Loader2,
  Phone,
  ShoppingBag,
  MessageSquare,
  Search,
  Layers,
  UserCheck,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { formatTimeDisplay } from '../utils/storage';
import { isPreOrder } from '../utils/orderUtils';

interface PendingApprovalsViewProps {
  pendingOrders: PendingOrder[];
  onApproveOrder: (pending: PendingOrder) => void;
  onRejectOrder: (orderId: string) => void;
  onApproveAll: () => void;
}

type ViewMode = 'split' | 'preorders' | 'approvals';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Categorize orders into Customer Pre-Orders vs Staff / POS Pending Approvals
  const preOrders = useMemo(() => {
    return pendingOrders.filter((p) => isPreOrder(p));
  }, [pendingOrders]);

  const staffApprovals = useMemo(() => {
    return pendingOrders.filter((p) => !isPreOrder(p));
  }, [pendingOrders]);

  // Financial subtotals
  const preOrdersTotal = useMemo(() => {
    return preOrders.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  }, [preOrders]);

  const staffApprovalsTotal = useMemo(() => {
    return staffApprovals.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  }, [staffApprovals]);

  const grandTotal = preOrdersTotal + staffApprovalsTotal;

  // Filter lists based on search query
  const matchesSearch = (order: PendingOrder, q: string): boolean => {
    if (!q) return true;
    const lowerQ = q.toLowerCase().trim();
    if (order.orderId.toLowerCase().includes(lowerQ)) return true;
    if (order.customerName && order.customerName.toLowerCase().includes(lowerQ)) return true;
    if (order.customerPhone && order.customerPhone.includes(lowerQ)) return true;
    if (order.staffName && order.staffName.toLowerCase().includes(lowerQ)) return true;
    if (order.source && order.source.toLowerCase().includes(lowerQ)) return true;
    if (order.itemsSummary && order.itemsSummary.toLowerCase().includes(lowerQ)) return true;
    if (order.paymentType && order.paymentType.toLowerCase().includes(lowerQ)) return true;
    if (order.pickupTime && order.pickupTime.toLowerCase().includes(lowerQ)) return true;
    if (order.items?.some((it) => it.name.toLowerCase().includes(lowerQ))) return true;
    return false;
  };

  const filteredPreOrders = useMemo(() => {
    return preOrders.filter((p) => matchesSearch(p, searchQuery));
  }, [preOrders, searchQuery]);

  const filteredStaffApprovals = useMemo(() => {
    return staffApprovals.filter((p) => matchesSearch(p, searchQuery));
  }, [staffApprovals, searchQuery]);

  // Single order actions
  const handleSingleApprove = async (order: PendingOrder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (processingIds.has(order.orderId)) return;

    setProcessingIds((prev) => new Set(prev).add(order.orderId));
    try {
      await onApproveOrder(order);
      if (selectedPending?.orderId === order.orderId) {
        setSelectedPending(null);
      }
      showToast(`Approved order #${order.orderId}`);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(order.orderId);
        return next;
      });
    }
  };

  const handleSingleReject = async (orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (processingIds.has(orderId)) return;

    setProcessingIds((prev) => new Set(prev).add(orderId));
    try {
      await onRejectOrder(orderId);
      if (selectedPending?.orderId === orderId) {
        setSelectedPending(null);
      }
      showToast(`Rejected order #${orderId}`);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // Batch approve specific subset (pre-orders or staff approvals)
  const handleBatchApproveSubset = async (ordersToApprove: PendingOrder[], label: string) => {
    if (ordersToApprove.length === 0 || isProcessingBatch) return;
    setIsProcessingBatch(true);
    try {
      const count = ordersToApprove.length;
      for (const order of ordersToApprove) {
        await onApproveOrder(order);
      }
      showToast(`Approved ${count} ${label}`);
    } catch (err) {
      console.error('Batch approval failed:', err);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // Global batch approve
  const handleBatchApproveAll = async () => {
    if (pendingOrders.length === 0 || isProcessingBatch) return;
    setIsProcessingBatch(true);
    try {
      const count = pendingOrders.length;
      await onApproveAll();
      showToast(`Approved all ${count} order${count !== 1 ? 's' : ''}`);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-2 py-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-extrabold px-5 py-3 rounded-2xl shadow-2xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP COMMAND HEADER */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Orders & Approvals
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                  {pendingOrders.length} Total
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Separated queues for customer pickup pre-orders and in-store cashier approvals
              </p>
            </div>
          </div>

          {/* Search & Global Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order, customer, drink..."
                className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={handleBatchApproveAll}
              disabled={pendingOrders.length === 0 || isProcessingBatch}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
              title="Approve all customer pre-orders and pending approvals at once"
            >
              {isProcessingBatch ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4 stroke-[2.5]" />
              )}
              <span>APPROVE ALL ({pendingOrders.length})</span>
            </button>
          </div>
        </div>

        {/* METRICS & QUICK FILTER CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Pre-Orders Card */}
          <div
            onClick={() => setViewMode(viewMode === 'preorders' ? 'split' : 'preorders')}
            className={`p-3.5 sm:p-4 rounded-xl border transition cursor-pointer relative overflow-hidden group ${
              viewMode === 'preorders'
                ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-950/50'
                : 'bg-slate-950/60 border-slate-800 hover:border-emerald-500/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
                      Customer Pre-Orders
                    </span>
                    {preOrders.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
                    {preOrders.length}
                    <span className="text-xs font-sans font-semibold text-slate-400 ml-1.5">
                      awaiting pickup
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Subtotal</span>
                <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                  ${preOrdersTotal.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Customer Portal & WhatsApp pick-up orders</span>
              <span className="text-emerald-400 font-bold group-hover:underline flex items-center gap-0.5">
                {viewMode === 'preorders' ? 'Showing Pre-Orders' : 'Filter Queue →'}
              </span>
            </div>
          </div>

          {/* Staff Pending Approvals Card */}
          <div
            onClick={() => setViewMode(viewMode === 'approvals' ? 'split' : 'approvals')}
            className={`p-3.5 sm:p-4 rounded-xl border transition cursor-pointer relative overflow-hidden group ${
              viewMode === 'approvals'
                ? 'bg-sky-950/40 border-sky-500 shadow-lg shadow-sky-950/50'
                : 'bg-slate-950/60 border-slate-800 hover:border-sky-500/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-sky-400 uppercase tracking-wider">
                      Pending Approvals
                    </span>
                    {staffApprovals.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    )}
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
                    {staffApprovals.length}
                    <span className="text-xs font-sans font-semibold text-slate-400 ml-1.5">
                      staff entries
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Subtotal</span>
                <span className="text-sm sm:text-base font-black text-sky-400 font-mono">
                  ${staffApprovalsTotal.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>POS counter sales, transfers & staff holds</span>
              <span className="text-sky-400 font-bold group-hover:underline flex items-center gap-0.5">
                {viewMode === 'approvals' ? 'Showing Approvals' : 'Filter Queue →'}
              </span>
            </div>
          </div>
        </div>

        {/* VIEW MODE TABS */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Separated View</span>
            </button>

            <button
              onClick={() => setViewMode('preorders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'preorders'
                  ? 'bg-emerald-500 text-slate-950 shadow font-extrabold'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Customer Pre-Orders ({preOrders.length})</span>
            </button>

            <button
              onClick={() => setViewMode('approvals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'approvals'
                  ? 'bg-sky-500 text-slate-950 shadow font-extrabold'
                  : 'text-slate-400 hover:text-sky-300'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Pending Approvals ({staffApprovals.length})</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span>Total Queue Value:</span>
            <span className="font-mono font-bold text-white">${grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: CUSTOMER PRE-ORDERS */}
      {(viewMode === 'split' || viewMode === 'preorders') && (
        <div className="rounded-2xl bg-slate-900 border border-emerald-500/30 overflow-hidden shadow-xl">
          {/* Section Header */}
          <div className="p-3.5 sm:p-5 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-b border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white">
                    Customer Pre-Orders
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {preOrders.length}
                  </span>
                </div>
                <p className="text-xs text-emerald-400/80">
                  Customer pickup orders via Customer Portal & WhatsApp
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs font-mono font-bold text-emerald-400 mr-2">
                ${preOrdersTotal.toFixed(2)}
              </span>
              <button
                onClick={() => handleBatchApproveSubset(preOrders, 'Pre-Orders')}
                disabled={preOrders.length === 0 || isProcessingBatch}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10"
              >
                <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Approve All Pre-Orders ({preOrders.length})</span>
              </button>
            </div>
          </div>

          {/* Pre-Orders Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono font-bold border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="px-3 sm:px-4 py-3">Order & Pickup</th>
                  <th className="px-3 sm:px-4 py-3">Customer & Contact</th>
                  <th className="px-3 sm:px-4 py-3">Drinks & Add-ons</th>
                  <th className="px-3 sm:px-4 py-3">Payment & Note</th>
                  <th className="px-3 sm:px-4 py-3 text-right">Total</th>
                  <th className="px-3 sm:px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredPreOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="max-w-sm mx-auto space-y-2">
                        <ShoppingBag className="w-8 h-8 mx-auto text-slate-600" />
                        <p className="text-slate-300 font-bold text-sm">
                          {searchQuery
                            ? `No pre-orders match "${searchQuery}"`
                            : 'No customer pre-orders waiting right now! 🥤'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Incoming customer online and pickup pre-orders will appear here immediately.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPreOrders.map((p) => {
                    const isProcessing = processingIds.has(p.orderId);
                    const cleanPhone = (p.customerPhone || '').replace(/[^0-9]/g, '');

                    return (
                      <tr
                        key={p.orderId}
                        onClick={() => setSelectedPending(p)}
                        className="hover:bg-slate-800/40 transition cursor-pointer"
                      >
                        {/* Order ID & Pickup Time */}
                        <td className="px-3 sm:px-4 py-3">
                          <div className="space-y-1">
                            <span className="font-mono font-bold text-amber-400 block">
                              #{p.orderId}
                            </span>
                            {p.pickupTime ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                                <Clock className="w-3 h-3 text-emerald-400" />
                                <span>Pickup: {p.pickupTime}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {p.date} • {formatTimeDisplay(p.time)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Customer & Contact */}
                        <td className="px-3 sm:px-4 py-3">
                          <div className="space-y-1">
                            <div className="font-extrabold text-white text-xs flex items-center gap-1.5">
                              <span>{p.customerName || 'Customer Pre-Order'}</span>
                            </div>
                            {p.customerPhone && (
                              <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                                <Phone className="w-3 h-3 shrink-0" />
                                <span>{p.customerPhone}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Drinks & Add-ons */}
                        <td className="px-3 sm:px-4 py-3">
                          <div className="max-w-xs space-y-1">
                            <p className="text-slate-200 text-xs line-clamp-2">
                              {p.itemsSummary ||
                                p.items?.map((it) => `${it.qty}x ${it.name}`).join(', ')}
                            </p>
                            {p.items?.some((it) => it.oat || it.protein || it.addonString) && (
                              <div className="flex flex-wrap gap-1">
                                {p.items.map((it, idx) => {
                                  if (!it.oat && !it.protein && !it.addonString) return null;
                                  return (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 text-[10px] font-bold"
                                    >
                                      {it.name}: {it.addonString || (it.oat ? 'Oat' : 'Protein')}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Payment & Customer Notes */}
                        <td className="px-3 sm:px-4 py-3">
                          <div className="space-y-1">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 inline-block">
                              {p.paymentType}
                            </span>
                            {p.customerNotes && (
                              <p className="text-[11px] text-amber-300/90 italic line-clamp-1">
                                "{p.customerNotes}"
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Price */}
                        <td className="px-3 sm:px-4 py-3 text-right font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                          ${p.totalAmount.toFixed(2)}
                        </td>

                        {/* Actions */}
                        <td className="px-3 sm:px-4 py-3 text-center">
                          <div
                            className="flex items-center justify-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
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
                              className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 transition cursor-pointer"
                              title="View full order details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleSingleApprove(p, e)}
                              disabled={isProcessing}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs transition flex items-center gap-1 cursor-pointer"
                              title="Approve pre-order & prepare"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Approve</span>
                            </button>

                            <button
                              onClick={(e) => handleSingleReject(p.orderId, e)}
                              disabled={isProcessing}
                              className="px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 text-red-400 border border-red-500/30 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                              title="Reject pre-order"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              <span>Reject</span>
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
      )}

      {/* SECTION 2: STAFF & POS PENDING APPROVALS */}
      {(viewMode === 'split' || viewMode === 'approvals') && (
        <div className="rounded-2xl bg-slate-900 border border-sky-500/30 overflow-hidden shadow-xl">
          {/* Section Header */}
          <div className="p-3.5 sm:p-5 bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-900 border-b border-sky-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white">
                    Staff & In-Store Pending Approvals
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {staffApprovals.length}
                  </span>
                </div>
                <p className="text-xs text-sky-400/80">
                  Cashier register sales, Binti Gym transfers, and held in-store orders
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs font-mono font-bold text-sky-400 mr-2">
                ${staffApprovalsTotal.toFixed(2)}
              </span>
              <button
                onClick={() => handleBatchApproveSubset(staffApprovals, 'Staff Approvals')}
                disabled={staffApprovals.length === 0 || isProcessingBatch}
                className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-sky-500/10"
              >
                <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Approve All Staff ({staffApprovals.length})</span>
              </button>
            </div>
          </div>

          {/* Staff Approvals Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono font-bold border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="px-3 sm:px-4 py-3">Order ID & Time</th>
                  <th className="px-3 sm:px-4 py-3">Cashier / Staff</th>
                  <th className="px-3 sm:px-4 py-3">Customer / Source</th>
                  <th className="px-3 sm:px-4 py-3">Payment Method</th>
                  <th className="px-3 sm:px-4 py-3">Items Summary</th>
                  <th className="px-3 sm:px-4 py-3 text-right">Price</th>
                  <th className="px-3 sm:px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredStaffApprovals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="max-w-sm mx-auto space-y-2">
                        <CheckCheck className="w-8 h-8 mx-auto text-slate-600" />
                        <p className="text-slate-300 font-bold text-sm">
                          {searchQuery
                            ? `No staff orders match "${searchQuery}"`
                            : 'No pending staff approvals at the moment! ✨'}
                        </p>
                        <p className="text-xs text-slate-500">
                          All staff cashier sales and held counter entries have been reviewed.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStaffApprovals.map((p) => {
                    const isProcessing = processingIds.has(p.orderId);
                    const staffDisplayName =
                      p.staffName ||
                      (p.source ? p.source.replace(/^Staff\s*\((.*)\)$/i, '$1') : 'Cashier');

                    return (
                      <tr
                        key={p.orderId}
                        onClick={() => setSelectedPending(p)}
                        className="hover:bg-slate-800/40 transition cursor-pointer"
                      >
                        {/* Order ID & Time */}
                        <td className="px-3 sm:px-4 py-3">
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-amber-400 block">
                              #{p.orderId}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {p.date} • {formatTimeDisplay(p.time)}
                            </span>
                          </div>
                        </td>

                        {/* Cashier / Staff */}
                        <td className="px-3 sm:px-4 py-3">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-500/10 text-sky-300 border border-sky-500/20 inline-flex items-center gap-1.5">
                            <User className="w-3 h-3 text-sky-400 shrink-0" />
                            <span>{staffDisplayName}</span>
                          </span>
                        </td>

                        {/* Customer / Source */}
                        <td className="px-3 sm:px-4 py-3 text-slate-300">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-200 block">
                              {p.customerName || 'Walk-in Customer'}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {p.source || 'POS Terminal'}
                            </span>
                          </div>
                        </td>

                        {/* Payment Method */}
                        <td className="px-3 sm:px-4 py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-block border ${
                              p.paymentType === 'Binti Gym Transfer'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-extrabold'
                                : p.paymentType?.includes('Bank')
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {p.paymentType}
                          </span>
                        </td>

                        {/* Items Summary */}
                        <td className="px-3 sm:px-4 py-3 text-slate-200">
                          <span className="line-clamp-2 max-w-xs text-xs">
                            {p.itemsSummary ||
                              p.items?.map((it) => `${it.qty}x ${it.name}`).join(', ')}
                          </span>
                        </td>

                        {/* Price */}
                        <td className="px-3 sm:px-4 py-3 text-right font-mono font-bold text-sky-400 text-xs sm:text-sm">
                          ${p.totalAmount.toFixed(2)}
                        </td>

                        {/* Actions */}
                        <td className="px-3 sm:px-4 py-3 text-center">
                          <div
                            className="flex items-center justify-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => setSelectedPending(p)}
                              className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 transition cursor-pointer"
                              title="View order details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleSingleApprove(p, e)}
                              disabled={isProcessing}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs transition flex items-center gap-1 cursor-pointer"
                              title="Approve order & finalize sale"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Approve</span>
                            </button>

                            <button
                              onClick={(e) => handleSingleReject(p.orderId, e)}
                              disabled={isProcessing}
                              className="px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 text-red-400 border border-red-500/30 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                              title="Reject and cancel"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              <span>Reject</span>
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
      )}

      {/* POP UP DETAILS MODAL FOR ORDER */}
      {selectedPending && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl border ${
                    isPreOrder(selectedPending)
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                  }`}
                >
                  {isPreOrder(selectedPending) ? (
                    <ShoppingBag className="w-5 h-5" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono font-extrabold text-amber-400 text-base">
                      #{selectedPending.orderId}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        isPreOrder(selectedPending)
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                      }`}
                    >
                      {isPreOrder(selectedPending) ? 'Customer Pre-Order' : 'Staff Approval'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {selectedPending.date} at {formatTimeDisplay(selectedPending.time)} • Source:{' '}
                    {selectedPending.source}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPending(null)}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* If Customer Pre-Order, show high-visibility customer card */}
              {isPreOrder(selectedPending) && (
                <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-300 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Pre-Order Pickup Details
                    </span>
                    {selectedPending.customerPhone && (
                      <a
                        href={`https://wa.me/${selectedPending.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Hi ${selectedPending.customerName || ''}! This is HERSHE Drinks regarding your pre-order #${selectedPending.orderId}.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center gap-1 border border-emerald-500/30 transition"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Chat WhatsApp</span>
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px]">
                    <div>
                      <span className="text-slate-500 font-bold block">Customer:</span>
                      <span className="font-extrabold text-white">
                        {selectedPending.customerName || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block">Pickup Time:</span>
                      <span className="font-extrabold text-emerald-400">
                        {selectedPending.pickupTime || 'ASAP'}
                      </span>
                    </div>
                    {selectedPending.customerPhone && (
                      <div className="col-span-2">
                        <span className="text-slate-500 font-bold block">WhatsApp Number:</span>
                        <span className="font-mono text-white">
                          {selectedPending.customerPhone}
                        </span>
                      </div>
                    )}
                    {selectedPending.customerNotes && (
                      <div className="col-span-2 pt-1 border-t border-emerald-500/20">
                        <span className="text-slate-500 font-bold block">Customer Note:</span>
                        <span className="italic text-emerald-200">
                          "{selectedPending.customerNotes}"
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* If Staff Order, show staff cashier card */}
              {!isPreOrder(selectedPending) && selectedPending.staffName && (
                <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-500/30 space-y-1.5 text-xs">
                  <span className="font-extrabold text-sky-300 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    Cashier & POS Verification
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 font-bold block">Submitted By Staff:</span>
                      <span className="font-bold text-white">{selectedPending.staffName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block">Customer Reference:</span>
                      <span className="font-bold text-slate-200">
                        {selectedPending.customerName || 'Walk-in Customer'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Key Summary Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Order ID</div>
                  <div className="font-mono font-bold text-xs text-amber-400 truncate">
                    #{selectedPending.orderId}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Payment</div>
                  <div className="font-bold text-xs text-slate-200 truncate">
                    {selectedPending.paymentType}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Price</div>
                  <div className="font-mono font-bold text-xs text-emerald-400">
                    ${selectedPending.totalAmount.toFixed(2)}
                  </div>
                </div>
              </div>

              {selectedPending.paymentType === 'Binti Gym Transfer' && (
                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-200 text-xs flex items-center justify-between">
                  <span className="font-bold text-purple-300">Binti Gym Transfer</span>
                  <span className="text-[11px] font-semibold text-purple-200">
                    Recorded as Cash upon approval
                  </span>
                </div>
              )}

              {/* Ordered Items List */}
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Ordered Items
              </div>
              <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/60 bg-slate-950">
                {selectedPending.items?.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-100 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[10px] text-amber-400 font-bold">
                          {item.qty}x
                        </span>
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
                  <span className="font-mono text-emerald-400">
                    ${selectedPending.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
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
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
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
