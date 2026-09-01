import React, { useState } from 'react';
import { UserRole, UserSession, StaffShift } from '../types';
import { getBruneiDateString } from '../data/initialData';
import { LogIn, UserCheck, ShieldCheck, User, Sparkles, Clock, KeyRound, ShoppingBag } from 'lucide-react';

interface StaffCheckInModalProps {
  onCheckIn: (session: UserSession, newShift: StaffShift) => void;
  activeShiftCount?: number;
  onOpenCustomerPortal?: () => void;
}

export const StaffCheckInModal: React.FC<StaffCheckInModalProps> = ({
  onCheckIn,
  activeShiftCount = 0,
  onOpenCustomerPortal,
}) => {
  const [inputName, setInputName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inputName.trim();

    if (!raw) {
      setErrorMsg('Please enter your name to check in.');
      return;
    }

    let role: UserRole = 'staff';
    let cleanName = raw;

    const lower = raw.toLowerCase();
    if (lower === 'admin' || lower === 'admi' || lower.startsWith('admin') || lower.startsWith('admi')) {
      role = 'admin';
      if (lower === 'admin' || lower === 'admi') {
        cleanName = 'Admin';
      } else if (lower.startsWith('admi->')) {
        cleanName = raw.substring(6).trim() || 'Admin';
      } else if (lower.startsWith('admin->')) {
        cleanName = raw.substring(7).trim() || 'Admin';
      } else if (lower.startsWith('admin ')) {
        cleanName = raw.substring(6).trim() || 'Admin';
      } else if (lower.startsWith('admi ')) {
        cleanName = raw.substring(5).trim() || 'Admin';
      } else {
        cleanName = raw.replace(/^admin|^admi/i, '').trim() || 'Admin';
      }
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = getBruneiDateString();

    const session: UserSession = {
      name: cleanName,
      role: role,
      checkInTime: timeStr,
      date: dateStr,
    };

    const newShift: StaffShift = {
      id: 'SHIFT-' + Date.now(),
      staffName: role === 'admin' ? `${cleanName} (Admin)` : cleanName,
      role: role,
      checkInDate: dateStr,
      checkInTime: timeStr,
      status: 'active',
    };

    onCheckIn(session, newShift);
  };

  const lowerInput = inputName.trim().toLowerCase();
  const detectedAdmin = lowerInput === 'admin' || lowerInput === 'admi' || lowerInput.startsWith('admin') || lowerInput.startsWith('admi');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 relative overflow-hidden">
        {/* Background Subtle Accent Glow */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Title & Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-1">
            <UserCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Staff Shift Check-In</h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Please check in with your name to start your POS terminal shift.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleCheckInSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Enter Staff Name</span>
              {detectedAdmin && (
                <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Admin Mode Triggered
                </span>
              )}
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                {detectedAdmin ? (
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                ) : (
                  <User className="w-4 h-4 text-slate-400" />
                )}
              </div>

              <input
                type="text"
                value={inputName}
                onChange={(e) => {
                  setInputName(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="e.g. Type your name"
                className={`w-full pl-10 pr-4 py-3 bg-slate-950 border rounded-xl text-xs font-semibold text-slate-100 placeholder:text-slate-600 focus:outline-none transition
                  ${detectedAdmin 
                    ? 'border-amber-500/60 focus:border-amber-400 bg-amber-950/10' 
                    : 'border-slate-800 focus:border-emerald-500'
                  }
                `}
                autoFocus
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-red-400 font-semibold mt-1.5">{errorMsg}</p>
            )}
          </div>

          {/* Role Instructions Box */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs">
            <div className="flex items-start gap-2 text-slate-300">
              <User className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-bold">Regular Staff Check-In</strong>
                <span className="text-slate-400 text-[11px]">
                  Type your name to check in. Gives access to the <strong>POS Terminal</strong>.
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-start gap-2 text-slate-300">
              <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-bold">Admin Manager Access</strong>
                <span className="text-slate-400 text-[11px]">
                  Admin account provides full access to Dashboard, Reports, & History.
                </span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-98
              ${detectedAdmin
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
              }
            `}
          >
            <LogIn className="w-4 h-4" />
            <span>{detectedAdmin ? 'Check In as Admin' : 'Start Staff Shift & Open Terminal'}</span>
          </button>

          {/* Direct Customer Menu Access (No Sign-In Required) */}
          {onOpenCustomerPortal && (
            <div className="pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onOpenCustomerPortal}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 shadow-sm group"
              >
                <ShoppingBag className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Open Customer Menu & Pre-Order (No Sign-In Required)</span>
              </button>
            </div>
          )}
        </form>

        {activeShiftCount > 0 && (
          <p className="text-[11px] text-center text-slate-500 font-mono">
            {activeShiftCount} staff session{activeShiftCount !== 1 ? 's' : ''} recorded in shift log
          </p>
        )}
      </div>
    </div>
  );
};
