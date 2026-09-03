import React, { useState, useEffect } from 'react';
import { Check, Plus, Settings } from 'lucide-react';
import { CustomAddon } from '../types';

interface AddonModalProps {
  isOpen: boolean;
  onClose: () => void;
  drinkName: string;
  basePrice: number;
  availableAddons?: CustomAddon[];
  onConfirm: (protein: boolean, oat: boolean, selectedAddons?: CustomAddon[]) => void;
  onOpenStoreAddons?: () => void;
}

export const AddonModal: React.FC<AddonModalProps> = ({
  isOpen,
  onClose,
  drinkName,
  basePrice,
  availableAddons = [],
  onConfirm,
  onOpenStoreAddons,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter only enabled add-ons
  const activeAddons = availableAddons.filter((a) => a.enabled !== false);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleAddon = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedList = activeAddons.filter((a) => selectedIds.has(a.id));
  const addonsTotal = selectedList.reduce((acc, a) => acc + (a.price || 0), 0);
  const grandTotal = basePrice + addonsTotal;

  const hasProtein = selectedList.some((a) => a.name.toLowerCase().includes('protein') || a.id === 'protein');
  const hasOat = selectedList.some((a) => a.name.toLowerCase().includes('oat') || a.id === 'oat');

  const handleConfirm = () => {
    onConfirm(hasProtein, hasOat, selectedList);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">{drinkName}</h3>
            <p className="text-xs font-mono font-semibold text-emerald-400 mt-0.5">
              Base Price: ${basePrice.toFixed(2)}
            </p>
          </div>
          {onOpenStoreAddons && (
            <button
              onClick={() => {
                onClose();
                onOpenStoreAddons();
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 transition"
              title="Manage store add-ons"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Addons List */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {activeAddons.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-slate-950 text-center space-y-2">
              <p className="text-xs text-slate-400">No add-ons configured for this store yet.</p>
              {onOpenStoreAddons && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenStoreAddons();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Configure Store Add-ons</span>
                </button>
              )}
            </div>
          ) : (
            activeAddons.map((addon) => {
              const isSelected = selectedIds.has(addon.id);
              return (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => toggleAddon(addon.id)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer select-none
                    ${isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center shrink-0
                      ${isSelected ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-700 bg-slate-900'}
                    `}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs truncate">{addon.name}</div>
                      {addon.description && (
                        <div className="text-[10px] text-slate-500 truncate">{addon.description}</div>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-400 shrink-0 ml-2">
                    +${(addon.price || 0).toFixed(2)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-2.5 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition shadow-lg shadow-emerald-500/20 active:scale-98"
          >
            ADD TO TICKET (${grandTotal.toFixed(2)})
          </button>
        </div>
      </div>
    </div>
  );
};
