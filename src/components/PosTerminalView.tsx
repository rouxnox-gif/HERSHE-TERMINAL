import React, { useState, useMemo, useRef } from 'react';
import { Product, CartItem, Order, PaymentMethod, OrderItem, InventoryItem, PaymentTypeConfig, CustomAddon, StoreInfoSettings } from '../types';
import { DEFAULT_PAYMENT_CONFIGS } from '../db/repositories/appSettingsRepo';
import { AddonModal } from './AddonModal';
import { StoreAddonsModal } from './StoreAddonsModal';
import { Search, Plus, Save, Trash2, ShoppingBag, CreditCard, DollarSign, Calendar, Check, Pencil, X, Edit3, AlertTriangle, Boxes, Layers } from 'lucide-react';
import { getBruneiDateString } from '../data/initialData';

interface PosTerminalViewProps {
  products: Product[];
  inventory?: InventoryItem[];
  paymentConfigs?: PaymentTypeConfig[];
  onSaveNewProduct: (product: Product) => void;
  onUpdateProduct?: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
  onClearAllProducts?: () => void;
  onChargeOrder: (order: Order) => void;
  currentUserRole?: 'admin' | 'staff';
  currentUserName?: string;
  activeShiftStaffName?: string;
  storeInfo?: StoreInfoSettings;
  onSaveStoreInfo?: (info: StoreInfoSettings) => void;
}

export const PosTerminalView: React.FC<PosTerminalViewProps> = ({
  products,
  inventory = [],
  paymentConfigs = DEFAULT_PAYMENT_CONFIGS,
  onSaveNewProduct,
  onUpdateProduct,
  onDeleteProduct,
  onClearAllProducts,
  onChargeOrder,
  currentUserRole,
  currentUserName,
  activeShiftStaffName,
  storeInfo,
  onSaveStoreInfo,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(getBruneiDateString());

  // Enabled payment methods list
  const enabledPaymentConfigs = useMemo(() => {
    if (paymentConfigs && paymentConfigs.length > 0) {
      const active = paymentConfigs.filter(c => c.enabled !== false);
      return active.length > 0 ? active : DEFAULT_PAYMENT_CONFIGS;
    }
    return DEFAULT_PAYMENT_CONFIGS;
  }, [paymentConfigs]);

  // Inventory lookup by product name and product id
  const inventoryMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    inventory.forEach(item => {
      if (item.productName) {
        map.set(item.productName.toLowerCase().trim(), item);
      }
      if (item.id) {
        map.set(item.id.toLowerCase().trim(), item);
        if (item.id.startsWith('inv-')) {
          map.set(item.id.slice(4).toLowerCase().trim(), item);
        }
      }
    });
    return map;
  }, [inventory]);
  
  // Custom product inputs
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customAllowAddons, setCustomAllowAddons] = useState(true);

  // Cart / Ticket state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountInput, setDiscountInput] = useState('');
  const [cashTendered, setCashTendered] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentMethod>('Cash');

  // Addon modal state
  const [addonModalOpen, setAddonModalOpen] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState<Product | null>(null);

  // Edit Drink Modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editAllowAddons, setEditAllowAddons] = useState(true);
  const [editSelectedAddonIds, setEditSelectedAddonIds] = useState<string[]>([]);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Store Addons & Clear Menu modal state
  const [isStoreAddonsOpen, setIsStoreAddonsOpen] = useState(false);
  const [isClearMenuModalOpen, setIsClearMenuModalOpen] = useState(false);

  // Add Drink Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newDrinkName, setNewDrinkName] = useState('');
  const [newDrinkPrice, setNewDrinkPrice] = useState('');
  const [newDrinkCategory, setNewDrinkCategory] = useState('');
  const [newDrinkAllowAddons, setNewDrinkAllowAddons] = useState(true);
  const [newDrinkSelectedAddonIds, setNewDrinkSelectedAddonIds] = useState<string[]>([]);

  // Mobile drawer state
  const [mobileSubTab, setMobileSubTab] = useState<'menu' | 'ticket'>('menu');
  const [isMobilePayModalOpen, setIsMobilePayModalOpen] = useState(false);

  // Success and submission protection
  const [chargedSuccess, setChargedSuccess] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const isSubmittingRef = useRef(false);
  const checkoutSessionIdRef = useRef<string | null>(null);

  const getOrCreateCheckoutId = (): string => {
    if (!checkoutSessionIdRef.current) {
      const entropySuffix = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().substring(0, 8).toUpperCase()
        : `${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      checkoutSessionIdRef.current = `HS-${entropySuffix}`;
    }
    return checkoutSessionIdRef.current;
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);

  // Handle drink selection to add to ticket
  const handleDrinkClick = (product: Product) => {
    // If the drink has add-ons disabled, directly add plain drink to ticket
    if (product.allowAddons === false) {
      addToCart(product.name, product.price, false, false, [], false, product.id);
      return;
    }

    const activeAddons = (storeInfo?.addons || []).filter(a => a.enabled !== false);
    const applicableAddons = (product.allowedAddonIds && product.allowedAddonIds.length > 0)
      ? activeAddons.filter(a => product.allowedAddonIds!.includes(a.id))
      : activeAddons;

    if (applicableAddons.length > 0) {
      setSelectedDrink(product);
      setAddonModalOpen(true);
    } else {
      addToCart(product.name, product.price, false, false, [], true, product.id);
    }
  };

  const addToCart = (
    name: string,
    price: number,
    protein = false,
    oat = false,
    selectedAddons: CustomAddon[] = [],
    allowAddons = true,
    productId?: string
  ) => {
    setCart(prevCart => {
      const addonKey = selectedAddons.map(a => a.id).sort().join(',');
      const existing = prevCart.find(
        item => {
          const itemAddonKey = (item.selectedAddons || []).map(a => a.id).sort().join(',');
          return item.name === name && itemAddonKey === addonKey && item.protein === protein && item.oat === oat && Math.abs(item.basePrice - price) < 0.001;
        }
      );
      if (existing) {
        return prevCart.map(item =>
          item.id === existing.id ? { ...item, qty: item.qty + 1 } : item
        );
      } else {
        const addonNames = selectedAddons.map(a => a.name).join(', ');
        const newItem: CartItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          productId,
          name,
          basePrice: price,
          qty: 1,
          protein,
          oat,
          allowAddons,
          selectedAddons,
          addonString: addonNames || undefined,
        };
        return [...prevCart, newItem];
      }
    });
  };

  const toggleAddon = (id: string, type: 'protein' | 'oat') => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [type]: !item[type] };
      }
      return item;
    }));
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const clearCart = () => {
    setCart([]);
    setDiscountInput('');
    setCashTendered('');
    checkoutSessionIdRef.current = null;
  };

  // Add Custom Drink to Cart directly
  const handleAddCustomToTicket = () => {
    const name = customName.trim();
    const price = parseFloat(customPrice);
    if (!name || isNaN(price) || price < 0) {
      alert('Please enter a valid drink name and price.');
      return;
    }
    addToCart(name, price, false, false, [], customAllowAddons);
    setCustomName('');
    setCustomPrice('');
  };

  // Save Custom Drink to Menu Catalog
  const handleSaveCustomToMenu = () => {
    if (currentUserRole === 'staff') {
      alert('Staff accounts are not permitted to add drinks to the Drink Menu. Only Admin can manage the Drink Menu.');
      return;
    }
    const name = customName.trim();
    const price = parseFloat(customPrice);
    if (!name || isNaN(price) || price < 0) {
      alert('Please enter a valid drink name and price to save to the menu catalog.');
      return;
    }
    const newProd: Product = {
      id: `p-custom-${Date.now()}`,
      name,
      price,
      allowAddons: customAllowAddons,
    };
    onSaveNewProduct(newProd);
    setCustomName('');
    setCustomPrice('');
  };

  // Open Edit Product Modal
  const handleOpenEditModal = (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProduct(p);
    setEditName(p.name);
    setEditPrice(p.price.toString());
    setEditAllowAddons(p.allowAddons !== false);
    setEditSelectedAddonIds(p.allowedAddonIds || []);
    setIsConfirmingDelete(false);
    setValidationError(null);
  };

  // Save Edited Product
  const handleSaveEditProduct = () => {
    if (!editingProduct) return;
    const name = editName.trim();
    const price = parseFloat(editPrice);
    if (!name || isNaN(price) || price < 0) {
      setValidationError('Please enter a valid drink name and positive price.');
      return;
    }

    if (onUpdateProduct) {
      onUpdateProduct({
        ...editingProduct,
        name,
        price,
        allowAddons: editAllowAddons,
        allowedAddonIds: editAllowAddons ? editSelectedAddonIds : [],
      });
    }
    setEditingProduct(null);
    setIsConfirmingDelete(false);
    setValidationError(null);
  };

  // Delete Product
  const handleDeleteProduct = () => {
    if (!editingProduct) return;
    if (onDeleteProduct) {
      onDeleteProduct(editingProduct.id);
    }
    setEditingProduct(null);
    setIsConfirmingDelete(false);
    setValidationError(null);
  };

  // Save New Drink via Modal
  const handleSaveNewModalDrink = () => {
    if (currentUserRole === 'staff') {
      alert('Staff accounts are not permitted to add drinks to the Drink Menu. Only Admin can manage the Drink Menu.');
      return;
    }
    const name = newDrinkName.trim();
    const price = parseFloat(newDrinkPrice);
    const category = newDrinkCategory.trim() || 'Menu';
    if (!name || isNaN(price) || price < 0) {
      alert('Please enter a valid drink name and price.');
      return;
    }

    const newProd: Product = {
      id: `p-modal-${Date.now()}`,
      name,
      price,
      category,
      allowAddons: newDrinkAllowAddons,
      allowedAddonIds: newDrinkAllowAddons ? newDrinkSelectedAddonIds : [],
    };
    onSaveNewProduct(newProd);
    setNewDrinkName('');
    setNewDrinkPrice('');
    setNewDrinkCategory('');
    setNewDrinkAllowAddons(true);
    setNewDrinkSelectedAddonIds([]);
    setAddModalOpen(false);
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      let addPrice = 0;
      if (item.selectedAddons && item.selectedAddons.length > 0) {
        addPrice = item.selectedAddons.reduce((sum, a) => sum + (a.price || 0), 0);
      } else {
        if (item.protein) addPrice += 2.00;
        if (item.oat) addPrice += 0.50;
      }
      return acc + (item.basePrice + addPrice) * item.qty;
    }, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const trimmed = discountInput.trim();
    if (!trimmed) return 0;
    if (trimmed.includes('%')) {
      const pct = parseFloat(trimmed.replace('%', '')) || 0;
      return subtotal * (pct / 100);
    } else {
      return parseFloat(trimmed) || 0;
    }
  }, [discountInput, subtotal]);

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const cashVal = parseFloat(cashTendered) || 0;
  const changeDue = cashVal > 0 && cashVal >= finalTotal ? cashVal - finalTotal : 0;

  const totalItemCount = useMemo(() => {
    return cart.reduce((acc, i) => acc + i.qty, 0);
  }, [cart]);

  // Charge Order
  const handleChargeOrder = () => {
    if (isSubmittingRef.current || isSubmittingOrder) return;
    if (cart.length === 0) {
      alert('Ticket is empty! Please add drinks first.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmittingOrder(true);

    const orderItems: OrderItem[] = cart.map(item => {
      let addPrice = 0;
      if (item.selectedAddons && item.selectedAddons.length > 0) {
        addPrice = item.selectedAddons.reduce((sum, a) => sum + (a.price || 0), 0);
      } else {
        if (item.protein) addPrice += 2.00;
        if (item.oat) addPrice += 0.50;
      }
      let lineTotal = (item.basePrice + addPrice) * item.qty;
      let itemDiscountShare = subtotal > 0 ? (lineTotal / subtotal) * discountAmount : 0;
      let finalPrice = Math.max(0, lineTotal - itemDiscountShare);

      let addonString = 'None';
      if (item.selectedAddons && item.selectedAddons.length > 0) {
        addonString = item.selectedAddons.map(a => a.name).join(', ');
      } else {
        const legacy: string[] = [];
        if (item.protein) legacy.push('With Protein');
        if (item.oat) legacy.push('With Oat');
        if (legacy.length > 0) addonString = legacy.join(', ');
      }

      return {
        name: item.name,
        addonString,
        qty: item.qty,
        lineTotal,
        finalPrice: finalPrice,
      };
    });

    const receiptTime = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
    const orderId = getOrCreateCheckoutId();
    const staffOnShift = currentUserName || activeShiftStaffName || (currentUserRole === 'admin' ? 'Admin' : 'Staff On Shift');

    const newOrder: Order = {
      orderId,
      date: selectedDate,
      time: receiptTime,
      paymentType,
      subtotal,
      discountValue: discountAmount,
      totalAmount: finalTotal,
      items: orderItems,
      itemsSummary: orderItems.map(i => `${i.qty}x ${i.name}${i.addonString !== 'None' ? ` (+ ${i.addonString})` : ''}`).join(', '),
      staffName: staffOnShift,
    };

    onChargeOrder(newOrder);

    // Visual feedback
    setChargedSuccess(true);
    setTimeout(() => {
      setChargedSuccess(false);
      setIsMobilePayModalOpen(false);
      setIsSubmittingOrder(false);
      isSubmittingRef.current = false;
    }, 1000);

    clearCart();
  };

  return (
    <div className="h-full flex flex-col p-3 md:p-6 max-w-7xl mx-auto w-full overflow-hidden">
      {/* Mobile Sub-Navigation Tabs */}
      <div className="flex md:hidden gap-2 mb-3">
        <button
          onClick={() => setMobileSubTab('menu')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition
            ${mobileSubTab === 'menu'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
              : 'bg-slate-900 text-slate-400 border-slate-800'
            }
          `}
        >
          🥤 Drink Menu
        </button>
        <button
          onClick={() => setMobileSubTab('ticket')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition relative
            ${mobileSubTab === 'ticket'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
              : 'bg-slate-900 text-slate-400 border-slate-800'
            }
          `}
        >
          🛒 Ticket
          {totalItemCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950 text-emerald-400 font-mono font-bold">
              {totalItemCount}
            </span>
          )}
        </button>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden ${totalItemCount > 0 ? 'pb-20 md:pb-0' : ''}`}>
        {/* CATALOG PANEL (Left) */}
        <div 
          className={`md:col-span-7 lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-col min-h-0 shadow-xl
            ${mobileSubTab === 'menu' ? 'flex' : 'hidden md:flex'}
          `}
        >
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-extrabold text-sm text-white tracking-tight">Drink Menu</h3>
              {currentUserRole !== 'staff' && (
                <>
                  <button
                    onClick={() => setAddModalOpen(true)}
                    className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Add a new drink to catalog"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Drink</span>
                  </button>
                  {storeInfo && onSaveStoreInfo && (
                    <button
                      onClick={() => setIsStoreAddonsOpen(true)}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                      title="Configure store add-ons and modifiers"
                    >
                      <Layers className="w-3 h-3 text-emerald-400" />
                      <span>Add-ons ({storeInfo.addons?.length || 0})</span>
                    </button>
                  )}
                  {products.length > 0 && onClearAllProducts && (
                    <button
                      onClick={() => setIsClearMenuModalOpen(true)}
                      className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 ml-auto sm:ml-0"
                      title="Clear all drinks to start fresh"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear Menu</span>
                    </button>
                  )}
                </>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 self-start sm:self-auto">
              <Calendar className="w-3 h-3 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-[11px] font-mono font-bold text-emerald-400 focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 md:top-2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drinks..."
              className="w-full pl-8 pr-3 py-1.5 md:py-1 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg text-xs md:text-[11px] font-medium text-slate-200 placeholder:text-slate-500 focus:outline-none transition"
            />
          </div>

          {/* Compact Product Grid */}
          <div className="flex-1 overflow-y-auto no-scrollbar pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 content-start items-start min-h-0 py-1">
            {products.length === 0 ? (
              <div className="col-span-full py-12 px-4 text-center bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Your Store Menu is Empty</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    {currentUserRole === 'staff'
                      ? 'No drinks are currently available on the Drink Menu. Staff accounts cannot add new drinks. Please contact an admin or manager.'
                      : "Add your store's dedicated drinks and custom add-ons below!"}
                  </p>
                </div>
                {currentUserRole !== 'staff' && (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      onClick={() => setAddModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>Add Drink</span>
                    </button>
                    {storeInfo && onSaveStoreInfo && (
                      <button
                        onClick={() => setIsStoreAddonsOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Layers className="w-4 h-4 text-emerald-400" />
                        <span>Manage Add-ons</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-500 text-xs">
                No matching drinks found for "{searchQuery}"
              </div>
            ) : (
              filteredProducts.map(p => {
                const invItem =
                  inventoryMap.get(p.name.toLowerCase().trim()) ||
                  (p.id ? inventoryMap.get(p.id.toLowerCase().trim()) : undefined);
                const hasInventoryRecord = invItem !== undefined;
                const stock = hasInventoryRecord ? (Number(invItem.currentStock) || 0) : 0;
                const isOutOfStock = hasInventoryRecord && stock === 0;
                const isLowStock = hasInventoryRecord && stock <= invItem.lowStockThreshold && stock > 0;
                const unit = invItem?.unit === 'shots' ? 'sh' : 'btl';

                return (
                  <div
                    key={p.id}
                    onClick={() => handleDrinkClick(p)}
                    className={`p-2 bg-slate-950 hover:bg-slate-800/90 border rounded-lg text-left transition duration-150 flex flex-col justify-between gap-1 group shadow-sm active:scale-98 cursor-pointer relative min-h-[84px] shrink-0
                      ${isOutOfStock 
                        ? 'border-red-500/40 opacity-80 hover:border-red-500' 
                        : isLowStock 
                        ? 'border-amber-500/40 hover:border-amber-500/70' 
                        : 'border-slate-800/80 hover:border-emerald-500/50'
                      }
                    `}
                  >
                    {/* Edit Pencil Button */}
                    <button
                      onClick={(e) => handleOpenEditModal(p, e)}
                      className="absolute top-1 right-1 p-1 rounded-md bg-slate-900/90 hover:bg-sky-500 hover:text-slate-950 text-slate-400 border border-slate-800 hover:border-sky-400 transition cursor-pointer z-10 opacity-70 hover:opacity-100"
                      title="Edit drink details or price"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>

                    <div>
                      <span className="font-bold text-[11px] md:text-[10px] lg:text-[11px] text-slate-200 group-hover:text-emerald-300 transition line-clamp-2 leading-tight pr-4">
                        {p.name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 mt-auto pt-1">
                      {/* Inventory Stock Pill & Addon Indicator */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {hasInventoryRecord && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-1 ${
                            isOutOfStock
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : isLowStock
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                          }`}>
                            <span className={`w-1 h-1 rounded-full ${
                              isOutOfStock ? 'bg-red-400' : isLowStock ? 'bg-amber-400' : 'bg-emerald-400'
                            }`} />
                            {stock} {unit}
                          </span>
                        )}

                        {p.allowAddons === false ? (
                          <span className="px-1 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400 text-[8px] font-semibold">
                            Plain
                          </span>
                        ) : (
                          <span className="px-1 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/90 text-[8px] font-semibold">
                            +Add-on
                          </span>
                        )}
                      </div>

                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 font-mono font-extrabold text-[10px] text-emerald-400 shrink-0">
                        ${p.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Custom Item Adder */}
          <div className="pt-2 mt-2 border-t border-dashed border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 overflow-hidden">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-[11px] md:text-[10px] font-bold text-slate-400 shrink-0">Custom:</span>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Drink Name"
                className="flex-1 min-w-0 px-2.5 py-1 md:py-0.5 bg-slate-950 border border-slate-800 rounded-lg text-xs md:text-[11px] font-medium text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-700"
              />
              <input
                type="number"
                step="0.01"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="Price $"
                className="w-16 sm:w-20 px-2 py-1 md:py-0.5 bg-slate-950 border border-slate-800 rounded-lg text-xs md:text-[11px] font-medium text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-700 shrink-0"
              />
              <button
                type="button"
                onClick={() => setCustomAllowAddons(prev => !prev)}
                className={`px-2 py-1 md:py-0.5 rounded-lg text-[10px] font-bold border transition shrink-0 cursor-pointer ${
                  customAllowAddons
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                }`}
                title={customAllowAddons ? 'Add-ons choice is enabled' : 'Add-ons choice is disabled (plain only)'}
              >
                {customAllowAddons ? '+Addons' : 'No Addons'}
              </button>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleAddCustomToTicket}
                className="flex-1 sm:flex-none px-2.5 py-1 md:py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs md:text-[11px] transition whitespace-nowrap cursor-pointer text-center"
                title="Add to current ticket only"
              >
                + Ticket
              </button>
              {currentUserRole !== 'staff' && (
                <button
                  onClick={handleSaveCustomToMenu}
                  className="flex-1 sm:flex-none px-2.5 py-1 md:py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs md:text-[11px] transition whitespace-nowrap flex items-center justify-center gap-1 cursor-pointer"
                  title="Save to Drink Menu catalog for future use"
                >
                  <Save className="w-3 h-3 text-emerald-400" />
                  Save Menu
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CHECKOUT TICKET PANEL (Right) */}
        <div 
          className={`md:col-span-5 lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col min-h-0 shadow-xl
            ${mobileSubTab === 'ticket' ? 'flex' : 'hidden md:flex'}
          `}
        >
          <div className="flex items-center justify-between pb-3 border-b-2 border-slate-800">
            <span className="font-extrabold text-sm text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              Current Ticket
            </span>
            <button
              onClick={clearCart}
              className="text-[11px] font-bold text-red-400 hover:text-red-300 hover:underline transition cursor-pointer"
            >
              CLEAR ALL
            </button>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto no-scrollbar my-3 pr-1 space-y-2.5 min-h-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2 py-12">
                <ShoppingBag className="w-8 h-8 stroke-1 text-slate-600" />
                <span>Ticket is empty</span>
              </div>
            ) : (
              cart.map(item => {
                let addPrice = 0;
                if (item.selectedAddons && item.selectedAddons.length > 0) {
                  addPrice = item.selectedAddons.reduce((sum, a) => sum + (a.price || 0), 0);
                } else {
                  if (item.protein) addPrice += 2.00;
                  if (item.oat) addPrice += 0.50;
                }
                let lineTotal = (item.basePrice + addPrice) * item.qty;

                return (
                  <div key={item.id} className="p-3 bg-slate-950 border border-slate-800 border-l-4 border-l-emerald-500 rounded-xl space-y-2">
                    <div className="flex items-center justify-between font-bold text-xs text-slate-100">
                      <span>{item.name}</span>
                      <span className="font-mono text-emerald-400">${lineTotal.toFixed(2)}</span>
                    </div>

                    {/* Selected Custom Add-ons display */}
                    {item.selectedAddons && item.selectedAddons.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {item.selectedAddons.map((addon) => (
                          <span
                            key={addon.id}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                          >
                            + {addon.name} (${(addon.price || 0).toFixed(2)})
                          </span>
                        ))}
                      </div>
                    ) : item.addonString && item.addonString !== 'None' ? (
                      <div className="text-[10px] text-emerald-400/90 font-medium">
                        + {item.addonString}
                      </div>
                    ) : null}

                    {/* Quick Add-on Chips: If drink allows add-ons */}
                    {item.allowAddons === false ? (
                      <div className="text-[10px] text-slate-500 italic py-0.5">
                        Standard drink (no add-ons allowed)
                      </div>
                    ) : storeInfo?.addons && storeInfo.addons.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {storeInfo.addons.filter(a => a.enabled !== false).map((addon) => {
                          const isSelected = (item.selectedAddons || []).some(a => a.id === addon.id);
                          return (
                            <button
                              key={addon.id}
                              type="button"
                              onClick={() => {
                                setCart(prev => prev.map(cartItem => {
                                  if (cartItem.id !== item.id) return cartItem;
                                  const currentSel = cartItem.selectedAddons || [];
                                  const exists = currentSel.some(a => a.id === addon.id);
                                  const updatedSel = exists
                                    ? currentSel.filter(a => a.id !== addon.id)
                                    : [...currentSel, addon];
                                  return {
                                    ...cartItem,
                                    selectedAddons: updatedSel,
                                    addonString: updatedSel.map(a => a.name).join(', ') || undefined,
                                  };
                                }));
                              }}
                              className={`py-0.5 px-2 rounded-md text-[10px] font-semibold border transition text-center cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              + {addon.name} (${(addon.price || 0).toFixed(2)})
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* Fallback legacy chips if no custom store addons configured yet */
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleAddon(item.id, 'protein')}
                          className={`flex-1 py-1 px-2 rounded-md text-[11px] font-semibold border transition text-center cursor-pointer
                            ${item.protein 
                              ? 'bg-amber-600/30 border-amber-500 text-amber-200' 
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                            }
                          `}
                        >
                          + Protein ($2)
                        </button>
                        <button
                          onClick={() => toggleAddon(item.id, 'oat')}
                          className={`flex-1 py-1 px-2 rounded-md text-[11px] font-semibold border transition text-center cursor-pointer
                            ${item.oat 
                              ? 'bg-amber-600/30 border-amber-500 text-amber-200' 
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                            }
                          `}
                        >
                          + Oat ($0.50)
                        </button>
                      </div>
                    )}

                    {/* Qty Controls */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="w-6 h-6 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold flex items-center justify-center transition cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-xs text-white px-2">{item.qty}</span>
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          className="w-6 h-6 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center transition cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Universal Summary & Pay Now Button (Desktop, Tablet & Mobile) */}
          <div className="pt-3 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block">Total Ticket</span>
                <span className="text-[10px] text-slate-500">{totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} in ticket</span>
              </div>
              <span className="font-mono text-emerald-400 text-xl font-black">
                BND {finalTotal.toFixed(2)}
              </span>
            </div>
            <button
              onClick={() => {
                if (cart.length === 0) {
                  alert('Ticket is empty! Please add drinks first.');
                  return;
                }
                setIsMobilePayModalOpen(true);
              }}
              className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition"
            >
              <CreditCard className="w-5 h-5" />
              PAY NOW ({totalItemCount} {totalItemCount === 1 ? 'ITEM' : 'ITEMS'})
            </button>
          </div>
        </div>
      </div>

      {/* EDIT DRINK POP-UP MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col space-y-4 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Edit Drink Details</h3>
                  <p className="text-[11px] text-slate-400">Update drink name, price, or remove from catalog</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsConfirmingDelete(false);
                  setValidationError(null);
                }}
                className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {validationError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {isConfirmingDelete ? (
              /* Confirmation Box */
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">Delete Drink from Menu?</h4>
                  <p className="text-xs text-slate-300 mt-1">
                    Are you sure you want to permanently delete <strong className="text-red-400">"{editingProduct.name}"</strong> from your drink menu?
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteProduct}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition shadow-lg shadow-red-600/30 flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Delete Drink</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Standard Edit Fields */
              <>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Drink Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                        setValidationError(null);
                      }}
                      placeholder="e.g. Strawberry Splash"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl text-slate-200 text-xs font-semibold focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Base Price ($ BND)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => {
                        setEditPrice(e.target.value);
                        setValidationError(null);
                      }}
                      placeholder="5.50"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl text-slate-200 text-xs font-mono font-bold focus:outline-none transition"
                    />
                  </div>

                  {/* Add-on Choice Selector */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <label className="block text-slate-300 font-bold text-xs">Drink Add-ons Choice</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditAllowAddons(true)}
                        className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition cursor-pointer ${
                          editAllowAddons
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="editAllowAddons"
                          checked={editAllowAddons}
                          onChange={() => setEditAllowAddons(true)}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-bold text-xs">Allow Add-ons</div>
                          <div className="text-[10px] text-slate-400">Customer/POS can customize</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditAllowAddons(false)}
                        className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition cursor-pointer ${
                          !editAllowAddons
                            ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="editAllowAddons"
                          checked={!editAllowAddons}
                          onChange={() => setEditAllowAddons(false)}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-bold text-xs">No Add-ons</div>
                          <div className="text-[10px] text-slate-400">Plain drink only</div>
                        </div>
                      </button>
                    </div>

                    {editAllowAddons && storeInfo?.addons && storeInfo.addons.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Specific Add-ons allowed:</span>
                          <span className="text-[10px] text-slate-500">
                            {editSelectedAddonIds.length === 0 ? 'All store add-ons' : `${editSelectedAddonIds.length} selected`}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                          {storeInfo.addons.filter(a => a.enabled !== false).map(addon => {
                            const isChecked = editSelectedAddonIds.length === 0 || editSelectedAddonIds.includes(addon.id);
                            return (
                              <button
                                key={addon.id}
                                type="button"
                                onClick={() => {
                                  if (editSelectedAddonIds.length === 0) {
                                    const allActiveIds = storeInfo.addons!.filter(a => a.enabled !== false).map(a => a.id);
                                    setEditSelectedAddonIds(allActiveIds.filter(id => id !== addon.id));
                                  } else if (editSelectedAddonIds.includes(addon.id)) {
                                    setEditSelectedAddonIds(prev => prev.filter(id => id !== addon.id));
                                  } else {
                                    setEditSelectedAddonIds(prev => [...prev, addon.id]);
                                  }
                                }}
                                className={`px-2 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${
                                  isChecked
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                                }`}
                              >
                                {isChecked ? '✓ ' : '+ '}{addon.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remove Item</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(null);
                        setIsConfirmingDelete(false);
                        setValidationError(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEditProduct}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ADD NEW DRINK MODAL */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col space-y-4 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Add New Drink to Menu</h3>
                  <p className="text-[11px] text-slate-400">Create a new item in your drink menu catalog</p>
                </div>
              </div>

              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Drink Name *</label>
                <input
                  type="text"
                  required
                  value={newDrinkName}
                  onChange={(e) => setNewDrinkName(e.target.value)}
                  placeholder="e.g. Taro Milk Tea, Avocado Shake, Dragonfruit Juice"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-slate-200 text-xs font-semibold focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Price ($ BND) *</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    required
                    value={newDrinkPrice}
                    onChange={(e) => setNewDrinkPrice(e.target.value)}
                    placeholder="5.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-slate-200 text-xs font-mono font-bold focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Category (Optional)</label>
                  <input
                    type="text"
                    value={newDrinkCategory}
                    onChange={(e) => setNewDrinkCategory(e.target.value)}
                    placeholder="e.g. Smoothies, Juices"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-slate-200 text-xs font-semibold focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Add-on Choices for New Drink */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <label className="block text-slate-300 font-bold text-xs">Add-on Options Choice *</label>
                <p className="text-[11px] text-slate-400">Choose if you want to put add-on choices for this drink:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewDrinkAllowAddons(true)}
                    className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition cursor-pointer ${
                      newDrinkAllowAddons
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="newDrinkAllowAddons"
                      checked={newDrinkAllowAddons}
                      onChange={() => setNewDrinkAllowAddons(true)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-xs">Put Add-ons</div>
                      <div className="text-[10px] text-slate-400">Allow toppings & extras</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewDrinkAllowAddons(false)}
                    className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition cursor-pointer ${
                      !newDrinkAllowAddons
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="newDrinkAllowAddons"
                      checked={!newDrinkAllowAddons}
                      onChange={() => setNewDrinkAllowAddons(false)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-xs">No Add-ons</div>
                      <div className="text-[10px] text-slate-400">Plain drink only</div>
                    </div>
                  </button>
                </div>

                {newDrinkAllowAddons && storeInfo?.addons && storeInfo.addons.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Specific Add-ons allowed:</span>
                      <span className="text-[10px] text-slate-500">
                        {newDrinkSelectedAddonIds.length === 0 ? 'All store add-ons' : `${newDrinkSelectedAddonIds.length} selected`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                      {storeInfo.addons.filter(a => a.enabled !== false).map(addon => {
                        const isChecked = newDrinkSelectedAddonIds.length === 0 || newDrinkSelectedAddonIds.includes(addon.id);
                        return (
                          <button
                            key={addon.id}
                            type="button"
                            onClick={() => {
                              if (newDrinkSelectedAddonIds.length === 0) {
                                const allActiveIds = storeInfo.addons!.filter(a => a.enabled !== false).map(a => a.id);
                                setNewDrinkSelectedAddonIds(allActiveIds.filter(id => id !== addon.id));
                              } else if (newDrinkSelectedAddonIds.includes(addon.id)) {
                                setNewDrinkSelectedAddonIds(prev => prev.filter(id => id !== addon.id));
                              } else {
                                setNewDrinkSelectedAddonIds(prev => [...prev, addon.id]);
                              }
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${
                              isChecked
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                            }`}
                          >
                            {isChecked ? '✓ ' : '+ '}{addon.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setAddModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewModalDrink}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add Drink</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Addon Selection Popup Modal */}
      <AddonModal
        isOpen={addonModalOpen}
        onClose={() => setAddonModalOpen(false)}
        drinkName={selectedDrink?.name || ''}
        basePrice={selectedDrink?.price || 0}
        availableAddons={
          selectedDrink?.allowedAddonIds && selectedDrink.allowedAddonIds.length > 0
            ? (storeInfo?.addons || []).filter(a => selectedDrink.allowedAddonIds!.includes(a.id))
            : (storeInfo?.addons || [])
        }
        onOpenStoreAddons={() => {
          setAddonModalOpen(false);
          setIsStoreAddonsOpen(true);
        }}
        onConfirm={(protein, oat, selectedAddons) => {
          if (selectedDrink) {
            addToCart(
              selectedDrink.name,
              selectedDrink.price,
              protein,
              oat,
              selectedAddons || [],
              selectedDrink.allowAddons !== false,
              selectedDrink.id
            );
            setAddonModalOpen(false);
          }
        }}
      />

      {/* Store Addons Manager Modal */}
      {storeInfo && onSaveStoreInfo && (
        <StoreAddonsModal
          isOpen={isStoreAddonsOpen}
          onClose={() => setIsStoreAddonsOpen(false)}
          storeInfo={storeInfo}
          onSaveStoreInfo={onSaveStoreInfo}
        />
      )}

      {/* Clear Menu Confirmation Modal */}
      {isClearMenuModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">Clear Store Menu?</h3>
                <p className="text-xs text-slate-400">
                  This will delete all {products.length} menu items so you can configure your own dedicated store menu.
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 leading-relaxed">
              You will be able to build your menu completely fresh from scratch using "+ Add Drink" and configure custom add-ons anytime.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsClearMenuModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onClearAllProducts) {
                    onClearAllProducts();
                  }
                  setIsClearMenuModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-black text-xs transition shadow-lg shadow-red-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Clear Menu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE PAY NOW POP-UP MODAL */}
      {isMobilePayModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col space-y-4 p-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Checkout & Payment</h3>
                  <p className="text-[11px] text-slate-400">{totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} in ticket</p>
                </div>
              </div>

              <button
                onClick={() => setIsMobilePayModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment & Amount Breakdown */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono text-slate-200">BND {subtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="font-semibold text-slate-300">Discount (% or $)</span>
                <input
                  type="text"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="0% or $0"
                  className="w-28 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-right font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-800 font-bold text-sm">
                <span className="text-slate-100">Total Amount</span>
                <span className="font-mono text-emerald-400 text-lg font-black">
                  BND {finalTotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-400 pt-1">
                <span className="font-semibold text-slate-300">Cash Handed</span>
                <input
                  type="number"
                  step="0.01"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder="$0.00"
                  className="w-28 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-right font-mono text-slate-200 focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              <div className="flex items-center justify-between font-bold text-sky-400 pt-1 border-t border-slate-900">
                <span>Change Due</span>
                <span className="font-mono text-base font-extrabold">BND {changeDue.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Select Payment Method
              </span>
              <div className="grid grid-cols-2 gap-2">
                {enabledPaymentConfigs.map((config) => {
                  const isSelected = paymentType === config.name || paymentType === config.id;
                  return (
                    <button
                      key={config.id}
                      type="button"
                      onClick={() => setPaymentType(config.name as PaymentMethod)}
                      className={`py-2.5 px-2 text-xs font-extrabold rounded-xl border transition text-center select-none cursor-pointer truncate
                        ${isSelected
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/10 scale-[1.02]'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }
                      `}
                    >
                      {config.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => setIsMobilePayModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleChargeOrder}
                className={`flex-2 py-3 px-4 rounded-xl font-black text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95
                  ${chargedSuccess
                    ? 'bg-emerald-600 text-white'
                    : currentUserRole === 'staff'
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                  }
                `}
              >
                {chargedSuccess ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    {currentUserRole === 'staff' ? 'SENT FOR APPROVAL!' : 'CHARGED!'}
                  </>
                ) : currentUserRole === 'staff' ? (
                  'SUBMIT FOR APPROVAL'
                ) : (
                  'CONFIRM & CHARGE'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* FLOATING MOBILE STICKY CHECKOUT BAR */}
      {totalItemCount > 0 && (
        <div className="md:hidden fixed bottom-3 left-3 right-3 z-40 bg-slate-900/95 backdrop-blur-lg border-2 border-emerald-500/50 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider block leading-tight">
                {totalItemCount} {totalItemCount === 1 ? 'drink' : 'drinks'} selected
              </span>
              <span className="text-base font-mono font-black text-white leading-tight block">
                BND {finalTotal.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setMobileSubTab('ticket')}
              className="py-2.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700/80 transition cursor-pointer active:scale-95"
            >
              Ticket
            </button>
            <button
              onClick={() => setIsMobilePayModalOpen(true)}
              className="py-2.5 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
            >
              <CreditCard className="w-4 h-4" />
              <span>Checkout Now</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
