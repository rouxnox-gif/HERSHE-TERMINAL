import React, { useState, useEffect, useMemo } from 'react';
import {
  TabType,
  Product,
  Order,
  Expense,
  PendingOrder,
  UserSession,
  StaffShift,
  InventoryItem,
  InventoryLog
} from './types';
import { usePOSData } from './hooks/usePOSData';
import { initializeDatabaseAndMigrate } from './services/migrationService';
import {
  createCompletedSale,
  createPendingOrder,
  approvePendingOrder,
  rejectPendingOrder,
  approveAllPendingOrders,
  saveProduct,
  deleteProduct,
  clearAllProducts,
  createExpense,
  deleteExpense,
  deleteOrder,
  clearAllOrders,
  saveShift,
  deleteShift,
  clearAllShifts,
  saveDistribution,
  resetDatabaseToDefaults,
  reconcileInventoryWithProducts
} from './services/posService';
import { applyInventoryMovement } from './services/inventoryService';
import { saveInventoryItem, deleteInventoryItem } from './db/repositories/inventoryRepo';
import { getOrCreateDeviceId, saveStoreInfoSettings } from './db/repositories/appSettingsRepo';
import { triggerSync, startRealtimeSync } from './services/syncEngine';
import { subscribeToFirebaseSync, getStoredPinCode } from './utils/firebaseSync';
import { isPreOrder } from './utils/orderUtils';
import { initAuth } from './lib/firebase';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { PosTerminalView } from './components/PosTerminalView';
import { InventoryView } from './components/InventoryView';
import { ExpensesView } from './components/ExpensesView';
import { ReportsView } from './components/ReportsView';
import { HistoryView } from './components/HistoryView';
import { PendingApprovalsView } from './components/PendingApprovalsView';
import { ReceiptsHistoryView } from './components/ReceiptsHistoryView';
import { PartnershipDistributionView } from './components/PartnershipDistributionView';
import { CustomerPreOrderView } from './components/CustomerPreOrderView';
import { ReceiptModal } from './components/ReceiptModal';
import { StaffCheckInModal } from './components/StaffCheckInModal';
import { ShiftLogModal } from './components/ShiftLogModal';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { StorePinModal } from './components/StorePinModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  // Reactive Dexie IndexedDB state
  const {
    products,
    orders,
    expenses,
    pendingOrders,
    inventory,
    inventoryLogs,
    shifts,
    distributions,
    paymentConfigs,
    hiddenTabs,
    storeInfo,
  } = usePOSData();

  // Helper to determine if the current URL points to the public customer portal
  const checkIsCustomerPortalUrl = () => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const tabParam = (params.get('tab') || params.get('view') || params.get('mode') || params.get('portal') || '').toLowerCase();
    const hash = (window.location.hash || '').toLowerCase();
    const path = (window.location.pathname || '').toLowerCase();
    
    return (
      tabParam === 'customer' ||
      tabParam === 'menu' ||
      tabParam === 'order' ||
      tabParam === 'preorder' ||
      params.has('customer') ||
      hash.includes('customer') ||
      hash.includes('menu') ||
      hash.includes('order') ||
      path.endsWith('/customer') ||
      path.endsWith('/menu')
    );
  };

  // URL customer portal status takes absolute priority over any stored terminal session
  const [isCustomerPortalUrl, setIsCustomerPortalUrl] = useState<boolean>(() => checkIsCustomerPortalUrl());

  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    // If opening via customer portal URL, NEVER restore terminal session into this browser tab
    if (checkIsCustomerPortalUrl()) {
      return null;
    }
    try {
      const stored = localStorage.getItem('hershe_current_user_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    return checkIsCustomerPortalUrl() ? 'customer' : 'sales';
  });
  const [activePinCode, setActivePinCode] = useState<string | null>(() => getStoredPinCode());
  const [storePinModalOpen, setStorePinModalOpen] = useState<boolean>(false);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('hershe_sidebar_collapsed') === 'true';
  });

  const [activeReceipt, setActiveReceipt] = useState<Order | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState<boolean>(false);
  const [shiftLogsOpen, setShiftLogsOpen] = useState<boolean>(false);
  const [googleSheetsOpen, setGoogleSheetsOpen] = useState<boolean>(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);

  // Listen to browser navigation / URL parameter changes (popstate & hashchange)
  useEffect(() => {
    const handleUrlChange = () => {
      const isCustomer = checkIsCustomerPortalUrl();
      setIsCustomerPortalUrl(isCustomer);
      if (isCustomer) {
        setActiveTab('customer');
        setStorePinModalOpen(false);
      } else {
        // Returned to terminal URL - restore stored terminal session if available
        try {
          const stored = localStorage.getItem('hershe_current_user_session');
          setCurrentUser(stored ? JSON.parse(stored) : null);
        } catch {
          setCurrentUser(null);
        }
        setActiveTab(prev => (prev === 'customer' ? 'sales' : prev));
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Sync customer tab to URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (activeTab === 'customer') {
        url.searchParams.set('tab', 'customer');
        window.history.replaceState({}, '', url.toString());
        setIsCustomerPortalUrl(true);
      } else if (url.searchParams.get('tab') === 'customer') {
        url.searchParams.delete('tab');
        window.history.replaceState({}, '', url.toString());
        setIsCustomerPortalUrl(false);
      }
    }
  }, [activeTab]);

  // Initialize IndexedDB and migrate data from localStorage on boot
  useEffect(() => {
    initAuth();
    initializeDatabaseAndMigrate().then(async () => {
      // Start real-time sync for any device (admin, staff, or customer link)
      await startRealtimeSync();
      triggerSync();
    });
  }, []);

  // Sync active PIN state changes
  useEffect(() => {
    if (activePinCode) {
      startRealtimeSync();
      triggerSync();
    }
  }, [activePinCode]);

  useEffect(() => {
    localStorage.setItem('hershe_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    // In customer portal mode, leave the stored terminal session in localStorage untouched
    if (isCustomerPortalUrl) {
      return;
    }
    if (currentUser) {
      localStorage.setItem('hershe_current_user_session', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('hershe_current_user_session');
    }
  }, [currentUser, isCustomerPortalUrl]);

  // Lock staff role strictly to POS terminal view (only while in terminal mode)
  useEffect(() => {
    if (!isCustomerPortalUrl && currentUser?.role === 'staff' && activeTab !== 'sales') {
      setActiveTab('sales');
    }
  }, [currentUser, activeTab, isCustomerPortalUrl]);

  // Low stock counter for header badge
  const lowStockCount = useMemo(() => {
    if (!inventory) return 0;
    return inventory.filter(it => it.currentStock <= it.lowStockThreshold).length;
  }, [inventory]);

  // Separate pre-orders and pending approvals counters
  const { preOrdersCount, pendingApprovalsCount } = useMemo(() => {
    let pre = 0;
    let pend = 0;
    for (const p of pendingOrders) {
      if (isPreOrder(p)) {
        pre++;
      } else {
        pend++;
      }
    }
    return { preOrdersCount: pre, pendingApprovalsCount: pend };
  }, [pendingOrders]);

  // Combined data structure for modals (like GoogleSheetsSyncModal)
  const appData = useMemo(() => ({
    products,
    orders,
    expenses,
    pendingOrders,
    shifts,
    currentUser,
    distributions,
    inventory,
    inventoryLogs,
  }), [products, orders, expenses, pendingOrders, shifts, currentUser, distributions, inventory, inventoryLogs]);

  // Inventory reflects the drink menu in terminal.
  // If there's no menu available, then inventory also should be none!
  useEffect(() => {
    if (!products) return;
    reconcileInventoryWithProducts(products).catch(err => {
      console.warn('[InventorySync] Error reconciling inventory with products:', err);
    });
  }, [products]);

  // Staff Check-In
  const handleCheckIn = async (session: UserSession, newShift: StaffShift) => {
    setCurrentUser(session);
    await saveShift(newShift);
    if (session.role === 'staff') {
      setActiveTab('sales');
    }
  };

  // End Shift / Logout
  const handleEndShift = async () => {
    if (!currentUser) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const activeShift = shifts.find(
      s => s.status === 'active' && s.staffName.toLowerCase().includes(currentUser.name.toLowerCase())
    );

    if (activeShift) {
      await saveShift({
        ...activeShift,
        status: 'ended',
        checkOutTime: timeStr,
      });
    }

    setCurrentUser(null);
    setActiveTab('sales');
  };

  // Clear Shift Logs (Admin)
  const handleClearShiftLogs = async () => {
    await clearAllShifts();
  };

  // Delete Individual Shift Log (Admin)
  const handleDeleteShift = async (id: string) => {
    await deleteShift(id);
  };

  // Charge order from POS terminal
  const handleChargeOrder = async (newOrder: Order) => {
    const activeShiftStaff = shifts.find(s => s.status === 'active')?.staffName;
    const resolvedStaffName = newOrder.staffName || currentUser?.name || activeShiftStaff || 'Admin';

    if (currentUser?.role === 'staff') {
      // Staff checkout creates a PendingOrder with immediate inventory deduction
      const pendingPayload: PendingOrder = {
        orderId: newOrder.orderId,
        date: newOrder.date,
        time: newOrder.time,
        totalAmount: newOrder.totalAmount,
        paymentType: newOrder.paymentType,
        source: `Staff (${resolvedStaffName})`,
        staffName: resolvedStaffName,
        inventoryDeducted: true,
        itemsSummary: newOrder.itemsSummary || newOrder.items.map(i => `${i.qty}x ${i.name}`).join(', '),
        items: newOrder.items.map(i => ({
          name: i.name,
          qty: i.qty,
          price: (i.lineTotal || i.finalPrice) / (i.qty || 1),
          protein: i.addonString.includes('Protein'),
          oat: i.addonString.includes('Oat'),
          addonString: i.addonString,
          lineTotal: i.lineTotal || i.finalPrice,
        })),
      };

      await createPendingOrder({
        pendingOrder: pendingPayload,
        staffName: resolvedStaffName,
      });
    } else {
      // Admin checkout completes the sale immediately
      const completed = await createCompletedSale({
        order: newOrder,
        staffName: resolvedStaffName,
      });

      // Show receipt modal
      setActiveReceipt(completed);
      setReceiptModalOpen(true);
    }
  };

  // Save new custom drink to catalog
  const handleSaveNewProduct = async (newProd: Product) => {
    await saveProduct(newProd);
  };

  // Update existing drink in catalog
  const handleUpdateProduct = async (updatedProd: Product) => {
    await saveProduct(updatedProd);
  };

  // Delete drink from catalog
  const handleDeleteProduct = async (productId: string) => {
    await deleteProduct(productId);
  };

  // Clear all drinks from catalog so owner can build their own menu
  const handleClearAllProducts = async () => {
    await clearAllProducts();
  };

  // Add Expense
  const handleAddExpense = async (newExp: Expense) => {
    await createExpense(newExp);
  };

  // Delete Expense
  const handleDeleteExpense = async (id: string) => {
    await deleteExpense(id);
  };

  // Approve single pending order
  const handleApprovePendingOrder = async (pending: PendingOrder) => {
    const approved = await approvePendingOrder(pending);
    setActiveReceipt(approved);
    setReceiptModalOpen(true);
  };

  // Reject pending order (and restore stock if deducted)
  const handleRejectPendingOrder = async (orderId: string) => {
    await rejectPendingOrder(orderId);
  };

  // Approve all pending orders in batch
  const handleApproveAllPending = async () => {
    await approveAllPendingOrders();
  };

  // Reset Store Data
  const handleResetData = async () => {
    await resetDatabaseToDefaults();
  };

  // Delete specific order from sales history
  const handleDeleteOrder = async (orderId: string) => {
    await deleteOrder(orderId);
  };

  // Clear all sales history
  const handleClearAllHistory = async () => {
    await clearAllOrders();
  };

  // Update partnership distribution config per month
  const handleUpdateDistribution = async (month: string, config: any) => {
    await saveDistribution({
      ...config,
      month,
    });
  };

  // Handle inventory manual operations (restock, adjustments, spoilage, editing stock, removing tracking)
  const handleUpdateInventory = async (updatedInv: InventoryItem[], updatedLogs: InventoryLog[]) => {
    const deviceId = await getOrCreateDeviceId();

    // 1. Process removals / stop tracking: any item previously in inventory missing in updatedInv
    const currentIds = new Set(updatedInv.map(i => i.id));
    if (inventory && inventory.length > 0) {
      for (const item of inventory) {
        if (!currentIds.has(item.id)) {
          await deleteInventoryItem(item.id);
        }
      }
    }

    const hasNewMovementLog = updatedLogs.length > 0 && updatedLogs.length > (inventoryLogs?.length || 0);
    const newestLog = hasNewMovementLog ? updatedLogs[0] : null;

    // 2. Process added or updated inventory items metadata
    for (const item of updatedInv) {
      const existing = inventory?.find(i => i.id === item.id);
      const isTargetOfMovement = Boolean(
        hasNewMovementLog &&
        newestLog &&
        newestLog.productName.toLowerCase().trim() === item.productName.toLowerCase().trim()
      );

      if (!existing) {
        // New item being tracked:
        // If an initial movement log is accompanying this new item, initialize stock to 0 so applyInventoryMovement can apply the delta cleanly
        if (isTargetOfMovement) {
          await saveInventoryItem({ ...item, currentStock: 0 });
        } else {
          await saveInventoryItem(item);
        }
      } else if (isTargetOfMovement) {
        // Existing item updated via a movement:
        // Save only metadata changes without mutating currentStock here, since applyInventoryMovement will calculate and apply the stock delta atomically
        if (
          existing.lowStockThreshold !== item.lowStockThreshold ||
          existing.unit !== item.unit ||
          existing.costPerUnit !== item.costPerUnit ||
          existing.productName !== item.productName ||
          existing.lastRestockedDate !== item.lastRestockedDate ||
          existing.lastRestockedQty !== item.lastRestockedQty
        ) {
          await saveInventoryItem({
            ...item,
            currentStock: existing.currentStock,
          });
        }
      } else {
        // Direct metadata/stock change without an accompanying movement log
        if (
          existing.lowStockThreshold !== item.lowStockThreshold ||
          existing.unit !== item.unit ||
          existing.costPerUnit !== item.costPerUnit ||
          existing.productName !== item.productName ||
          existing.currentStock !== item.currentStock ||
          existing.lastRestockedDate !== item.lastRestockedDate ||
          existing.lastRestockedQty !== item.lastRestockedQty
        ) {
          await saveInventoryItem(item);
        }
      }
    }

    // 3. Process new movement log entry into idempotent inventory movements
    if (hasNewMovementLog && newestLog) {
      const movementId = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : `mv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      await applyInventoryMovement({
        movementId,
        productName: newestLog.productName,
        quantityChange: newestLog.quantityChange,
        type: newestLog.type,
        deviceId,
        createdAt: newestLog.timestamp || new Date().toISOString(),
        staffName: newestLog.staffName || currentUser?.name || 'Admin',
        reason: newestLog.reason,
        appliedLocally: false,
        syncedToFirestore: false,
      });
    }

    // 4. Trigger cloud sync if connected
    triggerSync();
  };

  // View specific receipt
  const handleViewReceipt = (order: Order) => {
    setActiveReceipt(order);
    setReceiptModalOpen(true);
  };

  // Update store info & customer portal configuration
  const handleSaveStoreInfo = async (info: any) => {
    await saveStoreInfoSettings(info);
    triggerSync();
  };

  // Submit customer pre-order
  const handleCustomerPreOrderSubmit = async (pendingOrder: PendingOrder) => {
    await createPendingOrder({
      pendingOrder,
      staffName: `Customer (${pendingOrder.customerName || 'Online Pre-Order'})`,
    });
  };

  // Navigation from public customer portal to terminal mode
  const handleNavigateFromCustomerToTerminal = () => {
    // 1. Remove customer search params and hashes from URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      url.searchParams.delete('view');
      url.searchParams.delete('mode');
      url.searchParams.delete('portal');
      if (url.hash.includes('customer') || url.hash.includes('menu') || url.hash.includes('order')) {
        url.hash = '';
      }
      window.history.pushState({}, '', url.pathname + (url.search ? url.search : ''));
    }

    // 2. Switch off customer portal mode and reset tab
    setIsCustomerPortalUrl(false);
    setActiveTab('sales');

    // 3. Authenticate: restore stored terminal session if valid, otherwise require check-in
    try {
      const stored = localStorage.getItem('hershe_current_user_session');
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed && (parsed.role === 'admin' || parsed.role === 'staff')) {
        setCurrentUser(parsed);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  };

  // 1. PUBLIC CUSTOMER PORTAL MODE (Authoritative URL-driven)
  // Renders strictly the customer pre-order portal without exposing any terminal UI or admin session
  if (isCustomerPortalUrl) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950 overflow-x-hidden">
        <main className="flex-1 h-screen w-full pb-0 bg-slate-950">
          <CustomerPreOrderView
            products={products}
            inventory={inventory}
            storeInfo={storeInfo}
            paymentConfigs={paymentConfigs}
            currentUser={null}
            standalone={true}
            onSubmitPreOrder={handleCustomerPreOrderSubmit}
            onSaveStoreInfo={handleSaveStoreInfo}
            onNavigateToTerminal={handleNavigateFromCustomerToTerminal}
          />
        </main>
      </div>
    );
  }

  // 2. AUTHENTICATED / TERMINAL MODE
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans selection:bg-emerald-500 selection:text-slate-950 overflow-x-hidden">
      {/* Staff Check-In Screen Overlay when not checked in */}
      {!currentUser && (
        <StaffCheckInModal
          onCheckIn={handleCheckIn}
          activeShiftCount={shifts.length}
        />
      )}

      {/* Admin Shift Logs Modal */}
      {shiftLogsOpen && (
        <ShiftLogModal
          shifts={shifts}
          onClose={() => setShiftLogsOpen(false)}
          onClearShifts={handleClearShiftLogs}
          onDeleteShift={handleDeleteShift}
        />
      )}

      {/* Sidebar Header Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        pendingCount={pendingOrders.length}
        preOrdersCount={preOrdersCount}
        pendingApprovalsCount={pendingApprovalsCount}
        lowStockCount={lowStockCount}
        onResetData={() => setResetConfirmOpen(true)}
        currentUser={currentUser}
        onEndShift={handleEndShift}
        onOpenShiftLogs={() => setShiftLogsOpen(true)}
        onOpenGoogleSheets={() => setGoogleSheetsOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
        hiddenTabs={hiddenTabs}
        activePinCode={activePinCode}
        onOpenStorePinModal={() => setStorePinModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar bg-slate-950 flex flex-col h-[calc(100vh-56px)] md:h-screen pb-20 md:pb-0">
        <div className="flex-1">
          {/* Customer Pre-Order Portal View (terminal preview mode) */}
          {activeTab === 'customer' && (
            <CustomerPreOrderView
              products={products}
              inventory={inventory}
              storeInfo={storeInfo}
              paymentConfigs={paymentConfigs}
              currentUser={currentUser}
              standalone={false}
              onSubmitPreOrder={handleCustomerPreOrderSubmit}
              onSaveStoreInfo={handleSaveStoreInfo}
              onNavigateToTerminal={() => setActiveTab('sales')}
            />
          )}

          {/* Pos Terminal View - rendered when activeTab is sales or user is staff */}
          {(activeTab === 'sales' || (currentUser?.role === 'staff' && activeTab !== 'customer')) && (
            <PosTerminalView
              products={products}
              inventory={inventory}
              paymentConfigs={paymentConfigs}
              onSaveNewProduct={handleSaveNewProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onClearAllProducts={handleClearAllProducts}
              onChargeOrder={handleChargeOrder}
              currentUserRole={currentUser?.role}
              currentUserName={currentUser?.name}
              activeShiftStaffName={shifts.find(s => s.status === 'active')?.staffName}
              storeInfo={storeInfo}
              onSaveStoreInfo={handleSaveStoreInfo}
            />
          )}

          {currentUser?.role !== 'staff' && activeTab === 'inventory' && (
            <InventoryView
              inventory={inventory}
              inventoryLogs={inventoryLogs}
              orders={orders}
              products={products}
              onUpdateInventory={handleUpdateInventory}
              currentUserRole={currentUser?.role}
              currentUserName={currentUser?.name || 'Admin'}
              onNavigateToTerminal={() => setActiveTab('sales')}
            />
          )}

          {currentUser?.role !== 'staff' && activeTab === 'dashboard' && (
            <DashboardView orders={orders} expenses={expenses} />
          )}

          {currentUser?.role !== 'staff' && activeTab === 'expenses' && (
            <ExpensesView
              expenses={expenses}
              paymentConfigs={paymentConfigs}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          )}

          {currentUser?.role !== 'staff' && activeTab === 'monthly' && (
            <ReportsView
              orders={orders}
              expenses={expenses}
              onOpenGoogleSheets={() => setGoogleSheetsOpen(true)}
            />
          )}

          {currentUser?.role !== 'staff' && activeTab === 'distribution' && (
            <PartnershipDistributionView
              orders={orders}
              expenses={expenses}
              savedDistributions={distributions}
              onUpdateDistribution={handleUpdateDistribution}
            />
          )}

          {currentUser?.role !== 'staff' && activeTab === 'history' && (
            <HistoryView
              orders={orders}
              onDeleteOrder={handleDeleteOrder}
              onClearAllHistory={handleClearAllHistory}
              onViewReceipt={handleViewReceipt}
            />
          )}

          {currentUser?.role !== 'staff' && activeTab === 'pending' && (
            <PendingApprovalsView
              pendingOrders={pendingOrders}
              onApproveOrder={handleApprovePendingOrder}
              onRejectOrder={handleRejectPendingOrder}
              onApproveAll={handleApproveAllPending}
            />
          )}

          {currentUser?.role !== 'staff' && activeTab === 'receipts' && (
            <ReceiptsHistoryView
              orders={orders}
              onViewReceipt={handleViewReceipt}
              onDeleteOrder={handleDeleteOrder}
            />
          )}
        </div>
      </main>

      {/* Global Thermal Receipt Modal */}
      <ReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        order={activeReceipt}
      />

      {/* Google Sheets Live Sync Modal */}
      <GoogleSheetsSyncModal
        isOpen={googleSheetsOpen}
        onClose={() => setGoogleSheetsOpen(false)}
        data={appData}
      />

      {/* 4-Digit Store PIN Gateway & Real-Time Sync Modal - only for staff/admin tabs */}
      {storePinModalOpen && activeTab !== 'customer' && (
        <StorePinModal
          isOpen={storePinModalOpen}
          canCloseWithoutPin={true}
          onClose={() => setStorePinModalOpen(false)}
          onPinSuccess={(syncedData, pinCode) => {
            setActivePinCode(pinCode);
            setStorePinModalOpen(false);
          }}
        />
      )}

      {/* App Settings Modal (Tab Visibility, Payment Methods, & WhatsApp Store Settings) */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        hiddenTabs={hiddenTabs || []}
        paymentConfigs={paymentConfigs || []}
        storeInfo={storeInfo}
        onUpdateStoreInfo={handleSaveStoreInfo}
        currentUserRole={currentUser?.role}
      />

      {/* Confirmation Modal before resetting store data */}
      <ResetConfirmModal
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={handleResetData}
      />
    </div>
  );
}
