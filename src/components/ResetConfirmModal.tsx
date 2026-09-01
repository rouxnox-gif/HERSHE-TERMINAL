import React from 'react';
import { RotateCcw, AlertTriangle, X, ShieldAlert } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-red-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                Reset Store Data?
              </h3>
              <p className="text-xs text-slate-400">
                Action requires confirmation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Content Box */}
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-red-400 text-sm">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Are you sure you want to reset all store data?</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-300">
            This operation will reset the drink menu products back to default and clear all:
          </p>
          <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1 pl-1">
            <li>Sales transaction history and receipts</li>
            <li>Expense records</li>
            <li>Pending sales approvals</li>
            <li>Staff shift logs</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition cursor-pointer active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-900/30 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Yes, Reset Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
