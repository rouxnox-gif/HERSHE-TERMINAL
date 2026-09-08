import { Product, Expense, PendingOrder, Order, MonthlyDistributionConfig, PartnerShare, InventoryItem } from '../types';

export const DEFAULT_PARTNERS: PartnerShare[] = [
  { id: 'p-mizah', name: 'Mizah', percentage: 45 },
  { id: 'p-ema', name: 'Ema', percentage: 0 },
  { id: 'p-lulu', name: 'Lulu', percentage: 45 },
  { id: 'p-rifah', name: 'Rifah', percentage: 10 },
];

export const getDefaultMonthlyDistribution = (month: string): MonthlyDistributionConfig => ({
  month,
  juices: 17.50,
  juiceCount: 5,
  rental: 30.00,
  bottles: 105.00,
  customAccountNet: null,
  cashCarriedForward: 0.00,
  partners: [
    { id: 'p-mizah', name: 'Mizah', percentage: 45 },
    { id: 'p-ema', name: 'Ema', percentage: 0 },
    { id: 'p-lulu', name: 'Lulu', percentage: 45 },
    { id: 'p-rifah', name: 'Rifah', percentage: 10 },
  ],
});

export const INITIAL_PRODUCTS: Product[] = [];

// Helper for Brunei current date
export const getBruneiDateString = (): string => {
  const now = new Date();
  const bruneiTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Brunei" }));
  const yyyy = bruneiTime.getFullYear();
  const mm = String(bruneiTime.getMonth() + 1).padStart(2, '0');
  const dd = String(bruneiTime.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const getBruneiMonthString = (): string => {
  return getBruneiDateString().substring(0, 7);
};

export const getBruneiTimeString = (): string => {
  const now = new Date();
  return now.toLocaleTimeString("en-US", { timeZone: "Asia/Brunei", hour: 'numeric', minute: '2-digit', hour12: true });
};

const todayStr = getBruneiDateString();

export const DEFAULT_INVENTORY: InventoryItem[] = [];

/**
 * Known legacy synthetic inventory record IDs created by early auto-fill or template seeds.
 * A product in the Drink Menu must NEVER automatically create an InventoryItem.
 * Only explicit user actions in the Inventory management tab create legitimate InventoryItems.
 */
export const KNOWN_LEGACY_SYNTHETIC_IDS = new Set<string>([
  'inv-p1', 'inv-p2', 'inv-p3', 'inv-p4', 'inv-p5', 'inv-p6', 'inv-p7', 'inv-p8',
  'inv-prod-p1', 'inv-prod-p2', 'inv-prod-p3', 'inv-prod-p4', 'inv-prod-p5', 'inv-prod-p6', 'inv-prod-p7', 'inv-prod-p8',
  'inv-1', 'inv-2', 'inv-3', 'inv-4',
]);

export function isLegacySyntheticInventoryId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (KNOWN_LEGACY_SYNTHETIC_IDS.has(id)) return true;
  if (id.startsWith('inv-legacy-') || id.startsWith('inv-prod-legacy-')) return true;
  // Specific pattern for old default template products: inv-p1..p8 or inv-prod-p1..p8
  if (/^inv-(prod-)?p[1-8]$/.test(id)) return true;
  return false;
}

export const INITIAL_EXPENSES: Expense[] = [
  { id: 'exp-1', date: todayStr, description: 'Fresh Whole Milk & Dairy Supplies', paymentType: 'Cash', amount: 48.50 },
  { id: 'exp-2', date: todayStr, description: 'Ice Delivery & Fresh Strawberries', paymentType: 'Card Lulu', amount: 65.00 },
  { id: 'exp-3', date: todayStr, description: 'Eco-friendly Cups & Straws Bulk', paymentType: 'Card Mizah', amount: 32.00 },
];

export const INITIAL_SALES: Order[] = [
  {
    orderId: 'HS-781920',
    date: todayStr,
    time: '10:15 AM',
    paymentType: 'Cash',
    subtotal: 13.50,
    discountValue: 0,
    totalAmount: 13.50,
    paymentReceivedDate: todayStr,
    paymentReceivedTime: '10:15 AM',
    itemsSummary: '1x Strawberry Splash (+ With Protein), 1x Iced Spanish Latte',
    items: [
      { name: 'Strawberry Splash', addonString: 'With Protein', qty: 1, lineTotal: 7.50, finalPrice: 7.50 },
      { name: 'Iced Spanish Latte', addonString: 'None', qty: 1, lineTotal: 6.00, finalPrice: 6.00 },
    ]
  },
  {
    orderId: 'HS-781921',
    date: todayStr,
    time: '11:40 AM',
    paymentType: 'Card Lulu',
    subtotal: 11.00,
    discountValue: 1.00,
    totalAmount: 10.00,
    paymentReceivedDate: todayStr,
    paymentReceivedTime: '11:40 AM',
    itemsSummary: '2x Mango Tango',
    items: [
      { name: 'Mango Tango', addonString: 'None', qty: 2, lineTotal: 11.00, finalPrice: 10.00 }
    ]
  },
  {
    orderId: 'HS-781922',
    date: todayStr,
    time: '01:25 PM',
    paymentType: 'Card Mizah',
    subtotal: 17.50,
    discountValue: 0,
    totalAmount: 17.50,
    itemsSummary: '1x Cookies and Cream (+ With Oat), 1x Avocado Smoothie, 1x Iced Americano',
    items: [
      { name: 'Cookies and Cream', addonString: 'With Oat', qty: 1, lineTotal: 6.50, finalPrice: 6.50 },
      { name: 'Avocado Smoothie', addonString: 'None', qty: 1, lineTotal: 6.00, finalPrice: 6.00 },
      { name: 'Iced Americano', addonString: 'None', qty: 1, lineTotal: 5.00, finalPrice: 5.00 }
    ]
  }
];

export const INITIAL_PENDING_ORDERS: PendingOrder[] = [
  {
    orderId: 'HS-ONLINE-001',
    date: todayStr,
    time: '02:05 PM',
    totalAmount: 13.00,
    paymentType: 'Card Lulu',
    source: 'WhatsApp Order',
    itemsSummary: '2x Watermelon Bliss (+ With Oat)',
    items: [
      { name: 'Watermelon Bliss', qty: 2, price: 6.00, oat: true }
    ]
  },
  {
    orderId: 'HS-ONLINE-002',
    date: todayStr,
    time: '02:18 PM',
    totalAmount: 18.50,
    paymentType: 'Cash',
    source: 'Online Delivery App',
    itemsSummary: '1x Strawberry Splash (+ With Protein), 2x Fresh Lemonade',
    items: [
      { name: 'Strawberry Splash', qty: 1, price: 7.50, protein: true },
      { name: 'Fresh Lemonade', qty: 2, price: 4.50 }
    ]
  },
  {
    orderId: 'HS-ONLINE-003',
    date: todayStr,
    time: '02:40 PM',
    totalAmount: 11.00,
    paymentType: 'Card Mizah',
    source: 'Website Pre-Order',
    itemsSummary: '2x Berry Delight',
    items: [
      { name: 'Berry Delight', qty: 2, price: 5.50 }
    ]
  }
];
