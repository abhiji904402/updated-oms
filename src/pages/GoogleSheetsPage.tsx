import React, { useState, useMemo } from 'react';
import { useOMS } from '../lib/store';
import { Order, OrderStatus } from '../types';
import { EditOrderModal } from '../components/EditOrderModal';
import {
  parseCSVToOrders,
  parseJSONToOrders,
  downloadSampleCSVTemplate,
  downloadSampleJSONTemplate
} from '../lib/importUtils';
import {
  FileSpreadsheet,
  RefreshCw,
  Copy,
  Check,
  Save,
  Pencil,
  Trash2,
  Zap,
  ExternalLink,
  ChevronDown,
  Upload,
  UploadCloud,
  FileText,
  FileJson,
  Download,
  AlertCircle,
  CheckCircle2,
  FileUp,
  FileCode,
  ShieldCheck,
  X
} from 'lucide-react';

const APPS_SCRIPT_CODE = `// ===================================================
// BROOMIES BAKERY – Google Apps Script
// Multi-Outlet Separate Sheets + Master Sheet Auto-Routing
// Sorted Strictly by Order # (Column 1) - No S.No needed
// ===================================================

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var contents = e.postData.contents;
    var data = JSON.parse(contents);

    if (data && data.action === "delete") {
      deleteOrderFromAllSheets(ss, data.order || data);
    } else if (Array.isArray(data)) {
      data.forEach(function(order) { syncOrderToSheets(ss, order); });
    } else if (data && data.order) {
      syncOrderToSheets(ss, data.order);
    } else if (data) {
      syncOrderToSheets(ss, data);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Orders routed & sorted by Order #" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  // Auto-create Header row if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Order #", "Customer Name", "Phone", "Outlet", "Item Type", "Quantity/Weight",
      "Informed By", "Delivery Type", "Delivery Date", "Time", "Total (₹)", "Advance (₹)",
      "Remaining (₹)", "Payment Type", "Adv Bill No.", "Final Bill No.", "Status", "Cake Photo URL", "Remarks", "Last Updated"
    ]);
    sheet.getRange(1, 1, 1, 20).setFontWeight("bold").setBackground("#d9ead3");
  } else {
    // Auto-remove old S.No column if present so Order # becomes Column 1
    var firstCell = String(sheet.getRange(1, 1).getValue()).trim();
    if (firstCell === "S.No." || firstCell === "S.No") {
      sheet.deleteColumn(1);
    }
  }
  return sheet;
}

function syncOrderToSheets(ss, order) {
  if (!order || !order.order_number) return;
  var outletName = order.outlet ? String(order.outlet).trim() : "Sector 31";

  // 1. Sync to Master Sheet ("All Orders")
  var masterSheet = getOrCreateSheet(ss, "All Orders");
  appendOrUpdateOrder(masterSheet, order);

  // 2. Sync to Outlet Sheet (e.g. "Sector 31", "Sector 35", "Sector 42", "Sector 88")
  var outletSheet = getOrCreateSheet(ss, outletName);
  appendOrUpdateOrder(outletSheet, order);

  // 3. Clean up from other outlet tabs if order outlet was moved
  var sheets = ss.getSheets();
  var orderNum = order.order_number;
  for (var i = 0; i < sheets.length; i++) {
    var sName = sheets[i].getName();
    if (sName !== "All Orders" && sName !== outletName) {
      deleteOrderFromSheet(sheets[i], orderNum);
    }
  }
}

function appendOrUpdateOrder(sheet, order) {
  var rows = sheet.getDataRange().getValues();
  var numVal = Number(order.order_number);
  var orderNum = (!isNaN(numVal) && String(order.order_number).trim() !== "") ? numVal : (order.order_number || "");
  var rowIndex = -1;

  for (var i = 1; i < rows.length; i++) {
    var existingNum = Number(rows[i][0]);
    var compareVal = (!isNaN(existingNum) && String(rows[i][0]).trim() !== "") ? existingNum : rows[i][0];
    if (compareVal == orderNum && orderNum !== "" && orderNum !== undefined) {
      rowIndex = i + 1;
      break;
    }
  }

  var rowData = [
    orderNum,
    order.customer_name || "",
    order.mobile_number || "",
    order.outlet || "",
    order.item_type || "",
    order.quantity || "",
    order.informed_by || "",
    order.delivery_type || "",
    order.delivery_date || "",
    order.delivery_time_expected || "",
    Number(order.total_amount) || 0,
    Number(order.advance_amount) || 0,
    Number(order.remaining_balance) || 0,
    order.payment_type || "",
    order.advance_bill_number || "",
    order.final_bill_number || "",
    order.status || "",
    order.cake_photo_url || "",
    order.remarks || "",
    new Date().toLocaleString("en-IN")
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  // Keep sheet sorted by Column 1 (Order #) in Ascending Order
  sortSheetByOrderNumber(sheet);
}

function sortSheetByOrderNumber(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).sort({column: 1, ascending: true});
  }
}

function deleteOrderFromSheet(sheet, orderNum) {
  var rows = sheet.getDataRange().getValues();
  var numToDel = Number(orderNum);
  var targetNum = (!isNaN(numToDel) && String(orderNum).trim() !== "") ? numToDel : orderNum;

  for (var i = 1; i < rows.length; i++) {
    var existingNum = Number(rows[i][0]);
    var compareVal = (!isNaN(existingNum) && String(rows[i][0]).trim() !== "") ? existingNum : rows[i][0];
    if (compareVal == targetNum) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  sortSheetByOrderNumber(sheet);
}

function deleteOrderFromAllSheets(ss, order) {
  var sheets = ss.getSheets();
  var orderNum = typeof order === 'object' ? order.order_number : order;
  for (var s = 0; s < sheets.length; s++) {
    deleteOrderFromSheet(sheets[s], orderNum);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Bakery OMS Multi-Outlet Google Sheets Sync Webhook Active!");
}`;

interface DataUploadSectionProps {
  onImport: (orders: Partial<Order>[], overwrite: boolean) => void;
}

const DataUploadSection: React.FC<DataUploadSectionProps> = ({ onImport }) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [parsedOrders, setParsedOrders] = useState<Partial<Order>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'overwrite'>('append');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFileProcess = async (file: File) => {
    setSelectedFile(file);
    setParseError(null);
    setSuccessMessage(null);
    try {
      const text = await file.text();
      let ordersList: Partial<Order>[] = [];
      if (file.name.toLowerCase().endsWith('.json') || file.type.includes('json')) {
        ordersList = parseJSONToOrders(text);
      } else {
        ordersList = parseCSVToOrders(text);
      }

      if (ordersList.length === 0) {
        setParseError('Is file me koi valid order nahi mila. Kripya correct CSV ya JSON file verify karein.');
        setParsedOrders([]);
      } else {
        setParsedOrders(ordersList);
      }
    } catch (err: any) {
      setParseError(err.message || 'Error reading or parsing file format');
      setParsedOrders([]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleParsePastedText = () => {
    setParseError(null);
    setSuccessMessage(null);
    if (!pastedText.trim()) {
      setParseError('Kripya text area me CSV ya JSON text paste karein.');
      return;
    }

    try {
      let ordersList: Partial<Order>[] = [];
      const trimmed = pastedText.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        ordersList = parseJSONToOrders(trimmed);
      } else {
        ordersList = parseCSVToOrders(trimmed);
      }

      if (ordersList.length === 0) {
        setParseError('Pasted content se koi valid order data nahi nikla. Column names ya JSON format check karein.');
        setParsedOrders([]);
      } else {
        setParsedOrders(ordersList);
      }
    } catch (err: any) {
      setParseError(err.message || 'Pasted text format galat hai.');
      setParsedOrders([]);
    }
  };

  const handleConfirmImport = () => {
    if (parsedOrders.length === 0) return;
    setIsProcessing(true);
    setTimeout(() => {
      onImport(parsedOrders, false);
      setSuccessMessage(`✅ Successfully ${parsedOrders.length} orders store me load ho gaye!`);
      setIsProcessing(false);
      setParsedOrders([]);
      setSelectedFile(null);
      setPastedText('');
    }, 500);
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPastedText('');
    setParsedOrders([]);
    setParseError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="bg-[#0b0e1b] border border-indigo-950 rounded-2xl p-5 space-y-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
            3
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-emerald-400" />
              Upload Order Data (CSV / JSON)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Import Google Sheet exports, backups, or custom CSV/JSON files directly into the system
            </p>
          </div>
        </div>

        {/* Template download buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadSampleCSVTemplate}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 font-medium text-xs flex items-center gap-1.5 transition"
            title="Download CSV sample file"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sample CSV</span>
          </button>
          <button
            type="button"
            onClick={downloadSampleJSONTemplate}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 font-medium text-xs flex items-center gap-1.5 transition"
            title="Download JSON sample file"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span>Sample JSON</span>
          </button>
        </div>
      </div>

      {/* Tabs for File vs Paste */}
      <div className="flex items-center gap-2 border-b border-indigo-950/80 pb-2">
        <button
          type="button"
          onClick={() => { setActiveTab('file'); handleClear(); }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'file'
              ? 'bg-purple-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-indigo-950/50'
          }`}
        >
          <FileUp className="w-3.5 h-3.5" />
          <span>Upload File (.csv / .json)</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('paste'); handleClear(); }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'paste'
              ? 'bg-purple-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-indigo-950/50'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Paste Raw Text</span>
        </button>
      </div>

      {/* Mode 1: File Dropzone */}
      {activeTab === 'file' && (
        <div className="space-y-3">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center cursor-pointer ${
              dragActive
                ? 'border-purple-500 bg-purple-950/30'
                : selectedFile
                ? 'border-emerald-500/80 bg-emerald-950/20'
                : 'border-slate-800 hover:border-slate-700 bg-[#070913]'
            }`}
          >
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            {selectedFile ? (
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {selectedFile.name.endsWith('.json') ? <FileJson className="w-6 h-6" /> : <FileSpreadsheet className="w-6 h-6" />}
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-white">{selectedFile.name}</div>
                  <div className="text-xs text-slate-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Click or drag to change file
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-indigo-950/80 border border-indigo-900 text-purple-400 flex items-center justify-center mb-2 shadow-inner">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-slate-200">
                  Drag & Drop CSV or JSON file here
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  or click to select file from your computer (.csv, .json)
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: Paste Raw Text */}
      {activeTab === 'paste' && (
        <div className="space-y-3">
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Paste your CSV content (comma separated) or JSON array here..."
            className="w-full h-36 bg-[#070913] border border-indigo-950 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500 scrollbar-thin resize-y"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleParsePastedText}
              className="px-4 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs flex items-center gap-1.5 transition"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Parse Pasted Content</span>
            </button>
          </div>
        </div>
      )}

      {/* Errors or Messages */}
      {parseError && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Parsed Preview Section */}
      {parsedOrders.length > 0 && (
        <div className="bg-[#070913] border border-indigo-950/90 rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-950 pb-3">
            <div>
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Parsed {parsedOrders.length} Orders Ready for Import
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Review preview below before confirming load into store
              </div>
            </div>

            {/* Safe import badge */}
            <div className="flex items-center gap-2 bg-[#0b0e1b] border border-emerald-900/60 px-3 py-1.5 rounded-xl text-xs text-emerald-300 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Safe Import Mode (All existing orders preserved)</span>
            </div>
          </div>

          {/* Preview Table */}
          <div className="overflow-x-auto max-h-52 scrollbar-thin rounded-lg border border-indigo-950/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#0b0e1b] text-slate-400 border-b border-indigo-950 font-semibold">
                  <th className="py-2 px-3">Order#</th>
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">Outlet</th>
                  <th className="py-2 px-3">Item Details</th>
                  <th className="py-2 px-3 text-center">Qty</th>
                  <th className="py-2 px-3">Total (₹)</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Delivery Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-950/40 text-slate-300">
                {parsedOrders.slice(0, 8).map((ord, i) => (
                  <tr key={i} className="hover:bg-indigo-950/20">
                    <td className="py-2 px-3 font-mono text-purple-300 font-bold">
                      #{ord.order_number || 'Auto'}
                    </td>
                    <td className="py-2 px-3 font-medium text-white">{ord.customer_name}</td>
                    <td className="py-2 px-3 text-slate-400">{ord.outlet}</td>
                    <td className="py-2 px-3 text-slate-300">{ord.item_type}</td>
                    <td className="py-2 px-3 text-center font-bold">{ord.quantity}</td>
                    <td className="py-2 px-3 font-bold text-white">₹{ord.total_amount}</td>
                    <td className="py-2 px-3 capitalize font-semibold text-xs text-amber-300">
                      {ord.status}
                    </td>
                    <td className="py-2 px-3 text-slate-400 font-mono">{ord.delivery_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parsedOrders.length > 8 && (
            <div className="text-center text-[11px] text-slate-400 italic">
              + {parsedOrders.length - 8} more orders will be imported
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-indigo-950">
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold transition"
            >
              Cancel / Clear
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isProcessing}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition"
            >
              <Upload className={`w-4 h-4 ${isProcessing ? 'animate-bounce' : ''}`} />
              <span>{isProcessing ? 'Importing Data...' : `Confirm & Import ${parsedOrders.length} Orders`}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const GoogleSheetsPage = React.memo(() => {
  const { sheetConfig, orders = [], updateSheetConfig, triggerSheetSync, deleteOrder, importOrders, clearAllOrders, repairAndEnforceUniqueOrderNumbers } = useOMS();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isVerifyingIDs, setIsVerifyingIDs] = useState(false);
  const [urlInput, setUrlInput] = useState(sheetConfig.sheet_url);
  const [copied, setCopied] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await triggerSheetSync();
    setTimeout(() => {
      setIsSyncing(false);
    }, 1200);
  };

  const handleVerifyUniqueIDs = async () => {
    setIsVerifyingIDs(true);
    await repairAndEnforceUniqueOrderNumbers();
    setTimeout(() => {
      setIsVerifyingIDs(false);
    }, 800);
  };

  const handleClearAllOrdersRequest = () => {
    if (orders.length === 0) return;
    setIsClearConfirmOpen(true);
  };

  const handleConfirmClearAll = () => {
    clearAllOrders();
    setIsClearConfirmOpen(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = (urlInput || '').trim();
    if (cleanUrl.includes('docs.google.com/spreadsheets')) {
      alert('⚠️ Note: You entered a Google Sheet document URL (docs.google.com)!\n\nTo enable auto-sync, you must paste the Web App URL generated from Google Apps Script (Step 1 -> Extensions -> Apps Script -> Deploy as Web App).\n\nExample Web App URL: https://script.google.com/macros/s/AKfycb.../exec');
      return;
    }
    updateSheetConfig({ sheet_url: cleanUrl, auto_sync: true, is_active: true });
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 3000);
  };

  const handleToggleAutoSync = () => {
    const nextState = !sheetConfig.auto_sync;
    updateSheetConfig({ auto_sync: nextState });
  };

  const handleEditClick = (order: Order) => {
    setEditingOrder(order);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (order: Order) => {
    setOrderToDelete(order);
  };

  const handleConfirmDeleteSingle = () => {
    if (orderToDelete) {
      deleteOrder(orderToDelete.id);
      setOrderToDelete(null);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200/90 text-amber-950">pending</span>;
      case 'processing':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-200/90 text-sky-950">processing</span>;
      case 'out_for_delivery':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-200/90 text-blue-950">out for delivery</span>;
      case 'delivered':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-200/90 text-emerald-950">delivered</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-400 text-slate-950">cancelled</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-200 text-purple-950">{status}</span>;
    }
  };

  const getPaymentText = (order: Order) => {
    if (order.remaining_balance && order.remaining_balance > 0) {
      return <span className="text-slate-200 font-medium text-xs">Due</span>;
    }
    return <span className="text-slate-200 font-medium text-xs">Full Paid</span>;
  };

  // Sort orders by Order Number descending (highest/newest order number at top)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const numA = Number(a.order_number) || 0;
      const numB = Number(b.order_number) || 0;
      if (numB !== numA) return numB - numA;
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [orders]);

  const totalPages = useMemo(() => Math.ceil(sortedOrders.length / PAGE_SIZE) || 1, [sortedOrders.length]);
  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedOrders.slice(start, start + PAGE_SIZE);
  }, [sortedOrders, currentPage]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Google Sheet Sync
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure live data sync with Google Sheets
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {orders.length > 0 && (
            <>
              <button
                onClick={handleVerifyUniqueIDs}
                disabled={isVerifyingIDs}
                className="px-3.5 py-2.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-800/80 text-purple-200 font-bold text-xs shadow-md flex items-center gap-2 transition cursor-pointer"
                title="Audit and guarantee 100% unique sequential Order IDs"
              >
                <ShieldCheck className={`w-4 h-4 text-purple-400 ${isVerifyingIDs ? 'animate-spin' : ''}`} />
                <span>{isVerifyingIDs ? 'Auditing IDs...' : 'Verify Unique IDs'}</span>
              </button>

              <button
                onClick={handleClearAllOrdersRequest}
                className="px-3.5 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-200 font-bold text-xs shadow-md flex items-center gap-2 transition cursor-pointer"
                title="Clear all order data to replace with new data"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Clear All Data ({orders.length})</span>
              </button>
            </>
          )}

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-4 py-2.5 rounded-xl bg-[#0e1120] hover:bg-indigo-950 border border-slate-700/80 text-white font-bold text-xs shadow-md flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-4 h-4 text-slate-300 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Manual Sync'}</span>
          </button>
        </div>
      </div>

      {/* 2. Sync Active Banner & Controls */}
      <div className="bg-[#121d22]/90 border border-emerald-900/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-3">
          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold px-3 py-1 rounded-full">
            Active
          </span>
          <div>
            <span className="text-emerald-300 text-xs sm:text-sm font-semibold block">
              Google Sheet Webhook Sync Active
            </span>
            <span className="text-slate-400 text-[11px]">
              Orders automatically push to Google Sheets on create, update & status change.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleAutoSync}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
              sheetConfig.auto_sync
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${sheetConfig.auto_sync ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>Auto-Sync: {sheetConfig.auto_sync ? 'ENABLED (ON)' : 'DISABLED'}</span>
          </button>

          <div className="text-xs text-emerald-400/90 font-mono">
            Last synced: {new Date(sheetConfig.last_synced_at || Date.now()).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* 3. Section 1: Apps Script Code Box */}
      <div className="bg-[#0b0e1b] border border-indigo-950 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
              1
            </div>
            <h2 className="text-base font-bold text-white">Apps Script Code</h2>
          </div>

          <button
            onClick={handleCopyCode}
            className="px-3.5 py-1.5 rounded-xl bg-purple-950/60 border border-purple-800/60 hover:bg-purple-900/80 text-purple-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Highlighted Step instruction */}
        <div className="bg-purple-950/40 border border-purple-900/50 rounded-xl px-4 py-2 text-xs font-semibold text-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span>Copy this code → Open Google Sheet → Extensions → Apps Script → Paste → Deploy as Web App</span>
          <span className="text-[11px] text-emerald-300 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-md border border-emerald-800">
            ✨ Auto-creates separate tabs for each Outlet!
          </span>
        </div>

        {/* Scrollable Code Box */}
        <div className="bg-[#070913] border border-indigo-950 rounded-xl p-4 overflow-x-auto max-h-64 scrollbar-thin">
          <pre className="font-mono text-xs text-slate-300 whitespace-pre leading-relaxed select-all">
            {APPS_SCRIPT_CODE}
          </pre>
        </div>
      </div>

      {/* 4. Section 2: Web App URL */}
      <div className="bg-[#0b0e1b] border border-indigo-950 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
            2
          </div>
          <h2 className="text-base font-bold text-white">Web App URL</h2>
        </div>

        <form onSubmit={handleSaveUrl} className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="flex-1 bg-[#070913] border border-indigo-950 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 font-mono focus:outline-none focus:border-purple-500 shadow-inner"
            required
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2 transition"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
        </form>
      </div>

      {/* 5. Section 3: Data Upload (CSV / JSON) */}
      <DataUploadSection onImport={importOrders} />

      {/* 6. Section 4: All Orders Table */}
      <div className="bg-[#0b0e1b] border border-indigo-950 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-white">
            All Orders ({sortedOrders.length})
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Newest first • Click to edit
            </span>
            {orders.length > 0 && (
              <button
                onClick={handleClearAllOrdersRequest}
                className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Clear All ({orders.length})</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-indigo-950/80">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-indigo-950 bg-[#070913] text-slate-400 text-xs font-semibold">
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Outlet</th>
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Del. Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-950/60 text-xs">
              {sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No orders synced yet.
                  </td>
                </tr>
              ) : (
                pagedOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-indigo-950/30 transition">
                    <td className="py-3 px-4 font-bold text-indigo-400 font-mono text-sm">
                      #{ord.order_number}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-medium">
                      {ord.outlet}
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      {ord.item_type}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-200">
                      {ord.quantity}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      ₹{ord.total_amount}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(ord.status)}
                    </td>
                    <td className="py-3 px-4">
                      {getPaymentText(ord)}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono">
                      {ord.delivery_date}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditClick(ord)}
                          className="p-1.5 rounded-lg hover:bg-purple-950/80 text-purple-400 hover:text-purple-300 transition"
                          title="Edit Order"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(ord)}
                          className="p-1.5 rounded-lg hover:bg-rose-950/80 text-rose-400 hover:text-rose-300 transition"
                          title="Delete Order"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        {sortedOrders.length > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-indigo-950/80 text-xs text-slate-300">
            <div>
              Showing <strong className="text-white">{(currentPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
              <strong className="text-white">{Math.min(currentPage * PAGE_SIZE, sortedOrders.length)}</strong> of{' '}
              <strong className="text-purple-400">{sortedOrders.length}</strong> total synced orders
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="px-2.5 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 disabled:hover:bg-[#12162a] font-bold"
              >
                First
              </button>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 disabled:hover:bg-[#12162a] font-bold"
              >
                Prev
              </button>
              <span className="px-3 py-1 bg-purple-600/30 border border-purple-500/40 rounded-lg text-purple-200 font-extrabold">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 disabled:hover:bg-[#12162a] font-bold"
              >
                Next
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2.5 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 disabled:hover:bg-[#12162a] font-bold"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Order Modal */}
      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingOrder(null);
          }}
        />
      )}

      {/* Clear All Orders Modal */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101426] border border-rose-900/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl">
                <Trash2 className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete All Orders?</h3>
                <p className="text-xs text-rose-300/80">Permanent action • Cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete all <strong className="text-rose-400 font-extrabold">{orders.length} orders</strong> from the live database and system?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/40 flex items-center gap-2 transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Clear All Orders ({orders.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Order Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101426] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl">
                <Trash2 className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Order #{orderToDelete.order_number}?</h3>
                <p className="text-xs text-slate-400">{orderToDelete.customer_name} • ₹{orderToDelete.total_amount}</p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              This will remove Order #{orderToDelete.order_number} from the local system and sync live deletion with Google Sheets.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition"
              >
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

