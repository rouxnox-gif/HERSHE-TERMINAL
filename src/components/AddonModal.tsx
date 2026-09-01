import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

interface AddonModalProps {
  isOpen: boolean;
  onClose: () => void;
  drinkName: string;
  basePrice: number;
  onConfirm: (protein: boolean, oat: boolean) => void;
}

export const AddonModal: React.FC<AddonModalProps> = ({
  isOpen,
  onClose,
  drinkName,
  basePrice,
  onConfirm,
}) => {
  const [protein, setProtein] = useState(false);
  const [oat, setOat] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProtein(false);
      setOat(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const calculateTotal = () => {
    let total = basePrice;
    if (protein) total += 2.00;
    if (oat) total += 0.50;
    return total;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div>
          <h3 className="text-lg font-bold text-white">{drinkName}</h3>
          <p className="text-xs font-mono font-semibold text-emerald-400 mt-0.5">
            Base Price: ${basePrice.toFixed(2)}
          </p>
        </div>

        <div className="space-y-2.5">
          {/* Protein option */}
          <button
            type="button"
            onClick={() => setProtein(!protein)}
            className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer select-none
              ${protein 
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' 
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded border flex items-center justify-center
                ${protein ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-700 bg-slate-900'}
              `}>
                {protein && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <span className="font-semibold text-sm">+ Protein</span>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-400">+$2.00</span>
          </button>

          {/* Oat option */}
          <button
            type="button"
            onClick={() => setOat(!oat)}
            className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer select-none
              ${oat 
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' 
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded border flex items-center justify-center
                ${oat ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-700 bg-slate-900'}
              `}>
                {oat && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <span className="font-semibold text-sm">+ Oat</span>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-400">+$0.50</span>
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(protein, oat)}
            className="flex-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition shadow-lg shadow-emerald-500/20"
          >
            ADD TO TICKET (${calculateTotal().toFixed(2)})
          </button>
        </div>
      </div>
    </div>
  );
};
