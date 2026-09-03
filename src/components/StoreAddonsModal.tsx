import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Sparkles, Layers } from 'lucide-react';
import { CustomAddon, StoreInfoSettings } from '../types';

interface StoreAddonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeInfo: StoreInfoSettings;
  onSaveStoreInfo: (updatedInfo: StoreInfoSettings) => void;
}

export const StoreAddonsModal: React.FC<StoreAddonsModalProps> = ({
  isOpen,
  onClose,
  storeInfo,
  onSaveStoreInfo,
}) => {
  const addons: CustomAddon[] = storeInfo.addons || [];

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const numPrice = parseFloat(price);

    if (!cleanName) {
      alert('Please enter an add-on name.');
      return;
    }
    if (isNaN(numPrice) || numPrice < 0) {
      alert('Please enter a valid non-negative price.');
      return;
    }

    if (editingId) {
      // Update existing
      const updated = addons.map((a) =>
        a.id === editingId
          ? { ...a, name: cleanName, price: numPrice, description: description.trim() }
          : a
      );
      onSaveStoreInfo({ ...storeInfo, addons: updated });
      setEditingId(null);
    } else {
      // Create new
      const newAddon: CustomAddon = {
        id: `addon-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: cleanName,
        price: numPrice,
        description: description.trim(),
        enabled: true,
      };
      onSaveStoreInfo({ ...storeInfo, addons: [...addons, newAddon] });
    }

    setName('');
    setPrice('');
    setDescription('');
  };

  const handleStartEdit = (addon: CustomAddon) => {
    setEditingId(addon.id);
    setName(addon.name);
    setPrice(addon.price.toString());
    setDescription(addon.description || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setDescription('');
  };

  const handleToggle = (id: string) => {
    const updated = addons.map((a) =>
      a.id === id ? { ...a, enabled: a.enabled === false ? true : false } : a
    );
    onSaveStoreInfo({ ...storeInfo, addons: updated });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to remove this add-on from your store menu?')) return;
    const updated = addons.filter((a) => a.id !== id);
    onSaveStoreInfo({ ...storeInfo, addons: updated });
    if (editingId === id) {
      handleCancelEdit();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">Store Add-ons & Modifiers</h3>
              <p className="text-xs text-slate-400">
                Add and customize your own add-ons (extra shot, boba, collagen, syrup, etc.)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {/* Add / Edit Form */}
          <form
            onSubmit={handleAddOrUpdate}
            className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                {editingId ? 'Edit Add-on' : 'Add New Custom Add-on'}
              </span>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Add-on Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Extra Whey Protein, Oat Milk, Chia Seeds"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Price ($ BND) *
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  required
                  placeholder="e.g. 1.50"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono font-bold text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Description / Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 25g Whey protein scoop boost"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {editingId ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Plus className="w-3.5 h-3.5 stroke-[3]" />}
                <span>{editingId ? 'Update Add-on' : 'Save New Add-on'}</span>
              </button>
            </div>
          </form>

          {/* Current Add-ons List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                Store Add-ons ({addons.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Shown to customers and in POS terminal
              </span>
            </div>

            {addons.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center space-y-1.5">
                <Layers className="w-8 h-8 mx-auto text-slate-700" />
                <p className="text-xs font-bold text-slate-400">No custom add-ons yet</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Add add-ons like Protein Scoop, Oat Milk, Boba, or Honey above to make them available.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {addons.map((a) => {
                  const isEnabled = a.enabled !== false;
                  return (
                    <div
                      key={a.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                        isEnabled
                          ? 'bg-slate-950 border-slate-800'
                          : 'bg-slate-950/40 border-slate-900 opacity-60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-100">{a.name}</span>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 font-mono text-[10px] font-bold text-emerald-400">
                            +${(a.price || 0).toFixed(2)}
                          </span>
                          {!isEnabled && (
                            <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                              Disabled
                            </span>
                          )}
                        </div>
                        {a.description && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{a.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggle(a.id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                            isEnabled
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                          title="Toggle availability"
                        >
                          {isEnabled ? 'Active' : 'Off'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(a)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
                          title="Edit add-on"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition"
                          title="Delete add-on"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
