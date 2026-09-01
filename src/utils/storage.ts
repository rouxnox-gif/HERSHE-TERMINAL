import { Product, Order, Expense, PendingOrder, PeriodReport, AccountBalances, DailyAccountBreakdown, StaffShift, UserSession, MonthlyDistributionConfig, InventoryItem, InventoryLog } from '../types';
import { INITIAL_PRODUCTS, INITIAL_EXPENSES, INITIAL_SALES, INITIAL_PENDING_ORDERS, DEFAULT_INVENTORY, getBruneiDateString, getBruneiMonthString, getBruneiTimeString, getDefaultMonthlyDistribution } from '../data/initialData';

const STORAGE_KEY = 'hershe_pos_app_data_v4';

export interface StorageData {
  products: Product[];
  orders: Order[];
  expenses: Expense[];
  pendingOrders: PendingOrder[];
  shifts: StaffShift[];
  currentUser: UserSession | null;
  distributions?: Record<string, MonthlyDistributionConfig>;
  inventory?: InventoryItem[];
  inventoryLogs?: InventoryLog[];
}

export function loadStorageData(): StorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaultData: StorageData = {
        products: INITIAL_PRODUCTS,
        orders: [],
        expenses: [],
        pendingOrders: [],
        shifts: [],
        currentUser: null,
        distributions: {
          '2026-08': getDefaultMonthlyDistribution('2026-08'),
        },
        inventory: DEFAULT_INVENTORY,
        inventoryLogs: [],
      };
      saveStorageData(defaultData);
      return defaultData;
    }
    const parsed = JSON.parse(raw);
    
    // Ensure all 4 key tracked items (Beetboost, Green Detox, Orange Sunrise, Gingershot) exist in inventory
    let existingInventory: InventoryItem[] = Array.isArray(parsed.inventory) ? parsed.inventory : [];
    if (existingInventory.length === 0) {
      existingInventory = DEFAULT_INVENTORY;
    } else {
      // If any of the 4 default items are missing, add them seamlessly
      DEFAULT_INVENTORY.forEach(defItem => {
        const found = existingInventory.some(
          it => it.productName.toLowerCase().trim() === defItem.productName.toLowerCase().trim()
        );
        if (!found) {
          existingInventory.push(defItem);
        }
      });
    }

    return {
      products: Array.isArray(parsed.products) ? parsed.products : INITIAL_PRODUCTS,
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      pendingOrders: Array.isArray(parsed.pendingOrders) ? parsed.pendingOrders : [],
      shifts: Array.isArray(parsed.shifts) ? parsed.shifts : [],
      currentUser: parsed.currentUser || null,
      distributions: parsed.distributions && typeof parsed.distributions === 'object' ? parsed.distributions : {
        '2026-08': getDefaultMonthlyDistribution('2026-08'),
      },
      inventory: existingInventory,
      inventoryLogs: Array.isArray(parsed.inventoryLogs) ? parsed.inventoryLogs : [],
    };
  } catch (err) {
    console.error('Error loading storage data:', err);
    return {
      products: INITIAL_PRODUCTS,
      orders: [],
      expenses: [],
      pendingOrders: [],
      shifts: [],
      currentUser: null,
      distributions: {
        '2026-08': getDefaultMonthlyDistribution('2026-08'),
      },
      inventory: DEFAULT_INVENTORY,
      inventoryLogs: [],
    };
  }
}

export function saveStorageData(data: StorageData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Error saving storage data:', err);
  }
}

export function resetToDefaultData(): StorageData {
  const defaultData: StorageData = {
    products: INITIAL_PRODUCTS,
    orders: [],
    expenses: [],
    pendingOrders: [],
    shifts: [],
    currentUser: null,
    distributions: {
      '2026-08': getDefaultMonthlyDistribution('2026-08'),
    },
    inventory: DEFAULT_INVENTORY,
    inventoryLogs: [],
  };
  saveStorageData(defaultData);
  return defaultData;
}

// Financial Calculations
export function calculatePeriodReport(orders: Order[], expenses: Expense[], dateOrMonthStr: string, isMonth = false): PeriodReport {
  let filteredOrders = orders;
  let filteredExpenses = expenses;

  if (dateOrMonthStr) {
    if (isMonth) {
      filteredOrders = orders.filter(o => o.date && o.date.startsWith(dateOrMonthStr));
      filteredExpenses = expenses.filter(e => e.date && e.date.startsWith(dateOrMonthStr));
    } else {
      filteredOrders = orders.filter(o => o.date === dateOrMonthStr);
      filteredExpenses = expenses.filter(e => e.date === dateOrMonthStr);
    }
  }

  let cashSales = 0;
  let luluSales = 0;
  let mizahSales = 0;

  filteredOrders.forEach(o => {
    const amt = o.totalAmount || 0;
    if (o.paymentType === 'Cash' || o.paymentType === 'Binti Gym Transfer') cashSales += amt;
    else if (o.paymentType === 'Card Lulu') luluSales += amt;
    else if (o.paymentType === 'Card Mizah') mizahSales += amt;
  });

  let cashExpenses = 0;
  let luluExpenses = 0;
  let mizahExpenses = 0;

  filteredExpenses.forEach(e => {
    const amt = e.amount || 0;
    if (e.paymentType === 'Cash') cashExpenses += amt;
    else if (e.paymentType === 'Card Lulu') luluExpenses += amt;
    else if (e.paymentType === 'Card Mizah') mizahExpenses += amt;
  });

  const totalSales = cashSales + luluSales + mizahSales;
  const totalExpenses = cashExpenses + luluExpenses + mizahExpenses;
  const netProfit = totalSales - totalExpenses;

  return {
    totalSales,
    cashSales,
    luluSales,
    mizahSales,
    totalExpenses,
    cashExpenses,
    luluExpenses,
    mizahExpenses,
    netProfit,
  };
}

export function calculateAccountBalances(orders: Order[], expenses: Expense[], monthStr?: string): AccountBalances {
  let targetOrders = orders;
  let targetExpenses = expenses;

  if (monthStr) {
    targetOrders = orders.filter(o => o.date && o.date.startsWith(monthStr));
    targetExpenses = expenses.filter(e => e.date && e.date.startsWith(monthStr));
  }

  let cashIn = 0, luluIn = 0, mizahIn = 0;
  targetOrders.forEach(o => {
    const amt = o.totalAmount || 0;
    if (o.paymentType === 'Cash' || o.paymentType === 'Binti Gym Transfer') cashIn += amt;
    else if (o.paymentType === 'Card Lulu') luluIn += amt;
    else if (o.paymentType === 'Card Mizah') mizahIn += amt;
  });

  let cashOut = 0, luluOut = 0, mizahOut = 0;
  targetExpenses.forEach(e => {
    const amt = e.amount || 0;
    if (e.paymentType === 'Cash') cashOut += amt;
    else if (e.paymentType === 'Card Lulu') luluOut += amt;
    else if (e.paymentType === 'Card Mizah') mizahOut += amt;
  });

  const cash = cashIn - cashOut;
  const cardLulu = luluIn - luluOut;
  const cardMizah = mizahIn - mizahOut;
  const total = cash + cardLulu + cardMizah;

  return { cash, cardLulu, cardMizah, total };
}

export function calculateDailyAccountBalances(orders: Order[], expenses: Expense[], dateStr: string): DailyAccountBreakdown {
  const dayOrders = orders.filter(o => o.date === dateStr);
  const dayExpenses = expenses.filter(e => e.date === dateStr);

  let cashIn = 0, luluIn = 0, mizahIn = 0;
  dayOrders.forEach(o => {
    const amt = o.totalAmount || 0;
    if (o.paymentType === 'Cash' || o.paymentType === 'Binti Gym Transfer') cashIn += amt;
    else if (o.paymentType === 'Card Lulu') luluIn += amt;
    else if (o.paymentType === 'Card Mizah') mizahIn += amt;
  });

  let cashOut = 0, luluOut = 0, mizahOut = 0;
  dayExpenses.forEach(e => {
    const amt = e.amount || 0;
    if (e.paymentType === 'Cash') cashOut += amt;
    else if (e.paymentType === 'Card Lulu') luluOut += amt;
    else if (e.paymentType === 'Card Mizah') mizahOut += amt;
  });

  const cashNet = cashIn - cashOut;
  const luluNet = luluIn - luluOut;
  const mizahNet = mizahIn - mizahOut;
  const totalSales = cashIn + luluIn + mizahIn;
  const totalExpenses = cashOut + luluOut + mizahOut;
  const dailyNet = totalSales - totalExpenses;

  // Cumulative calculation up to and including dateStr (if dateStr is provided)
  const asOfOrders = dateStr ? orders.filter(o => o.date && o.date <= dateStr) : orders;
  const asOfExpenses = dateStr ? expenses.filter(e => e.date && e.date <= dateStr) : expenses;

  let cumCashIn = 0, cumLuluIn = 0, cumMizahIn = 0;
  asOfOrders.forEach(o => {
    const amt = o.totalAmount || 0;
    if (o.paymentType === 'Cash' || o.paymentType === 'Binti Gym Transfer') cumCashIn += amt;
    else if (o.paymentType === 'Card Lulu') cumLuluIn += amt;
    else if (o.paymentType === 'Card Mizah') cumMizahIn += amt;
  });

  let cumCashOut = 0, cumLuluOut = 0, cumMizahOut = 0;
  asOfExpenses.forEach(e => {
    const amt = e.amount || 0;
    if (e.paymentType === 'Cash') cumCashOut += amt;
    else if (e.paymentType === 'Card Lulu') cumLuluOut += amt;
    else if (e.paymentType === 'Card Mizah') cumMizahOut += amt;
  });

  const asOfCash = cumCashIn - cumCashOut;
  const asOfCardLulu = cumLuluIn - cumLuluOut;
  const asOfCardMizah = cumMizahIn - cumMizahOut;
  const asOfTotal = asOfCash + asOfCardLulu + asOfCardMizah;

  return {
    date: dateStr,
    cashIn,
    cashOut,
    cashNet,
    luluIn,
    luluOut,
    luluNet,
    mizahIn,
    mizahOut,
    mizahNet,
    totalSales,
    totalExpenses,
    dailyNet,
    asOfCash,
    asOfCardLulu,
    asOfCardMizah,
    asOfTotal,
  };
}

export function formatTimeDisplay(timeStr: string): string {
  if (!timeStr) return '-';
  const str = String(timeStr).trim();
  if (/^\d{1,2}:\d{2}(?::\d{2})?\s*(AM|PM|am|pm)$/i.test(str)) {
    const m = str.match(/^\s*(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM|am|pm)\s*$/i);
    if (m) return `${m[1]} ${m[2].toUpperCase()}`;
    return str;
  }
  const match = str.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }
  return str;
}

/**
 * Deducts stock from inventory for items present in a completed order.
 * Returns the updated inventory array and new inventory logs.
 */
export function deductInventoryForOrderItems(
  items: { name: string; qty: number }[],
  orderId: string,
  staffName: string,
  currentInventory: InventoryItem[] = [],
  currentLogs: InventoryLog[] = [],
  orderDate?: string,
  orderTime?: string
): { updatedInventory: InventoryItem[]; updatedLogs: InventoryLog[] } {
  if (!items || items.length === 0 || !currentInventory || currentInventory.length === 0) {
    return { updatedInventory: currentInventory, updatedLogs: currentLogs };
  }

  const date = orderDate || getBruneiDateString();
  const time = orderTime || getBruneiTimeString();
  const newLogs: InventoryLog[] = [];
  
  const updatedInventory = currentInventory.map(invItem => {
    // Find matching items in the order
    const matchingOrderItems = items.filter(
      it => it.name && it.name.toLowerCase().trim() === invItem.productName.toLowerCase().trim()
    );

    if (matchingOrderItems.length === 0) {
      return invItem;
    }

    const totalQtyDeducted = matchingOrderItems.reduce((acc, it) => acc + (Number(it.qty) || 1), 0);
    const newStock = Math.max(0, invItem.currentStock - totalQtyDeducted);

    newLogs.push({
      id: `log-sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      date,
      time,
      productName: invItem.productName,
      type: 'sale',
      quantityChange: -totalQtyDeducted,
      balanceAfter: newStock,
      reason: `Order #${orderId}`,
      staffName: staffName || 'Staff',
    });

    return {
      ...invItem,
      currentStock: newStock,
    };
  });

  return {
    updatedInventory,
    updatedLogs: [...newLogs, ...currentLogs],
  };
}

/**
 * Restores stock back to inventory if an order is rejected or cancelled.
 */
export function restoreInventoryForOrderItems(
  items: { name: string; qty: number }[],
  orderId: string,
  staffName: string,
  currentInventory: InventoryItem[] = [],
  currentLogs: InventoryLog[] = [],
  reasonStr?: string
): { updatedInventory: InventoryItem[]; updatedLogs: InventoryLog[] } {
  if (!items || items.length === 0 || !currentInventory || currentInventory.length === 0) {
    return { updatedInventory: currentInventory, updatedLogs: currentLogs };
  }

  const date = getBruneiDateString();
  const time = getBruneiTimeString();
  const newLogs: InventoryLog[] = [];

  const updatedInventory = currentInventory.map(invItem => {
    const matchingOrderItems = items.filter(
      it => it.name && it.name.toLowerCase().trim() === invItem.productName.toLowerCase().trim()
    );

    if (matchingOrderItems.length === 0) {
      return invItem;
    }

    const totalQtyRestored = matchingOrderItems.reduce((acc, it) => acc + (Number(it.qty) || 1), 0);
    const newStock = invItem.currentStock + totalQtyRestored;

    newLogs.push({
      id: `log-restore-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      date,
      time,
      productName: invItem.productName,
      type: 'adjustment',
      quantityChange: totalQtyRestored,
      balanceAfter: newStock,
      reason: reasonStr || `Order #${orderId} cancelled/rejected - stock restored`,
      staffName: staffName || 'Admin',
    });

    return {
      ...invItem,
      currentStock: newStock,
    };
  });

  return {
    updatedInventory,
    updatedLogs: [...newLogs, ...currentLogs],
  };
}

