import React, { useState } from 'react';
import { Expense, PaymentMethod, PaymentTypeConfig } from '../types';
import { DEFAULT_PAYMENT_CONFIGS } from '../db/repositories/appSettingsRepo';
import { getBruneiDateString } from '../data/initialData';
import { Receipt, Plus, Trash2, Calendar, CreditCard, DollarSign } from 'lucide-react';

interface ExpensesViewProps {
  expenses: Expense[];
  paymentConfigs?: PaymentTypeConfig[];
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses = [],
  paymentConfigs = DEFAULT_PAYMENT_CONFIGS,
  onAddExpense,
  onDeleteExpense,
}) => {
  const safePaymentConfigs = Array.isArray(paymentConfigs) && paymentConfigs.length > 0 ? paymentConfigs : DEFAULT_PAYMENT_CONFIGS;
  const enabledPaymentConfigs = safePaymentConfigs.filter(c => c && c.enabled !== false);
  const [date, setDate] = useState<string>(getBruneiDateString());
  const [description, setDescription] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentMethod>(
    (enabledPaymentConfigs[0]?.name || 'Cash') as PaymentMethod
  );
  const [amount, setAmount] = useState('');
  const [successLogged, setSuccessLogged] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    const desc = description.trim();

    if (!date || !desc || isNaN(amt) || amt <= 0) {
      alert('Please fill in all expense details with a valid positive amount.');
      return;
    }

    const newExp: Expense = {
      id: `exp-${Date.now()}`,
      date,
      description: desc,
      paymentType,
      amount: amt,
    };

    onAddExpense(newExp);

    setDescription('');
    setAmount('');
    setSuccessLogged(true);
    setTimeout(() => setSuccessLogged(false), 1500);
  };

  return (
    <div className="max-w-4xl mx-auto w-full p-4 md:p-6 space-y-6">
      {/* Expense Form */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Log Store Expense</h2>
            <p className="text-xs text-slate-400">Record inventory payouts, utility bills, and supply purchases</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-slate-700"
                  required
                />
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Payment Method
              </label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as PaymentMethod)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-slate-700"
              >
                {enabledPaymentConfigs.map((cfg) => (
                  <option key={cfg.id} value={cfg.name}>
                    {cfg.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Expense Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Fresh Milk & Fruit Supplies"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-700"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Amount (BND)
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-red-400 placeholder:text-slate-600 focus:outline-none focus:border-slate-700"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className={`w-full py-3.5 px-4 rounded-xl font-extrabold text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer
              ${successLogged
                ? 'bg-emerald-600 text-white'
                : 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20 active:scale-[0.99]'
              }
            `}
          >
            {successLogged ? '✓ EXPENSE LOGGED!' : 'LOG EXPENSE'}
          </button>
        </form>
      </div>

      {/* Expense History Table */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white pb-3 border-b border-slate-800">
          Recent Expenses History
        </h3>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono font-bold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 text-right">BND</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No recorded expenses yet.
                  </td>
                </tr>
              ) : (
                expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-mono text-slate-300">{exp.date}</td>
                    <td className="px-4 py-3 text-slate-200">{exp.description}</td>
                    <td className="px-4 py-3 text-slate-400">{exp.paymentType}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-red-400">
                      ${exp.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onDeleteExpense(exp.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                        title="Delete expense entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
