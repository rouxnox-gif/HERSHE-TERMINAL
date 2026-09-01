import React, { useState } from 'react';
import { Order, Expense } from '../types';
import { calculatePeriodReport, calculateDailyAccountBalances } from '../utils/storage';
import { getBruneiDateString, getBruneiMonthString } from '../data/initialData';
import { Calendar, TrendingUp, TrendingDown, FileSpreadsheet, Sparkles, Wallet, CreditCard } from 'lucide-react';

interface ReportsViewProps {
  orders: Order[];
  expenses: Expense[];
  onOpenGoogleSheets?: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ orders, expenses, onOpenGoogleSheets }) => {
  const [dailyDate, setDailyDate] = useState<string>(getBruneiDateString());
  const [monthlyMonth, setMonthlyMonth] = useState<string>(getBruneiMonthString());

  const dailyReport = calculatePeriodReport(orders, expenses, dailyDate, false);
  const dailyBalances = calculateDailyAccountBalances(orders, expenses, dailyDate);
  const monthlyReport = calculatePeriodReport(orders, expenses, monthlyMonth, true);

  return (
    <div className="max-w-4xl mx-auto w-full p-4 md:p-6 space-y-8">
      {/* GOOGLE SHEETS INTEGRATION BANNER */}
      {onOpenGoogleSheets && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Google Sheets Export & Sync
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h3>
              <p className="text-xs text-slate-300">
                Sync all financial records, sales history, and expense reports to your Google Drive.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenGoogleSheets}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shrink-0 cursor-pointer active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Open Google Sheets Sync</span>
          </button>
        </div>
      )}

      {/* DAILY FINANCIAL REPORT & ACCOUNT BALANCES AS OF DAY */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Daily Financial Report & Balances</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                DAILY BREAKDOWN
              </span>
            </h2>
            <p className="text-xs text-slate-400">Detailed account balances and revenue breakdown for {dailyDate}</p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 self-start sm:self-auto">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-emerald-400 focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* ACCOUNT BALANCES AS OF SELECTED DAY */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Wallet className="w-4 h-4" /> Account Balances Breakdown as of {dailyDate}
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">
              Net balance on {dailyDate}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Cash Account */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-200">Cash Account</span>
                    <p className="text-[10px] text-slate-400">In-hand physical register</p>
                  </div>
                </div>
                <span className={`text-xs font-mono font-black ${dailyBalances.cashNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {dailyBalances.cashNet >= 0 ? '+' : ''}BND {dailyBalances.cashNet.toFixed(2)}
                </span>
              </div>

              <div className="space-y-1 text-[11px] font-mono border-t border-slate-800/80 pt-2">
                <div className="flex justify-between text-slate-400">
                  <span>Day Inflow (Sales):</span>
                  <span className="text-emerald-400 font-semibold">+BND {dailyBalances.cashIn.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Day Outflow (Expenses):</span>
                  <span className="text-red-400 font-semibold">-BND {dailyBalances.cashOut.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-300 font-bold pt-1 border-t border-slate-800/40">
                  <span className="text-[10px] uppercase font-sans text-slate-400">Total as of {dailyDate}:</span>
                  <span className="text-slate-100">BND {dailyBalances.asOfCash.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Card Lulu */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-200">Card Lulu</span>
                    <p className="text-[10px] text-slate-400">Lulu Merchant Terminal</p>
                  </div>
                </div>
                <span className={`text-xs font-mono font-black ${dailyBalances.luluNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {dailyBalances.luluNet >= 0 ? '+' : ''}BND {dailyBalances.luluNet.toFixed(2)}
                </span>
              </div>

              <div className="space-y-1 text-[11px] font-mono border-t border-slate-800/80 pt-2">
                <div className="flex justify-between text-slate-400">
                  <span>Day Inflow (Sales):</span>
                  <span className="text-indigo-400 font-semibold">+BND {dailyBalances.luluIn.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Day Outflow (Expenses):</span>
                  <span className="text-red-400 font-semibold">-BND {dailyBalances.luluOut.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-300 font-bold pt-1 border-t border-slate-800/40">
                  <span className="text-[10px] uppercase font-sans text-slate-400">Total as of {dailyDate}:</span>
                  <span className="text-slate-100">BND {dailyBalances.asOfCardLulu.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Card Mizah */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-200">Card Mizah</span>
                    <p className="text-[10px] text-slate-400">Mizah Merchant Terminal</p>
                  </div>
                </div>
                <span className={`text-xs font-mono font-black ${dailyBalances.mizahNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {dailyBalances.mizahNet >= 0 ? '+' : ''}BND {dailyBalances.mizahNet.toFixed(2)}
                </span>
              </div>

              <div className="space-y-1 text-[11px] font-mono border-t border-slate-800/80 pt-2">
                <div className="flex justify-between text-slate-400">
                  <span>Day Inflow (Sales):</span>
                  <span className="text-purple-400 font-semibold">+BND {dailyBalances.mizahIn.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Day Outflow (Expenses):</span>
                  <span className="text-red-400 font-semibold">-BND {dailyBalances.mizahOut.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-300 font-bold pt-1 border-t border-slate-800/40">
                  <span className="text-[10px] uppercase font-sans text-slate-400">Total as of {dailyDate}:</span>
                  <span className="text-slate-100">BND {dailyBalances.asOfCardMizah.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cumulative Combined Total as of Day */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
              <div>
                <span className="text-xs font-extrabold text-emerald-300">Total Cumulative Balance as of {dailyDate}</span>
                <p className="text-[10px] text-slate-400">Combined balance across all 3 accounts accumulated up to this day</p>
              </div>
            </div>
            <span className={`font-mono text-lg font-black ${dailyBalances.asOfTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              BND {dailyBalances.asOfTotal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* REVENUE & EXPENSES BREAKDOWN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> Daily Revenue Inflow
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-300">Cash Sales</span>
                <span className="font-mono font-bold text-slate-100">BND {dailyReport.cashSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-300">Card Lulu Sales</span>
                <span className="font-mono font-bold text-slate-100">BND {dailyReport.luluSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-300">Card Mizah Sales</span>
                <span className="font-mono font-bold text-slate-100">BND {dailyReport.mizahSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 font-bold text-xs text-emerald-300">
                <span>Total Gross Sales</span>
                <span className="font-mono font-black text-emerald-400">BND {dailyReport.totalSales.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4" /> Daily Expenses Outflow
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-300">Cash Expenses</span>
                <span className="font-mono font-bold text-slate-100">BND {dailyReport.cashExpenses.toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-300">Card Lulu Expenses</span>
                <span className="font-mono font-bold text-slate-100">BND {dailyReport.luluExpenses.toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-300">Card Mizah Expenses</span>
                <span className="font-mono font-bold text-slate-100">BND {dailyReport.mizahExpenses.toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-red-950/20 border border-red-500/30 font-bold text-xs text-red-300">
                <span>Total Expenses</span>
                <span className="font-mono font-black text-red-400">BND {dailyReport.totalExpenses.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center p-4 rounded-xl bg-slate-950 border-2 border-slate-800 font-extrabold text-sm">
          <span className="text-slate-200">Daily Net Profit ({dailyDate})</span>
          <span className={`font-mono text-lg ${dailyReport.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            BND {dailyReport.netProfit.toFixed(2)}
          </span>
        </div>
      </div>

      {/* MONTHLY FINANCIAL REPORT */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">Monthly Financial Report</h2>
            <p className="text-xs text-slate-400">Monthly aggregate accounting summary</p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 self-start sm:self-auto">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="month"
              value={monthlyMonth}
              onChange={(e) => setMonthlyMonth(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-emerald-400 focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> Monthly Revenue
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="text-slate-300">Cash Sales</span>
              <span className="font-mono font-bold text-slate-100">BND {monthlyReport.cashSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="text-slate-300">Card Lulu Sales</span>
              <span className="font-mono font-bold text-slate-100">BND {monthlyReport.luluSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="text-slate-300">Card Mizah Sales</span>
              <span className="font-mono font-bold text-slate-100">BND {monthlyReport.mizahSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 font-bold text-sm text-emerald-300">
              <span>Total Gross Sales</span>
              <span className="font-mono font-black text-emerald-400">BND {monthlyReport.totalSales.toFixed(2)}</span>
            </div>
          </div>

          <h4 className="text-xs font-extrabold uppercase tracking-wider text-red-400 pt-2 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4" /> Monthly Expenses
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="text-slate-300">Cash Expenses</span>
              <span className="font-mono font-bold text-slate-100">BND {monthlyReport.cashExpenses.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="text-slate-300">Card Lulu Expenses</span>
              <span className="font-mono font-bold text-slate-100">BND {monthlyReport.luluExpenses.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="text-slate-300">Card Mizah Expenses</span>
              <span className="font-mono font-bold text-slate-100">BND {monthlyReport.mizahExpenses.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-red-950/20 border border-red-500/30 font-bold text-sm text-red-300">
              <span>Total Expenses</span>
              <span className="font-mono font-black text-red-400">BND {monthlyReport.totalExpenses.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center p-4 rounded-xl bg-slate-950 border-2 border-slate-800 font-extrabold text-base pt-3 mt-4">
            <span className="text-slate-200">Monthly Net Profit</span>
            <span className={`font-mono text-xl ${monthlyReport.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              BND {monthlyReport.netProfit.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* HISTORICAL MONTHLY ACCOUNT BALANCES HISTORY */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="pb-3 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Historical Monthly Account Balances
            <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              ALL TIME HISTORY
            </span>
          </h2>
          <p className="text-xs text-slate-400">Monthly account balance breakdown across Cash, Card Lulu, and Card Mizah</p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono font-bold border-b border-slate-800 text-[11px]">
              <tr>
                <th className="px-3 py-3">Month</th>
                <th className="px-3 py-3 text-right">Cash Net</th>
                <th className="px-3 py-3 text-right">Card Lulu Net</th>
                <th className="px-3 py-3 text-right">Card Mizah Net</th>
                <th className="px-3 py-3 text-right">Total Revenue</th>
                <th className="px-3 py-3 text-right">Total Expenses</th>
                <th className="px-3 py-3 text-right">Monthly Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium font-mono">
              {React.useMemo(() => {
                const monthsSet = new Set<string>();
                orders.forEach(o => { if (o.date && o.date.length >= 7) monthsSet.add(o.date.substring(0, 7)); });
                expenses.forEach(e => { if (e.date && e.date.length >= 7) monthsSet.add(e.date.substring(0, 7)); });
                if (monthsSet.size === 0) monthsSet.add(getBruneiMonthString());

                return Array.from(monthsSet).sort().reverse().map(m => {
                  const mOrders = orders.filter(o => o.date && o.date.startsWith(m));
                  const mExpenses = expenses.filter(e => e.date && e.date.startsWith(m));

                  let cIn = 0, lIn = 0, mIn = 0;
                  mOrders.forEach(o => {
                    const amt = o.totalAmount || 0;
                    if (o.paymentType === 'Cash' || o.paymentType === 'Binti Gym Transfer') cIn += amt;
                    else if (o.paymentType === 'Card Lulu') lIn += amt;
                    else if (o.paymentType === 'Card Mizah') mIn += amt;
                  });

                  let cOut = 0, lOut = 0, mOut = 0;
                  mExpenses.forEach(e => {
                    const amt = e.amount || 0;
                    if (e.paymentType === 'Cash') cOut += amt;
                    else if (e.paymentType === 'Card Lulu') lOut += amt;
                    else if (e.paymentType === 'Card Mizah') mOut += amt;
                  });

                  const cNet = cIn - cOut;
                  const lNet = lIn - lOut;
                  const mzNet = mIn - mOut;
                  const tSales = cIn + lIn + mIn;
                  const tExp = cOut + lOut + mOut;
                  const mNet = tSales - tExp;

                  return (
                    <tr key={m} className="hover:bg-slate-800/40 transition">
                      <td className="px-3 py-3 font-extrabold text-slate-200">{m}</td>
                      <td className="px-3 py-3 text-right text-slate-300">BND {cNet.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-slate-300">BND {lNet.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-slate-300">BND {mzNet.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-400">BND {tSales.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-bold text-red-400">BND {tExp.toFixed(2)}</td>
                      <td className={`px-3 py-3 text-right font-black ${mNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        BND {mNet.toFixed(2)}
                      </td>
                    </tr>
                  );
                });
              }, [orders, expenses])}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
