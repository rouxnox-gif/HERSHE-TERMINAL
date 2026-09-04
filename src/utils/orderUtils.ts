import { PendingOrder } from '../types';

/**
 * Accurately determines if a PendingOrder is a Customer Pre-Order
 * (e.g. from Customer Pre-Order Portal, WhatsApp, or Online Pre-Order)
 * versus an in-store Staff / POS Pending Approval (cashier submission, hold entry, transfer verification).
 */
export function isPreOrder(p: PendingOrder): boolean {
  // Explicit source tag check
  if (p.orderSource === 'customer_preorder') return true;
  if (p.orderSource === 'pos_staff' || p.orderSource === 'pos') return false;

  const s = (p.source || '').toLowerCase();
  if (
    s.includes('pre-order') ||
    s.includes('preorder') ||
    s.includes('customer') ||
    s.includes('portal') ||
    s.includes('whatsapp') ||
    s.includes('website') ||
    s.includes('online') ||
    s.includes('delivery')
  ) {
    return true;
  }
  if (s.startsWith('staff') || s.includes('cashier') || s.includes('register') || s.includes('pos')) {
    return false;
  }
  // Pickup time is a strong indicator of a pre-order
  if (p.pickupTime && p.pickupTime.trim() !== '') {
    return true;
  }
  // Cashier staff name is a strong indicator of a staff POS order
  if (p.staffName && p.staffName.trim() !== '') {
    return false;
  }
  // ID prefix convention check
  const idLower = (p.orderId || '').toLowerCase();
  if (idLower.startsWith('pre-') || idLower.includes('online') || idLower.startsWith('hs-online')) {
    return true;
  }
  // Customer phone provided without staff attribution
  if (p.customerPhone && p.customerPhone.trim() !== '') {
    return true;
  }
  // Custom customer name (excluding generic walk-in)
  if (p.customerName && p.customerName !== 'Walk-in Customer' && p.customerName !== 'Binti Gym Customer') {
    return true;
  }
  return false;
}
