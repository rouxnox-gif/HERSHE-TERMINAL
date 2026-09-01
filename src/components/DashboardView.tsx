import React, { useState, useMemo } from 'react';
import { Order, Expense } from '../types';
import { calculatePeriodReport, calculateAccountBalances } from '../utils/storage';
import { getBruneiMonthString } from '../data/initialData';
import {
  DollarSign,
  CreditCard,
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  Eye,
  FileText,
  Printer,
  Check,
  X,
  History,
  Download,
} from 'lucide-react';

interface DashboardViewProps {
  orders: Order[];
  expenses: Expense[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ orders, expenses }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(getBruneiMonthString());
  const [reportModalMonth, setReportModalMonth] = useState<string | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Calculate stats for current selected month
  const periodReport = calculatePeriodReport(orders, expenses, selectedMonth, true);
  const accountBalances = calculateAccountBalances(orders, expenses, selectedMonth);

  // Helper to format YYYY-MM into "August 2026"
  const formatMonthLabel = (mStr: string) => {
    if (!mStr || mStr.length < 7) return mStr;
    const [year, month] = mStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Find all unique recorded months across orders & expenses
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    const currentM = getBruneiMonthString();
    monthSet.add(currentM);

    orders.forEach(o => {
      if (o.date && o.date.length >= 7) {
        monthSet.add(o.date.substring(0, 7));
      }
    });

    expenses.forEach(e => {
      if (e.date && e.date.length >= 7) {
        monthSet.add(e.date.substring(0, 7));
      }
    });

    return Array.from(monthSet).sort().reverse();
  }, [orders, expenses]);

  // Compute stats for all available months in monthly history table
  const monthlyHistory = useMemo(() => {
    return availableMonths.map(mStr => {
      const rep = calculatePeriodReport(orders, expenses, mStr, true);
      const bal = calculateAccountBalances(orders, expenses, mStr);
      const orderCount = orders.filter(o => o.date && o.date.startsWith(mStr)).length;
      const expenseCount = expenses.filter(e => e.date && e.date.startsWith(mStr)).length;

      return {
        monthStr: mStr,
        label: formatMonthLabel(mStr),
        report: rep,
        balances: bal,
        orderCount,
        expenseCount,
      };
    });
  }, [availableMonths, orders, expenses]);

  // Copy monthly report text to clipboard
  const handleCopyMonthlyReport = (mStr: string) => {
    const rep = calculatePeriodReport(orders, expenses, mStr, true);
    const bal = calculateAccountBalances(orders, expenses, mStr);
    const label = formatMonthLabel(mStr);

    const reportText = `
========================================
  FINANCIAL REPORT: ${label.toUpperCase()} (${mStr})
========================================
Gross Sales Revenue:  BND ${rep.totalSales.toFixed(2)}
  - Cash Sales:        BND ${rep.cashSales.toFixed(2)}
  - Card Lulu Sales:   BND ${rep.luluSales.toFixed(2)}
  - Card Mizah Sales:  BND ${rep.mizahSales.toFixed(2)}

Total Expenses:       BND ${rep.totalExpenses.toFixed(2)}
  - Cash Expenses:     BND ${rep.cashExpenses.toFixed(2)}
  - Card Lulu Exp:     BND ${rep.luluExpenses.toFixed(2)}
  - Card Mizah Exp:    BND ${rep.mizahExpenses.toFixed(2)}

----------------------------------------
NET PROFIT:           BND ${rep.netProfit.toFixed(2)}
----------------------------------------

MONTH-END ACCOUNT BALANCES:
  - Cash Account:      BND ${bal.cash.toFixed(2)}
  - Card Lulu:         BND ${bal.cardLulu.toFixed(2)}
  - Card Mizah:        BND ${bal.cardMizah.toFixed(2)}
  --------------------------------------
  COMBINED TOTAL:      BND ${bal.total.toFixed(2)}
========================================
    `.trim();

    navigator.clipboard.writeText(reportText);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto w-full h-full p-3 md:p-4 flex flex-col gap-4 text-slate-100 overflow-y-auto">
      {/* Header Bar with Month Selection */}
      <div className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              Financial Dashboard
            </h2>
            <p className="text-[11px] text-slate-400 leading-none mt-0.5">
              Monthly sales, expenses, net profit, and account balances overview
            </p>
          </div>
        </div>

        {/* Month Picker & Report Modal Trigger */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-semibold text-slate-400">Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-mono text-emerald-400 font-bold focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => setReportModalMonth(selectedMonth)}
            className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Export / View Printable Snapshot"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Save Report</span>
          </button>
        </div>
      </div>

      {/* QUICK MONTH CHIPS */}
      {availableMonths.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <History className="w-3 h-3" /> Select Month:
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
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }
                `}
              >
                <span>{label}</span>
                {mStr === getBruneiMonthString() && (
                  <span className={`px-1 py-0.2 text-[9px] rounded font-mono ${isSelected ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    Current
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Month Title Banner */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <span>Overview for</span>
          <span className="text-emerald-400 font-mono text-sm">
            {formatMonthLabel(selectedMonth)}
          </span>
        </h3>
        {selectedMonth !== getBruneiMonthString() && (
          <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
            Reviewing Previous Month Record
          </span>
        )}
      </div>

      {/* 3 Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Sales */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between gap-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Monthly Sales
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-extrabold font-mono text-emerald-400">
            BND {periodReport.totalSales.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-500 truncate">
            Gross revenue collected in {formatMonthLabel(selectedMonth)}
          </p>
        </div>

        {/* Expenses */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between gap-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Monthly Expenses
            </span>
            <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-extrabold font-mono text-red-400">
            BND {periodReport.totalExpenses.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-500 truncate">
            Total payouts & costs in {formatMonthLabel(selectedMonth)}
          </p>
        </div>

        {/* Net Profit */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between gap-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Monthly Net Profit
            </span>
            <div className={`p-1.5 rounded-lg ${periodReport.netProfit >= 0 ? 'bg-sky-500/10 text-sky-400' : 'bg-red-500/10 text-red-400'}`}>
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl font-extrabold font-mono ${periodReport.netProfit >= 0 ? 'text-sky-400' : 'text-red-400'}`}>
            BND {periodReport.netProfit.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-500 truncate">
            Sales minus Expenses for {formatMonthLabel(selectedMonth)}
          </p>
        </div>
      </div>

      {/* Monthly Account Balances Section */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Monthly Account Balances Breakdown ({formatMonthLabel(selectedMonth)})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 font-bold">
            {formatMonthLabel(selectedMonth)}
          </span>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Cash Account */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 shrink-0">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-medium text-slate-200">Cash</span>
              </div>
              <span className="text-xs font-extrabold font-mono text-slate-100">
                BND {accountBalances.cash.toFixed(2)}
              </span>
            </div>

            {/* Card Lulu */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-indigo-500/10 text-indigo-400 shrink-0">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-medium text-slate-200">Card Lulu</span>
              </div>
              <span className="text-xs font-extrabold font-mono text-slate-100">
                BND {accountBalances.cardLulu.toFixed(2)}
              </span>
            </div>

            {/* Card Mizah */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-purple-500/10 text-purple-400 shrink-0">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-medium text-slate-200">Card Mizah</span>
              </div>
              <span className="text-xs font-extrabold font-mono text-slate-100">
                BND {accountBalances.cardMizah.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Combined Total Account Balance Banner */}
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-xs font-bold text-emerald-200">Total Combined Balance ({formatMonthLabel(selectedMonth)})</span>
            </div>
            <span className={`text-base font-black font-mono ${accountBalances.total >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              BND {accountBalances.total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* MONTHLY HISTORY ARCHIVE TABLE */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              Monthly History Archives
            </h3>
            <p className="text-[11px] text-slate-400">
              All recorded monthly financial summaries
            </p>
          </div>

          <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 self-start sm:self-auto">
            {monthlyHistory.length} Month{monthlyHistory.length !== 1 ? 's' : ''} Recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                <th className="py-2.5 px-3">Month</th>
                <th className="py-2.5 px-3 text-right">Sales</th>
                <th className="py-2.5 px-3 text-right">Expenses</th>
                <th className="py-2.5 px-3 text-right">Net Profit</th>
                <th className="py-2.5 px-3 text-right">End Balance</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {monthlyHistory.map((item) => {
                const isCurrentView = item.monthStr === selectedMonth;
                const isNowMonth = item.monthStr === getBruneiMonthString();

                return (
                  <tr
                    key={item.monthStr}
                    className={`transition hover:bg-slate-800/50 ${isCurrentView ? 'bg-emerald-950/20 font-semibold' : ''}`}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100">{item.label}</span>
                        {isNowMonth && (
                          <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-emerald-500/20 text-emerald-400 font-bold">
                            Current
                          </span>
                        )}
                        {isCurrentView && (
                          <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-sky-500/20 text-sky-400 font-bold">
                            Viewing
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {item.orderCount} order{item.orderCount !== 1 ? 's' : ''} • {item.expenseCount} expense{item.expenseCount !== 1 ? 's' : ''}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                      BND {item.report.totalSales.toFixed(2)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-red-400">
                      BND {item.report.totalExpenses.toFixed(2)}
                    </td>

                    <td className={`py-3 px-3 text-right font-mono font-bold ${item.report.netProfit >= 0 ? 'text-sky-400' : 'text-red-400'}`}>
                      BND {item.report.netProfit.toFixed(2)}
                    </td>

                    <td className={`py-3 px-3 text-right font-mono font-bold ${item.balances.total >= 0 ? 'text-slate-200' : 'text-red-400'}`}>
                      BND {item.balances.total.toFixed(2)}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedMonth(item.monthStr)}
                          className={`p-1.5 rounded-lg border transition cursor-pointer active:scale-95
                            ${isCurrentView
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                              : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border-sky-500/30'
                            }
                          `}
                          title={`Review financial details for ${item.label}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setReportModalMonth(item.monthStr)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer active:scale-95"
                          title={`Export/Print report for ${item.label}`}
                        >
                          <FileText className="w-3.5 h-3.5 text-sky-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MONTHLY REPORT SNAPSHOT POPUP MODAL */}
      {reportModalMonth && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Monthly Financial Report</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {formatMonthLabel(reportModalMonth)} ({reportModalMonth})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setReportModalMonth(null)}
                className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Report Details Body */}
            {(() => {
              const rep = calculatePeriodReport(orders, expenses, reportModalMonth, true);
              const bal = calculateAccountBalances(orders, expenses, reportModalMonth);

              return (
                <div className="space-y-3 text-xs">
                  {/* Revenue Breakdown */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                      Revenue Breakdown
                    </span>
                    <div className="flex justify-between text-slate-300">
                      <span>Cash Sales</span>
                      <span className="font-mono font-bold">BND {rep.cashSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Card Lulu Sales</span>
                      <span className="font-mono font-bold">BND {rep.luluSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Card Mizah Sales</span>
                      <span className="font-mono font-bold">BND {rep.mizahSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-800 font-extrabold text-emerald-400 text-sm">
                      <span>Gross Sales Revenue</span>
                      <span className="font-mono">BND {rep.totalSales.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Expense Breakdown */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">
                      Expense Breakdown
                    </span>
                    <div className="flex justify-between text-slate-300">
                      <span>Cash Expenses</span>
                      <span className="font-mono font-bold">BND {rep.cashExpenses.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Card Lulu Expenses</span>
                      <span className="font-mono font-bold">BND {rep.luluExpenses.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Card Mizah Expenses</span>
                      <span className="font-mono font-bold">BND {rep.mizahExpenses.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-800 font-extrabold text-red-400 text-sm">
                      <span>Total Expenses</span>
                      <span className="font-mono">BND {rep.totalExpenses.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Net Profit & Account Balances */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                    <div className="flex justify-between items-center font-extrabold text-sm pb-1.5 border-b border-slate-800">
                      <span className="text-slate-200">Net Profit</span>
                      <span className={`font-mono text-base ${rep.netProfit >= 0 ? 'text-sky-400' : 'text-red-400'}`}>
                        BND {rep.netProfit.toFixed(2)}
                      </span>
                    </div>

                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pt-1">
                      Account Balances
                    </span>
                    <div className="grid grid-cols-3 gap-2 pt-0.5 text-[11px]">
                      <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-center">
                        <span className="text-slate-400 block text-[9px]">Cash</span>
                        <span className="font-mono font-bold text-slate-200">BND {bal.cash.toFixed(2)}</span>
                      </div>
                      <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-center">
                        <span className="text-slate-400 block text-[9px]">Card Lulu</span>
                        <span className="font-mono font-bold text-slate-200">BND {bal.cardLulu.toFixed(2)}</span>
                      </div>
                      <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-center">
                        <span className="text-slate-400 block text-[9px]">Card Mizah</span>
                        <span className="font-mono font-bold text-slate-200">BND {bal.cardMizah.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => handleCopyMonthlyReport(reportModalMonth)}
                className="px-3.5 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                {copiedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Report Copied!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Copy Text Report</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setReportModalMonth(null)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 cursor-pointer"
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
