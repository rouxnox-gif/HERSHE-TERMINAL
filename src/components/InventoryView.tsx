import React, { useState, useMemo } from 'react';
import { InventoryItem, InventoryLog, Order, Product } from '../types';
import { getBruneiDateString, getBruneiTimeString } from '../data/initialData';
import {
  Boxes,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit3,
  Search,
  Filter,
  Download,
  Printer,
  Sparkles,
  Layers,
  TrendingDown,
  TrendingUp,
  X,
  PlusCircle,
  MinusCircle,
  FileSpreadsheet,
  PackageCheck,
  ShieldAlert,
  ClipboardList
} from 'lucide-react';

interface InventoryViewProps {
  inventory: InventoryItem[];
  inventoryLogs: InventoryLog[];
  orders: Order[];
  products: Product[];
  onUpdateInventory: (updatedInventory: InventoryItem[], updatedLogs: InventoryLog[]) => void;
  currentUserRole?: 'admin' | 'staff';
  currentUserName?: string;
  onDeleteLog?: (logId: string) => void;
  onClearLogs?: (logIds?: string[]) => void;
  onNavigateToTerminal?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory = [],
  inventoryLogs = [],
  orders = [],
  products = [],
  onUpdateInventory,
  currentUserRole = 'admin',
  currentUserName = 'Admin',
  onDeleteLog,
  onClearLogs,
  onNavigateToTerminal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilterItem, setLogFilterItem] = useState<string>('all');
  const [logFilterType, setLogFilterType] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Log Deletion Modals state
  const [logToDelete, setLogToDelete] = useState<InventoryLog | null>(null);
  const [isConfirmingClearLogs, setIsConfirmingClearLogs] = useState(false);

  // Modals state
  const [restockModalItem, setRestockModalItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState<string>('12');
  const [restockCost, setRestockCost] = useState<string>('');
  const [restockNote, setRestockNote] = useState<string>('Batch restock');

  const [auditModalItem, setAuditModalItem] = useState<InventoryItem | null>(null);
  const [auditCount, setAuditCount] = useState<string>('');
  const [auditReason, setAuditReason] = useState<string>('Physical count audit');

  const [spoilageModalItem, setSpoilageModalItem] = useState<InventoryItem | null>(null);
  const [spoilageQty, setSpoilageQty] = useState<string>('1');
  const [spoilageReason, setSpoilageReason] = useState<string>('Expired / Spoilage');
  const [spoilageNotes, setSpoilageNotes] = useState<string>('');

  const [newItemModalOpen, setNewItemModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newCurrentStock, setNewCurrentStock] = useState('0');
  const [newUnit, setNewUnit] = useState('bottles');
  const [newThreshold, setNewThreshold] = useState('5');
  const [newCost, setNewCost] = useState('1.50');

  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editStock, setEditStock] = useState('');
  const [editThreshold, setEditThreshold] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCost, setEditCost] = useState('');
  const [isConfirmingEditDelete, setIsConfirmingEditDelete] = useState(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);

  const [isPrintSlipOpen, setIsPrintSlipOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const todayStr = getBruneiDateString();

  // Available drinks on Drink Menu that are NOT yet tracked in inventory
  const availableDrinksForInventory = useMemo(() => {
    const tracked = new Set(inventory.map(it => it.productName.toLowerCase().trim()));
    return products.filter(p => !tracked.has(p.name.toLowerCase().trim()));
  }, [products, inventory]);

  // Helper map of product prices
  const productPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => map.set(p.name.toLowerCase().trim(), p.price));
    return map;
  }, [products]);

  // Calculate today's sales quantity per item
  const todaySalesCountMap = useMemo(() => {
    const map = new Map<string, number>();
    const todayOrders = orders.filter(o => o.date === todayStr);
    todayOrders.forEach(o => {
      o.items.forEach(it => {
        const key = it.name.toLowerCase().trim();
        map.set(key, (map.get(key) || 0) + (Number(it.qty) || 1));
      });
    });
    return map;
  }, [orders, todayStr]);

  // Overall KPI stats
  const totalStockUnits = useMemo(() => {
    return inventory.reduce((sum, it) => sum + (Number(it.currentStock) || 0), 0);
  }, [inventory]);

  const lowStockCount = useMemo(() => {
    return inventory.filter(it => it.currentStock <= it.lowStockThreshold).length;
  }, [inventory]);

  const totalEstimatedRetailValue = useMemo(() => {
    return inventory.reduce((sum, it) => {
      const price = productPriceMap.get(it.productName.toLowerCase().trim()) || 4.0;
      return sum + (it.currentStock * price);
    }, 0);
  }, [inventory, productPriceMap]);

  const todayTotalUnitsSold = useMemo(() => {
    let count = 0;
    inventory.forEach(it => {
      const sold = todaySalesCountMap.get(it.productName.toLowerCase().trim()) || 0;
      count += sold;
    });
    return count;
  }, [inventory, todaySalesCountMap]);

  // Inventory reflects the drink menu in terminal
  const displayInventory = useMemo(() => {
    if (!searchQuery.trim()) return inventory;
    const q = searchQuery.toLowerCase().trim();
    return inventory.filter(it => it.productName.toLowerCase().includes(q));
  }, [inventory, searchQuery]);

  // Quick 1-Click Restock handler
  const handleQuickRestock = (item: InventoryItem, qtyToAdd: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStock = item.currentStock + qtyToAdd;
    const date = getBruneiDateString();
    const time = getBruneiTimeString();

    const newLog: InventoryLog = {
      id: `log-restock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      date,
      time,
      productName: item.productName,
      type: 'restock',
      quantityChange: qtyToAdd,
      balanceAfter: newStock,
      reason: `Quick restock (+${qtyToAdd} ${item.unit})`,
      staffName: currentUserName,
    };

    const updatedInv = inventory.map(it =>
      it.id === item.id
        ? {
            ...it,
            currentStock: newStock,
            lastRestockedDate: date,
            lastRestockedQty: qtyToAdd,
          }
        : it
    );

    onUpdateInventory(updatedInv, [newLog, ...inventoryLogs]);
    showToast(`Restocked +${qtyToAdd} ${item.unit} for ${item.productName}`);
  };

  // Submit Detailed Restock Modal
  const handleConfirmRestockModal = () => {
    if (!restockModalItem) return;
    const qty = parseInt(restockQty, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast('Please enter a valid positive restock quantity.');
      return;
    }

    const cost = parseFloat(restockCost) || restockModalItem.costPerUnit || undefined;
    const newStock = restockModalItem.currentStock + qty;
    const date = getBruneiDateString();
    const time = getBruneiTimeString();

    const newLog: InventoryLog = {
      id: `log-restock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      date,
      time,
      productName: restockModalItem.productName,
      type: 'restock',
      quantityChange: qty,
      balanceAfter: newStock,
      reason: restockNote.trim() || `Restock (+${qty} ${restockModalItem.unit})`,
      staffName: currentUserName,
    };

    const updatedInv = inventory.map(it =>
      it.id === restockModalItem.id
        ? {
            ...it,
            currentStock: newStock,
            costPerUnit: cost,
            lastRestockedDate: date,
            lastRestockedQty: qty,
          }
        : it
    );

    onUpdateInventory(updatedInv, [newLog, ...inventoryLogs]);
    setRestockModalItem(null);
    showToast(`Successfully restocked +${qty} ${restockModalItem.unit} of ${restockModalItem.productName}`);
  };

  // Submit Audit / Physical Count Modal
  const handleConfirmAuditModal = () => {
    if (!auditModalItem) return;
    const count = parseInt(auditCount, 10);
    if (isNaN(count) || count < 0) {
      showToast('Please enter a valid non-negative physical stock count.');
      return;
    }

    const diff = count - auditModalItem.currentStock;
    const date = getBruneiDateString();
    const time = getBruneiTimeString();

    const newLog: InventoryLog = {
      id: `log-audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      date,
      time,
      productName: auditModalItem.productName,
      type: 'adjustment',
      quantityChange: diff,
      balanceAfter: count,
      reason: auditReason.trim() || `Physical Count Audit (was ${auditModalItem.currentStock}, adjusted to ${count})`,
      staffName: currentUserName,
    };

    const updatedInv = inventory.map(it =>
      it.id === auditModalItem.id
        ? {
            ...it,
            currentStock: count,
          }
        : it
    );

    onUpdateInventory(updatedInv, [newLog, ...inventoryLogs]);
    setAuditModalItem(null);
    showToast(`Updated physical stock for ${auditModalItem.productName} to ${count} ${auditModalItem.unit}`);
  };

  // Submit Spoilage / Wastage Modal
  const handleConfirmSpoilageModal = () => {
    if (!spoilageModalItem) return;
    const qty = parseInt(spoilageQty, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast('Please enter a valid positive wastage quantity.');
      return;
    }

    const newStock = Math.max(0, spoilageModalItem.currentStock - qty);
    const date = getBruneiDateString();
    const time = getBruneiTimeString();

    const reasonDesc = `${spoilageReason}${spoilageNotes.trim() ? `: ${spoilageNotes.trim()}` : ''}`;

    const newLog: InventoryLog = {
      id: `log-spoilage-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      date,
      time,
      productName: spoilageModalItem.productName,
      type: 'spoilage',
      quantityChange: -qty,
      balanceAfter: newStock,
      reason: reasonDesc,
      staffName: currentUserName,
    };

    const updatedInv = inventory.map(it =>
      it.id === spoilageModalItem.id
        ? {
            ...it,
            currentStock: newStock,
          }
        : it
    );

    onUpdateInventory(updatedInv, [newLog, ...inventoryLogs]);
    setSpoilageModalItem(null);
    setSpoilageNotes('');
    showToast(`Deducted -${qty} ${spoilageModalItem.unit} for ${spoilageModalItem.productName} (${spoilageReason})`);
  };

  // Create New Tracked Item (Only from available drinks on Drink Menu)
  const handleCreateNewTrackedItem = () => {
    const name = newProductName.trim();
    const initialStock = parseInt(newCurrentStock, 10);
    const threshold = parseInt(newThreshold, 10);
    const cost = parseFloat(newCost) || undefined;
    const unit = newUnit.trim() || 'bottles';

    if (!name) {
      showToast('Please select an available drink from the Drink Menu.');
      return;
    }

    // Verify the drink exists on the Drink Menu
    const matchedProduct = products.find(p => p.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (!matchedProduct) {
      showToast(`"${name}" is not on the Drink Menu. Only drinks from the Drink Menu can be tracked.`);
      return;
    }

    // Check if already tracked
    const existing = inventory.find(it => it.productName.toLowerCase().trim() === name.toLowerCase().trim());
    if (existing) {
      showToast(`"${matchedProduct.name}" is already being tracked in inventory!`);
      return;
    }

    if (isNaN(initialStock) || initialStock < 0) {
      showToast('Please enter a valid non-negative initial stock count.');
      return;
    }

    if (isNaN(threshold) || threshold < 0) {
      showToast('Please enter a valid non-negative low stock alert threshold.');
      return;
    }

    const date = getBruneiDateString();
    const time = getBruneiTimeString();

    const newItem: InventoryItem = {
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      productName: matchedProduct.name,
      currentStock: initialStock,
      unit,
      lowStockThreshold: threshold,
      costPerUnit: cost || (Math.round(matchedProduct.price * 0.4 * 100) / 100),
      lastRestockedDate: date,
      lastRestockedQty: initialStock,
    };

    const initialLog: InventoryLog = {
      id: `log-init-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date,
      time,
      productName: matchedProduct.name,
      type: 'restock',
      quantityChange: initialStock,
      balanceAfter: initialStock,
      reason: 'Initial inventory tracking intake',
      staffName: currentUserName,
    };

    onUpdateInventory([newItem, ...inventory], [initialLog, ...inventoryLogs]);
    setNewItemModalOpen(false);
    setNewProductName('');
    setNewCurrentStock('0');
    setNewCost('');
    showToast(`Added "${matchedProduct.name}" to inventory checking (${initialStock} ${unit})`);
  };

  // Edit Item Stock & Settings
  const handleOpenEditItem = (item: InventoryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingItem(item);
    setEditStock(item.currentStock.toString());
    setEditThreshold(item.lowStockThreshold.toString());
    setEditUnit(item.unit || 'bottles');
    setEditCost(item.costPerUnit ? item.costPerUnit.toString() : '');
    setIsConfirmingEditDelete(false);
    setEditModalError(null);
  };

  const handleSaveEditItem = () => {
    if (!editingItem) return;
    const stock = parseInt(editStock, 10);
    const threshold = parseInt(editThreshold, 10);
    const unit = editUnit.trim() || 'bottles';
    const cost = parseFloat(editCost) || undefined;

    if (isNaN(stock) || stock < 0) {
      setEditModalError('Please enter a valid non-negative current stock count.');
      return;
    }

    if (isNaN(threshold) || threshold < 0) {
      setEditModalError('Please enter a valid non-negative low stock threshold.');
      return;
    }

    const diff = stock - editingItem.currentStock;
    let newLogs = [...inventoryLogs];

    if (diff !== 0) {
      const date = getBruneiDateString();
      const time = getBruneiTimeString();
      const newLog: InventoryLog = {
        id: `log-edit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        date,
        time,
        productName: editingItem.productName,
        type: 'adjustment',
        quantityChange: diff,
        balanceAfter: stock,
        reason: `Direct stock edit (was ${editingItem.currentStock} ${editingItem.unit}, adjusted to ${stock} ${unit})`,
        staffName: currentUserName,
      };
      newLogs = [newLog, ...inventoryLogs];
    }

    const updatedInv = inventory.map(it =>
      it.id === editingItem.id
        ? {
            ...it,
            currentStock: stock,
            lowStockThreshold: threshold,
            unit,
            costPerUnit: cost,
            updatedAt: new Date().toISOString(),
          }
        : it
    );

    onUpdateInventory(updatedInv, newLogs);
    setEditingItem(null);
    setIsConfirmingEditDelete(false);
    setEditModalError(null);
    showToast(`Updated ${editingItem.productName} stock (${stock} ${unit}) & settings`);
  };

  const handleConfirmDeleteItem = () => {
    if (!editingItem) return;
    const itemId = editingItem.id;
    const itemName = editingItem.productName;
    const updatedInv = inventory.filter(it => it.id !== itemId);
    onUpdateInventory(updatedInv, inventoryLogs);

    setEditingItem(null);
    setIsConfirmingEditDelete(false);
    setEditModalError(null);
    showToast(`Removed "${itemName}" from inventory checking`);
  };

  // Filtered Logs for display
  const filteredLogs = useMemo(() => {
    return inventoryLogs.filter(log => {
      if (logFilterItem !== 'all' && log.productName.toLowerCase().trim() !== logFilterItem.toLowerCase().trim()) {
        return false;
      }
      if (logFilterType !== 'all' && log.type !== logFilterType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = log.productName.toLowerCase().includes(q);
        const matchReason = (log.reason || '').toLowerCase().includes(q);
        const matchStaff = (log.staffName || '').toLowerCase().includes(q);
        const matchDate = log.date.includes(q);
        if (!matchName && !matchReason && !matchStaff && !matchDate) return false;
      }
      return true;
    });
  }, [inventoryLogs, logFilterItem, logFilterType, searchQuery]);

  // Export inventory CSV
  const handleExportCSV = () => {
    const headers = ['Date', 'Time', 'Product', 'Type', 'Quantity Change', 'Balance After', 'Reason / Order', 'Staff'];
    const rows = inventoryLogs.map(l => [
      l.date,
      l.time,
      `"${l.productName.replace(/"/g, '""')}"`,
      l.type,
      l.quantityChange,
      l.balanceAfter,
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      `"${(l.staffName || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hershe_inventory_logs_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded Inventory CSV');
  };

  // Delete single inventory log
  const handleConfirmDeleteLog = async () => {
    if (!logToDelete) return;
    try {
      if (onDeleteLog) {
        onDeleteLog(logToDelete.id);
      } else {
        const { deleteInventoryLog } = await import('../services/posService');
        await deleteInventoryLog(logToDelete.id);
      }
      const remainingLogs = inventoryLogs.filter(l => l.id !== logToDelete.id);
      onUpdateInventory(inventory, remainingLogs);
      showToast(`Deleted log for "${logToDelete.productName}"`);
    } catch (err) {
      console.error('Failed to delete log:', err);
    } finally {
      setLogToDelete(null);
    }
  };

  // Clear filtered or all inventory logs
  const handleConfirmClearLogs = async () => {
    try {
      const filteredIds = filteredLogs.map(l => l.id);
      if (filteredIds.length === 0) return;

      if (onClearLogs) {
        onClearLogs(logFilterItem !== 'all' || logFilterType !== 'all' || searchQuery ? filteredIds : undefined);
      } else {
        const { deleteInventoryLogsBulk, clearAllInventoryLogsAndMovements } = await import('../services/posService');
        if (logFilterItem !== 'all' || logFilterType !== 'all' || searchQuery) {
          await deleteInventoryLogsBulk(filteredIds);
        } else {
          await clearAllInventoryLogsAndMovements();
        }
      }
      const remainingLogs = inventoryLogs.filter(l => !filteredIds.includes(l.id));
      onUpdateInventory(inventory, remainingLogs);
      showToast(`Cleared ${filteredIds.length} inventory movement logs`);
    } catch (err) {
      console.error('Failed to clear logs:', err);
    } finally {
      setIsConfirmingClearLogs(false);
    }
  };

  // Visual Theme Config for the 4 featured drinks
  const getDrinkVisualTheme = (name: string) => {
    const lower = name.toLowerCase().trim();
    if (lower.includes('beetboost')) {
      return {
        accentBg: 'from-rose-950/40 via-slate-900 to-slate-950',
        borderColor: 'border-rose-500/30 hover:border-rose-500/60',
        badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        ringColor: 'ring-rose-500/30',
        progressBarBg: 'bg-rose-500',
        iconBg: 'bg-rose-500/20 text-rose-400',
        tagline: 'Fresh Beetroot, Apple & Ginger Energy Blend',
        defaultUnit: 'bottles',
        presetRestocks: [1, 3, 6, 12],
      };
    } else if (lower.includes('green detox')) {
      return {
        accentBg: 'from-emerald-950/40 via-slate-900 to-slate-950',
        borderColor: 'border-emerald-500/30 hover:border-emerald-500/60',
        badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        ringColor: 'ring-emerald-500/30',
        progressBarBg: 'bg-emerald-500',
        iconBg: 'bg-emerald-500/20 text-emerald-400',
        tagline: 'Kale, Cucumber, Green Apple & Lemon Cleanse',
        defaultUnit: 'bottles',
        presetRestocks: [1, 3, 6, 12],
      };
    } else if (lower.includes('orange sunrise')) {
      return {
        accentBg: 'from-amber-950/40 via-slate-900 to-slate-950',
        borderColor: 'border-amber-500/30 hover:border-amber-500/60',
        badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        ringColor: 'ring-amber-500/30',
        progressBarBg: 'bg-amber-500',
        iconBg: 'bg-amber-500/20 text-amber-400',
        tagline: 'Fresh Squeezed Valencia Orange & Carrot Boost',
        defaultUnit: 'bottles',
        presetRestocks: [1, 3, 6, 12],
      };
    } else if (lower.includes('gingershot')) {
      return {
        accentBg: 'from-yellow-950/40 via-slate-900 to-slate-950',
        borderColor: 'border-yellow-500/30 hover:border-yellow-500/60',
        badgeBg: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
        ringColor: 'ring-yellow-500/30',
        progressBarBg: 'bg-yellow-400',
        iconBg: 'bg-yellow-500/20 text-yellow-300',
        tagline: '100% Pure Raw Ginger, Turmeric & Cayenne Shot',
        defaultUnit: 'shots',
        presetRestocks: [1, 3, 6, 12],
      };
    }
    return {
      accentBg: 'from-sky-950/30 via-slate-900 to-slate-950',
      borderColor: 'border-slate-800 hover:border-sky-500/50',
      badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
      ringColor: 'ring-sky-500/30',
      progressBarBg: 'bg-sky-500',
      iconBg: 'bg-sky-500/20 text-sky-400',
      tagline: 'Tracked Beverage Item',
      defaultUnit: 'bottles',
      presetRestocks: [1, 3, 6, 12],
    };
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 md:px-6 py-4 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-extrabold px-5 py-3 rounded-xl shadow-2xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Boxes className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Inventory & Stock Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live POS Deductions
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time stock balances and physical stock management for all beverage products.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsPrintSlipOpen(true)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="Print Physical Stock Taking Sheet"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>Stock Sheet</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="Download CSV log"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              if (availableDrinksForInventory.length > 0 && !newProductName) {
                setNewProductName(availableDrinksForInventory[0].name);
                setNewCost((Math.round(availableDrinksForInventory[0].price * 0.4 * 100) / 100).toString());
              }
              setNewItemModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Add Item to Inventory</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Total Units In Stock</span>
            <Layers className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">
              {totalStockUnits}
            </span>
            <span className="text-xs text-slate-400 font-medium">units across {inventory.length} drinks</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Sold Today (POS)</span>
            <TrendingDown className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
              {todayTotalUnitsSold}
            </span>
            <span className="text-xs text-slate-400 font-medium">bottles/shots today</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Low Stock Alerts</span>
            <AlertTriangle className={`w-4 h-4 ${lowStockCount > 0 ? 'text-amber-400 animate-bounce' : 'text-slate-500'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-black font-mono ${lowStockCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {lowStockCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">items at/below threshold</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Estimated Retail Stock Value</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
              ${totalEstimatedRetailValue.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-medium">BND retail value</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: DRINK MENU INVENTORY BALANCES OR EMPTY STATE */}
      {inventory.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/5">
            <Boxes className="w-8 h-8" />
          </div>
          {products.length === 0 ? (
            <>
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  No Drink Menu Available
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Inventory reflects the active drink menu in the terminal. When there is no menu available, inventory is also none. Drinks must be added on the Drink Menu in the POS Terminal first (Admin only).
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2 flex-wrap justify-center">
                {onNavigateToTerminal && (
                  <button
                    onClick={onNavigateToTerminal}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Boxes className="w-4 h-4" />
                    <span>Open POS Terminal & Add Drinks</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  No Drinks Tracked in Inventory Yet
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  You have {products.length} drink(s) available on your Drink Menu. Add them to inventory checking to track stock balances and physical counts.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2 flex-wrap justify-center">
                <button
                  onClick={() => {
                    if (availableDrinksForInventory.length > 0) {
                      setNewProductName(availableDrinksForInventory[0].name);
                      setNewCost((Math.round(availableDrinksForInventory[0].price * 0.4 * 100) / 100).toString());
                    }
                    setNewItemModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Track Available Drink</span>
                </button>
                {onNavigateToTerminal && (
                  <button
                    onClick={onNavigateToTerminal}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Boxes className="w-4 h-4 text-emerald-400" />
                    <span>View Drink Menu in Terminal</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <PackageCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                Active Drink Menu Stock Balances
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 font-mono font-bold text-slate-400">
                {displayInventory.length} of {inventory.length} drinks
              </span>
            </div>

            {/* Search Drink Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search inventory drinks..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {displayInventory.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
              No matching drinks found for "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayInventory.map(item => {
                const theme = getDrinkVisualTheme(item.productName);
                const soldToday = todaySalesCountMap.get(item.productName.toLowerCase().trim()) || 0;
                const price = productPriceMap.get(item.productName.toLowerCase().trim()) || 4.0;
                const isLowStock = item.currentStock <= item.lowStockThreshold && item.currentStock > 0;
                const isOutOfStock = item.currentStock === 0;

                // Compute relative progress bar percentage (capped at 100%)
                const maxExpected = Math.max(item.lowStockThreshold * 4, 30);
                const percent = Math.min(100, Math.round((item.currentStock / maxExpected) * 100));

                return (
                  <div
                    key={item.id}
                    className={`bg-gradient-to-b ${theme.accentBg} border ${theme.borderColor} rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xl relative overflow-hidden transition duration-200 hover:shadow-2xl group`}
                  >
                    {/* Top Title & Status Badge */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-black tracking-wide ${theme.badgeBg}`}>
                              {item.productName}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-1 font-medium">
                            {theme.tagline}
                          </p>
                        </div>

                        <button
                          onClick={(e) => handleOpenEditItem(item, e)}
                          className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition cursor-pointer shrink-0"
                          title="Edit stock thresholds and settings"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Stock Count Display */}
                      <div className="pt-2 flex items-baseline justify-between">
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                              isOutOfStock ? 'text-red-400' : isLowStock ? 'text-amber-400' : 'text-white'
                            }`}>
                              {item.currentStock}
                            </span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                              {item.unit}
                            </span>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
                            Alert threshold: <span className="text-slate-300 font-mono">≤ {item.lowStockThreshold}</span>
                          </div>
                        </div>

                        {/* Stock Status Badge */}
                        <div>
                          {isOutOfStock ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="w-3 h-3" />
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              In Stock
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stock Level Progress Bar */}
                      <div className="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-slate-800/80">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOutOfStock
                              ? 'bg-red-500 w-0'
                              : isLowStock
                              ? 'bg-amber-400'
                              : theme.progressBarBg
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      {/* Today's movement stats */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-[11px]">
                        <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/40">
                          <span className="text-slate-400 block text-[10px]">Sold Today</span>
                          <span className="font-extrabold text-emerald-400 font-mono text-xs">
                            {soldToday} {item.unit} (${(soldToday * price).toFixed(2)})
                          </span>
                        </div>
                        <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/40">
                          <span className="text-slate-400 block text-[10px]">Retail Value</span>
                          <span className="font-extrabold text-slate-200 font-mono text-xs">
                            ${(item.currentStock * price).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons & Fast 1-Click Restock Chips */}
                    <div className="space-y-2 mt-4 pt-3 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                        <span>Quick Restock:</span>
                        <span className="text-[10px] text-slate-400">1-click addition</span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {theme.presetRestocks.map(qty => (
                          <button
                            key={qty}
                            onClick={(e) => handleQuickRestock(item, qty, e)}
                            className="py-1.5 px-1 bg-slate-950/80 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-bold text-xs rounded-lg border border-slate-800 hover:border-emerald-400 transition cursor-pointer text-center font-mono shadow-sm active:scale-95"
                            title={`Instantly add +${qty} to stock`}
                          >
                            +{qty}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          onClick={() => {
                            setRestockModalItem(item);
                            setRestockQty('7');
                            setRestockCost(item.costPerUnit ? item.costPerUnit.toString() : '');
                          }}
                          className="py-1.5 px-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-bold text-[11px] rounded-lg border border-slate-700 transition flex items-center justify-center gap-1 cursor-pointer"
                          title="Custom batch restock"
                        >
                          <PlusCircle className="w-3 h-3 text-emerald-400" />
                          <span>Restock</span>
                        </button>

                        <button
                          onClick={() => {
                            setAuditModalItem(item);
                            setAuditCount(item.currentStock.toString());
                          }}
                          className="py-1.5 px-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-bold text-[11px] rounded-lg border border-slate-700 transition flex items-center justify-center gap-1 cursor-pointer"
                          title="Enter physical counted stock"
                        >
                          <ClipboardList className="w-3 h-3 text-sky-400" />
                          <span>Audit</span>
                        </button>

                        <button
                          onClick={() => {
                            setSpoilageModalItem(item);
                            setSpoilageQty('1');
                          }}
                          className="py-1.5 px-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-bold text-[11px] rounded-lg border border-slate-700 transition flex items-center justify-center gap-1 cursor-pointer"
                          title="Log spoilage, leakage or sample"
                        >
                          <MinusCircle className="w-3 h-3 text-rose-400" />
                          <span>Wastage</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: INVENTORY MOVEMENT LOGS & AUDIT TRAIL */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm sm:text-base font-extrabold text-white">
              Inventory Movement & Audit Logs
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 font-mono font-bold text-slate-400">
              {filteredLogs.length} events
            </span>
          </div>

          {/* Filters Bar & Clear Button */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter by Item */}
            <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400">Drink:</span>
              <select
                value={logFilterItem}
                onChange={(e) => setLogFilterItem(e.target.value)}
                className="bg-transparent text-xs font-bold text-emerald-400 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-white">All Drinks</option>
                {inventory.map(it => (
                  <option key={it.id} value={it.productName} className="bg-slate-900 text-white">
                    {it.productName}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Type */}
            <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400">Event:</span>
              <select
                value={logFilterType}
                onChange={(e) => setLogFilterType(e.target.value)}
                className="bg-transparent text-xs font-bold text-sky-400 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-white">All Events</option>
                <option value="sale" className="bg-slate-900 text-white">Sales Deduction</option>
                <option value="restock" className="bg-slate-900 text-white">Restocks</option>
                <option value="adjustment" className="bg-slate-900 text-white">Physical Count Audits</option>
                <option value="spoilage" className="bg-slate-900 text-white">Wastage / Spoilage</option>
              </select>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-slate-700 w-32 sm:w-40"
              />
            </div>

            {/* Clear Logs Action (Admin only) */}
            {currentUserRole === 'admin' && filteredLogs.length > 0 && (
              <button
                type="button"
                onClick={() => setIsConfirmingClearLogs(true)}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Delete or clear inventory movement logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear Logs</span>
              </button>
            )}
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto no-scrollbar max-h-[380px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <Boxes className="w-8 h-8 text-slate-700 stroke-1" />
              <span>No inventory activity logs recorded yet.</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 sticky top-0 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-3 py-2.5">Date & Time</th>
                  <th className="px-3 py-2.5">Drink</th>
                  <th className="px-3 py-2.5 text-center">Event Type</th>
                  <th className="px-3 py-2.5 text-center">Change</th>
                  <th className="px-3 py-2.5 text-center">Balance After</th>
                  <th className="px-3 py-2.5">Reference / Reason</th>
                  <th className="px-3 py-2.5 text-right">Staff</th>
                  {currentUserRole === 'admin' && (
                    <th className="px-3 py-2.5 text-center w-14">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredLogs.map(log => {
                  const isPositive = log.quantityChange > 0;
                  const isZero = log.quantityChange === 0;

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition text-[11px] group">
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                        <span className="font-bold text-slate-300">{log.date}</span> <span className="text-[10px] text-slate-500">{log.time}</span>
                      </td>
                      <td className="px-3 py-2.5 font-sans font-bold text-white whitespace-nowrap">
                        {log.productName}
                      </td>
                      <td className="px-3 py-2.5 text-center font-sans">
                        {log.type === 'sale' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            POS Sale
                          </span>
                        )}
                        {log.type === 'restock' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            Restock
                          </span>
                        )}
                        {log.type === 'adjustment' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            Audit Count
                          </span>
                        )}
                        {log.type === 'spoilage' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Wastage
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-black">
                        <span className={`flex items-center justify-center gap-0.5 ${
                          isPositive ? 'text-emerald-400' : isZero ? 'text-slate-400' : 'text-rose-400'
                        }`}>
                          {isPositive ? `+${log.quantityChange}` : `${log.quantityChange}`}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-black text-white">
                        {log.balanceAfter}
                      </td>
                      <td className="px-3 py-2.5 font-sans text-slate-300 max-w-[200px] truncate">
                        {log.reason || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-sans text-slate-400">
                        {log.staffName || 'Admin'}
                      </td>
                      {currentUserRole === 'admin' && (
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => setLogToDelete(log)}
                            className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                            title="Delete this inventory log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* RESTOCK MODAL */}
      {restockModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    Restock {restockModalItem.productName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Current stock: <span className="font-bold text-white font-mono">{restockModalItem.currentStock} {restockModalItem.unit}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRestockModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Quantity to Add ({restockModalItem.unit})
                </label>
                <input
                  type="number"
                  min="1"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-base font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
                {/* Fast presets */}
                <div className="flex gap-1.5 mt-2">
                  {[5, 6, 7, 14].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRestockQty(n.toString())}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 rounded-lg text-xs font-bold font-mono transition cursor-pointer"
                    >
                      +{n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Cost per Unit (Optional $)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={restockCost}
                  onChange={(e) => setRestockCost(e.target.value)}
                  placeholder="e.g. 1.80"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 focus:outline-none focus:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Batch / Supplier Note
                </label>
                <input
                  type="text"
                  value={restockNote}
                  onChange={(e) => setRestockNote(e.target.value)}
                  placeholder="e.g. Morning fresh batch #14"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-slate-700"
                />
              </div>

              {/* Preview calculation */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">New Balance After Restock:</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  {restockModalItem.currentStock + (parseInt(restockQty, 10) || 0)} {restockModalItem.unit}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setRestockModalItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestockModal}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                Confirm Restock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHYSICAL COUNT / AUDIT MODAL */}
      {auditModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    Physical Stock Audit
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {auditModalItem.productName} (System was: {auditModalItem.currentStock} {auditModalItem.unit})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAuditModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Actual Physical Count in Fridge/Storage ({auditModalItem.unit})
                </label>
                <input
                  type="number"
                  min="0"
                  value={auditCount}
                  onChange={(e) => setAuditCount(e.target.value)}
                  placeholder="Enter exact count"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-base font-bold text-sky-400 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Audit Reason / Note
                </label>
                <input
                  type="text"
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="e.g. End of day physical count audit"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-slate-700"
                />
              </div>

              {/* Difference preview */}
              {auditCount !== '' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Audit Discrepancy (Change):</span>
                  <span className={`font-mono font-black text-sm ${
                    (parseInt(auditCount, 10) - auditModalItem.currentStock) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {(parseInt(auditCount, 10) - auditModalItem.currentStock) >= 0 ? '+' : ''}
                    {parseInt(auditCount, 10) - auditModalItem.currentStock} {auditModalItem.unit}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setAuditModalItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAuditModal}
                className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-sky-500/20"
              >
                Save Physical Count
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SPOILAGE / WASTAGE MODAL */}
      {spoilageModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <MinusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    Log Spoilage & Wastage
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {spoilageModalItem.productName} ({spoilageModalItem.currentStock} {spoilageModalItem.unit} in stock)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSpoilageModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Quantity Lost / Discarded ({spoilageModalItem.unit})
                </label>
                <input
                  type="number"
                  min="1"
                  max={spoilageModalItem.currentStock}
                  value={spoilageQty}
                  onChange={(e) => setSpoilageQty(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-base font-bold text-rose-400 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Wastage Reason
                </label>
                <select
                  value={spoilageReason}
                  onChange={(e) => setSpoilageReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-slate-700 cursor-pointer"
                >
                  <option value="Expired / Past shelf life">Expired / Past shelf life</option>
                  <option value="Broken Bottle / Leakage">Broken Bottle / Leakage</option>
                  <option value="Staff Sampling / Taste Test">Staff Sampling / Taste Test</option>
                  <option value="Defective Seal / Cap">Defective Seal / Cap</option>
                  <option value="Customer Return / Damaged">Customer Return / Damaged</option>
                  <option value="Other Wastage">Other Wastage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Additional Notes (Optional)
                </label>
                <input
                  type="text"
                  value={spoilageNotes}
                  onChange={(e) => setSpoilageNotes(e.target.value)}
                  placeholder="e.g. Discarded 1 bottle due to cap crack"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-slate-700"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Remaining Balance After Deduction:</span>
                <span className="font-mono font-black text-rose-300 text-sm">
                  {Math.max(0, spoilageModalItem.currentStock - (parseInt(spoilageQty, 10) || 0))} {spoilageModalItem.unit}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSpoilageModalItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSpoilageModal}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-rose-500/20"
              >
                Deduct Spoilage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRACK AVAILABLE DRINK IN INVENTORY MODAL */}
      {newItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Plus className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    Track Drink in Inventory
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Add an available drink from your Drink Menu to inventory checking
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNewItemModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {products.length === 0 ? (
              <div className="py-6 px-4 text-center space-y-3 bg-slate-950 rounded-xl border border-dashed border-slate-800">
                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  No drinks available on the Drink Menu yet.
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Only the Drink Menu is allowed to add new drinks. Please create drinks on the Drink Menu in the POS Terminal first.
                </p>
                {onNavigateToTerminal && (
                  <button
                    onClick={() => {
                      setNewItemModalOpen(false);
                      onNavigateToTerminal();
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                  >
                    Go to Drink Menu (POS Terminal)
                  </button>
                )}
              </div>
            ) : availableDrinksForInventory.length === 0 ? (
              <div className="py-6 px-4 text-center space-y-3 bg-slate-950 rounded-xl border border-dashed border-slate-800">
                <p className="text-xs text-emerald-300 font-semibold leading-relaxed">
                  All {products.length} drink(s) on your Drink Menu are already tracked in inventory!
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  To track a new beverage, add it to the Drink Menu first (in the POS terminal).
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  <button
                    onClick={() => setNewItemModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                  >
                    Close
                  </button>
                  {onNavigateToTerminal && (
                    <button
                      onClick={() => {
                        setNewItemModalOpen(false);
                        onNavigateToTerminal();
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                    >
                      Go to Drink Menu
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Select Available Drink from Menu *
                    </label>
                    <select
                      value={newProductName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewProductName(val);
                        const match = products.find(p => p.name === val);
                        if (match) {
                          setNewCost((Math.round(match.price * 0.4 * 100) / 100).toString());
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="">-- Choose a drink ({availableDrinksForInventory.length} available) --</option>
                      {availableDrinksForInventory.map(p => (
                        <option key={p.id} value={p.name}>
                          {p.name} (BND ${p.price.toFixed(2)})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      * Only drinks already existing on the Drink Menu can be added for inventory checking.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Initial Stock Count
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={newCurrentStock}
                        onChange={(e) => setNewCurrentStock(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 font-bold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Unit Type
                      </label>
                      <select
                        value={newUnit}
                        onChange={(e) => setNewUnit(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none cursor-pointer"
                      >
                        <option value="bottles">bottles</option>
                        <option value="shots">shots</option>
                        <option value="cups">cups</option>
                        <option value="cans">cans</option>
                        <option value="packs">packs</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Low Stock Alert
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newThreshold}
                        onChange={(e) => setNewThreshold(e.target.value)}
                        placeholder="e.g. 5"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-amber-400 font-bold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Cost per Unit ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newCost}
                        onChange={(e) => setNewCost(e.target.value)}
                        placeholder="e.g. 1.80"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
                    <span className="text-emerald-400 text-xs">ℹ️</span>
                    <span>
                      Adding this item only enables inventory stock checking. It does not add or modify anything on the Drink Menu.
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setNewItemModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateNewTrackedItem}
                    disabled={!newProductName}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    Add to Inventory
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* EDIT ITEM STOCK & SETTINGS MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    Edit {editingItem.productName}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Adjust current stock count & inventory settings
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editModalError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editModalError}</span>
              </div>
            )}

            {isConfirmingEditDelete ? (
              /* Inline Removal Confirmation Card */
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">Remove from Inventory?</h4>
                  <p className="text-xs text-slate-300 mt-1">
                    Are you sure you want to remove <strong className="text-red-400">"{editingItem.productName}"</strong> from inventory tracking? Its current stock and alert settings will be removed.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingEditDelete(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteItem}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition shadow-lg shadow-red-600/30 flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Remove Item</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Standard Edit Fields */
              <>
                <div className="space-y-3.5">
                  {/* Direct Stock Count Edit */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-200">
                        Current Physical Stock ({editUnit || 'units'})
                      </label>
                      <span className="text-[11px] font-mono text-emerald-400 font-bold">
                        Previous: {editingItem.currentStock} {editingItem.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditStock(prev => Math.max(0, (parseInt(prev, 10) || 0) - 5).toString());
                          setEditModalError(null);
                        }}
                        className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-mono text-xs font-bold rounded-lg transition cursor-pointer"
                        title="Decrease by 5"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditStock(prev => Math.max(0, (parseInt(prev, 10) || 0) - 1).toString());
                          setEditModalError(null);
                        }}
                        className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-mono text-xs font-bold rounded-lg transition cursor-pointer"
                        title="Decrease by 1"
                      >
                        -1
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={editStock}
                        onChange={(e) => {
                          setEditStock(e.target.value);
                          setEditModalError(null);
                        }}
                        className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg font-mono text-base text-center font-black text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEditStock(prev => ((parseInt(prev, 10) || 0) + 1).toString());
                          setEditModalError(null);
                        }}
                        className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-mono text-xs font-bold rounded-lg transition cursor-pointer"
                        title="Increase by 1"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditStock(prev => ((parseInt(prev, 10) || 0) + 5).toString());
                          setEditModalError(null);
                        }}
                        className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-mono text-xs font-bold rounded-lg transition cursor-pointer"
                        title="Increase by 5"
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Low Stock Alert Threshold
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editThreshold}
                      onChange={(e) => {
                        setEditThreshold(e.target.value);
                        setEditModalError(null);
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-amber-400 font-bold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Unit Label (e.g. bottles, shots)
                    </label>
                    <input
                      type="text"
                      value={editUnit}
                      onChange={(e) => {
                        setEditUnit(e.target.value);
                        setEditModalError(null);
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Cost per Unit ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editCost}
                      onChange={(e) => {
                        setEditCost(e.target.value);
                        setEditModalError(null);
                      }}
                      placeholder="e.g. 1.80"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfirmingEditDelete(true);
                      setEditModalError(null);
                    }}
                    className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Item</span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(null);
                        setIsConfirmingEditDelete(false);
                        setEditModalError(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEditItem}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-md shadow-emerald-500/20"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PRINTABLE PHYSICAL STOCK SHEET MODAL */}
      {isPrintSlipOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-white text-base">
                  Physical Stock Count Sheet
                </h3>
              </div>
              <button
                onClick={() => setIsPrintSlipOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable View Container */}
            <div className="p-6 bg-white text-slate-950 rounded-xl space-y-4 font-sans print:p-0">
              <div className="text-center border-b-2 border-slate-900 pb-3">
                <h2 className="text-xl font-black tracking-tight uppercase">HERSHE BEVERAGES</h2>
                <p className="text-xs font-bold text-slate-600">DAILY INVENTORY & PHYSICAL AUDIT SHEET</p>
                <div className="flex justify-between text-xs font-mono font-semibold text-slate-700 mt-2">
                  <span>Date: {todayStr}</span>
                  <span>Auditor / Staff: __________________</span>
                </div>
              </div>

              <table className="w-full text-left text-xs border-collapse border border-slate-400">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 text-slate-900 font-extrabold uppercase text-[10px]">
                    <th className="border border-slate-400 p-2">Drink Item</th>
                    <th className="border border-slate-400 p-2 text-center">Unit</th>
                    <th className="border border-slate-400 p-2 text-center">System Stock</th>
                    <th className="border border-slate-400 p-2 text-center w-28">Physical Count</th>
                    <th className="border border-slate-400 p-2 text-center w-24">Difference</th>
                    <th className="border border-slate-400 p-2 text-center">Notes / Sign</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(item => (
                    <tr key={item.id} className="border-b border-slate-300">
                      <td className="border border-slate-400 p-2 font-bold text-slate-900">
                        {item.productName}
                      </td>
                      <td className="border border-slate-400 p-2 text-center text-slate-700">
                        {item.unit}
                      </td>
                      <td className="border border-slate-400 p-2 text-center font-mono font-bold">
                        {item.currentStock}
                      </td>
                      <td className="border border-slate-400 p-2 text-center font-mono text-slate-400">
                        [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
                      </td>
                      <td className="border border-slate-400 p-2 text-center font-mono text-slate-400">
                        [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
                      </td>
                      <td className="border border-slate-400 p-2 text-center text-slate-400">
                        ________________
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-4 flex justify-between text-xs text-slate-600 font-semibold border-t border-slate-300">
                <span>Manager Approval: _____________________</span>
                <span>Timestamp: {getBruneiTimeString()}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setIsPrintSlipOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Stock Sheet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE SINGLE LOG MODAL */}
      {logToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Delete Inventory Log</h3>
                  <p className="text-xs text-slate-400">Permanently delete this movement record</p>
                </div>
              </div>
              <button
                onClick={() => setLogToDelete(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Drink:</span>
                <span className="font-bold text-white">{logToDelete.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Date & Time:</span>
                <span className="font-mono text-slate-300">{logToDelete.date} {logToDelete.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Event Type:</span>
                <span className="font-bold text-sky-400 uppercase text-[10px]">{logToDelete.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Qty Change:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {logToDelete.quantityChange > 0 ? `+${logToDelete.quantityChange}` : logToDelete.quantityChange}
                </span>
              </div>
              {logToDelete.reason && (
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Reason:</span>
                  <span className="text-slate-300 text-right max-w-[200px] truncate">{logToDelete.reason}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-amber-400/90 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
              Note: Deleting this log removes it from the audit log record without changing your current on-hand stock counts.
            </p>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setLogToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLog}
                className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-black text-xs transition cursor-pointer shadow-lg shadow-red-500/20 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Log</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM CLEAR LOGS MODAL */}
      {isConfirmingClearLogs && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Clear Inventory Logs</h3>
                  <p className="text-xs text-slate-400">
                    {logFilterItem !== 'all' || logFilterType !== 'all' || searchQuery
                      ? `Clear ${filteredLogs.length} filtered log event(s)`
                      : `Clear all ${inventoryLogs.length} log event(s)`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmingClearLogs(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
              <p className="text-slate-300">
                Are you sure you want to delete{' '}
                <span className="font-bold text-white font-mono">{filteredLogs.length}</span> inventory audit log
                record(s)?
              </p>
              {logFilterItem !== 'all' && (
                <p className="text-slate-400 text-[11px]">
                  Filtered drink: <span className="text-emerald-400 font-semibold">{logFilterItem}</span>
                </p>
              )}
              {logFilterType !== 'all' && (
                <p className="text-slate-400 text-[11px]">
                  Filtered event: <span className="text-sky-400 font-semibold">{logFilterType}</span>
                </p>
              )}
            </div>

            <p className="text-xs text-red-400/90 bg-red-500/10 p-3 rounded-xl border border-red-500/20 font-semibold">
              This action cannot be undone. All matching movement and audit log history will be permanently deleted.
            </p>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingClearLogs(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearLogs}
                className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-black text-xs transition cursor-pointer shadow-lg shadow-red-500/20 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm & Delete {filteredLogs.length} Logs</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
