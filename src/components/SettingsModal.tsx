import React, { useState } from 'react';
import { TabType, PaymentTypeConfig, StoreInfoSettings } from '../types';
import { APP_VERSION, BUILD_ID } from '../version';
import {
  ALL_APP_TABS,
  DEFAULT_PAYMENT_CONFIGS,
  saveHiddenTabs,
  savePaymentConfigs,
} from '../db/repositories/appSettingsRepo';
import {
  X,
  Sliders,
  CreditCard,
  Layout,
  Check,
  RotateCcw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Monitor,
  BarChart3,
  Boxes,
  Receipt,
  TrendingUp,
  PieChart,
  History,
  Clock,
  FileCheck,
  Store,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hiddenTabs?: TabType[];
  onUpdateHiddenTabs?: (tabs: TabType[]) => void;
  paymentConfigs?: PaymentTypeConfig[];
  onUpdatePaymentConfigs?: (configs: PaymentTypeConfig[]) => void;
  storeInfo?: StoreInfoSettings;
  onUpdateStoreInfo?: (info: StoreInfoSettings) => void;
  currentUserRole?: 'admin' | 'staff';
}

const TAB_ICONS: Record<TabType, React.ReactNode> = {
  sales: <Monitor className="w-4 h-4 text-emerald-400" />,
  customer: <Store className="w-4 h-4 text-emerald-400" />,
  dashboard: <BarChart3 className="w-4 h-4 text-sky-400" />,
  inventory: <Boxes className="w-4 h-4 text-amber-400" />,
  expenses: <Receipt className="w-4 h-4 text-rose-400" />,
  monthly: <TrendingUp className="w-4 h-4 text-indigo-400" />,
  distribution: <PieChart className="w-4 h-4 text-purple-400" />,
  history: <History className="w-4 h-4 text-cyan-400" />,
  pending: <Clock className="w-4 h-4 text-amber-300" />,
  receipts: <FileCheck className="w-4 h-4 text-emerald-300" />,
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  hiddenTabs = [],
  onUpdateHiddenTabs,
  paymentConfigs = DEFAULT_PAYMENT_CONFIGS,
  onUpdatePaymentConfigs,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'tabs' | 'payments'>('tabs');
  const [localHiddenTabs, setLocalHiddenTabs] = useState<TabType[]>(hiddenTabs || []);
  const [localPaymentConfigs, setLocalPaymentConfigs] = useState<PaymentTypeConfig[]>(
    paymentConfigs && paymentConfigs.length > 0 ? paymentConfigs : DEFAULT_PAYMENT_CONFIGS
  );
  const [newPaymentName, setNewPaymentName] = useState('');
  const [savedToast, setSavedToast] = useState(false);

  // Sync state when modal opens or external props update
  React.useEffect(() => {
    if (isOpen) {
      setLocalHiddenTabs(hiddenTabs || []);
      setLocalPaymentConfigs(
        paymentConfigs && paymentConfigs.length > 0 ? paymentConfigs : DEFAULT_PAYMENT_CONFIGS
      );
      setSavedToast(false);
    }
  }, [isOpen, hiddenTabs, paymentConfigs]);

  if (!isOpen) return null;

  const triggerToast = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const handleToggleTab = async (tabId: TabType) => {
    const currentList = localHiddenTabs || [];
    const isCurrentlyHidden = currentList.includes(tabId);
    if (!isCurrentlyHidden) {
      const visibleCount = ALL_APP_TABS.length - currentList.length;
      if (visibleCount <= 1) {
        alert('You must keep at least 1 tab visible.');
        return;
      }
    }

    const updated = isCurrentlyHidden
      ? currentList.filter((id) => id !== tabId)
      : [...currentList, tabId];

    setLocalHiddenTabs(updated);
    if (onUpdateHiddenTabs) {
      onUpdateHiddenTabs(updated);
    }
    await saveHiddenTabs(updated);
    triggerToast();
  };

  const handleShowAllTabs = async () => {
    setLocalHiddenTabs([]);
    if (onUpdateHiddenTabs) {
      onUpdateHiddenTabs([]);
    }
    await saveHiddenTabs([]);
    triggerToast();
  };

  const handlePaymentNameChange = async (id: string, newName: string) => {
    const currentList = localPaymentConfigs || DEFAULT_PAYMENT_CONFIGS;
    const updated = currentList.map((c) => (c.id === id ? { ...c, name: newName } : c));
    setLocalPaymentConfigs(updated);
    if (onUpdatePaymentConfigs) {
      onUpdatePaymentConfigs(updated);
    }
    await savePaymentConfigs(updated);
    triggerToast();
  };

  const handleTogglePaymentEnabled = async (id: string) => {
    const currentList = localPaymentConfigs || DEFAULT_PAYMENT_CONFIGS;
    const target = currentList.find((c) => c.id === id);
    if (!target) return;

    const enabledCount = currentList.filter((c) => c.enabled !== false).length;
    if (target.enabled !== false && enabledCount <= 1) {
      alert('At least one payment method must remain enabled.');
      return;
    }

    const updated = currentList.map((c) =>
      c.id === id ? { ...c, enabled: c.enabled === false ? true : false } : c
    );
    setLocalPaymentConfigs(updated);
    if (onUpdatePaymentConfigs) {
      onUpdatePaymentConfigs(updated);
    }
    await savePaymentConfigs(updated);
    triggerToast();
  };

  const handleAddCustomPayment = async () => {
    const name = newPaymentName.trim();
    if (!name) return;

    const currentList = localPaymentConfigs || DEFAULT_PAYMENT_CONFIGS;
    if (currentList.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      alert('A payment method with this name already exists.');
      return;
    }

    const customId = `custom_${Date.now()}`;
    const updated: PaymentTypeConfig[] = [
      ...currentList,
      { id: customId, name, enabled: true, isCustom: true },
    ];
    setLocalPaymentConfigs(updated);
    if (onUpdatePaymentConfigs) {
      onUpdatePaymentConfigs(updated);
    }
    await savePaymentConfigs(updated);
    setNewPaymentName('');
    triggerToast();
  };

  const handleDeleteCustomPayment = async (id: string) => {
    const currentList = localPaymentConfigs || DEFAULT_PAYMENT_CONFIGS;
    const updated = currentList.filter((c) => c.id !== id);
    setLocalPaymentConfigs(updated);
    if (onUpdatePaymentConfigs) {
      onUpdatePaymentConfigs(updated);
    }
    await savePaymentConfigs(updated);
    triggerToast();
  };

  const handleResetPaymentDefaults = async () => {
    setLocalPaymentConfigs(DEFAULT_PAYMENT_CONFIGS);
    if (onUpdatePaymentConfigs) {
      onUpdatePaymentConfigs(DEFAULT_PAYMENT_CONFIGS);
    }
    await savePaymentConfigs(DEFAULT_PAYMENT_CONFIGS);
    triggerToast();
  };

  const currentHiddenCount = (localHiddenTabs || []).length;
  const currentPaymentsList = localPaymentConfigs || DEFAULT_PAYMENT_CONFIGS;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 shrink-0 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">System Settings</h2>
              <p className="text-xs text-slate-400">
                Configure navigation tab visibility and custom payment methods
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savedToast && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1 animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                Saved
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

        {/* Subtab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-2 border-b border-slate-800 bg-slate-950/30 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('tabs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeSubTab === 'tabs'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layout className="w-4 h-4" />
            <span>Tabs Visibility</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
              {ALL_APP_TABS.length - currentHiddenCount}/{ALL_APP_TABS.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('payments')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeSubTab === 'payments'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Payment Methods</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
              {currentPaymentsList.length}
            </span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {activeSubTab === 'tabs' ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-200 block">Manage Navigation Tabs</span>
                  <p className="text-[11px] text-slate-400">
                    Toggle tabs on or off to show or hide them from the sidebar and mobile menu.
                  </p>
                </div>
                <button
                  onClick={handleShowAllTabs}
                  disabled={currentHiddenCount === 0}
                  className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Show All Tabs</span>
                </button>
              </div>

              {/* Tabs List */}
              <div className="space-y-2">
                {ALL_APP_TABS.map((tab) => {
                  const isVisible = !localHiddenTabs.includes(tab.id);

                  return (
                    <div
                      key={tab.id}
                      onClick={() => handleToggleTab(tab.id)}
                      className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer select-none ${
                        isVisible
                          ? 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          : 'bg-slate-950/40 border-slate-800/40 opacity-60 hover:opacity-80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-xl border ${
                            isVisible
                              ? 'bg-slate-900 border-slate-800'
                              : 'bg-slate-900/50 border-slate-800/50'
                          }`}
                        >
                          {TAB_ICONS[tab.id] || <Layout className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-white truncate">
                              {tab.label}
                            </span>
                            {tab.id === 'customer' && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                                Public Portal
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-1 truncate">
                            {tab.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
                            isVisible
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-900 text-slate-500 border-slate-800'
                          }`}
                        >
                          {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          <span>{isVisible ? 'Visible' : 'Hidden'}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* PAYMENT METHODS SUBTAB */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-200 block">
                    Checkout Payment Methods
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Rename payment methods, enable/disable options, or add custom payment types.
                  </p>
                </div>
                <button
                  onClick={handleResetPaymentDefaults}
                  className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reset Default Types</span>
                </button>
              </div>

              {/* Payment Methods Edit List */}
              <div className="space-y-2.5">
                {currentPaymentsList.map((config, index) => {
                  const isEnabled = config.enabled !== false;

                  return (
                    <div
                      key={config.id}
                      className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 shrink-0 font-mono font-bold text-xs">
                          #{index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                            {config.isCustom ? 'Custom Payment Method' : `Original Key: ${config.id}`}
                          </label>
                          <input
                            type="text"
                            value={config.name}
                            onChange={(e) => handlePaymentNameChange(config.id, e.target.value)}
                            placeholder="Payment Name"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-bold text-slate-100 focus:outline-none transition"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                        <button
                          type="button"
                          onClick={() => handleTogglePaymentEnabled(config.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                            isEnabled
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-400'
                          }`}
                          title={isEnabled ? 'Click to disable in POS' : 'Click to enable in POS'}
                        >
                          {isEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          <span>{isEnabled ? 'Enabled' : 'Disabled'}</span>
                        </button>

                        {config.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomPayment(config.id)}
                            className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition cursor-pointer"
                            title="Remove custom payment method"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Custom Payment Method */}
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={newPaymentName}
                  onChange={(e) => setNewPaymentName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomPayment();
                    }
                  }}
                  placeholder="e.g. QR Pay / Baiduri Qpay"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-xl text-xs font-medium text-slate-200 placeholder:text-slate-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomPayment}
                  disabled={!newPaymentName.trim()}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Payment Type</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Settings update live and persist across devices</span>
            <span className="sm:hidden">Settings auto-save</span>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 ml-1">v{APP_VERSION}</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
