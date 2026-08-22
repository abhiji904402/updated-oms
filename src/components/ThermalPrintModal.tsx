import React from 'react';
import { useOMS } from '../lib/store';
import { printThermalReceipts } from '../lib/thermalPrint';
import { X, Printer, CheckCircle, ShoppingBag, FileText } from 'lucide-react';

interface ThermalPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThermalPrintModal: React.FC<ThermalPrintModalProps> = ({ isOpen, onClose }) => {
  const { orders, selectedOrderIds, selectAllOrders, clearOrderSelection } = useOMS();

  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));

  const handlePrint = () => {
    if (selectedOrders.length === 0) return;
    printThermalReceipts(selectedOrders);
    onClose();
  };

  const handleSelectAll = () => {
    selectAllOrders(orders.map((o) => o.id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-extrabold text-slate-100">
              Thermal Receipt Batch Printer (80mm)
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div className="text-slate-300 font-medium">
              Selected Orders: <strong className="text-emerald-400 font-bold">{selectedOrders.length}</strong> of {orders.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-rose-400 hover:underline font-semibold"
              >
                Select All
              </button>
              <span className="text-slate-600">|</span>
              <button
                type="button"
                onClick={clearOrderSelection}
                className="text-xs text-slate-400 hover:underline"
              >
                Clear Selection
              </button>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl p-2 bg-slate-950/80 space-y-1.5">
            {orders.map((o) => {
              const isChecked = selectedOrderIds.includes(o.id);
              return (
                <div
                  key={o.id}
                  onClick={() => {
                    if (isChecked) {
                      clearOrderSelection();
                    }
                  }}
                  className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition ${
                    isChecked
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                      : 'bg-slate-900 border-slate-800/80 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700"
                    />
                    <div>
                      <div className="font-bold text-slate-200">
                        #{o.order_number} - {o.customer_name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {o.item_type} ({o.quantity}) • ₹{(o.total_amount ?? 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {o.outlet}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-emerald-400" /> Print Settings Information
            </div>
            <p>
              Formatting target: Standard 80mm ESC/POS Thermal Receipt Printers. Generates printable DOM layout with auto page breaks and cut-lines.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              disabled={selectedOrders.length === 0}
              className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print {selectedOrders.length} Receipt(s)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThermalPrintModal;
