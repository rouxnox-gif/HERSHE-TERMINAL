export type PaymentMethod = 'Cash' | 'Card Lulu' | 'Card Mizah' | 'Binti Gym Transfer' | (string & {});

export interface PaymentTypeConfig {
  id: string; // Identifier or original key
  name: string; // User-facing display label
  enabled?: boolean;
  isCustom?: boolean;
}

export interface TabConfig {
  id: TabType;
  label: string;
  description?: string;
  defaultVisible: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category?: string;
  allowAddons?: boolean; // Choices: true (allow add-ons / modifiers) | false (no add-ons)
  allowedAddonIds?: string[]; // Optional specific allowed add-on IDs
  updatedAt?: string;
  deviceId?: string;
  isDeleted?: boolean;
}

export interface CartItem {
  id: string;
  productId?: string;
  name: string;
  basePrice: number;
  qty: number;
  protein?: boolean;
  oat?: boolean;
  allowAddons?: boolean;
  selectedAddons?: CustomAddon[];
  addonString?: string;
  lineTotal?: number;
}

export interface OrderItem {
  id?: string;
  orderId?: string;
  name: string;
  addonString: string;
  qty: number;
  lineTotal: number;
  finalPrice: number;
  createdAt?: string;
}

export interface Order {
  id?: string;
  orderId: string;
  date: string;
  time: string;
  paymentType: PaymentMethod;
  subtotal: number;
  discountValue: number;
  totalAmount: number;
  items: OrderItem[];
  itemsSummary?: string;
  staffName?: string;
  paymentReceivedDate?: string;
  paymentReceivedTime?: string;
  paymentReceivedAt?: string;
  originalSubmissionDate?: string;
  originalSubmissionTime?: string;
  createdAt?: string;
  updatedAt?: string;
  deviceId?: string;
  isDeleted?: boolean;
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  paymentType: PaymentMethod;
  amount: number;
  createdAt?: string;
  updatedAt?: string;
  deviceId?: string;
  isDeleted?: boolean;
}

export interface CustomAddon {
  id: string;
  name: string;
  price: number;
  description?: string;
  enabled: boolean;
}

export interface StoreInfoSettings {
  storeName: string;
  whatsappNumber: string;
  location: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  instructions?: string;
  isPreOrderOpen?: boolean;
  closedMessage?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  addons?: CustomAddon[];
  customPortalUrl?: string;
}

export interface PendingOrder {
  id?: string;
  orderId: string;
  date: string;
  time: string;
  totalAmount: number;
  paymentType: PaymentMethod;
  source: string;
  itemsSummary: string;
  staffName?: string;
  customerName?: string;
  customerPhone?: string;
  customerNotes?: string;
  pickupTime?: string;
  orderSource?: 'customer_preorder' | 'pos_staff' | 'pos' | string;
  inventoryDeducted?: boolean;
  status?: 'pending' | 'approving' | 'approved' | 'rejected';
  items: {
    name: string;
    qty: number;
    price: number;
    protein?: boolean;
    oat?: boolean;
    addonString?: string;
    addons?: { id: string; name: string; price: number }[];
    lineTotal?: number;
  }[];
  createdAt?: string;
  updatedAt?: string;
  deviceId?: string;
  isDeleted?: boolean;
}

export interface AccountBalances {
  cash: number;
  cardLulu: number;
  cardMizah: number;
  total: number;
}

export interface DailyAccountBreakdown {
  date: string;
  cashIn: number;
  cashOut: number;
  cashNet: number;
  luluIn: number;
  luluOut: number;
  luluNet: number;
  mizahIn: number;
  mizahOut: number;
  mizahNet: number;
  totalSales: number;
  totalExpenses: number;
  dailyNet: number;
  asOfCash: number;
  asOfCardLulu: number;
  asOfCardMizah: number;
  asOfTotal: number;
}

export interface PeriodReport {
  totalSales: number;
  cashSales: number;
  luluSales: number;
  mizahSales: number;
  totalExpenses: number;
  cashExpenses: number;
  luluExpenses: number;
  mizahExpenses: number;
  netProfit: number;
}

export interface PartnerShare {
  id: string;
  name: string;
  percentage: number;
}

export interface MonthlyDistributionConfig {
  month: string;
  juices: number;
  juiceCount?: number;
  rental: number;
  bottles: number;
  customAccountNet?: number | null;
  cashCarriedForward: number;
  partners: PartnerShare[];
  updatedAt?: string;
  deviceId?: string;
}

export interface InventoryItem {
  id: string;
  productName: string;
  currentStock: number;
  unit: string; // e.g. 'bottles' | 'shots' | 'cups' | 'pcs'
  lowStockThreshold: number;
  costPerUnit?: number;
  lastRestockedDate?: string;
  lastRestockedQty?: number;
  isDeleted?: boolean;
  updatedAt?: string;
  deviceId?: string;
}

export interface InventoryLog {
  id: string;
  timestamp: string;
  date: string;
  time: string;
  productName: string;
  type: 'sale' | 'restock' | 'spoilage' | 'adjustment' | 'restore';
  quantityChange: number;
  balanceAfter: number;
  reason?: string;
  staffName?: string;
  createdAt?: string;
}

export interface InventoryMovement {
  movementId: string;
  productId?: string;
  productName: string;
  quantityChange: number; // e.g., -2 for sale, +5 for restock, +2 for cancel restore
  type: 'sale' | 'restock' | 'spoilage' | 'adjustment' | 'restore';
  orderId?: string;
  deviceId: string;
  createdAt: string;
  staffName: string;
  reason?: string;
  appliedLocally?: boolean;
  syncedToFirestore?: boolean;
}

export type SyncEntityType = 
  | 'order' 
  | 'product' 
  | 'expense' 
  | 'pendingOrder' 
  | 'inventoryMovement' 
  | 'inventoryItem' 
  | 'shift' 
  | 'distribution';

export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE' | 'INVENTORY_MOVEMENT';

export interface SyncQueueItem {
  operationId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperationType;
  payload: any;
  deviceId: string;
  createdAt: string;
  retryCount: number;
  lastAttempt?: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error?: string;
}

export interface SyncMeta {
  key: string;
  value: any;
  updatedAt: string;
}

export type SyncConnectionState = 'ONLINE' | 'SYNCING' | 'OFFLINE' | 'SYNCED' | 'ERROR';

export type TabType = 'dashboard' | 'sales' | 'inventory' | 'expenses' | 'monthly' | 'distribution' | 'history' | 'pending' | 'receipts' | 'customer';

export type UserRole = 'admin' | 'staff';

export interface UserSession {
  name: string;
  role: UserRole;
  checkInTime: string;
  date: string;
}

export interface StaffShift {
  id: string;
  staffName: string;
  role: UserRole;
  checkInDate: string;
  checkInTime: string;
  checkOutTime?: string;
  status: 'active' | 'ended';
  createdAt?: string;
  updatedAt?: string;
  deviceId?: string;
}
