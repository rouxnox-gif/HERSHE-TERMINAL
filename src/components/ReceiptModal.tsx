import React from 'react';
import { Order } from '../types';
import { Printer, X } from 'lucide-react';
import { formatTimeDisplay } from '../utils/storage';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, order }) => {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="flex flex-col items-center max-w-full my-auto">
        {/* Printable thermal receipt container */}
        <div 
          id="receiptPrintArea" 
          className="bg-white text-black w-80 max-w-full p-6 rounded-lg shadow-2xl font-mono text-xs select-text"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          {/* Header */}
          <div className="text-center border-b border-dashed border-black pb-3 mb-3">
            <h2 className="text-2xl font-black tracking-wider uppercase mb-1">HERSHE</h2>
            <p className="text-[11px] font-semibold">Fresh Drinks & Beverages</p>
            <p className="text-[10px] text-gray-700">Brunei Darussalam</p>
            
            <div className="border-t border-dashed border-black my-2.5"></div>
            
            <div className="flex justify-between text-[11px] leading-tight">
              <span>Date:</span>
              <span>{order.date}</span>
            </div>
            <div className="flex justify-between text-[11px] leading-tight">
              <span>Time:</span>
              <span>{formatTimeDisplay(order.time)}</span>
            </div>
            <div className="flex justify-between text-[11px] leading-tight font-bold">
              <span>Order ID:</span>
              <span>{order.orderId}</span>
            </div>
          </div>

          {/* Itemized Table */}
          <table className="w-full text-[11px] mb-3">
            <thead>
              <tr className="border-b border-dashed border-black">
                <th className="text-left font-bold py-1 w-7/12">Item</th>
                <th className="text-center font-bold py-1 w-2/12">Qty</th>
                <th className="text-right font-bold py-1 w-3/12">Amt ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-gray-200">
              {order.items.map((item, idx) => (
                <tr key={idx} className="align-top">
                  <td className="py-1">
                    <div>{item.name}</div>
                    {item.addonString && item.addonString !== 'None' && (
                      <div className="text-[9px] text-gray-600 font-semibold">+ {item.addonString}</div>
                    )}
                  </td>
                  <td className="py-1 text-center">{item.qty}</td>
                  <td className="py-1 text-right">${item.lineTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-black my-2"></div>

          {/* Pricing Totals */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            {order.discountValue > 0 && (
              <div className="flex justify-between text-red-700 font-semibold">
                <span>Discount:</span>
                <span>-${order.discountValue.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black pt-1 border-t border-dashed border-black">
              <span>TOTAL:</span>
              <span>${order.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-black my-2.5"></div>

          <div className="flex justify-between text-[11px] font-bold">
            <span>Payment Method:</span>
            <span>{order.paymentType}</span>
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] pt-3 mt-3 border-t border-dashed border-black leading-tight">
            <p className="font-bold">Thank you for visiting HERSHE!</p>
            <p className="mt-0.5">Have a great day ahead! 🥤</p>
          </div>
        </div>

        {/* Action Controls (Hidden when printing) */}
        <div className="no-print flex items-center gap-3 mt-4 w-80 max-w-full">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <Printer className="w-4 h-4" />
            PRINT RECEIPT
          </button>
        </div>
      </div>
    </div>
  );
};
