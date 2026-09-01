import React, { useState } from 'react';
import { StaffShift } from '../types';
import { Clock, UserCheck, ShieldCheck, X, CheckCircle, Calendar, Trash2, Search, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';

interface ShiftLogModalProps {
  shifts: StaffShift[];
  onClose: () => void;
  onClearShifts?: () => Promise<void> | void;
  onDeleteShift?: (id: string) => Promise<void> | void;
}

export const ShiftLogModal: React.FC<ShiftLogModalProps> = ({
  shifts = [],
  onClose,
  onClearShifts,
  onDeleteShift,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const filteredShifts = (shifts || []).filter(s => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (s.staffName && s.staffName.toLowerCase().includes(term)) ||
      (s.checkInDate && s.checkInDate.toLowerCase().includes(term)) ||
      (s.role && s.role.toLowerCase().includes(term)) ||
      (s.status && s.status.toLowerCase().includes(term))
    );
  });

  const activeCount = (shifts || []).filter(s => s.status === 'active').length;
  const endedCount = (shifts || []).length - activeCount;

  const handleClearAll = async () => {
    if (!onClearShifts) return;
    setIsClearing(true);
    try {
      await onClearShifts();
      setShowConfirmClear(false);
      showToast('All shift logs have been cleared.');
    } catch (err) {
      console.error('Failed to clear shifts:', err);
      alert('Failed to clear shift logs. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteSingle = async (shift: StaffShift) => {
    if (!onDeleteShift) return;
    const confirmMsg = `Delete shift log for ${shift.staffName} on ${shift.checkInDate} (${shift.checkInTime})?`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(shift.id);
    try {
      await onDeleteShift(shift.id);
      showToast(`Shift log for ${shift.staffName} deleted.`);
    } catch (err) {
      console.error('Failed to delete shift:', err);
      alert('Failed to delete shift record. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl space-y-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 shrink-0 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-white">Staff Attendance & Shift Logs</h3>
              <p className="text-xs text-slate-400">Record of staff check-ins, check-outs, and shift history</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {toastMessage && (
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 animate-in fade-in">
                <CheckCircle className="w-3.5 h-3.5" />
                {toastMessage}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats & Search Bar */}
        <div className="px-5 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-bold">
                Total: <span className="text-emerald-400 font-mono">{(shifts || []).length}</span>
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">
                Active: <span className="font-mono">{activeCount}</span>
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 font-bold">
                Ended: <span className="font-mono">{endedCount}</span>
              </span>
            </div>

            <div className="relative flex-1 sm:max-w-xs min-w-[160px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search staff, date, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Confirm Clear Alert Banner */}
          {showConfirmClear && (
            <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/30 flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5 text-xs text-red-300">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Are you sure you want to permanently clear all <strong>{(shifts || []).length}</strong> shift records?</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  disabled={isClearing}
                  className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={isClearing}
                  className="px-3 py-1 rounded-xl bg-red-500 hover:bg-red-400 text-slate-950 text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-red-500/20"
                >
                  {isClearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>{isClearing ? 'Clearing...' : 'Confirm Clear'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Shift List Table */}
        <div className="overflow-y-auto flex-1 min-h-0 px-5 space-y-2 no-scrollbar">
          {filteredShifts.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs space-y-2">
              <Clock className="w-8 h-8 mx-auto text-slate-700 opacity-50" />
              <p>
                {searchTerm ? 'No shift logs matched your search.' : 'No staff shift records found yet.'}
              </p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-3.5">Staff Name</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Check In</th>
                    <th className="py-3 px-3">Check Out</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredShifts.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-900/50 transition">
                      <td className="py-3 px-3.5 font-bold text-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>{s.staffName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                            s.role === 'admin'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-slate-900 text-slate-300 border-slate-800'
                          }`}
                        >
                          {s.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">{s.checkInDate}</td>
                      <td className="py-3 px-3 font-mono text-emerald-400 font-bold">{s.checkInTime}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">{s.checkOutTime || '—'}</td>
                      <td className="py-3 px-3 text-center">
                        {s.status === 'active' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-slate-400 border border-slate-800">
                            Ended
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {onDeleteShift && (
                          <button
                            onClick={() => handleDeleteSingle(s)}
                            disabled={deletingId === s.id}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition cursor-pointer disabled:opacity-50"
                            title="Delete this shift record"
                          >
                            {deletingId === s.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/50 shrink-0">
          <span className="text-[11px] text-slate-500">
            Showing {filteredShifts.length} of {(shifts || []).length} records
          </span>

          <div className="flex items-center gap-2">
            {(shifts || []).length > 0 && onClearShifts && (
              <button
                type="button"
                onClick={() => setShowConfirmClear(true)}
                disabled={isClearing || showConfirmClear}
                className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Logs</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
