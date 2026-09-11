import React, { useState } from 'react';
import { TabType, UserSession } from '../types';
import { 
  BarChart3, 
  Monitor, 
  Receipt, 
  TrendingUp, 
  History, 
  Clock, 
  FileCheck,
  RotateCcw,
  Store,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  X,
  Sparkles,
  LogOut,
  UserCheck,
  ShieldCheck,
  Users,
  FileSpreadsheet,
  PieChart,
  Boxes,
  Sliders,
  ShoppingBag
} from 'lucide-react';
import { SyncStatusBadge } from './SyncStatusBadge';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  pendingCount: number;
  preOrdersCount?: number;
  pendingApprovalsCount?: number;
  lowStockCount?: number;
  onResetData: () => void;
  currentUser: UserSession | null;
  onEndShift: () => void;
  onOpenShiftLogs?: () => void;
  onOpenGoogleSheets?: () => void;
  onOpenSettings?: () => void;
  activePinCode?: string | null;
  onOpenStorePinModal?: () => void;
  hiddenTabs?: TabType[];
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  pendingCount,
  preOrdersCount,
  pendingApprovalsCount,
  lowStockCount = 0,
  onResetData,
  currentUser,
  onEndShift,
  onOpenShiftLogs,
  onOpenGoogleSheets,
  onOpenSettings,
  activePinCode,
  onOpenStorePinModal,
  hiddenTabs = [],
}) => {
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const isStaffOnly = currentUser?.role === 'staff';
  const currentHiddenList = Array.isArray(hiddenTabs) ? hiddenTabs : [];

  const allTabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }[] = [
    { id: 'sales', label: 'Terminal', icon: <Monitor className="w-5 h-5" /> },
    { id: 'customer', label: 'Customer Menu', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'inventory', label: 'Inventory', icon: <Boxes className="w-5 h-5" />, badge: lowStockCount > 0 ? lowStockCount : undefined, badgeColor: 'bg-amber-500 text-slate-950' },
    { id: 'expenses', label: 'Expenses', icon: <Receipt className="w-5 h-5" /> },
    { id: 'monthly', label: 'Reports', icon: <TrendingUp className="w-5 h-5" /> },
    { id: 'distribution', label: 'Partnership distribution', icon: <PieChart className="w-5 h-5" /> },
    { id: 'history', label: 'History', icon: <History className="w-5 h-5" /> },
    { id: 'pending', label: 'Pending & Pre-Orders', icon: <Clock className="w-5 h-5" />, badge: pendingCount, badgeColor: 'bg-emerald-500 text-slate-950' },
    { id: 'receipts', label: 'Receipts', icon: <FileCheck className="w-5 h-5" /> },
  ];

  // Filter tabs for staff role and hidden tab settings
  const availableTabs = isStaffOnly
    ? allTabs.filter(t => t.id === 'sales')
    : allTabs.filter(t => !currentHiddenList.includes(t.id));

  // Determine mobile tabs filtered by hidden status
  const visiblePrimaryCandidates: TabType[] = ['sales', 'inventory', 'dashboard', 'expenses'];
  const activePrimaryIds = visiblePrimaryCandidates.filter(id => !currentHiddenList.includes(id));
  
  // If fewer than 4 primary tabs are visible, pick from remaining visible tabs
  const remainingVisibleTabs = availableTabs.filter(t => !activePrimaryIds.includes(t.id));
  const finalPrimaryIds = isStaffOnly 
    ? ['sales' as TabType]
    : [...activePrimaryIds, ...remainingVisibleTabs.map(t => t.id)].slice(0, 4);

  const primaryMobileTabs = availableTabs.filter(t => finalPrimaryIds.includes(t.id));
  const secondaryMobileTabs = isStaffOnly
    ? []
    : availableTabs.filter(t => !finalPrimaryIds.includes(t.id));

  return (
    <>
      {/* FLOATING TOGGLE BUTTON FOR DESKTOP (When Totally Collapsed) */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="hidden md:flex fixed top-4 left-4 z-50 items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-emerald-400 shadow-2xl backdrop-blur-md transition active:scale-95 cursor-pointer hover:border-emerald-500/50 group"
          title="Expand Navigation Panel"
        >
          <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-200">MENU</span>
          {pendingCount > 0 && !isStaffOnly && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>
      )}

      {/* MOBILE TOP BAR */}
      <header className="md:hidden bg-slate-950 border-b border-slate-800 px-3 py-2 pt-[max(0.6rem,env(safe-area-inset-top))] flex items-center justify-between gap-2 sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-xs tracking-wider text-emerald-400 font-mono leading-none truncate">
              HERSHE POS
            </h1>
            {currentUser && (
              <span className={`text-[10px] font-bold block mt-0.5 truncate ${currentUser.role === 'admin' ? 'text-amber-400' : 'text-slate-300'}`}>
                {currentUser.role === 'admin' ? '⚡ Admin' : '👤 Staff'}: {currentUser.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 overflow-x-auto no-scrollbar max-w-[65%] justify-end">
          <SyncStatusBadge compact={true} />

          {/* Terminal Button at Top for Mobile Staff */}
          {isStaffOnly && (
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 ${
                activeTab === 'sales'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 text-emerald-400" />
              <span>Terminal</span>
            </button>
          )}

          {onOpenStorePinModal && (
            <button
              onClick={onOpenStorePinModal}
              className="px-2 py-1 rounded-lg bg-slate-900 border border-amber-500/30 text-amber-300 font-mono font-bold text-[11px] flex items-center gap-1 active:scale-95 transition cursor-pointer shrink-0"
              title="Store PIN Sync - Connect devices using this 4-digit PIN"
            >
              <Store className="w-3.5 h-3.5 text-amber-400" />
              <span>{activePinCode ? `#${activePinCode}` : 'PIN'}</span>
            </button>
          )}

          {!isStaffOnly && pendingCount > 0 && (
            <button
              onClick={() => setActiveTab('pending')}
              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1 active:scale-95 transition cursor-pointer shrink-0"
              title={`${preOrdersCount || 0} Pre-Orders, ${pendingApprovalsCount || 0} Pending Approvals`}
            >
              {(preOrdersCount || 0) > 0 && (
                <span className="flex items-center gap-1 text-emerald-400 font-black">
                  <ShoppingBag className="w-3 h-3" />
                  <span>{preOrdersCount}</span>
                </span>
              )}
              {(preOrdersCount || 0) > 0 && (pendingApprovalsCount || 0) > 0 && (
                <span className="text-slate-600 font-bold">•</span>
              )}
              {(pendingApprovalsCount || 0) > 0 && (
                <span className="flex items-center gap-1 text-amber-400 font-black">
                  <Clock className="w-3 h-3" />
                  <span>{pendingApprovalsCount}</span>
                </span>
              )}
              {!(preOrdersCount || 0) && !(pendingApprovalsCount || 0) && (
                <span className="flex items-center gap-1 text-amber-400 font-black">
                  <Clock className="w-3 h-3" />
                  <span>{pendingCount}</span>
                </span>
              )}
            </button>
          )}

          {currentUser?.role === 'admin' && onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-sky-400 hover:text-white transition active:scale-95 shrink-0"
              title="System Settings & Tabs"
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}

          {currentUser?.role === 'admin' && onOpenShiftLogs && (
            <button
              onClick={onOpenShiftLogs}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition active:scale-95 shrink-0"
              title="Staff Shift Logs"
            >
              <Users className="w-4 h-4 text-emerald-400" />
            </button>
          )}

          {currentUser ? (
            <button
              onClick={onEndShift}
              className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[11px] font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer shrink-0"
              title="End Shift / Log Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">End Shift</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('sales')}
              className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer shrink-0"
              title="Staff & Admin Sign In"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Staff Login</span>
            </button>
          )}
        </div>
      </header>

      {/* Tablet Portrait Backdrop Overlay when Sidebar is open */}
      {!collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          className="hidden md:block lg:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-25 transition-opacity"
        />
      )}

      {/* DESKTOP & TABLET SIDEBAR PANEL */}
      <aside 
        className={`hidden md:flex bg-slate-950 border-r border-slate-800 flex-col shrink-0 transition-all duration-300 z-30 h-screen
          ${collapsed ? 'w-0 border-none p-0 overflow-hidden opacity-0 pointer-events-none' : 'w-60 opacity-100 md:max-lg:fixed md:max-lg:top-0 md:max-lg:left-0 md:max-lg:bottom-0 md:max-lg:shadow-2xl'}
        `}
      >
        {/* Brand & Collapse Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 h-16 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <h1 className="font-extrabold text-base tracking-wider text-emerald-400 font-mono">
                HERSHE POS
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Brunei Terminal</p>
            </div>
          </div>

          <button
            onClick={() => setCollapsed(true)}
            className="flex items-center justify-center p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-95 cursor-pointer shrink-0"
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Current Active Staff Session Box */}
        {currentUser ? (
          <div className="p-3 m-3 rounded-2xl bg-slate-900 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {currentUser.role === 'admin' ? (
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <div>
                  <span className="font-bold text-xs text-white block truncate max-w-[110px]">
                    {currentUser.name}
                  </span>
                  <span className={`text-[10px] font-mono font-extrabold uppercase ${currentUser.role === 'admin' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {currentUser.role === 'admin' ? 'Admin Access' : 'Staff Terminal'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-1 text-[10px] text-slate-400">
              <span className="font-mono">In: {currentUser.checkInTime}</span>

              <button
                onClick={onEndShift}
                className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                title="End shift and return to check-in"
              >
                <LogOut className="w-3 h-3" />
                <span>End Shift</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 m-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">Customer Portal</span>
                <span className="text-[10px] text-slate-400">Pre-Order & Menu</span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('sales')}
              className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Staff / Admin Sign In</span>
            </button>
          </div>
        )}

        {/* Cloud Sync Status Indicator */}
        <div className="px-3 mb-2">
          <SyncStatusBadge compact={false} />
        </div>

        {/* 4-Digit Store PIN Sync Badge */}
        {onOpenStorePinModal && (
          <div className="px-3 mb-2">
            <button
              onClick={onOpenStorePinModal}
              className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-amber-500/30 text-amber-300 transition flex items-center justify-between gap-2 cursor-pointer shadow-lg group active:scale-95"
              title="Click to Switch or Set Store PIN"
            >
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-none">
                    Store PIN Sync
                  </span>
                  <span className="text-xs font-mono font-extrabold text-amber-300">
                    {activePinCode ? `#${activePinCode}` : 'Not Linked'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {activePinCode ? 'SYNCED' : 'SET PIN'}
              </span>
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex flex-col overflow-y-auto px-3 py-1 gap-1.5 no-scrollbar flex-1">
          {isStaffOnly && (
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] font-medium leading-tight mb-2">
              🔒 Staff Mode active. Restricted strictly to Terminal operations.
            </div>
          )}

          {availableTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    setCollapsed(true);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition cursor-pointer text-left
                  ${isActive 
                    ? 'bg-slate-800/90 text-white border-l-4 border-emerald-500 shadow-sm font-bold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }
                `}
              >
                <span className={`shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {tab.icon}
                </span>

                <span className="text-sm font-medium">
                  {tab.label}
                </span>

                {tab.id === 'pending' && ((preOrdersCount || 0) > 0 || (pendingApprovalsCount || 0) > 0) && !isStaffOnly ? (
                  <div className="ml-auto flex items-center gap-1">
                    {(preOrdersCount || 0) > 0 && (
                      <span
                        className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-500 text-slate-950 flex items-center gap-0.5"
                        title={`${preOrdersCount} Pre-Orders`}
                      >
                        <ShoppingBag className="w-2.5 h-2.5" />
                        {preOrdersCount}
                      </span>
                    )}
                    {(pendingApprovalsCount || 0) > 0 && (
                      <span
                        className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-amber-500 text-slate-950 flex items-center gap-0.5"
                        title={`${pendingApprovalsCount} Staff Approvals`}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {pendingApprovalsCount}
                      </span>
                    )}
                  </div>
                ) : tab.badge !== undefined && tab.badge > 0 && !isStaffOnly ? (
                  <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 shadow-sm">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}

          {currentUser?.role === 'admin' && onOpenShiftLogs && (
            <button
              onClick={onOpenShiftLogs}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer mt-2"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>View Shift Logs</span>
            </button>
          )}

          {currentUser?.role === 'admin' && onOpenGoogleSheets && (
            <button
              onClick={onOpenGoogleSheets}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition cursor-pointer mt-1"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Export Google Sheets</span>
            </button>
          )}

          {currentUser?.role === 'admin' && onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-sky-300 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 transition cursor-pointer mt-1"
            >
              <Sliders className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Settings & Tabs</span>
            </button>
          )}
        </nav>

        {/* Footer Reset Control (Admin only) */}
        {!isStaffOnly && (
          <div className="p-3 border-t border-slate-800">
            <button
              onClick={onResetData}
              className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Reset Store Data</span>
            </button>
          </div>
        )}
      </aside>

      {/* MOBILE BOTTOM DOCKED NAVIGATION (Admin only - Staff has Terminal at top) */}
      {!isStaffOnly && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 py-1.5 px-2 pb-[max(0.6rem,calc(env(safe-area-inset-bottom)+0.35rem))] shadow-2xl flex items-center justify-around">
          {primaryMobileTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileMoreOpen(false);
                }}
                className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition min-w-[64px] cursor-pointer
                  ${isActive 
                    ? 'text-emerald-400 font-bold' 
                    : 'text-slate-400 hover:text-slate-200'
                  }
                `}
              >
                <div className={`p-1.5 rounded-xl transition ${isActive ? 'bg-emerald-500/10 border border-emerald-500/20' : ''}`}>
                  {tab.icon}
                </div>
                <span className="text-[10px] tracking-tight">{tab.label}</span>
              </button>
            );
          })}

          {/* "More" Menu Button for Mobile (Admin only) */}
          {secondaryMobileTabs.length > 0 && (
            <button
              onClick={() => setMobileMoreOpen(prev => !prev)}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition min-w-[64px] relative cursor-pointer
                ${secondaryMobileTabs.some(t => t.id === activeTab) || mobileMoreOpen
                  ? 'text-emerald-400 font-bold' 
                  : 'text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <div className="p-1.5 rounded-xl relative">
                <MoreHorizontal className="w-5 h-5" />
                {pendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-slate-950" />
                )}
              </div>
              <span className="text-[10px] tracking-tight">More</span>
            </button>
          )}
        </nav>
      )}

      {/* MOBILE MORE MENU BOTTOM SHEET (Admin only) */}
      {!isStaffOnly && mobileMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end p-3 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.75rem))] animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-extrabold text-sm text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Admin Options
              </span>
              <button
                onClick={() => setMobileMoreOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800/80"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {secondaryMobileTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMoreOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition text-left cursor-pointer
                      ${isActive 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                        : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                      }
                    `}
                  >
                    <span className={isActive ? 'text-emerald-400' : 'text-slate-400'}>
                      {tab.icon}
                    </span>
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                        {tab.badge} Pending
                      </span>
                    )}
                  </button>
                );
              })}

              {onOpenStorePinModal && (
                <button
                  onClick={() => {
                    onOpenStorePinModal();
                    setMobileMoreOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Store className="w-4 h-4 text-amber-400" />
                    <span>Store PIN Sync</span>
                  </div>
                  <span className="font-mono font-extrabold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30">
                    {activePinCode ? `#${activePinCode}` : 'SET PIN'}
                  </span>
                </button>
              )}

              {onOpenShiftLogs && (
                <button
                  onClick={() => {
                    onOpenShiftLogs();
                    setMobileMoreOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 cursor-pointer"
                >
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>View Staff Shift Logs</span>
                </button>
              )}

              {onOpenGoogleSheets && (
                <button
                  onClick={() => {
                    onOpenGoogleSheets();
                    setMobileMoreOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Export to Google Sheets</span>
                </button>
              )}

              {onOpenSettings && (
                <button
                  onClick={() => {
                    onOpenSettings();
                    setMobileMoreOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold text-sky-300 bg-sky-500/10 border border-sky-500/20 cursor-pointer"
                >
                  <Sliders className="w-4 h-4 text-sky-400" />
                  <span>Settings & Tab Visibility</span>
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  onResetData();
                  setMobileMoreOpen(false);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4 text-red-400" />
                <span>Reset Store Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
