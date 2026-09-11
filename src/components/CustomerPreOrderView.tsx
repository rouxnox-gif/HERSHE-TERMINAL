import React, { useState, useMemo, useEffect } from 'react';
import { Product, InventoryItem, PendingOrder, PaymentTypeConfig, StoreInfoSettings, CustomAddon, UserSession } from '../types';
import { getBruneiDateString, getBruneiTimeString } from '../data/initialData';
import { DEFAULT_ADDONS, DEFAULT_STORE_INFO, getStoreId } from '../db/repositories/appSettingsRepo';
import { db as firestoreDb } from '../lib/firebase';
import { doc, onSnapshot, collection, getDocs, setDoc } from 'firebase/firestore';
import {
  ShoppingBag,
  Plus,
  Minus,
  Check,
  Sparkles,
  Phone,
  MapPin,
  Clock,
  Send,
  Copy,
  ChevronRight,
  X,
  Search,
  Store,
  ShieldCheck,
  QrCode,
  Share2,
  AlertCircle,
  HelpCircle,
  Flame,
  Leaf,
  CheckCircle2,
  Building2,
  Sliders,
  Edit3,
  Trash2,
  Power,
  Layers,
  Save,
  RotateCcw,
  Info,
  CheckSquare,
  Square,
  ExternalLink,
  Lock,
  Coffee
} from 'lucide-react';

interface CustomerPreOrderViewProps {
  products: Product[];
  inventory: InventoryItem[];
  storeInfo?: StoreInfoSettings;
  paymentConfigs?: PaymentTypeConfig[];
  onSubmitPreOrder: (pending: PendingOrder) => Promise<void>;
  currentUser?: UserSession | null;
  onSaveStoreInfo?: (info: StoreInfoSettings) => Promise<void> | void;
  standalone?: boolean;
  onNavigateToTerminal?: () => void;
}

interface CartItem {
  id: string; // unique item instance id
  productId: string;
  name: string;
  basePrice: number;
  qty: number;
  selectedAddons: CustomAddon[];
  addonString: string;
  protein: boolean;
  oat: boolean;
  notes?: string;
  lineTotal: number;
}

export const PUBLIC_CUSTOMER_PORTAL_URL = 'https://ais-pre-gmbspf5pdy4xx5pebvsqhx-694944998158.asia-southeast1.run.app';

export const CustomerPreOrderView: React.FC<CustomerPreOrderViewProps> = ({
  products,
  inventory,
  storeInfo = DEFAULT_STORE_INFO,
  paymentConfigs,
  onSubmitPreOrder,
  currentUser,
  onSaveStoreInfo,
  standalone = false,
  onNavigateToTerminal,
}) => {
  const [currentStoreInfo, setCurrentStoreInfo] = useState<StoreInfoSettings>(storeInfo);
  const [activeStoreId, setActiveStoreId] = useState<string>('');
  const [firestoreProducts, setFirestoreProducts] = useState<Product[] | null>(null);
  const [firestoreInventory, setFirestoreInventory] = useState<InventoryItem[] | null>(null);

  useEffect(() => {
    if (storeInfo) {
      setCurrentStoreInfo(storeInfo);
    }
  }, [storeInfo]);

  useEffect(() => {
    let unsubSettings: (() => void) | null = null;
    let unsubProducts: (() => void) | null = null;
    let unsubInventory: (() => void) | null = null;

    async function initStoreListeners() {
      // 1. First check URL search parameter for explicit store isolation
      let resolvedId = '';
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        resolvedId = urlParams.get('store') || urlParams.get('storeId') || urlParams.get('s') || '';
      }

      // 2. If not in URL, query repository storeId
      if (!resolvedId) {
        resolvedId = (await getStoreId()) || '';
      }

      if (resolvedId) {
        setActiveStoreId(resolvedId);
        if (firestoreDb) {
          try {
            // Direct store settings listener
            const settingsRef = doc(firestoreDb, 'stores', resolvedId, 'meta', 'settings');
            unsubSettings = onSnapshot(settingsRef, (snap) => {
              if (snap.exists()) {
                const data = snap.data() as any;
                if (data?.storeInfo && typeof data.storeInfo === 'object') {
                  setCurrentStoreInfo((prev) => ({
                    ...prev,
                    ...data.storeInfo,
                  }));
                }
              }
            }, (err) => console.warn('[CustomerView] Direct settings listener notice:', err));

            // Real-time store products listener
            const prodsColRef = collection(firestoreDb, 'stores', resolvedId, 'products');
            unsubProducts = onSnapshot(prodsColRef, (querySnap) => {
              const loaded: Product[] = [];
              querySnap.forEach((d) => {
                const pData = d.data() as any;
                if (pData && !pData.isDeleted && (pData.name || pData.id)) {
                  loaded.push({ ...pData, id: pData.id || d.id } as Product);
                }
              });
              // Always update store products state, including empty list if menu was cleared
              setFirestoreProducts(loaded);
            }, (err) => console.warn('[CustomerView] Store products live listener notice:', err));

            // Real-time store inventory listener
            const invColRef = collection(firestoreDb, 'stores', resolvedId, 'inventory');
            unsubInventory = onSnapshot(invColRef, (querySnap) => {
              const loaded: InventoryItem[] = [];
              querySnap.forEach((d) => {
                const iData = d.data() as any;
                if (iData && !iData.isDeleted) {
                  loaded.push({ ...iData, id: iData.id || d.id } as InventoryItem);
                }
              });
              setFirestoreInventory(loaded);
            }, (err) => console.warn('[CustomerView] Store inventory live listener notice:', err));
          } catch (e) {
            console.warn('[CustomerView] Listener setup notice:', e);
          }
        }
      }
    }

    initStoreListeners();

    return () => {
      if (unsubSettings) unsubSettings();
      if (unsubProducts) unsubProducts();
      if (unsubInventory) unsubInventory();
    };
  }, []);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Quick URL editor within QR Share modal
  const [editingQrUrl, setEditingQrUrl] = useState(false);
  const [qrCustomUrlInput, setQrCustomUrlInput] = useState('');
  const [savingQrUrl, setSavingQrUrl] = useState(false);
  const [qrUrlSavedToast, setQrUrlSavedToast] = useState(false);

  // Admin edit portal modal
  const [adminEditModalOpen, setAdminEditModalOpen] = useState(false);

  // Form Fields
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('hershe_customer_name') || '');
  const [customerPhone, setCustomerPhone] = useState(() => localStorage.getItem('hershe_customer_phone') || '');
  const [pickupTimeOption, setPickupTimeOption] = useState<string>('15 mins');
  const [customPickupTime, setCustomPickupTime] = useState('');
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>('Bank Transfer (BIBD/Baiduri)');
  const [customerNotes, setCustomerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmittedOrder, setLastSubmittedOrder] = useState<PendingOrder | null>(null);

  // Item customization modal
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [selectedCustomAddonIds, setSelectedCustomAddonIds] = useState<string[]>([]);
  const [customQty, setCustomQty] = useState(1);

  // Pre-order open status (default true if undefined)
  const isPreOrderOpen = currentStoreInfo.isPreOrderOpen !== false;
  const isAdmin = !standalone && currentUser?.role === 'admin';

  // Computed direct customer link including active storeId parameter.
  // Explicitly excludes internal POS terminal domains (like https://hershe-terminal.binti.workers.dev)
  const customerShareUrl = useMemo(() => {
    // 1. If explicit customPortalUrl is configured and NOT the internal terminal worker domain
    if (currentStoreInfo.customPortalUrl && currentStoreInfo.customPortalUrl.trim().startsWith('http')) {
      const trimmed = currentStoreInfo.customPortalUrl.trim();
      if (!trimmed.includes('hershe-terminal.binti.workers.dev') && !trimmed.includes('hershe-terminal')) {
        try {
          const urlObj = new URL(trimmed);
          urlObj.searchParams.set('tab', 'customer');
          if (activeStoreId) {
            urlObj.searchParams.set('store', activeStoreId);
          }
          return urlObj.toString();
        } catch {
          // fallback to clean public URL logic below
        }
      }
    }

    // 2. If running on internal terminal worker, NEVER show or leak hershe-terminal.binti.workers.dev to customers!
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (
        origin.includes('hershe-terminal.binti.workers.dev') ||
        origin.includes('hershe-terminal') ||
        origin.includes('workers.dev')
      ) {
        // Use clean Google Cloud Run shared customer web app
        const base = PUBLIC_CUSTOMER_PORTAL_URL;
        return activeStoreId ? `${base}?tab=customer&store=${activeStoreId}` : `${base}?tab=customer`;
      }

      const pathname = window.location.pathname || '';
      const base = `${origin}${pathname}`;
      return activeStoreId ? `${base}?tab=customer&store=${activeStoreId}` : `${base}?tab=customer`;
    }

    return activeStoreId ? `${PUBLIC_CUSTOMER_PORTAL_URL}?tab=customer&store=${activeStoreId}` : `${PUBLIC_CUSTOMER_PORTAL_URL}?tab=customer`;
  }, [activeStoreId, currentStoreInfo.customPortalUrl]);

  // Available addons (active list)
  const allAddons: CustomAddon[] = useMemo(() => {
    if (currentStoreInfo && Array.isArray(currentStoreInfo.addons)) {
      return currentStoreInfo.addons;
    }
    return DEFAULT_ADDONS;
  }, [currentStoreInfo.addons]);

  const activeAddons = useMemo(() => {
    return allAddons.filter((a) => a.enabled !== false);
  }, [allAddons]);

  // Helper to categorize drinks consistently, respecting terminal drink category
  const getProductCategory = (p: Product): string => {
    if (p.category && p.category.trim()) {
      return p.category.trim();
    }
    const name = p.name.toLowerCase().trim();
    if (name.includes('gingershot') || name.includes('ginger shot') || name.includes('wellness') || name === 'gingershot') {
      return 'Wellness Shots';
    }
    if (
      name.includes('beetboost') ||
      name.includes('green detox') ||
      name.includes('orange sunrise') ||
      name.includes('beet') ||
      name.includes('green') ||
      name.includes('sunrise') ||
      name.includes('pure juice')
    ) {
      return 'Fresh Pure Juices';
    }
    return 'Signature Smoothies';
  };

  // Helper for drink flavor descriptions
  const getProductDescription = (p: Product): string => {
    const name = p.name.toLowerCase().trim();
    if (name.includes('beetboost')) return 'Fresh Beetroot, Apple & Ginger Energy Blend.';
    if (name.includes('green detox')) return 'Kale, Cucumber, Green Apple & Lemon Cleanse.';
    if (name.includes('orange sunrise')) return 'Fresh Squeezed Valencia Orange & Carrot Boost.';
    if (name.includes('gingershot') || name.includes('ginger shot')) return '100% Pure Raw Ginger, Turmeric & Cayenne Immunity Shot.';
    if (name.includes('strawberry')) return 'Fresh real strawberry blend with rich berry flavor.';
    if (name.includes('watermelon')) return 'Crisp, hydrating fresh watermelon refreshment.';
    if (name.includes('banana')) return 'Smooth and creamy banana blend rich in potassium.';
    if (name.includes('cookies')) return 'Decadent cookie crumble smoothie favorite.';
    return 'Freshly prepared beverage. Customize with protein or specialty add-ons.';
  };

  // Map inventory for stock validation
  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    const source = (firestoreInventory && firestoreInventory.length > 0) ? firestoreInventory : (inventory || []);
    if (source) {
      for (const inv of source) {
        const stockVal = Number(inv.currentStock) || 0;
        if (inv.productName) {
          const rawName = inv.productName.toLowerCase().trim();
          map.set(rawName, stockVal);
          const alphaName = rawName.replace(/[^a-z0-9]/g, '');
          if (alphaName) {
            map.set(alphaName, stockVal);
          }
        }
        if (inv.id) {
          map.set(inv.id.toLowerCase().trim(), stockVal);
        }
      }
    }
    return map;
  }, [firestoreInventory, inventory]);

  // Clean WhatsApp number (e.g., 673XXXXXXXX)
  const cleanWhatsAppNumber = useMemo(() => {
    return currentStoreInfo.whatsappNumber ? currentStoreInfo.whatsappNumber.replace(/[^0-9]/g, '') : '6738881234';
  }, [currentStoreInfo.whatsappNumber]);

  // Active drink catalog reflecting the terminal's drink menu
  const activeProductCatalog = useMemo(() => {
    // 1. If staff/admin is previewing within POS terminal session (not standalone customer mode),
    // directly reflect the terminal's local live product list from usePOSData()
    if (!standalone && currentUser && products !== undefined) {
      return products;
    }

    // 2. In standalone customer mode or external device:
    // If Firestore products listener has fired, it is the authoritative store menu (including empty [])
    if (firestoreProducts !== null) {
      return firestoreProducts;
    }

    // 3. Fallback to products prop from terminal
    return products || [];
  }, [currentUser, firestoreProducts, products]);

  // Dynamically derived categories reflecting available drinks on the active menu
  const dynamicCategories = useMemo(() => {
    if (activeProductCatalog.length === 0) return [];
    const catSet = new Set<string>();
    activeProductCatalog.forEach((p) => {
      const cat = getProductCategory(p);
      if (cat && cat.trim()) catSet.add(cat.trim());
    });
    const unique = Array.from(catSet);
    if (unique.length <= 1) return [];
    return ['All', ...unique];
  }, [activeProductCatalog]);

  // Reset selectedCategory if current selection is no longer valid
  useEffect(() => {
    if (selectedCategory !== 'All' && dynamicCategories.length > 0 && !dynamicCategories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [dynamicCategories, selectedCategory]);

  const filteredProducts = useMemo(() => {
    if (activeProductCatalog.length === 0) return [];
    return activeProductCatalog.filter((p) => {
      const productCat = getProductCategory(p);
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        productCat.toLowerCase().includes(searchQuery.toLowerCase().trim());

      if (!matchesSearch) return false;
      if (!selectedCategory || selectedCategory === 'All') return true;
      return productCat.toLowerCase() === selectedCategory.toLowerCase();
    });
  }, [activeProductCatalog, searchQuery, selectedCategory]);

  // Calculate cart subtotal
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.lineTotal, 0);
  }, [cart]);

  const totalCartItemCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.qty, 0);
  }, [cart]);

  // Quick 1-click Pre-Order Open/Closed Toggle by Admin
  const handleQuickTogglePreOrder = async () => {
    if (!isAdmin || !onSaveStoreInfo) return;
    const newStatus = !isPreOrderOpen;
    const updated: StoreInfoSettings = {
      ...currentStoreInfo,
      isPreOrderOpen: newStatus,
    };
    setCurrentStoreInfo(updated);
    await onSaveStoreInfo(updated);
  };

  // Helper to check if a product is sold out
  const checkIsSoldOut = (product: Product | null): boolean => {
    if (!product) return false;
    const rawName = product.name.toLowerCase().trim();
    let stockVal: number | undefined = stockMap.get(rawName);

    if (stockVal === undefined) {
      const alphaName = rawName.replace(/[^a-z0-9]/g, '');
      if (alphaName) {
        stockVal = stockMap.get(alphaName);
      }
    }

    if (stockVal === undefined && product.id) {
      stockVal = stockMap.get(product.id.toLowerCase().trim());
    }

    // Rule: Do NOT display out of stock unless the drink is in the inventory section and has 0 stock
    if (stockVal === undefined) {
      return false;
    }

    return stockVal <= 0;
  };

  // Available customizer addons for currently selected product
  const availableCustomizerAddons = useMemo(() => {
    if (!customizingProduct || customizingProduct.allowAddons === false) return [];
    if (customizingProduct.allowedAddonIds && customizingProduct.allowedAddonIds.length > 0) {
      return activeAddons.filter((a) => customizingProduct.allowedAddonIds!.includes(a.id));
    }
    return activeAddons;
  }, [customizingProduct, activeAddons]);

  // Open item customizer
  const handleOpenCustomizer = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (checkIsSoldOut(product) || !isPreOrderOpen) return;
    
    // If the drink does not allow add-ons, or store has no applicable add-ons, quick-add directly
    const hasAddons = product.allowAddons !== false && activeAddons.length > 0;
    const applicable = (product.allowedAddonIds && product.allowedAddonIds.length > 0)
      ? activeAddons.filter(a => product.allowedAddonIds!.includes(a.id))
      : activeAddons;

    if (!hasAddons || applicable.length === 0) {
      handleQuickAdd(product);
      return;
    }

    setCustomizingProduct(product);
    setSelectedCustomAddonIds([]);
    setCustomQty(1);
  };

  // Toggle addon in customizer
  const handleToggleAddon = (addonId: string) => {
    setSelectedCustomAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  };

  // Calculate unit price for current customizer item
  const currentCustomizerUnitPrice = useMemo(() => {
    if (!customizingProduct) return 0;
    const base = customizingProduct.price || 0;
    const addonsTotal = selectedCustomAddonIds.reduce((sum, id) => {
      const addon = availableCustomizerAddons.find((a) => a.id === id);
      return sum + (addon ? addon.price : 0);
    }, 0);
    return base + addonsTotal;
  }, [customizingProduct, selectedCustomAddonIds, availableCustomizerAddons]);

  // Add customized item to cart
  const handleAddCustomizedToCart = () => {
    if (!customizingProduct || !isPreOrderOpen || checkIsSoldOut(customizingProduct)) return;

    const base = customizingProduct.price || 0;
    const chosenAddons = availableCustomizerAddons.filter((a) => selectedCustomAddonIds.includes(a.id));
    const addonsExtra = chosenAddons.reduce((sum, a) => sum + a.price, 0);
    const unitPrice = base + addonsExtra;
    const lineTotal = unitPrice * customQty;

    const hasProtein = chosenAddons.some((a) => a.id === 'protein' || a.name.toLowerCase().includes('protein'));
    const hasOat = chosenAddons.some((a) => a.id === 'oat' || a.name.toLowerCase().includes('oat'));
    const addonNames = chosenAddons.map((a) => a.name);
    const addonString = addonNames.length > 0 ? addonNames.join(', ') : 'None';

    const sortedAddonIds = [...selectedCustomAddonIds].sort().join('_');
    const newItemId = `${customizingProduct.id}-${sortedAddonIds || 'plain'}-${Date.now()}`;

    // Check if identical item already exists in cart
    const existingIndex = cart.findIndex(
      (it) =>
        it.productId === customizingProduct.id &&
        it.selectedAddons.map((a) => a.id).sort().join('_') === sortedAddonIds
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      const exist = updated[existingIndex];
      const newQty = exist.qty + customQty;
      updated[existingIndex] = {
        ...exist,
        qty: newQty,
        lineTotal: unitPrice * newQty,
      };
      setCart(updated);
    } else {
      setCart((prev) => [
        ...prev,
        {
          id: newItemId,
          productId: customizingProduct.id,
          name: customizingProduct.name,
          basePrice: customizingProduct.price,
          qty: customQty,
          selectedAddons: chosenAddons,
          addonString,
          protein: hasProtein,
          oat: hasOat,
          lineTotal,
        },
      ]);
    }

    setCustomizingProduct(null);
  };

  // Quick add plain item (only if pre-orders are open and item in stock)
  const handleQuickAdd = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isPreOrderOpen || checkIsSoldOut(product)) return;

    const unitPrice = product.price || 0;
    const existingIndex = cart.findIndex(
      (it) => it.productId === product.id && it.selectedAddons.length === 0
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      const exist = updated[existingIndex];
      const newQty = exist.qty + 1;
      updated[existingIndex] = {
        ...exist,
        qty: newQty,
        lineTotal: unitPrice * newQty,
      };
      setCart(updated);
    } else {
      const newItemId = `${product.id}-plain-${Date.now()}`;
      setCart((prev) => [
        ...prev,
        {
          id: newItemId,
          productId: product.id,
          name: product.name,
          basePrice: product.price,
          qty: 1,
          selectedAddons: [],
          addonString: 'None',
          protein: false,
          oat: false,
          lineTotal: unitPrice,
        },
      ]);
    }
  };

  // Update item quantity in cart
  const handleUpdateQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((it) => {
          if (it.id !== itemId) return it;
          const newQty = it.qty + delta;
          if (newQty <= 0) return null;
          const addonsExtra = it.selectedAddons.reduce((sum, a) => sum + a.price, 0);
          const unitPrice = (it.basePrice || 0) + addonsExtra;
          return {
            ...it,
            qty: newQty,
            lineTotal: unitPrice * newQty,
          };
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Remove item
  const handleRemoveItem = (itemId: string) => {
    setCart((prev) => prev.filter((it) => it.id !== itemId));
  };

  // Copy Bank Account Number
  const handleCopyBankAccount = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentStoreInfo.bankAccountNumber);
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2000);
    }
  };

  // Copy Customer Pre-Order Share Link
  const handleCopyShareLink = () => {
    if (navigator.clipboard) {
      const url = customerShareUrl || (typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?tab=customer`
        : '');
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Resolved pickup time string
  const resolvedPickupTime = useMemo(() => {
    if (pickupTimeOption === 'Custom') {
      return customPickupTime.trim() || 'Specified in notes';
    }
    return `In ${pickupTimeOption}`;
  }, [pickupTimeOption, customPickupTime]);

  // Submit Pre-Order and Open WhatsApp
  const handlePlaceOrderAndWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPreOrderOpen) {
      alert('We are currently closed for pre-orders. Ordering is temporarily unavailable.');
      return;
    }

    const name = customerName.trim();
    const phone = customerPhone.trim();

    if (!name) {
      alert('Please enter your Name so we can label your drinks.');
      return;
    }
    if (!phone) {
      alert('Please enter your WhatsApp Phone Number so we can confirm your order.');
      return;
    }
    if (cart.length === 0) {
      alert('Your basket is empty. Please add drinks to place an order.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Save customer info locally for instant reuse next time
      localStorage.setItem('hershe_customer_name', name);
      localStorage.setItem('hershe_customer_phone', phone);

      const nowIso = new Date().toISOString();
      const dateStr = getBruneiDateString();
      const timeStr = getBruneiTimeString();
      const generatedOrderId = `PO-${Math.floor(1000 + Math.random() * 9000)}`;

      // Build Items Summary for POS terminal and WhatsApp
      const itemsSummary = cart
        .map((it) => {
          const addonText = it.selectedAddons.length > 0 ? ` (${it.selectedAddons.map((a) => a.name).join(', ')})` : '';
          return `${it.qty}x ${it.name}${addonText}`;
        })
        .join(', ');

      const pendingItems = cart.map((it) => ({
        name: it.name,
        qty: it.qty,
        price: it.basePrice,
        protein: it.protein,
        oat: it.oat,
        addonString: it.addonString,
        addons: it.selectedAddons.map((a) => ({ id: a.id, name: a.name, price: a.price })),
        lineTotal: it.lineTotal,
      }));

      const newPendingOrder: PendingOrder = {
        orderId: generatedOrderId,
        date: dateStr,
        time: timeStr,
        totalAmount: cartSubtotal,
        paymentType: selectedPaymentType,
        source: `Customer Pre-Order (${name})`,
        itemsSummary,
        customerName: name,
        customerPhone: phone,
        customerNotes: customerNotes.trim(),
        pickupTime: resolvedPickupTime,
        status: 'pending',
        orderSource: 'customer_preorder',
        items: pendingItems,
        inventoryDeducted: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // Deduct inventory in Firestore & locally for all items ordered via customer link
      const storeIdToUse = activeStoreId || (await getStoreId()) || '';
      const currentInventoryList = (firestoreInventory && firestoreInventory.length > 0) ? firestoreInventory : (inventory || []);
      const updatedInvList = [...currentInventoryList];

      for (const item of cart) {
        const cleanName = item.name.toLowerCase().trim();
        const cleanAlpha = cleanName.replace(/[^a-z0-9]/g, '');
        const invIndex = updatedInvList.findIndex(
          (it) =>
            it.productName.toLowerCase().trim() === cleanName ||
            (cleanAlpha && it.productName.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === cleanAlpha) ||
            it.id === item.id
        );

        if (invIndex !== -1) {
          const invItem = updatedInvList[invIndex];
          const qtyToDeduct = Number(item.qty) || 1;
          const newStock = Math.max(0, invItem.currentStock - qtyToDeduct);

          updatedInvList[invIndex] = {
            ...invItem,
            currentStock: newStock,
            updatedAt: nowIso,
          };
        }
      }

      // Optimistically update stock count for current customer session
      setFirestoreInventory(updatedInvList);

      if (firestoreDb && storeIdToUse) {
        try {
          const poDocRef = doc(firestoreDb, 'stores', storeIdToUse, 'pendingOrders', generatedOrderId);
          await setDoc(poDocRef, {
            ...newPendingOrder,
            orderSource: 'customer_preorder',
            inventoryDeducted: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        } catch (poErr) {
          console.warn('Failed saving customer pending order to Firestore:', poErr);
        }
      }

      // 1. Submit to POS system & cloud sync
      await onSubmitPreOrder(newPendingOrder);
      setLastSubmittedOrder(newPendingOrder);

      // 2. Build structured WhatsApp message
      const itemsListFormatted = cart
        .map((it) => {
          const addonsText = it.selectedAddons.length > 0
            ? `\n   ↳ *Add-ons:* ${it.selectedAddons.map((a) => `${a.name} (+$${a.price.toFixed(2)})`).join(', ')}`
            : '';
          return `• ${it.qty}x *${it.name}* — $${it.lineTotal.toFixed(2)}${addonsText}`;
        })
        .join('\n');

      const whatsappMessage =
`🥤 *NEW PRE-ORDER — ${currentStoreInfo.storeName.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━
📋 *Order ID:* #${generatedOrderId}
👤 *Customer Name:* ${name}
📱 *Contact Phone:* ${phone}
⏰ *Preferred Pickup:* ${resolvedPickupTime}
💳 *Payment Method:* ${selectedPaymentType}
━━━━━━━━━━━━━━━━━━━━
🍹 *ORDERED DRINKS:*
${itemsListFormatted}

💰 *TOTAL DUE: $${cartSubtotal.toFixed(2)}*
━━━━━━━━━━━━━━━━━━━━
${customerNotes.trim() ? `📝 *Special Notes:* ${customerNotes.trim()}\n━━━━━━━━━━━━━━━━━━━━\n` : ''}📍 *Pickup Location:* ${currentStoreInfo.location}

📎 *Attached Proof of Payment screenshot below:*`;

      const encodedText = encodeURIComponent(whatsappMessage);
      const whatsappUrl = `https://wa.me/${cleanWhatsAppNumber}?text=${encodedText}`;

      // 3. Clear cart and open WhatsApp
      setCart([]);
      setCartDrawerOpen(false);

      // Open WhatsApp in a new tab/window
      const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        // Fallback for popup blockers
        window.location.href = whatsappUrl;
      }
    } catch (err: any) {
      console.error('Failed to submit pre-order:', err);
      alert('Could not submit order. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28 sm:pb-32 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* ADMIN CONTROL BAR (Visible only to Admin) */}
      {isAdmin && (
        <div className="bg-slate-900 border-b border-amber-500/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Portal
            </span>
            <span className="text-slate-400 hidden sm:inline">
              Managing customer menu, store information & add-ons
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick 1-Click Pre-Order Toggle */}
            <button
              onClick={handleQuickTogglePreOrder}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs transition cursor-pointer shadow-sm ${
                isPreOrderOpen
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
              }`}
              title={isPreOrderOpen ? 'Click to Close Pre-Orders' : 'Click to Open Pre-Orders'}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isPreOrderOpen ? '🟢 Pre-Orders: OPEN' : '🔴 Pre-Orders: CLOSED'}</span>
            </button>

            {/* Edit Customer View & Add-Ons Button */}
            <button
              onClick={() => setAdminEditModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 text-xs font-bold transition cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Edit Store Info & Add-Ons</span>
            </button>
          </div>
        </div>
      )}

      {/* TOP HERO HEADER */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-md shadow-emerald-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
                <Store className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base text-white tracking-wide font-mono">
                  {currentStoreInfo.storeName}
                </h1>
                {isPreOrderOpen ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Open for Pre-Orders
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    Closed for Pre-Orders
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>{currentStoreInfo.location}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setQrModalOpen(true)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer"
              title="Share Menu QR Code"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
            </button>

            {/* Cart Button */}
            <button
              onClick={() => setCartDrawerOpen(true)}
              className="relative px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Basket</span>
              {totalCartItemCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-emerald-400 text-[10px] font-black">
                  {totalCartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
        {/* PRE-ORDER CLOSED BANNER (Shown if closed) */}
        {!isPreOrderOpen && (
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/60 border border-rose-500/40 shadow-xl space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-rose-200">
                    Pre-Orders Currently Closed
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {currentStoreInfo.closedMessage ||
                    'We are currently closed for pre-orders. Please visit our store in person or check back later!'}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-rose-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-400 text-[11px]">
                📍 Visit us at <strong className="text-slate-200">{currentStoreInfo.location}</strong>
              </span>
              <a
                href={`https://wa.me/${cleanWhatsAppNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-emerald-400 font-bold flex items-center gap-1.5 border border-slate-700"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Contact Store: {currentStoreInfo.whatsappNumber}</span>
              </a>
            </div>
          </div>
        )}

        {/* BANNER PROMO (Freshly blended & instructions) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border border-emerald-500/30 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Freshly Blended Upon Order
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white">
                {currentStoreInfo.bannerTitle || 'Pre-Order Drinks & Smoothies'}
              </h2>
              <p className="text-xs text-slate-300 max-w-lg leading-relaxed">
                {currentStoreInfo.bannerSubtitle ||
                  'Order ahead, choose your add-ons, and send your order with proof of payment directly to our WhatsApp for speedy pickup!'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`https://wa.me/${cleanWhatsAppNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>WhatsApp: {currentStoreInfo.whatsappNumber}</span>
              </a>
            </div>
          </div>
        </div>

        {/* AVAILABLE ADD-ONS SHOWCASE PILL BAR */}
        {activeProductCatalog.length > 0 && activeAddons.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                Available Custom Add-Ons
              </span>
              {isAdmin && (
                <button
                  onClick={() => setAdminEditModalOpen(true)}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Manage Add-Ons</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {activeAddons.map((addon) => (
                <div
                  key={addon.id}
                  className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <span className="font-medium">{addon.name}</span>
                  <span className="font-mono font-bold text-emerald-400 text-[11px]">
                    +${addon.price.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEARCH & CATEGORY BAR - Displayed only when menu has items */}
        {activeProductCatalog.length > 0 && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drinks, juices, smoothies..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-2xl text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none transition shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Pills - Rendered dynamically if more than 1 category exists */}
            {dynamicCategories.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {dynamicCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PRODUCT MENU GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {activeProductCatalog.length === 0 ? (
            /* Direct reflection when terminal menu has no drinks */
            <div className="col-span-full py-16 px-6 text-center bg-slate-900/60 rounded-3xl border border-dashed border-slate-800 flex flex-col items-center justify-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 shadow-inner">
                <Coffee className="w-7 h-7" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h3 className="text-base sm:text-lg font-extrabold text-white">
                  Menu Currently Unavailable
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  There are currently no drinks listed on our customer menu. Please check back shortly or visit our counter in-store!
                </p>
              </div>
              {onNavigateToTerminal && isAdmin && (
                <button
                  onClick={onNavigateToTerminal}
                  className="mt-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Add Drinks in POS Terminal</span>
                </button>
              )}
            </div>
          ) : filteredProducts.length === 0 ? (
            /* Active search or filter returned 0 results */
            <div className="col-span-full py-12 px-4 text-center bg-slate-900/50 rounded-3xl border border-slate-800 space-y-3">
              <ShoppingBag className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-slate-300 font-bold text-sm">
                No drinks match "{searchQuery}"
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:text-white border border-slate-700 transition cursor-pointer"
              >
                Reset Search & Filters
              </button>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const isSoldOut = checkIsSoldOut(product);
              const inCartCount = cart
                .filter((it) => it.productId === product.id)
                .reduce((sum, it) => sum + it.qty, 0);

              return (
                <div
                  key={product.id}
                  onClick={() => !isSoldOut && handleOpenCustomizer(product)}
                  className={`group p-4 rounded-2xl bg-slate-900 border transition flex flex-col justify-between relative overflow-hidden select-none ${
                    isSoldOut
                      ? 'border-rose-900/50 opacity-60 cursor-not-allowed bg-slate-950/60'
                      : !isPreOrderOpen
                      ? 'border-slate-800 hover:border-slate-700 bg-slate-900 cursor-pointer'
                      : 'border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 hover:shadow-xl hover:shadow-emerald-500/5 cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  {isSoldOut && (
                    <div className="absolute top-2.5 right-2.5 px-3 py-1 rounded-full bg-rose-600/90 text-white border border-rose-400 font-black text-[10px] uppercase tracking-wider shadow-lg shadow-rose-900/30 z-10">
                      Out of Stock
                    </div>
                  )}

                  {!isSoldOut && inCartCount > 0 && (
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] shadow-sm">
                      {inCartCount} in basket
                    </span>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2 pr-16">
                      <div>
                        <h3 className={`font-extrabold text-sm transition ${isSoldOut ? 'text-slate-400 line-through' : 'text-white group-hover:text-emerald-300'}`}>
                          {product.name}
                        </h3>
                        <span className="text-[10px] text-emerald-400/80 uppercase tracking-wider font-bold">
                          {getProductCategory(product)}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {getProductDescription(product)}
                    </p>

                    {/* Add-on capability tag */}
                    <div className="pt-0.5">
                      {product.allowAddons === false ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 font-medium">
                          Plain Only
                        </span>
                      ) : activeAddons.length > 0 ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
                          Add-ons Available
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">Price</span>
                      <span className={`font-mono font-black text-base ${isSoldOut ? 'text-slate-500' : 'text-emerald-400'}`}>
                        ${product.price.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isSoldOut ? (
                        <button
                          type="button"
                          disabled
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-bold opacity-80 cursor-not-allowed"
                        >
                          Sold Out
                        </button>
                      ) : !isPreOrderOpen ? (
                        <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-bold">
                          Closed
                        </span>
                      ) : product.allowAddons !== false && activeAddons.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleQuickAdd(product, e)}
                            className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition active:scale-95 cursor-pointer text-[10px] font-bold"
                            title="Add plain without add-ons"
                          >
                            Plain
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenCustomizer(product, e)}
                            className="p-1.5 px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 transition active:scale-95 cursor-pointer flex items-center gap-1 font-bold text-xs"
                            title="Customize drink with add-ons"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-extrabold">Customize</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleQuickAdd(product, e)}
                          className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 transition active:scale-95 cursor-pointer flex items-center gap-1 font-bold text-xs"
                          title="Add to basket"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-[11px] font-extrabold pr-1">Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* BANK TRANSFER & PAYMENT PROOF HOW-TO CARD */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
            <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <h3 className="font-extrabold text-xs sm:text-sm text-white">
              Bank Transfer / Payment Proof Guide
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Official Store Bank Details</span>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-extrabold text-slate-200">{currentStoreInfo.bankName}</div>
                  <div className="font-mono font-bold text-emerald-400 text-xs sm:text-sm tracking-wide">
                    {currentStoreInfo.bankAccountNumber}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    Acc Holder: {currentStoreInfo.bankAccountHolder}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyBankAccount}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedBank ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedBank ? 'Copied!' : 'Copy Acc'}</span>
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col justify-center space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">How It Works</span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                1. Select your favorite juices & add to basket.<br />
                2. Tap <strong className="text-emerald-400">Place Order & Send WhatsApp</strong>.<br />
                3. Attach your payment transfer slip / receipt screenshot in WhatsApp to confirm!
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* FLOATING CART BAR AT BOTTOM */}
      {cart.length > 0 && !cartDrawerOpen && (
        <div className="fixed bottom-3 sm:bottom-5 left-0 right-0 z-40 px-3 max-w-lg mx-auto animate-in slide-in-from-bottom-5 duration-200">
          <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/40 shadow-2xl backdrop-blur-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-sm shrink-0">
                {totalCartItemCount}
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block leading-tight">Total Amount</span>
                <span className="font-mono font-extrabold text-white text-base">
                  ${cartSubtotal.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setCartDrawerOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/30 flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>Review Basket & Checkout</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* CUSTOMIZE MODAL */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-white">{customizingProduct.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase">
                    {getProductCategory(customizingProduct)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    Base: ${customizingProduct.price.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-slate-400 line-clamp-1">
                    • {getProductDescription(customizingProduct)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setCustomizingProduct(null)}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto no-scrollbar">
              {!isPreOrderOpen && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Pre-orders are currently closed. Adding to basket is disabled.</span>
                </div>
              )}

              {/* Addons Selection (Dynamic from admin config) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Choose Add-ons
                  </span>
                  <span className="text-[10px] text-slate-500">Optional</span>
                </div>

                {availableCustomizerAddons.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded-xl">No add-ons available for this drink</p>
                ) : (
                  availableCustomizerAddons.map((addon) => {
                    const isSelected = selectedCustomAddonIds.includes(addon.id);
                    return (
                      <div
                        key={addon.id}
                        onClick={() => handleToggleAddon(addon.id)}
                        className={`p-3 rounded-2xl border transition flex items-center justify-between cursor-pointer select-none ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-5 h-5 rounded-lg flex items-center justify-center border ${
                              isSelected
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                : 'border-slate-700 bg-slate-900'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div>
                            <span className="text-xs block">{addon.name}</span>
                            {addon.description && (
                              <span className="text-[10px] text-slate-400 font-normal">{addon.description}</span>
                            )}
                          </div>
                        </div>
                        <span className="font-mono font-extrabold text-xs text-emerald-400">
                          +${addon.price.toFixed(2)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quantity Stepper */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Quantity</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCustomQty((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-mono font-black text-sm text-white w-6 text-center">
                    {customQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomQty((q) => q + 1)}
                    className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Price</span>
                <span className="font-mono font-black text-emerald-400 text-base sm:text-lg">
                  ${(currentCustomizerUnitPrice * customQty).toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                disabled={!isPreOrderOpen || checkIsSoldOut(customizingProduct)}
                onClick={handleAddCustomizedToCart}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
              >
                {checkIsSoldOut(customizingProduct) ? 'Sold Out' : isPreOrderOpen ? 'Add to Basket' : 'Pre-Orders Closed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT CART DRAWER / SLIDE-OVER */}
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex justify-end animate-in fade-in duration-200">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-lg h-full shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Your Pre-Order Basket</h3>
                  <p className="text-[11px] text-slate-400">{totalCartItemCount} items selected</p>
                </div>
              </div>

              <button
                onClick={() => setCartDrawerOpen(false)}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Closed Alert inside Cart */}
            {!isPreOrderOpen && (
              <div className="p-3.5 bg-rose-500/15 border-b border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Pre-orders are currently closed. Checkout is unavailable.</span>
              </div>
            )}

            {/* Drawer Body Form */}
            <form onSubmit={handlePlaceOrderAndWhatsApp} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 no-scrollbar">
              {/* Cart Items List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Items in Basket
                </span>

                {cart.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <ShoppingBag className="w-8 h-8 mx-auto text-slate-700" />
                    <p className="text-xs text-slate-400 font-bold">Your basket is empty</p>
                    <p className="text-[11px] text-slate-500">Add some juices or smoothies to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-white">{item.name}</span>
                            <span className="font-mono font-black text-emerald-400 text-xs">
                              ${item.lineTotal.toFixed(2)}
                            </span>
                          </div>

                          {item.selectedAddons.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.selectedAddons.map((addon) => (
                                <span
                                  key={addon.id}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium"
                                >
                                  +{addon.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500">Standard</span>
                          )}
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.id, -1)}
                            className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center border border-slate-800 text-xs"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono font-bold text-xs w-5 text-center text-white">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.id, 1)}
                            className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center border border-slate-800 text-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 text-xs ml-1"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Contact Information */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Your Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Your Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Sarah"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-medium text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      WhatsApp Phone <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. 8881234 or +673..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-mono font-medium text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Pickup Time Selection */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-400">
                    Pickup Time
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {['15 mins', '30 mins', '45 mins', 'Custom'].map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setPickupTimeOption(time)}
                        className={`py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                          pickupTimeOption === time
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>

                  {pickupTimeOption === 'Custom' && (
                    <input
                      type="text"
                      value={customPickupTime}
                      onChange={(e) => setCustomPickupTime(e.target.value)}
                      placeholder="e.g. After gym class at 5:30 PM"
                      className="w-full mt-2 px-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-medium text-white focus:outline-none"
                    />
                  )}
                </div>

                {/* Special Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Special Notes / Drink Requests
                  </label>
                  <input
                    type="text"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="e.g. Less ice, no sugar, leave at gym desk..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-medium text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Bank Transfer Details Box */}
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-emerald-300">Bank Transfer Account</span>
                  <button
                    type="button"
                    onClick={handleCopyBankAccount}
                    className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedBank ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedBank ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="font-mono font-black text-white text-sm">
                  {currentStoreInfo.bankName}: {currentStoreInfo.bankAccountNumber}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  Account Name: {currentStoreInfo.bankAccountHolder}
                </div>
                <p className="text-[11px] text-emerald-400/90 font-medium leading-relaxed">
                  💡 {currentStoreInfo.instructions || 'After clicking below, your pre-order message will open on WhatsApp. Please send it and attach your payment receipt screenshot!'}
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || cart.length === 0 || !isPreOrderOpen}
                  className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm sm:text-base transition shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {!isPreOrderOpen
                      ? 'Pre-Orders Closed'
                      : isSubmitting
                      ? 'Submitting Pre-Order...'
                      : `Place Pre-Order ($${cartSubtotal.toFixed(2)}) & Open WhatsApp`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUCCESS CONFIRMATION MODAL */}
      {lastSubmittedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                Pre-Order #{lastSubmittedOrder.orderId}
              </span>
              <h3 className="text-lg font-black text-white">Pre-Order Received!</h3>
              <p className="text-xs text-slate-300">
                Your order has been sent to our POS terminal. Please make sure to send your WhatsApp message and attach your transfer screenshot so we can prepare your drinks!
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="font-bold text-white">{lastSubmittedOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pickup Time:</span>
                <span className="font-bold text-emerald-400">{lastSubmittedOrder.pickupTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total:</span>
                <span className="font-mono font-black text-emerald-400">${lastSubmittedOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <a
                href={`https://wa.me/${cleanWhatsAppNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                <span>Re-open WhatsApp Chat</span>
              </a>

              <button
                type="button"
                onClick={() => setLastSubmittedOrder(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs transition cursor-pointer"
              >
                Place Another Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHARE / QR CODE MODAL */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 text-center space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-extrabold text-sm text-white flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-400" />
                Dedicated Customer Menu QR Code
              </span>
              <button
                onClick={() => setQrModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Store Identification Badge */}
            <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-left">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-white block">
                    {currentStoreInfo.storeName || 'Dedicated Store'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {activeStoreId ? `Store ID: ${activeStoreId.substring(0, 18)}...` : 'Active Store'}
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                Isolated
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
              <span>⚡ Public Access — No Google Login Required for Customers</span>
            </div>

            <div className="p-4 bg-white rounded-2xl flex items-center justify-center shadow-inner mx-auto w-fit">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                  customerShareUrl || `${PUBLIC_CUSTOMER_PORTAL_URL}?tab=customer`
                )}`}
                alt="Scan to Pre-Order Drinks"
                className="w-48 h-48"
              />
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Display or print this QR Code at the cashier counter. When customers scan it with their phone camera, it connects exclusively to <strong>{currentStoreInfo.storeName}</strong> without requiring any account login.
            </p>

            {/* Customer Pre-Order Web Address (URL) Section */}
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                  <span>Customer Pre-Order Link</span>
                  {currentStoreInfo.customPortalUrl && !currentStoreInfo.customPortalUrl.includes('hershe-terminal') ? (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono">Custom Domain</span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[9px] font-mono">Public Portal</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setQrCustomUrlInput(currentStoreInfo.customPortalUrl || '');
                    setEditingQrUrl(!editingQrUrl);
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                >
                  {editingQrUrl ? 'Hide Editor' : 'Change URL...'}
                </button>
              </div>

              {/* URL Display */}
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-300 break-all select-all">
                {customerShareUrl}
              </div>

              {/* Inline URL Editor */}
              {editingQrUrl && (
                <div className="p-3 bg-slate-950 rounded-2xl border border-emerald-500/30 space-y-2.5 animate-in fade-in">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-300 block">
                      Custom Customer Web Address / Domain:
                    </label>
                    <input
                      type="url"
                      value={qrCustomUrlInput}
                      onChange={(e) => setQrCustomUrlInput(e.target.value)}
                      placeholder="e.g. https://order.hershedrinks.com or https://hershe-order.binti.workers.dev"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[9px] text-slate-400">
                      Enter your customer-facing domain or worker. If left blank, it automatically uses the public cloud web app so customers never see the internal terminal address.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={savingQrUrl}
                      onClick={async () => {
                        setSavingQrUrl(true);
                        try {
                          const sanitized = qrCustomUrlInput.trim();
                          const updatedInfo: StoreInfoSettings = {
                            ...currentStoreInfo,
                            customPortalUrl: sanitized,
                          };
                          setCurrentStoreInfo(updatedInfo);
                          if (onSaveStoreInfo) {
                            await onSaveStoreInfo(updatedInfo);
                          }
                          setQrUrlSavedToast(true);
                          setTimeout(() => setQrUrlSavedToast(false), 2500);
                          setEditingQrUrl(false);
                        } finally {
                          setSavingQrUrl(false);
                        }
                      }}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                    >
                      {savingQrUrl ? 'Saving...' : 'Save Customer URL'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setQrCustomUrlInput('');
                        setSavingQrUrl(true);
                        try {
                          const updatedInfo: StoreInfoSettings = {
                            ...currentStoreInfo,
                            customPortalUrl: '',
                          };
                          setCurrentStoreInfo(updatedInfo);
                          if (onSaveStoreInfo) {
                            await onSaveStoreInfo(updatedInfo);
                          }
                          setQrUrlSavedToast(true);
                          setTimeout(() => setQrUrlSavedToast(false), 2500);
                          setEditingQrUrl(false);
                        } finally {
                          setSavingQrUrl(false);
                        }
                      }}
                      className="py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition cursor-pointer"
                    >
                      Reset to Default
                    </button>
                  </div>

                  {qrUrlSavedToast && (
                    <div className="text-[10px] font-bold text-emerald-400 text-center flex items-center justify-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Saved! QR code & share link updated.</span>
                    </div>
                  )}
                </div>
              )}

              <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[10px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Cashier Terminal URL (<code className="text-slate-300">hershe-terminal.binti.workers.dev</code>) is hidden from customers.</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyShareLink}
                className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
              </button>

              <a
                href={customerShareUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Test Link</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN EDIT PORTAL & ADD-ONS MODAL */}
      {adminEditModalOpen && (
        <CustomerPortalEditModal
          isOpen={adminEditModalOpen}
          onClose={() => setAdminEditModalOpen(false)}
          storeInfo={currentStoreInfo}
          onSaveStoreInfo={async (updated) => {
            setCurrentStoreInfo(updated);
            if (onSaveStoreInfo) {
              await onSaveStoreInfo(updated);
            }
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
 * ADMIN CUSTOMER PORTAL & ADD-ONS EDIT MODAL
 * ========================================================================= */
interface CustomerPortalEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeInfo: StoreInfoSettings;
  onSaveStoreInfo: (info: StoreInfoSettings) => Promise<void>;
}

const CustomerPortalEditModal: React.FC<CustomerPortalEditModalProps> = ({
  isOpen,
  onClose,
  storeInfo,
  onSaveStoreInfo,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'store' | 'bank' | 'addons'>('status');
  const [formData, setFormData] = useState<StoreInfoSettings>(storeInfo);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync state whenever modal opens or parent storeInfo updates
  React.useEffect(() => {
    if (isOpen && storeInfo) {
      setFormData(storeInfo);
    }
  }, [isOpen, storeInfo]);

  // New addon input fields
  const [newAddonName, setNewAddonName] = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState('0.50');
  const [newAddonDesc, setNewAddonDesc] = useState('');

  if (!isOpen) return null;

  const handleFieldChange = (field: keyof StoreInfoSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Addon management
  const currentAddons: CustomAddon[] = formData.addons && Array.isArray(formData.addons)
    ? formData.addons
    : (storeInfo.addons && Array.isArray(storeInfo.addons) ? storeInfo.addons : DEFAULT_ADDONS);

  const handleToggleAddonEnabled = (addonId: string) => {
    const updated = currentAddons.map((a) =>
      a.id === addonId ? { ...a, enabled: a.enabled === false ? true : false } : a
    );
    setFormData((prev) => ({ ...prev, addons: updated }));
  };

  const handleUpdateAddonPrice = (addonId: string, priceStr: string) => {
    const p = parseFloat(priceStr) || 0;
    const updated = currentAddons.map((a) => (a.id === addonId ? { ...a, price: p } : a));
    setFormData((prev) => ({ ...prev, addons: updated }));
  };

  const handleUpdateAddonName = (addonId: string, name: string) => {
    const updated = currentAddons.map((a) => (a.id === addonId ? { ...a, name } : a));
    setFormData((prev) => ({ ...prev, addons: updated }));
  };

  const handleUpdateAddonDesc = (addonId: string, description: string) => {
    const updated = currentAddons.map((a) => (a.id === addonId ? { ...a, description } : a));
    setFormData((prev) => ({ ...prev, addons: updated }));
  };

  const handleDeleteAddon = (addonId: string) => {
    const updated = currentAddons.filter((a) => a.id !== addonId);
    setFormData((prev) => ({ ...prev, addons: updated }));
  };

  const handleAddNewAddon = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newAddonName.trim();
    if (!name) return;

    const price = parseFloat(newAddonPrice) || 0;
    const newId = `addon_${Date.now()}`;
    const newAddon: CustomAddon = {
      id: newId,
      name,
      price,
      description: newAddonDesc.trim(),
      enabled: true,
    };

    setFormData((prev) => ({
      ...prev,
      addons: [...currentAddons, newAddon],
    }));

    setNewAddonName('');
    setNewAddonPrice('0.50');
    setNewAddonDesc('');
  };

  const handleResetDefaultAddons = () => {
    if (confirm('Reset all add-ons back to default (Protein, Oat Milk, Chia Seeds, Honey, Ginger Shot)?')) {
      setFormData((prev) => ({ ...prev, addons: DEFAULT_ADDONS }));
    }
  };

  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      await onSaveStoreInfo(formData);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 800);
    } catch (err) {
      console.error('Failed to save store info:', err);
      alert('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                Customer View & Portal Configuration
              </h2>
              <p className="text-xs text-slate-400">
                Edit pre-order schedule, store contact info, bank accounts, and custom add-ons
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 pt-3 pb-2 bg-slate-950/50 border-b border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'status', label: 'Pre-Order Status', icon: <Power className="w-3.5 h-3.5" /> },
            { id: 'addons', label: `Add-Ons (${currentAddons.length})`, icon: <Leaf className="w-3.5 h-3.5" /> },
            { id: 'store', label: 'Store Info & Banner', icon: <Store className="w-3.5 h-3.5" /> },
            { id: 'bank', label: 'Bank & Payments', icon: <Building2 className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 no-scrollbar flex-1">
          {/* TAB 1: PRE-ORDER STATUS */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-extrabold text-white block">
                      Customer Pre-Order Availability
                    </span>
                    <span className="text-[11px] text-slate-400">
                      When closed, customers can browse the menu but cannot submit pre-orders.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleFieldChange('isPreOrderOpen', !formData.isPreOrderOpen)}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 border cursor-pointer ${
                      formData.isPreOrderOpen !== false
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    <Power className="w-4 h-4" />
                    <span>{formData.isPreOrderOpen !== false ? 'OPEN FOR ORDERS' : 'CLOSED'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Closed Announcement Notice (Shown to customers when pre-orders are closed)
                </label>
                <textarea
                  rows={3}
                  value={formData.closedMessage || ''}
                  onChange={(e) => handleFieldChange('closedMessage', e.target.value)}
                  placeholder="e.g. We are currently closed for pre-orders. Please visit us in person at Binti Gym Brunei or check back tomorrow!"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl text-xs text-white placeholder:text-slate-600 focus:outline-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 2: ADD-ONS MANAGEMENT */}
          {activeTab === 'addons' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-white block">Custom Add-Ons Catalog</span>
                  <span className="text-[11px] text-slate-400">
                    Add-ons appear in the drink customization popup and recalculate the line total automatically.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleResetDefaultAddons}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold flex items-center gap-1 border border-slate-700 cursor-pointer"
                  title="Reset to default add-ons"
                >
                  <RotateCcw className="w-3 h-3 text-amber-400" />
                  <span>Reset Defaults</span>
                </button>
              </div>

              {/* Add New Addon Form */}
              <form onSubmit={handleAddNewAddon} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Add New Custom Add-On
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Add-On Name</label>
                    <input
                      type="text"
                      required
                      value={newAddonName}
                      onChange={(e) => setNewAddonName(e.target.value)}
                      placeholder="e.g. Creatine Boost (+5g)"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Extra Price ($)</label>
                    <input
                      type="number"
                      step="0.10"
                      min="0"
                      required
                      value={newAddonPrice}
                      onChange={(e) => setNewAddonPrice(e.target.value)}
                      placeholder="0.50"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-mono text-emerald-300 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Description (Optional)</label>
                    <input
                      type="text"
                      value={newAddonDesc}
                      onChange={(e) => setNewAddonDesc(e.target.value)}
                      placeholder="e.g. Pure micronized performance booster"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to List</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* List of Add-ons */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Configured Add-Ons ({currentAddons.length})
                </span>

                {currentAddons.map((addon) => (
                  <div
                    key={addon.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleAddonEnabled(addon.id)}
                          className={`p-1 rounded-lg border cursor-pointer transition ${
                            addon.enabled !== false
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-900 text-slate-600 border-slate-800'
                          }`}
                          title={addon.enabled !== false ? 'Enabled on menu' : 'Disabled on menu'}
                        >
                          {addon.enabled !== false ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        <input
                          type="text"
                          value={addon.name}
                          onChange={(e) => handleUpdateAddonName(addon.id, e.target.value)}
                          className="px-2 py-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-xs font-bold text-white flex-1"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 text-xs">$</span>
                          <input
                            type="number"
                            step="0.10"
                            min="0"
                            value={addon.price}
                            onChange={(e) => handleUpdateAddonPrice(addon.id, e.target.value)}
                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-xs font-mono font-bold text-emerald-400"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteAddon(addon.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 cursor-pointer"
                          title="Delete Add-On"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={addon.description || ''}
                        onChange={(e) => handleUpdateAddonDesc(addon.id, e.target.value)}
                        placeholder="Add-on description / ingredient note..."
                        className="w-full px-2.5 py-1 bg-slate-900/80 border border-slate-800/80 focus:border-emerald-500 rounded-lg text-[11px] text-slate-300 placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: STORE INFO & BANNER */}
          {activeTab === 'store' && (
            <div className="space-y-4">
              <div className="space-y-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Store Brand Name
                  </label>
                  <input
                    type="text"
                    value={formData.storeName || ''}
                    onChange={(e) => handleFieldChange('storeName', e.target.value)}
                    placeholder="e.g. HERSHE Drinks & Juices"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-bold text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Store WhatsApp Phone Number (with Country Code)
                  </label>
                  <input
                    type="text"
                    value={formData.whatsappNumber || ''}
                    onChange={(e) => handleFieldChange('whatsappNumber', e.target.value)}
                    placeholder="e.g. 6738881234 or +673 888 1234"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-mono font-bold text-emerald-400 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Customer WhatsApp messages and screenshots will be directed to this number.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Pickup Location / Physical Store Address
                  </label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => handleFieldChange('location', e.target.value)}
                    placeholder="e.g. Binti Gym Brunei / Main Counter"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Banner Promo Title
                  </label>
                  <input
                    type="text"
                    value={formData.bannerTitle || ''}
                    onChange={(e) => handleFieldChange('bannerTitle', e.target.value)}
                    placeholder="e.g. Pre-Order Drinks & Smoothies"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-bold text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Banner Promo Description
                  </label>
                  <textarea
                    rows={2}
                    value={formData.bannerSubtitle || ''}
                    onChange={(e) => handleFieldChange('bannerSubtitle', e.target.value)}
                    placeholder="e.g. Order ahead, choose your custom add-ons, and send your order with proof of payment directly to our WhatsApp for speedy pickup!"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white focus:outline-none leading-relaxed"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>Customer Pre-Order Web Address (Domain / URL)</span>
                    <span className="text-[10px] text-emerald-400 font-normal">Clean Customer Portal</span>
                  </label>
                  <input
                    type="url"
                    value={formData.customPortalUrl || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleFieldChange('customPortalUrl', val);
                    }}
                    placeholder="e.g. https://order.hershedrinks.com or https://hershe-order.binti.workers.dev"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none"
                  />
                  {formData.customPortalUrl?.includes('hershe-terminal') && (
                    <p className="text-[10px] text-amber-400 font-semibold">
                      ⚠️ Note: This is your internal cashier terminal address. Customers should not access this address. Leave blank to automatically use the public customer portal.
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500">
                    Leave blank to automatically use the Google Cloud Run public customer pre-order portal (<code className="text-slate-400">ais-pre-gmbspf5pdy4xx5pebvsqhx-694944998158.asia-southeast1.run.app</code>). The internal cashier terminal (<code className="text-slate-400">hershe-terminal.binti.workers.dev</code>) is blocked from customer links.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BANK & PAYMENTS */}
          {activeTab === 'bank' && (
            <div className="space-y-4">
              <div className="space-y-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-xs font-extrabold text-emerald-400 block mb-1">
                  Official Bank Transfer Details for Customers
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={formData.bankName || ''}
                      onChange={(e) => handleFieldChange('bankName', e.target.value)}
                      placeholder="e.g. BIBD / Baiduri"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Account Number</label>
                    <input
                      type="text"
                      value={formData.bankAccountNumber || ''}
                      onChange={(e) => handleFieldChange('bankAccountNumber', e.target.value)}
                      placeholder="e.g. 00-001-01-7890123"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-mono font-bold text-emerald-300 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-full">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Account Holder Name</label>
                    <input
                      type="text"
                      value={formData.bankAccountHolder || ''}
                      onChange={(e) => handleFieldChange('bankAccountHolder', e.target.value)}
                      placeholder="e.g. HERSHE BEVERAGES"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="col-span-full">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Payment Instructions Note</label>
                    <textarea
                      rows={2}
                      value={formData.instructions || ''}
                      onChange={(e) => handleFieldChange('instructions', e.target.value)}
                      placeholder="e.g. Please transfer to the account above and attach your payment receipt screenshot when WhatsApp opens!"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white focus:outline-none leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {savedSuccess ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" />
                Settings saved successfully!
              </span>
            ) : (
              <span>Changes sync in real-time to all customer devices</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAll}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save & Apply'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
