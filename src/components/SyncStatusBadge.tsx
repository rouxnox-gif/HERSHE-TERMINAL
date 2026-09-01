import React, { useEffect, useState } from 'react';
import { SyncConnectionState } from '../types';
import { connectivityService } from '../services/connectivityService';
import { forceSyncNow } from '../utils/firebaseSync';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface SyncStatusBadgeProps {
  compact?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ compact = false }) => {
  const [state, setState] = useState<SyncConnectionState>(() => connectivityService.getState());
  const [pendingCount, setPendingCount] = useState<number>(() => connectivityService.getPendingCount());
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useEffect(() => {
    const unsub = connectivityService.subscribe((newState, newCount) => {
      setState(newState);
      setPendingCount(newCount);
    });
    return () => unsub();
  }, []);

  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isManualSyncing) return;
    setIsManualSyncing(true);
    try {
      await forceSyncNow();
    } finally {
      setIsManualSyncing(false);
    }
  };

  const getStatusConfig = () => {
    if (isManualSyncing || state === 'SYNCING') {
      return {
        label: pendingCount > 0 ? `Syncing (${pendingCount})` : 'Syncing...',
        icon: <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />,
        bg: 'bg-sky-500/10 hover:bg-sky-500/20',
        border: 'border-sky-500/30',
        text: 'text-sky-300',
        dot: 'bg-sky-400 animate-ping',
      };
    }

    if (state === 'OFFLINE') {
      return {
        label: pendingCount > 0 ? `Offline (${pendingCount} queued)` : 'Offline',
        icon: <CloudOff className="w-3.5 h-3.5 text-amber-400" />,
        bg: 'bg-amber-500/10 hover:bg-amber-500/20',
        border: 'border-amber-500/30',
        text: 'text-amber-300',
        dot: 'bg-amber-400',
      };
    }

    if (state === 'ERROR') {
      return {
        label: pendingCount > 0 ? `Retry Sync (${pendingCount})` : 'Sync Issue',
        icon: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
        bg: 'bg-red-500/10 hover:bg-red-500/20',
        border: 'border-red-500/30',
        text: 'text-red-300',
        dot: 'bg-red-400',
      };
    }

    // Default: ONLINE / SYNCED
    if (pendingCount > 0) {
      return {
        label: `Pending Sync (${pendingCount})`,
        icon: <Cloud className="w-3.5 h-3.5 text-emerald-400" />,
        bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
        border: 'border-emerald-500/30',
        text: 'text-emerald-300',
        dot: 'bg-emerald-400',
      };
    }

    return {
      label: 'Cloud Synced',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
      bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
      border: 'border-emerald-500/20',
      text: 'text-emerald-300',
      dot: 'bg-emerald-400',
    };
  };

  const config = getStatusConfig();

  if (compact) {
    return (
      <button
        onClick={handleManualSync}
        className={`p-1.5 rounded-lg border flex items-center justify-center transition active:scale-95 cursor-pointer ${config.bg} ${config.border}`}
        title={`Status: ${config.label}. Click to sync now.`}
      >
        {config.icon}
      </button>
    );
  }

  return (
    <button
      onClick={handleManualSync}
      className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition active:scale-95 cursor-pointer select-none text-[11px] font-mono font-bold ${config.bg} ${config.border} ${config.text}`}
      title="Click to force immediate synchronization"
    >
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot.replace(' animate-ping', '')}`} />
      </span>
      {config.icon}
      <span className="truncate max-w-[120px]">{config.label}</span>
    </button>
  );
};
