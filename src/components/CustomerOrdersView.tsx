import React, { useState, useMemo } from 'react';
import { Order, PendingOrder, StoreInfoSettings, PaymentMethod, PaymentTypeConfig } from '../types';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  Search,
  Calendar,
  Filter,
  CheckSquare,
  Square,
  User,
  Coffee,
  Sparkles,
  AlertCircle,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  DollarSign,
  CreditCard,
  X,
  Check,
} from 'lucide-react';
import { formatTimeDisplay } from '../utils/storage';
import { getBruneiDateString } from '../data/initialData';
import { DEFAULT_PAYMENT_CONFIGS } from '../db/repositories/appSettingsRepo';

export interface UnifiedCustomerOrder {
  orderId: string;
  date: string;
  time: string;
  customerName?: string;
  customerPhone?: string;
  customerNotes?: string;
  totalAmount: number;
  paymentType?: string;
  paymentStatus?: 'paid' | 'unpaid';
  isUnpaid: boolean;
  settledPaymentType?: string;
  settledAt?: string;
  settledStaffName?: string;
  cashTendered?: number;
  changeDue?: number;
  fulfillmentStatus: 'pending' | 'completed';
  fulfilledAt?: string;
  sourceType: 'order' | 'pending';
  staffName?: string;
  items: {
    name: string;
    qty: number;
    addonString?: string;
    lineTotal?: number;
  }[];
  originalOrder?: Order;
  originalPending?: PendingOrder;
}

interface CustomerOrdersViewProps {
  orders: Order[];
  pendingOrders: PendingOrder[];
  onToggleFulfillment: (orderId: string, currentStatus: 'pending' | 'completed') => Promise<void>;
  onSettlePayment?: (orderId: string, paymentType: PaymentMethod, cashTendered?: number, changeDue?: number) => Promise<void>;
  storeInfo?: StoreInfoSettings;
  paymentConfigs?: PaymentTypeConfig[];
}

export const CustomerOrdersView: React.FC<CustomerOrdersViewProps> = ({
  orders,
  pendingOrders,
  onToggleFulfillment,
  onSettlePayment,
  storeInfo,
  paymentConfigs,
}) => {
  const [filterStatus, setFilterStatus] = useState<'pending' | 'completed' | 'unpaid' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(() => getBruneiDateString());
  const [showAllDates, setShowAllDates] = useState<boolean>(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Pay Later settlement modal state
  const [settlingOrder, setSettlingOrder] = useState<UnifiedCustomerOrder | null>(null);
  const [settlePaymentType, setSettlePaymentType] = useState<PaymentMethod>('Cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState<boolean>(false);
  const [settleSuccessMessage, setSettleSuccessMessage] = useState<string | null>(null);

  const todayDate = useMemo(() => getBruneiDateString(), []);

  // Available settlement payment methods (excluding 'Pay Later' itself)
  const availablePaymentMethods = useMemo(() => {
    const list = paymentConfigs || DEFAULT_PAYMENT_CONFIGS;
    return list.filter((p) => p.enabled && p.name !== 'Pay Later');
  }, [paymentConfigs]);

  // Unify Order and PendingOrder records into a clean, deduplicated order list
  const unifiedOrders: UnifiedCustomerOrder[] = useMemo(() => {
    const map = new Map<string, UnifiedCustomerOrder>();

    // 1. Process completed sales orders
    for (const ord of orders) {
      if (ord.isDeleted) continue;
      
      const items = (ord.items || []).map((it) => ({
        name: it.name || 'Drink',
        qty: it.qty || 1,
        addonString: it.addonString && it.addonString !== 'None' ? it.addonString : undefined,
        lineTotal: it.lineTotal,
      }));

      // Extract customer name if stored or formatted in staff attribution
      let custName = ord.customerName;
      if (!custName && ord.staffName && ord.staffName.toLowerCase().startsWith('customer')) {
        const match = ord.staffName.match(/Customer\s*\((.*?)\)/i);
        if (match && match[1]) {
          custName = match[1].trim();
        }
      }

      const isUnpaid = ord.paymentStatus === 'unpaid' || ord.paymentType === 'Pay Later';

      map.set(ord.orderId, {
        orderId: ord.orderId,
        date: ord.date || todayDate,
        time: ord.time || '',
        customerName: custName,
        customerPhone: ord.customerPhone,
        customerNotes: ord.customerNotes,
        totalAmount: ord.totalAmount || 0,
        paymentType: ord.paymentType,
        paymentStatus: isUnpaid ? 'unpaid' : 'paid',
        isUnpaid,
        settledPaymentType: ord.settledPaymentType,
        settledAt: ord.settledAt,
        settledStaffName: ord.settledStaffName,
        cashTendered: ord.cashTendered,
        changeDue: ord.changeDue,
        fulfillmentStatus: ord.fulfillmentStatus === 'completed' ? 'completed' : 'pending',
        fulfilledAt: ord.fulfilledAt,
        sourceType: 'order',
        staffName: ord.staffName,
        items,
        originalOrder: ord,
      });
    }

    // 2. Process pending orders (staff orders or pre-orders)
    for (const p of pendingOrders) {
      if (p.isDeleted) continue;
      
      // If already present from orders, completed sales take precedence
      if (map.has(p.orderId)) {
        continue;
      }

      const items = (p.items || []).map((it) => ({
        name: it.name || 'Drink',
        qty: it.qty || 1,
        addonString: it.addonString && it.addonString !== 'None' ? it.addonString : undefined,
        lineTotal: it.lineTotal,
      }));

      let custName = p.customerName;
      if (!custName && p.staffName && p.staffName.toLowerCase().startsWith('customer')) {
        const match = p.staffName.match(/Customer\s*\((.*?)\)/i);
        if (match && match[1]) {
          custName = match[1].trim();
        }
      }

      const isUnpaid = p.paymentStatus === 'unpaid' || p.paymentType === 'Pay Later';

      map.set(p.orderId, {
        orderId: p.orderId,
        date: p.date || todayDate,
        time: p.time || '',
        customerName: custName,
        customerPhone: p.customerPhone,
        customerNotes: p.customerNotes,
        totalAmount: p.totalAmount || 0,
        paymentType: p.paymentType,
        paymentStatus: isUnpaid ? 'unpaid' : 'paid',
        isUnpaid,
        settledPaymentType: p.settledPaymentType,
        settledAt: p.settledAt,
        settledStaffName: p.settledStaffName,
        cashTendered: p.cashTendered,
        changeDue: p.changeDue,
        fulfillmentStatus: p.fulfillmentStatus === 'completed' ? 'completed' : 'pending',
        fulfilledAt: p.fulfilledAt,
        sourceType: 'pending',
        staffName: p.staffName,
        items,
        originalPending: p,
      });
    }

    // Sort: Unpaid and pending first, then newest time to oldest
    return Array.from(map.values()).sort((a, b) => {
      // Unpaid pending tabs get top priority
      if (a.isUnpaid !== b.isUnpaid) {
        return a.isUnpaid ? -1 : 1;
      }
      // If one is pending and one is completed, pending comes first
      if (a.fulfillmentStatus !== b.fulfillmentStatus) {
        return a.fulfillmentStatus === 'pending' ? -1 : 1;
      }
      // Otherwise sort newest date & time first
      const dtA = `${a.date} ${a.time}`;
      const dtB = `${b.date} ${b.time}`;
      return dtB.localeCompare(dtA);
    });
  }, [orders, pendingOrders, todayDate]);

  // Orders filtered by the chosen date (default: today)
  const dateScopedOrders = useMemo(() => {
    if (showAllDates) return unifiedOrders;
    return unifiedOrders.filter((o) => o.date === selectedDate);
  }, [unifiedOrders, selectedDate, showAllDates]);

  // Counts based on the current date scope
  const counts = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let unpaid = 0;
    for (const o of dateScopedOrders) {
      if (o.fulfillmentStatus === 'completed') {
        completed++;
      } else {
        pending++;
      }
      if (o.isUnpaid) {
        unpaid++;
      }
    }
    return {
      all: dateScopedOrders.length,
      pending,
      completed,
      unpaid,
    };
  }, [dateScopedOrders]);

  // Filtered by status and search query
  const displayedOrders = useMemo(() => {
    let list = dateScopedOrders;

    // Filter by status
    if (filterStatus === 'pending') {
      list = list.filter((o) => o.fulfillmentStatus === 'pending');
    } else if (filterStatus === 'completed') {
      list = list.filter((o) => o.fulfillmentStatus === 'completed');
    } else if (filterStatus === 'unpaid') {
      list = list.filter((o) => o.isUnpaid);
    }

    // Filter by search query
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter((o) => {
        return (
          o.orderId.toLowerCase().includes(q) ||
          (o.customerName && o.customerName.toLowerCase().includes(q)) ||
          (o.customerPhone && o.customerPhone.includes(q)) ||
          (o.customerNotes && o.customerNotes.toLowerCase().includes(q)) ||
          o.items.some(
            (it) =>
              it.name.toLowerCase().includes(q) ||
              (it.addonString && it.addonString.toLowerCase().includes(q))
          )
        );
      });
    }

    return list;
  }, [dateScopedOrders, filterStatus, searchQuery]);

  const handleToggle = async (orderId: string, currentStatus: 'pending' | 'completed') => {
    try {
      setTogglingId(orderId);
      await onToggleFulfillment(orderId, currentStatus);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-2 sm:px-4 md:px-6 py-2 sm:py-4 md:py-6 space-y-4">
      {/* Top Header Card */}
      <div className="p-3 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-extrabold text-white tracking-tight">
                  Customer Orders
                </h1>
                {counts.pending > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 animate-pulse">
                    {counts.pending} to prepare
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Staff drink preparation checklist • Real-time offline & multi-terminal sync
              </p>
            </div>
          </div>

          {/* Date Selector Controls */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
              <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                disabled={showAllDates}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setShowAllDates(false);
                }}
                className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer disabled:opacity-40"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedDate(todayDate);
                setShowAllDates(false);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                !showAllDates && selectedDate === todayDate
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => setShowAllDates((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                showAllDates
                  ? 'bg-sky-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              All Dates
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          {/* Status Tabs with Counters */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterStatus('pending')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterStatus === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending</span>
              <span
                className={`px-1.5 py-0.2 rounded font-mono text-[11px] font-black ${
                  filterStatus === 'pending'
                    ? 'bg-slate-950 text-amber-300'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {counts.pending}
              </span>
            </button>

            {/* Unpaid Tabs Filter Button */}
            <button
              type="button"
              onClick={() => setFilterStatus('unpaid')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterStatus === 'unpaid'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : counts.unpaid > 0
                  ? 'text-amber-400 hover:text-amber-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Unpaid Tabs</span>
              <span
                className={`px-1.5 py-0.2 rounded font-mono text-[11px] font-black ${
                  filterStatus === 'unpaid'
                    ? 'bg-slate-950 text-amber-300'
                    : counts.unpaid > 0
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {counts.unpaid}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('completed')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterStatus === 'completed'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completed</span>
              <span
                className={`px-1.5 py-0.2 rounded font-mono text-[11px] font-black ${
                  filterStatus === 'completed'
                    ? 'bg-slate-950 text-emerald-300'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {counts.completed}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>All</span>
              <span className="px-1.5 py-0.2 rounded font-mono text-[11px] font-black bg-slate-800 text-slate-300">
                {counts.all}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, #ID, drink..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Orders List */}
      {displayedOrders.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            {filterStatus === 'pending' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            ) : (
              <ClipboardList className="w-6 h-6 text-slate-500" />
            )}
          </div>
          <h3 className="text-base font-bold text-slate-200">
            {filterStatus === 'pending'
              ? 'All orders completed!'
              : filterStatus === 'completed'
              ? 'No completed orders yet'
              : 'No orders found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {filterStatus === 'pending'
              ? 'All drinks for this selection have been prepared and marked DONE. Great job!'
              : 'New beverage orders taken at the POS will automatically appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {displayedOrders.map((ord) => {
            const isCompleted = ord.fulfillmentStatus === 'completed';
            const isToggling = togglingId === ord.orderId;

            return (
              <div
                key={ord.orderId}
                id={`customer-order-${ord.orderId}`}
                className={`relative rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                  ord.isUnpaid
                    ? 'bg-slate-900 border-amber-500/60 shadow-lg shadow-amber-950/20'
                    : isCompleted
                    ? 'bg-slate-900/50 border-emerald-500/25 shadow-sm'
                    : 'bg-slate-900 border-slate-700/80 shadow-lg hover:border-emerald-500/50'
                }`}
              >
                {/* Status Bar Indicator */}
                <div
                  className={`h-1.5 w-full ${
                    ord.isUnpaid
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                      : isCompleted
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-amber-500 to-emerald-500'
                  }`}
                />

                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3">
                  {/* Top Row: Customer Name, Order ID, Time, Checkbox Area */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Large Touch Checkbox (min 44px x 44px for POS tablets) */}
                      <button
                        type="button"
                        id={`btn-toggle-order-${ord.orderId}`}
                        disabled={isToggling}
                        onClick={() => handleToggle(ord.orderId, ord.fulfillmentStatus)}
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border-2 transition-all cursor-pointer shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-500 border-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 active:scale-95'
                            : 'bg-slate-950 border-slate-600 hover:border-emerald-400 text-transparent hover:text-slate-600 active:scale-95'
                        }`}
                        title={isCompleted ? 'Mark as Pending' : 'Mark as Done'}
                        aria-label={`Toggle fulfillment for order ${ord.orderId}`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                        ) : (
                          <Square className="w-6 h-6 stroke-[1.5]" />
                        )}
                      </button>

                      {/* Customer Name & Order ID */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={`text-base sm:text-lg font-black tracking-tight truncate ${
                              isCompleted
                                ? 'text-slate-300 line-through decoration-slate-500/60'
                                : 'text-white'
                            }`}
                          >
                            {ord.customerName || 'Walk-in Customer'}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono font-bold text-amber-400">
                            #{ord.orderId}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {formatTimeDisplay(ord.time)}
                          </span>
                          {showAllDates && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{ord.date}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badges: Payment Status & Drink Fulfillment Status */}
                    <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {ord.isUnpaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>UNPAID TAB</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>PAID</span>
                          </span>
                        )}

                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>DONE</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            <span>PENDING</span>
                          </span>
                        )}
                      </div>

                      {ord.totalAmount > 0 && (
                        <div
                          className={`font-mono font-bold text-xs ${
                            ord.isUnpaid ? 'text-amber-300 font-black' : 'text-slate-300'
                          }`}
                        >
                          BND {ord.totalAmount.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customer Notes if provided */}
                  {ord.customerNotes && (
                    <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-300">Note: </span>
                        {ord.customerNotes}
                      </div>
                    </div>
                  )}

                  {/* Ordered Items Checklist */}
                  <div
                    className={`rounded-xl p-3 space-y-2 border ${
                      isCompleted
                        ? 'bg-slate-950/40 border-slate-800/60'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    {ord.items.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No items listed</p>
                    ) : (
                      ord.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-2 text-xs"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <span
                              className={`px-1.5 py-0.2 rounded font-mono font-black shrink-0 ${
                                isCompleted
                                  ? 'bg-slate-800 text-slate-400'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {it.qty}×
                            </span>
                            <div className="min-w-0">
                              <span
                                className={`font-bold block ${
                                  isCompleted ? 'text-slate-400' : 'text-slate-100'
                                }`}
                              >
                                {it.name}
                              </span>
                              {it.addonString && (
                                <span className="text-[11px] text-amber-300/90 font-medium block">
                                  {it.addonString.startsWith('•') || it.addonString.startsWith('+')
                                    ? it.addonString
                                    : `• ${it.addonString}`}
                                </span>
                              )}
                            </div>
                          </div>

                          {it.lineTotal !== undefined && (
                            <span className="font-mono text-slate-400 shrink-0">
                              ${it.lineTotal.toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer Info & Quick Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 gap-2 flex-wrap">
                    <div className="flex items-center gap-2 truncate">
                      {ord.paymentType && (
                        <span
                          className={`px-2 py-0.5 rounded-lg font-medium ${
                            ord.isUnpaid
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {ord.paymentType}
                        </span>
                      )}
                      {ord.staffName && (
                        <span className="truncate">Cashier: {ord.staffName}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      {/* Settle Tab Button for Unpaid Orders */}
                      {ord.isUnpaid && onSettlePayment && (
                        <button
                          type="button"
                          id={`btn-settle-${ord.orderId}`}
                          onClick={() => {
                            setSettlingOrder(ord);
                            setSettlePaymentType('Cash');
                            setCashTendered('');
                            setSettleSuccessMessage(null);
                          }}
                          className="px-3 py-1.5 rounded-xl font-black transition flex items-center gap-1.5 cursor-pointer text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 active:scale-95"
                          title="Settle Open Tab"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Settle Tab</span>
                        </button>
                      )}

                      {/* Direct Quick Tap Drink Fulfillment Button */}
                      <button
                        type="button"
                        id={`btn-quick-toggle-${ord.orderId}`}
                        disabled={isToggling}
                        onClick={() => handleToggle(ord.orderId, ord.fulfillmentStatus)}
                        className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-xs ${
                          isCompleted
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-md shadow-emerald-500/10'
                        }`}
                      >
                        {isCompleted ? (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            <span>Undo to Pending</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Done</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settle Payment Modal */}
      {settlingOrder && (
        <div
          id="settle-tab-modal"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Settle Open Tab</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono font-bold text-amber-400">#{settlingOrder.orderId}</span>
                    <span>•</span>
                    <span className="font-medium text-slate-300">{settlingOrder.customerName || 'Walk-in Customer'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmittingSettle) {
                    setSettlingOrder(null);
                    setSettleSuccessMessage(null);
                  }
                }}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Success Notification Banner */}
              {settleSuccessMessage ? (
                <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div className="text-sm font-bold">{settleSuccessMessage}</div>
                </div>
              ) : (
                <>
                  {/* Order Total Highlight */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Total Amount Due</div>
                      <div className="text-2xl font-black font-mono text-amber-400 mt-0.5">
                        BND {settlingOrder.totalAmount.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>{settlingOrder.items.reduce((acc, it) => acc + it.qty, 0)} item(s)</div>
                      <div className="text-[11px] text-amber-400/80 font-mono">Tab Status: Unpaid</div>
                    </div>
                  </div>

                  {/* Payment Method Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">
                      Select Payment Method
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {availablePaymentMethods.map((method) => {
                        const isSelected = settlePaymentType === method.name;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setSettlePaymentType(method.name as PaymentMethod)}
                            className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <CreditCard className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                            <span className="text-xs font-bold truncate">{method.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cash Presets and Change Due (Only shown if Cash selected) */}
                  {settlePaymentType === 'Cash' && (
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300">
                          Cash Tendered
                        </label>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Exact: ${settlingOrder.totalAmount.toFixed(2)}
                        </span>
                      </div>

                      {/* Quick Tender Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setCashTendered(settlingOrder.totalAmount.toFixed(2))}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition cursor-pointer"
                        >
                          Exact
                        </button>
                        {[5, 10, 20, 50].map((amt) => {
                          if (amt < settlingOrder.totalAmount && amt !== 5) return null;
                          return (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setCashTendered(amt.toString())}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition cursor-pointer"
                            >
                              ${amt}
                            </button>
                          );
                        })}
                      </div>

                      {/* Input */}
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                          BND
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          placeholder={settlingOrder.totalAmount.toFixed(2)}
                          value={cashTendered}
                          onChange={(e) => setCashTendered(e.target.value)}
                          className="w-full pl-12 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Change Due Display */}
                      {(() => {
                        const tenderedNum = parseFloat(cashTendered) || 0;
                        const change = tenderedNum > settlingOrder.totalAmount
                          ? tenderedNum - settlingOrder.totalAmount
                          : 0;
                        return (
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800 font-mono">
                            <span className="text-slate-400">Change Due:</span>
                            <span className={`font-bold ${change > 0 ? 'text-emerald-400 text-sm' : 'text-slate-300'}`}>
                              BND {change.toFixed(2)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isSubmittingSettle}
                      onClick={() => setSettlingOrder(null)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      id="btn-confirm-settle"
                      disabled={isSubmittingSettle}
                      onClick={async () => {
                        if (!settlingOrder || !onSettlePayment) return;
                        setIsSubmittingSettle(true);
                        try {
                          const tenderedNum = parseFloat(cashTendered) || settlingOrder.totalAmount;
                          const change = settlePaymentType === 'Cash' && tenderedNum > settlingOrder.totalAmount
                            ? Math.max(0, tenderedNum - settlingOrder.totalAmount)
                            : 0;

                          await onSettlePayment(
                            settlingOrder.orderId,
                            settlePaymentType,
                            settlePaymentType === 'Cash' ? tenderedNum : undefined,
                            settlePaymentType === 'Cash' ? change : undefined
                          );

                          setSettleSuccessMessage(`Tab settled via ${settlePaymentType}!`);
                          setTimeout(() => {
                            setSettleSuccessMessage(null);
                            setSettlingOrder(null);
                            setIsSubmittingSettle(false);
                          }, 800);
                        } catch (err) {
                          console.error(err);
                          setIsSubmittingSettle(false);
                        }
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
                    >
                      {isSubmittingSettle ? (
                        <>
                          <Clock className="w-4 h-4 animate-spin" />
                          <span>Settling...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Confirm Payment</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
