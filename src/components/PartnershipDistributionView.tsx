import React, { useState, useMemo, useEffect } from 'react';
import { Order, Expense, MonthlyDistributionConfig, PartnerShare } from '../types';
import { calculatePeriodReport } from '../utils/storage';
import { getBruneiMonthString, getDefaultMonthlyDistribution } from '../data/initialData';
import {
  Users,
  Calendar,
  DollarSign,
  PieChart,
  Copy,
  Check,
  Printer,
  RotateCcw,
  Plus,
  Trash2,
  HelpCircle,
  TrendingUp,
  Wallet,
  Sparkles,
  Info,
  RefreshCw,
  Percent,
} from 'lucide-react';

interface PartnershipDistributionViewProps {
  orders: Order[];
  expenses: Expense[];
  savedDistributions?: Record<string, MonthlyDistributionConfig>;
  onUpdateDistribution: (month: string, config: MonthlyDistributionConfig) => void;
}

const JUICE_UNIT_PRICE = 3.50;

export const PartnershipDistributionView: React.FC<PartnershipDistributionViewProps> = ({
  orders,
  expenses,
  savedDistributions = {},
  onUpdateDistribution,
}) => {
  const currentBruneiMonth = getBruneiMonthString();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    savedDistributions['2026-08'] ? '2026-08' : currentBruneiMonth
  );

  // Load config for selected month or fallback to defaults
  const currentConfig: MonthlyDistributionConfig = useMemo(() => {
    if (savedDistributions[selectedMonth]) {
      return savedDistributions[selectedMonth];
    }
    return getDefaultMonthlyDistribution(selectedMonth);
  }, [savedDistributions, selectedMonth]);

  // Form input local state - Juices deduction is fixed at $3.50 x juiceCount
  const [juiceCount, setJuiceCount] = useState<number>(() => {
    if (currentConfig.juiceCount !== undefined && currentConfig.juiceCount !== null) {
      return currentConfig.juiceCount;
    }
    if (currentConfig.juices !== undefined && currentConfig.juices !== null) {
      return Math.round((currentConfig.juices / JUICE_UNIT_PRICE) * 100) / 100;
    }
    return 5;
  });
  const [rental, setRental] = useState<number>(currentConfig.rental ?? 30.00);
  const [bottles, setBottles] = useState<number>(currentConfig.bottles ?? 105.00);
  const [cashCarriedForward, setCashCarriedForward] = useState<number>(currentConfig.cashCarriedForward ?? 0.00);
  const [partners, setPartners] = useState<PartnerShare[]>(currentConfig.partners || [
    { id: 'p-mizah', name: 'Mizah', percentage: 45 },
    { id: 'p-ema', name: 'Ema', percentage: 0 },
    { id: 'p-lulu', name: 'Lulu', percentage: 45 },
    { id: 'p-rifah', name: 'Rifah', percentage: 10 },
  ]);
  const [isManualNetOverride, setIsManualNetOverride] = useState<boolean>(currentConfig.customAccountNet !== null && currentConfig.customAccountNet !== undefined);
  const [manualNet, setManualNet] = useState<number>(currentConfig.customAccountNet ?? 194.52);

  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Calculated Juices deduction ($3.50 fixed x juiceCount)
  const juices = useMemo(() => {
    return Math.round(Number(juiceCount || 0) * JUICE_UNIT_PRICE * 100) / 100;
  }, [juiceCount]);

  // Sync inputs when selectedMonth or savedDistributions change
  useEffect(() => {
    const cfg = savedDistributions[selectedMonth] || getDefaultMonthlyDistribution(selectedMonth);
    const count = cfg.juiceCount !== undefined && cfg.juiceCount !== null
      ? cfg.juiceCount
      : (cfg.juices ? Math.round((cfg.juices / JUICE_UNIT_PRICE) * 100) / 100 : 5);
    setJuiceCount(count);
    setRental(cfg.rental ?? 30.00);
    setBottles(cfg.bottles ?? 105.00);
    setCashCarriedForward(cfg.cashCarriedForward ?? 0.00);
    setPartners(cfg.partners && cfg.partners.length > 0 ? cfg.partners : [
      { id: 'p-mizah', name: 'Mizah', percentage: 45 },
      { id: 'p-ema', name: 'Ema', percentage: 0 },
      { id: 'p-lulu', name: 'Lulu', percentage: 45 },
      { id: 'p-rifah', name: 'Rifah', percentage: 10 },
    ]);
    if (cfg.customAccountNet !== null && cfg.customAccountNet !== undefined) {
      setIsManualNetOverride(true);
      setManualNet(cfg.customAccountNet);
    } else {
      setIsManualNetOverride(false);
    }
  }, [selectedMonth, savedDistributions]);

  // Calculate actual POS Net for the selected month
  const periodReport = useMemo(() => {
    return calculatePeriodReport(orders, expenses, selectedMonth, true);
  }, [orders, expenses, selectedMonth]);

  const posNet = periodReport.netProfit;

  // Final account combined net used in calculations
  const accountCombinedNet = isManualNetOverride ? manualNet : posNet;

  // Datul's Total Calculation = Rental + Bottles - Juices ($3.50 x juiceCount)
  const datulsTotal = (rental || 0) + (bottles || 0) - (juices || 0);

  // Balance = Account Combined Net - Datul's Total
  const balance = accountCombinedNet - datulsTotal;

  // Base for Distribution = Balance - Cash Carried Forward
  const baseForDistribution = balance - (cashCarriedForward || 0);

  // Partner distribution calculations
  const totalPercentage = partners.reduce((sum, p) => sum + (Number(p.percentage) || 0), 0);

  const partnerDistributions = useMemo(() => {
    return partners.map(p => {
      const pct = Number(p.percentage) || 0;
      const amt = baseForDistribution > 0 ? (baseForDistribution * (pct / 100)) : 0;
      return {
        ...p,
        amount: Math.round(amt * 100) / 100, // round to 2 decimal places
      };
    });
  }, [partners, baseForDistribution]);

  const totalDistributed = partnerDistributions.reduce((sum, p) => sum + p.amount, 0);
  const leftover = Math.max(0, baseForDistribution - totalDistributed);

  // Auto-save changes
  const handlePersistChanges = (
    newJuiceCount = juiceCount,
    newRental = rental,
    newBottles = bottles,
    newCashCarried = cashCarriedForward,
    newPartners = partners,
    newIsManual = isManualNetOverride,
    newManualNet = manualNet
  ) => {
    const calculatedJuices = Math.round(Number(newJuiceCount || 0) * JUICE_UNIT_PRICE * 100) / 100;
    const updatedConfig: MonthlyDistributionConfig = {
      month: selectedMonth,
      juices: calculatedJuices,
      juiceCount: Number(newJuiceCount) || 0,
      rental: Number(newRental) || 0,
      bottles: Number(newBottles) || 0,
      cashCarriedForward: Number(newCashCarried) || 0,
      customAccountNet: newIsManual ? Number(newManualNet) || 0 : null,
      partners: newPartners,
    };
    onUpdateDistribution(selectedMonth, updatedConfig);
  };

  // Helper to format month
  const formatMonthLabel = (mStr: string) => {
    if (!mStr || mStr.length < 7) return mStr;
    const [year, month] = mStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Partner Handlers
  const handlePartnerPercentageChange = (id: string, newPct: number) => {
    const updated = partners.map(p => p.id === id ? { ...p, percentage: newPct } : p);
    setPartners(updated);
    handlePersistChanges(juiceCount, rental, bottles, cashCarriedForward, updated);
  };

  const handlePartnerNameChange = (id: string, newName: string) => {
    const updated = partners.map(p => p.id === id ? { ...p, name: newName } : p);
    setPartners(updated);
    handlePersistChanges(juiceCount, rental, bottles, cashCarriedForward, updated);
  };

  const handleAddPartner = () => {
    const newPartner: PartnerShare = {
      id: `p-${Date.now()}`,
      name: 'New Partner',
      percentage: 0,
    };
    const updated = [...partners, newPartner];
    setPartners(updated);
    handlePersistChanges(juiceCount, rental, bottles, cashCarriedForward, updated);
  };

  const handleRemovePartner = (id: string) => {
    if (partners.length <= 1) return;
    const updated = partners.filter(p => p.id !== id);
    setPartners(updated);
    handlePersistChanges(juiceCount, rental, bottles, cashCarriedForward, updated);
  };

  const handleResetToDefaults = () => {
    const def = getDefaultMonthlyDistribution(selectedMonth);
    setJuiceCount(def.juiceCount ?? 5);
    setRental(def.rental);
    setBottles(def.bottles);
    setCashCarriedForward(def.cashCarriedForward);
    setPartners(def.partners);
    setIsManualNetOverride(false);
    setManualNet(194.52);
    handlePersistChanges(def.juiceCount ?? 5, def.rental, def.bottles, def.cashCarriedForward, def.partners, false, 194.52);
  };

  // Copy structured text report
  const handleCopyReport = () => {
    const text = `
==================================================
   HERSHE PARTNERSHIP DISTRIBUTION: ${selectedMonth}
   ${formatMonthLabel(selectedMonth).toUpperCase()}
==================================================
Datul's / Distribution        Amount (BND)
--------------------------------------------------
Juices ($3.50 × ${juiceCount}):        BND ${juices.toFixed(2)}
Rental:                       BND ${rental.toFixed(2)}
Bottles:                      BND ${bottles.toFixed(2)}
--------------------------------------------------
Datul's Total:                BND ${datulsTotal.toFixed(2)}
Account Combined Net (${selectedMonth}): BND ${accountCombinedNet.toFixed(2)}
Balance:                      BND ${balance.toFixed(2)}
Cash Carried Forward:         BND ${cashCarriedForward.toFixed(2)}
--------------------------------------------------
BASE FOR DISTRIBUTION:        BND ${baseForDistribution.toFixed(2)}
==================================================

DISTRIBUTION BREAKDOWN:
Partner       Percentage      Amount (BND)
--------------------------------------------------
${partnerDistributions.map(p => `${p.name.padEnd(14, ' ')} ${p.percentage.toFixed(2).padStart(6, ' ')}%      BND ${p.amount.toFixed(2)}`).join('\n')}
--------------------------------------------------
Total Distributed:            BND ${totalDistributed.toFixed(2)}
Leftover (Base - Distributed): BND ${leftover.toFixed(2)}
==================================================
Generated on ${new Date().toLocaleDateString('en-GB')}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Find all unique months recorded
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add('2026-08');
    set.add(currentBruneiMonth);
    Object.keys(savedDistributions).forEach(m => set.add(m));
    orders.forEach(o => {
      if (o.date && o.date.length >= 7) set.add(o.date.substring(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [currentBruneiMonth, savedDistributions, orders]);

  return (
    <div className="max-w-5xl mx-auto w-full h-full p-3 sm:p-5 flex flex-col gap-4 text-slate-100 overflow-y-auto">
      {/* Top Header Banner */}
      <div className="px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Partnership Distribution
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PROFIT SHARING
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Monthly net profit calculations, Datul deductions, and partner percentage split
            </p>
          </div>
        </div>

        {/* Action Buttons & Month Picker */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-400">Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) setSelectedMonth(e.target.value);
              }}
              className="bg-transparent text-xs font-mono text-emerald-400 font-bold focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => setShowHelp(prev => !prev)}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="Formula Explanations"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            onClick={handleCopyReport}
            className="px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Copy Formatted Text Summary"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Print Voucher"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Quick Month Chips */}
      {availableMonths.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Month:
          </span>
          {availableMonths.map(mStr => {
            const isSelected = mStr === selectedMonth;
            const label = formatMonthLabel(mStr);
            return (
              <button
                key={mStr}
                onClick={() => setSelectedMonth(mStr)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition shrink-0 cursor-pointer flex items-center gap-1.5
                  ${isSelected
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-extrabold'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }
                `}
              >
                <span>{label}</span>
                <span className="font-mono text-[10px] opacity-75">({mStr})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Formula Explanation Banner (Collapsible) */}
      {showHelp && (
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 text-xs space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-emerald-400 font-bold">
            <span className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              Partnership Distribution Formulas & Accounting Logic
            </span>
            <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300 pt-1">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="font-bold text-emerald-400 block">1. Datul's Total</span>
              <p className="text-[11px] text-slate-400">
                <code className="text-emerald-300">Datul's Total = Rental + Bottles - Juices ($3.50 × count)</code>
              </p>
              <p className="text-[10px] text-slate-500">
                (Rental ${rental.toFixed(2)} + Bottles ${bottles.toFixed(2)} - Juices ($3.50 × {juiceCount} = ${juices.toFixed(2)}) = ${datulsTotal.toFixed(2)})
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="font-bold text-emerald-400 block">2. Base for Distribution</span>
              <p className="text-[11px] text-slate-400">
                <code className="text-emerald-300">Balance = Account Combined Net - Datul's Total</code>
              </p>
              <p className="text-[11px] text-slate-400">
                <code className="text-emerald-300">Base = Balance - Cash Carried Forward</code>
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 sm:col-span-2">
              <span className="font-bold text-emerald-400 block">3. Partner Share Calculation</span>
              <p className="text-[11px] text-slate-400">
                <code className="text-emerald-300">Partner Amount = Base for Distribution × (Percentage ÷ 100)</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Container Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT / TOP: Datul's & Calculation Table (Matches user's spreadsheet exact format) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            {/* Table Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <h3 className="font-mono font-extrabold text-sm text-white uppercase tracking-wider">
                  Datul's / Distribution Calculation
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  {selectedMonth}
                </span>

                <button
                  onClick={handleResetToDefaults}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer text-xs flex items-center gap-1"
                  title="Reset this month's inputs to defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="text-[10px]">Reset</span>
                </button>
              </div>
            </div>

            {/* SPREADSHEET REPLICA TABLE */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-300 font-extrabold border-b border-slate-800">
                    <th className="px-3.5 py-2.5 font-sans uppercase text-[11px] text-slate-400">Datul's / Distribution</th>
                    <th className="px-3.5 py-2.5 text-center font-sans uppercase text-[11px] text-slate-400 w-36">Value Input</th>
                    <th className="px-3.5 py-2.5 text-right font-sans uppercase text-[11px] text-slate-400">Amount (BND)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {/* Month Label Row */}
                  <tr className="bg-slate-900/40">
                    <td colSpan={3} className="px-3.5 py-1.5 text-center text-xs font-bold text-emerald-400 bg-emerald-950/20">
                      {selectedMonth} ({formatMonthLabel(selectedMonth)})
                    </td>
                  </tr>

                  {/* Juices */}
                  <tr className="hover:bg-slate-900/40 transition">
                    <td className="px-3.5 py-2.5 text-slate-200 font-sans font-medium">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-100">Juices</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-sans font-medium">
                          Deduction ($3.50 fixed)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        $3.50 × {juiceCount} {juiceCount === 1 ? 'bottle' : 'bottles'}
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-slate-400 text-xs font-mono font-bold shrink-0">$3.50 ×</span>
                        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5 shadow-inner">
                          <button
                            type="button"
                            onClick={() => {
                              const nextCount = Math.max(0, juiceCount - 1);
                              setJuiceCount(nextCount);
                              handlePersistChanges(nextCount, rental, bottles, cashCarriedForward);
                            }}
                            className="w-5 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded text-xs font-bold transition cursor-pointer"
                            title="Subtract 1 juice bottle"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={juiceCount}
                            onChange={(e) => {
                              const val = Math.max(0, parseFloat(e.target.value) || 0);
                              setJuiceCount(val);
                              handlePersistChanges(val, rental, bottles, cashCarriedForward);
                            }}
                            className="w-12 px-1 py-0.5 bg-transparent text-center font-mono font-bold text-emerald-400 text-xs focus:outline-none"
                            title="Number of juice bottles (multiplied by $3.50 fixed rate)"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextCount = juiceCount + 1;
                              setJuiceCount(nextCount);
                              handlePersistChanges(nextCount, rental, bottles, cashCarriedForward);
                            }}
                            className="w-5 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded text-xs font-bold transition cursor-pointer"
                            title="Add 1 juice bottle"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-extrabold text-slate-100 font-mono">
                      <div className="text-xs sm:text-sm text-slate-100">
                        BND {juices.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        ($3.50 × {juiceCount})
                      </div>
                    </td>
                  </tr>

                  {/* Rental */}
                  <tr className="hover:bg-slate-900/40 transition">
                    <td className="px-3.5 py-2 text-slate-200 font-sans font-medium">Rental</td>
                    <td className="px-3.5 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-slate-500 text-[11px]">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={rental}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setRental(val);
                            handlePersistChanges(juiceCount, val, bottles, cashCarriedForward);
                          }}
                          className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-center font-mono font-bold text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </td>
                    <td className="px-3.5 py-2 text-right font-extrabold text-slate-200">
                      ${rental.toFixed(2)}
                    </td>
                  </tr>

                  {/* Bottles */}
                  <tr className="hover:bg-slate-900/40 transition">
                    <td className="px-3.5 py-2 text-slate-200 font-sans font-medium">Bottles</td>
                    <td className="px-3.5 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-slate-500 text-[11px]">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={bottles}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setBottles(val);
                            handlePersistChanges(juiceCount, rental, val, cashCarriedForward);
                          }}
                          className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-center font-mono font-bold text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </td>
                    <td className="px-3.5 py-2 text-right font-extrabold text-slate-200">
                      ${bottles.toFixed(2)}
                    </td>
                  </tr>

                  {/* Datul's Total */}
                  <tr className="bg-slate-900/80 font-bold border-t border-b border-slate-800">
                    <td className="px-3.5 py-2.5 text-white font-sans">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold">Datul's Total</span>
                        <span className="text-[10px] text-slate-400 font-sans font-normal">(Rental + Bottles - Juices)</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-center text-slate-400 text-[11px] font-mono">
                      ${rental.toFixed(2)} + ${bottles.toFixed(2)} - ${juices.toFixed(2)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-black text-amber-400 text-sm">
                      ${datulsTotal.toFixed(2)}
                    </td>
                  </tr>

                  {/* Account Combined Net */}
                  <tr className="hover:bg-slate-900/40 transition">
                    <td className="px-3.5 py-2.5 text-slate-200 font-sans">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Account Combined Net ({selectedMonth})</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => {
                            const newIsManual = !isManualNetOverride;
                            setIsManualNetOverride(newIsManual);
                            handlePersistChanges(juiceCount, rental, bottles, cashCarriedForward, partners, newIsManual, manualNet);
                          }}
                          className={`text-[10px] font-sans px-2 py-0.5 rounded border transition cursor-pointer ${
                            isManualNetOverride
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {isManualNetOverride ? 'Manual Override' : 'Auto POS Net'}
                        </button>

                        {!isManualNetOverride && (
                          <span className="text-[10px] font-sans text-slate-400">
                            (POS Sales: ${periodReport.totalSales.toFixed(2)} - Exp: ${periodReport.totalExpenses.toFixed(2)})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      {isManualNetOverride ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-slate-500 text-[11px]">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={manualNet}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setManualNet(val);
                              handlePersistChanges(juiceCount, rental, bottles, cashCarriedForward, partners, true, val);
                            }}
                            className="w-20 px-2 py-1 rounded bg-slate-900 border border-amber-500/50 text-center font-mono font-bold text-amber-300 text-xs focus:outline-none"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setIsManualNetOverride(true);
                            setManualNet(posNet);
                            handlePersistChanges(juiceCount, rental, bottles, cashCarriedForward, partners, true, posNet);
                          }}
                          className="text-[10px] text-slate-400 hover:text-amber-300 underline font-sans"
                        >
                          Custom
                        </button>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-black text-emerald-400 text-sm">
                      ${accountCombinedNet.toFixed(2)}
                    </td>
                  </tr>

                  {/* Balance */}
                  <tr className="hover:bg-slate-900/40 transition">
                    <td className="px-3.5 py-2 text-slate-200 font-sans font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>Balance</span>
                        <span className="text-[10px] text-slate-500 font-sans">(Net - Datul's Total)</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2 text-center text-slate-400 text-[11px]">
                      ${accountCombinedNet.toFixed(2)} - ${datulsTotal.toFixed(2)}
                    </td>
                    <td className="px-3.5 py-2 text-right font-extrabold text-slate-100">
                      ${balance.toFixed(2)}
                    </td>
                  </tr>

                  {/* Cash Carried Forward */}
                  <tr className="hover:bg-slate-900/40 transition">
                    <td className="px-3.5 py-2 text-slate-200 font-sans font-medium">Cash Carried Forward</td>
                    <td className="px-3.5 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-slate-500 text-[11px]">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={cashCarriedForward}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setCashCarriedForward(val);
                            handlePersistChanges(juiceCount, rental, bottles, val);
                          }}
                          className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-center font-mono font-bold text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </td>
                    <td className="px-3.5 py-2 text-right font-extrabold text-slate-200">
                      ${cashCarriedForward.toFixed(2)}
                    </td>
                  </tr>

                  {/* Base for Distribution (Highlighted Row) */}
                  <tr className="bg-sky-950/40 border-t-2 border-b-2 border-sky-500/40">
                    <td className="px-3.5 py-3 text-sky-200 font-sans font-extrabold text-sm">
                      Base for Distribution
                    </td>
                    <td className="px-3.5 py-3 text-center text-sky-400 text-xs font-mono font-semibold">
                      ${balance.toFixed(2)} - ${cashCarriedForward.toFixed(2)}
                    </td>
                    <td className="px-3.5 py-3 text-right font-black text-sky-300 text-base">
                      ${baseForDistribution.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT / BOTTOM: Partner Distribution Section */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Partner Distribution Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-mono font-extrabold text-sm text-white uppercase tracking-wider">
                    Distribution
                  </h3>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    Math.abs(totalPercentage - 100) < 0.01
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    {totalPercentage.toFixed(1)}% Total
                  </span>

                  <button
                    onClick={handleAddPartner}
                    className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-emerald-400 transition cursor-pointer text-xs"
                    title="Add another partner"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* SPREADSHEET REPLICA PARTNER TABLE */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-300 font-extrabold border-b border-slate-800">
                      <th className="px-3 py-2.5 font-sans uppercase text-[11px] text-slate-400">Distribution</th>
                      <th className="px-3 py-2.5 text-center font-sans uppercase text-[11px] text-slate-400 w-28">Percentage</th>
                      <th className="px-3 py-2.5 text-right font-sans uppercase text-[11px] text-slate-400">Amount (BND)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-medium">
                    {partnerDistributions.map((partner) => {
                      return (
                        <tr key={partner.id} className="hover:bg-slate-900/40 transition group">
                          {/* Partner Name */}
                          <td className="px-3 py-2.5 font-sans font-bold text-slate-200">
                            <div className="flex items-center justify-between gap-1">
                              <input
                                type="text"
                                value={partner.name}
                                onChange={(e) => handlePartnerNameChange(partner.id, e.target.value)}
                                className="bg-transparent font-sans font-bold text-slate-200 text-xs focus:outline-none focus:border-b border-emerald-500 w-24 sm:w-28"
                              />
                              {partners.length > 1 && (
                                <button
                                  onClick={() => handleRemovePartner(partner.id)}
                                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition p-0.5"
                                  title="Remove Partner"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Percentage Input */}
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={partner.percentage}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handlePartnerPercentageChange(partner.id, val);
                                }}
                                className="w-16 px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-center font-mono font-bold text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                              />
                              <span className="text-slate-400 text-xs">%</span>
                            </div>
                          </td>

                          {/* Computed Partner Amount */}
                          <td className="px-3 py-2.5 text-right font-black font-mono text-emerald-400 text-xs sm:text-sm">
                            ${partner.amount.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Total Distributed Row */}
                    <tr className="bg-slate-900/80 font-bold border-t-2 border-slate-800">
                      <td className="px-3 py-2.5 text-white font-sans">
                        Total Distributed
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-400 font-mono text-xs">
                        {totalPercentage.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5 text-right font-black text-emerald-400 text-sm">
                        ${totalDistributed.toFixed(2)}
                      </td>
                    </tr>

                    {/* Leftover Row */}
                    <tr className="hover:bg-slate-900/40 transition">
                      <td colSpan={2} className="px-3 py-2 text-slate-300 font-sans">
                        <div className="flex items-center gap-1.5">
                          <span>Leftover</span>
                          <span className="text-[10px] text-slate-500 font-sans">(Base - Distributed)</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-extrabold text-slate-200">
                        ${leftover.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Visual Partner Summary Cards */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Partner Payout Summary ({formatMonthLabel(selectedMonth)})
              </span>
              <div className="grid grid-cols-2 gap-2">
                {partnerDistributions.map(p => (
                  <div key={p.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-200 truncate">{p.name}</span>
                      <span className="font-mono text-[10px] text-slate-400">{p.percentage}%</span>
                    </div>
                    <div className="text-sm font-extrabold font-mono text-emerald-400 mt-1">
                      ${p.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
