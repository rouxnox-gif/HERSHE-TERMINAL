import React, { useState, useEffect } from 'react';
import { StorageData } from '../utils/storage';
import {
  pushDataToGoogleSheets,
  getStoreSavedSpreadsheetId,
  saveSpreadsheetId,
  clearSavedSpreadsheetId,
} from '../utils/googleSheetsSync';
import {
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  RefreshCw,
  Sparkles,
  Database,
  Store,
  ShieldCheck,
} from 'lucide-react';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: StorageData;
  storePin?: string | null;
  storeName?: string;
  storeId?: string | null;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  data,
  storePin,
  storeName,
  storeId,
}) => {
  const [spreadsheetId, setSpreadsheetId] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmSync, setConfirmSync] = useState<boolean>(false);
  const [loadingSheetId, setLoadingSheetId] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      setLoadingSheetId(true);
      setErrorMessage(null);
      getStoreSavedSpreadsheetId(storePin, storeId)
        .then((saved) => {
          if (!isMounted) return;
          if (saved) {
            setSpreadsheetId(saved);
            setSuccessUrl(`https://docs.google.com/spreadsheets/d/${saved}`);
          } else {
            setSpreadsheetId('');
            setSuccessUrl(null);
          }
        })
        .finally(() => {
          if (isMounted) setLoadingSheetId(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, storePin, storeId]);

  if (!isOpen) return null;

  const handleStartSync = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    try {
      if (spreadsheetId.trim()) {
        await saveSpreadsheetId(spreadsheetId.trim(), storePin, storeId, storeName);
      }
      const result = await pushDataToGoogleSheets(
        data,
        spreadsheetId.trim() || undefined,
        { storePin, storeName, storeId }
      );
      setSpreadsheetId(result.spreadsheetId);
      setSuccessUrl(result.url);
      setConfirmSync(false);
    } catch (err: any) {
      console.error('Google Sheets Export Error:', err);
      setErrorMessage(err?.message || 'An error occurred while pushing data to Google Sheets.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleUnlink = async () => {
    await clearSavedSpreadsheetId(storePin, storeId);
    setSpreadsheetId('');
    setSuccessUrl(null);
    setErrorMessage(null);
  };

  const generatedSheetTitle = storeName && storePin
    ? `Hershe POS - ${storeName} (PIN: ${storePin}) - Data Sync`
    : storePin
      ? `Hershe POS - Store PIN ${storePin} - Data Sync`
      : 'Hershe POS - Store Data Sync';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Export to Google Sheets
                <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  LIVE SYNC
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Push all POS Sales (with Staff on shift), Expenses, Shift Logs, and Monthly Balances directly to Google Sheets
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

        {/* Store PIN & Partition Indicator */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <span className="text-white font-bold block">{storeName || 'HERSHE Store'}</span>
              <span className="text-[11px] text-slate-400">
                Store PIN: <strong className="text-emerald-400 font-mono font-extrabold">{storePin ? `#${storePin}` : 'Default Store'}</strong>
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" />
              Store-Isolated Sheet
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Separate per PIN</span>
          </div>
        </div>

        {/* Data Summary Grid */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-3">
          <span className="text-xs font-mono uppercase tracking-wider font-bold text-slate-400 block flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" /> Current Store Records Ready for Sync
          </span>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Sales</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-400 font-mono">
                {data.orders?.length || 0}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Expenses</span>
              <span className="text-xs sm:text-sm font-bold text-red-400 font-mono">
                {data.expenses?.length || 0}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Shifts</span>
              <span className="text-xs sm:text-sm font-bold text-sky-400 font-mono">
                {data.shifts?.length || 0}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Monthly</span>
              <span className="text-xs sm:text-sm font-bold text-amber-400 font-mono">
                History
              </span>
            </div>
          </div>
        </div>

        {/* Saved Spreadsheet Status or Input */}
        {loadingSheetId ? (
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-center flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Loading store sheet configuration...</span>
          </div>
        ) : successUrl ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="leading-tight">
                <span className="font-bold text-sm text-white block">Connected to Google Sheet</span>
                <span className="text-xs text-slate-300 font-mono break-all">ID: {spreadsheetId}</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-300 leading-relaxed bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20">
              Linked exclusively to <strong className="text-emerald-300">Store PIN #{storePin || 'Default'}</strong>. Other store PINs will not share or overwrite this spreadsheet.
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-500/20">
              <a
                href={successUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-400 transition shadow-lg cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Google Sheet</span>
              </a>

              <button
                onClick={handleUnlink}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700/80 transition cursor-pointer"
              >
                Unlink Sheet ID
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Google Spreadsheet ID for PIN #{storePin || 'Default'} (Optional)
            </label>
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="Leave blank to automatically create a dedicated sheet for this PIN"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500 transition"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              If left blank, a dedicated spreadsheet named <strong className="text-emerald-400 font-mono">"{generatedSheetTitle}"</strong> will be created in your Google Drive, isolated to this store PIN.
            </p>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Sync Error</span>
              <p className="text-[11px] leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* User Confirmation Step before mutating data */}
        {confirmSync ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="font-bold text-xs text-white">Confirm Data Export / Overwrite</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              You are about to export <strong>{data.orders?.length || 0} orders</strong>,{' '}
              <strong>{data.expenses?.length || 0} expenses</strong>, and{' '}
              <strong>{data.shifts?.length || 0} shift logs</strong> into your Google Sheet.
              This will update the tabs with the latest records.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleStartSync}
                disabled={isExporting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Pushing Data...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Yes, Export Now</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setConfirmSync(false)}
                disabled={isExporting}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => setConfirmSync(true)}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{successUrl ? 'Sync / Update Sheet' : 'Export to Google Sheets'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
