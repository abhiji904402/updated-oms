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
import { getDeliveredByDisplayName } from '../lib/orderLogic';
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
  HardDrive,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Key,
  X
} from 'lucide-react';

const APPS_SCRIPT_CODE = `// =============================================
// BROOMIES BAKERY — Google Apps Script
// Outlet-wise sheets + Smart missing data sync
// =============================================

var OUTLET_SHEET_MAP = {
  "sector_31": "Sector 31",
  "Sector 31": "Sector 31",
  "sector_42": "Sector 42",
  "Sector 42": "Sector 42",
  "sector_35": "Sector 35",
  "Sector 35": "Sector 35",
  "sector_88": "Sector 88",
  "Sector 88": "Sector 88"
};

var HEADERS = [
  "Order#", "Order Date", "Order Time", "Mobile", "Customer Name",
  "Item", "Qty", "Delivery Type", "Informed By", "Amount",
  "Advance", "Remaining", "Payment", "Adv Bill No.", "Final Bill No.",
  "Status", "Delivery Date", "Expected Time", "Actual Time", "Partner",
  "Address", "Remarks", "Image URL", "Last Updated"
];

function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground("#6345ED")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold");
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground("#6345ED")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold");
  }
  return sheet;
}

function upsertRow(sheet, orderNum, rowData) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(orderNum)) {
      sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
      return;
    }
  }
  sheet.appendRow(rowData);
}

function deleteRow(sheet, orderNum) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(orderNum)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function buildRow(d) {
  return [
    d.order_number || "",
    d.order_date || "",
    d.order_time || "",
    d.mobile_number || "",
    d.customer_name || "",
    d.item_type || "",
    d.quantity || "",
    d.delivery_type || "",
    d.informed_by || "",
    Number(d.total_amount) || 0,
    Number(d.advance_amount) || 0,
    Number(d.remaining_balance) || 0,
    d.payment_type || "",
    d.advance_bill_number || "",
    d.final_bill_number || "",
    d.status || "",
    d.delivery_date || "",
    d.delivery_time_expected || "",
    d.actual_delivery_time || "",
    d.delivery_partner || "",
    d.address || "",
    d.remarks || "",
    d.item_image_url || "",
    new Date().toLocaleString("en-IN")
  ];
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = data.action;

    // Handle bulk sync (array of orders)
    if (data.bulk && Array.isArray(data.orders)) {
      var allSheet = getOrCreateSheet(ss, "All Orders");
      data.orders.forEach(function(order) {
        var outletKey = order.outlet ? String(order.outlet).trim() : "Sector 31";
        var sheetName = OUTLET_SHEET_MAP[outletKey] || OUTLET_SHEET_MAP[outletKey.toLowerCase().replace(/\\s+/g, '_')] || outletKey || "Other";
        var sheet = getOrCreateSheet(ss, sheetName);
        var rowData = buildRow(order);
        upsertRow(sheet, order.order_number, rowData);
        upsertRow(allSheet, order.order_number, rowData);
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: data.orders.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (Array.isArray(data)) {
      var allSheet = getOrCreateSheet(ss, "All Orders");
      data.forEach(function(order) {
        var outletKey = order.outlet ? String(order.outlet).trim() : "Sector 31";
        var sheetName = OUTLET_SHEET_MAP[outletKey] || OUTLET_SHEET_MAP[outletKey.toLowerCase().replace(/\\s+/g, '_')] || outletKey || "Other";
        var sheet = getOrCreateSheet(ss, sheetName);
        var rowData = buildRow(order);
        upsertRow(sheet, order.order_number, rowData);
        upsertRow(allSheet, order.order_number, rowData);
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: data.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Single order sync
    var orderData = data.order || data;
    var outletKey = orderData.outlet ? String(orderData.outlet).trim() : "Sector 31";
    var sheetName = OUTLET_SHEET_MAP[outletKey] || OUTLET_SHEET_MAP[outletKey.toLowerCase().replace(/\\s+/g, '_')] || outletKey || "Other";
    var sheet = getOrCreateSheet(ss, sheetName);
    var allSheet = getOrCreateSheet(ss, "All Orders");
    var rowData = buildRow(orderData);

    if (action === "delete") {
      deleteRow(sheet, orderData.order_number);
      deleteRow(allSheet, orderData.order_number);
    } else {
      upsertRow(sheet, orderData.order_number, rowData);
      upsertRow(allSheet, orderData.order_number, rowData);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, "All Orders");
    var data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", orders: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var orders = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0] && !row[4]) continue;
      var obj = {
        order_number: Number(row[0]) || i,
        order_date: String(row[1] || ""),
        order_time: String(row[2] || ""),
        mobile_number: String(row[3] || ""),
        customer_name: String(row[4] || ""),
        item_type: String(row[5] || ""),
        items: String(row[5] || ""),
        quantity: Number(row[6]) || 1,
        delivery_type: String(row[7] || "delivery"),
        informed_by: String(row[8] || ""),
        total_amount: Number(row[9]) || 0,
        advance_amount: Number(row[10]) || 0,
        remaining_balance: Number(row[11]) || 0,
        due_amount: Number(row[11]) || 0,
        payment_type: String(row[12] || "full"),
        advance_bill_number: String(row[13] || ""),
        final_bill_number: String(row[14] || ""),
        status: String(row[15] || "pending"),
        delivery_date: String(row[16] || ""),
        delivery_time_expected: String(row[17] || ""),
        scheduled_time: String(row[17] || ""),
        actual_delivery_time: String(row[18] || ""),
        delivery_partner: String(row[19] || ""),
        delivery_address: String(row[20] || ""),
        address: String(row[20] || ""),
        remarks: String(row[21] || ""),
        notes: String(row[21] || ""),
        item_image_url: String(row[22] || ""),
        created_at: String(row[23] || new Date().toISOString()),
        updated_at: String(row[23] || new Date().toISOString())
      };
      obj.id = "ord_" + obj.order_number;
      orders.push(obj);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", count: orders.length, orders: orders }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

interface DataUploadSectionProps {
  onImport: (orders: Partial<Order>[], overwrite: boolean) => void;
  onClearAll?: () => void;
  existingCount?: number;
}

const DataUploadSection: React.FC<DataUploadSectionProps> = ({ onImport, onClearAll, existingCount = 0 }) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [parsedOrders, setParsedOrders] = useState<Partial<Order>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'overwrite'>('append');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [overwritePassword, setOverwritePassword] = useState('');
  const [showOverwritePassword, setShowOverwritePassword] = useState(false);
  const [overwritePasswordError, setOverwritePasswordError] = useState<string | null>(null);

  const MASTER_DELETE_PASSWORD = 'abhi9919';

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
    const isOverwrite = importMode === 'overwrite';

    if (isOverwrite) {
      if (overwritePassword.trim() !== MASTER_DELETE_PASSWORD) {
        setOverwritePasswordError('Galat Master Password! Database overwrite karne ke liye password enter karein.');
        return;
      }
    }

    setOverwritePasswordError(null);
    setIsProcessing(true);
    setTimeout(() => {
      onImport(parsedOrders, isOverwrite);
      setSuccessMessage(`✅ Successfully ${parsedOrders.length} orders store aur Firestore me load ho gaye! (${isOverwrite ? 'Puraana data replace ho gaya' : 'Naye orders jud gaye'})`);
      setIsProcessing(false);
      setParsedOrders([]);
      setSelectedFile(null);
      setPastedText('');
      setOverwritePassword('');
    }, 500);
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPastedText('');
    setParsedOrders([]);
    setParseError(null);
    setSuccessMessage(null);
    setOverwritePassword('');
    setOverwritePasswordError(null);
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
          <div className="overflow-x-auto max-h-64 scrollbar-thin rounded-lg border border-indigo-950/60">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-[#0b0e1b] text-slate-400 border-b border-indigo-950 font-semibold">
                  <th className="py-2.5 px-3">Order #</th>
                  <th className="py-2.5 px-3">Outlet</th>
                  <th className="py-2.5 px-3">Order Date &amp; Time</th>
                  <th className="py-2.5 px-3">Delivery Date &amp; Time</th>
                  <th className="py-2.5 px-3">Actual Del.</th>
                  <th className="py-2.5 px-3">Customer &amp; Mobile</th>
                  <th className="py-2.5 px-3">Address</th>
                  <th className="py-2.5 px-3">Item Details</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Total (₹)</th>
                  <th className="py-2.5 px-3">Advance (₹)</th>
                  <th className="py-2.5 px-3">Remaining (₹)</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3">Adv Bill#</th>
                  <th className="py-2.5 px-3">Final Bill#</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Delivery Partner</th>
                  <th className="py-2.5 px-3">Delivered By</th>
                  <th className="py-2.5 px-3">Payment Modified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-950/40 text-slate-300 text-[11px]">
                {parsedOrders.slice(0, 10).map((ord, i) => (
                  <tr key={i} className="hover:bg-indigo-950/20 transition">
                    <td className="py-2 px-3 font-mono text-purple-300 font-bold">
                      #{ord.order_number || 'Auto'}
                    </td>
                    <td className="py-2 px-3 text-slate-300 font-medium">{ord.outlet}</td>
                    <td className="py-2 px-3 text-slate-400 font-mono">
                      {ord.order_date} <span className="text-slate-500">{ord.order_time}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 font-mono">
                      {ord.delivery_date} <span className="text-indigo-400 font-semibold">{ord.delivery_time_expected}</span>
                    </td>
                    <td className="py-2 px-3 text-emerald-400 font-mono">
                      {ord.actual_delivery_time || '—'}
                    </td>
                    <td className="py-2 px-3 font-medium text-white">
                      {ord.customer_name} <span className="text-slate-400 font-mono text-[10px]">({ord.mobile_number})</span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 max-w-[160px] truncate" title={ord.address}>
                      {ord.address}
                    </td>
                    <td className="py-2 px-3 text-slate-200">{ord.item_type}</td>
                    <td className="py-2 px-3 text-center font-bold text-slate-100">{ord.quantity}</td>
                    <td className="py-2 px-3 uppercase text-[10px] font-bold text-slate-400">{ord.delivery_type}</td>
                    <td className="py-2 px-3 font-bold text-white">₹{ord.total_amount}</td>
                    <td className="py-2 px-3 text-emerald-400 font-medium">₹{ord.advance_amount}</td>
                    <td className="py-2 px-3 text-rose-400 font-medium">₹{ord.remaining_balance}</td>
                    <td className="py-2 px-3 uppercase text-[10px] font-semibold text-sky-400">{ord.payment_type}</td>
                    <td className="py-2 px-3 font-mono text-slate-400">{ord.advance_bill_number || '—'}</td>
                    <td className="py-2 px-3 font-mono text-slate-400">{ord.final_bill_number || '—'}</td>
                    <td className="py-2 px-3 capitalize font-semibold text-amber-300">
                      {ord.status}
                    </td>
                    <td className="py-2 px-3 text-slate-300 font-medium">
                      {ord.delivery_partner || '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-300">
                      {ord.status === 'delivered' ? getDeliveredByDisplayName(ord) : (ord.delivered_by ? getDeliveredByDisplayName(ord) : '—')}
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-[10px]">
                      {ord.payment_changed_by ? `${ord.payment_changed_by} (${ord.payment_changed_at || ''})` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parsedOrders.length > 10 && (
            <div className="text-center text-[11px] text-slate-400 italic">
              + {parsedOrders.length - 10} more orders ready to import
            </div>
          )}

          {/* Import Mode Selector */}
          <div className="bg-[#0b0e1b] border border-indigo-950 rounded-xl p-3 space-y-2">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              Choose Import Action:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setImportMode('append')}
                className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2.5 ${
                  importMode === 'append'
                    ? 'bg-emerald-950/70 border-emerald-500 text-white shadow'
                    : 'bg-[#12162a] border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full mt-0.5 border flex items-center justify-center ${importMode === 'append' ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600'}`}>
                  {importMode === 'append' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-300">📥 Append & Merge</div>
                  <div className="text-[10px] text-slate-400">Purana data safe rahega, naye orders jud jayenge</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setImportMode('overwrite')}
                className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2.5 ${
                  importMode === 'overwrite'
                    ? 'bg-purple-950/70 border-purple-500 text-white shadow'
                    : 'bg-[#12162a] border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full mt-0.5 border flex items-center justify-center ${importMode === 'overwrite' ? 'border-purple-400 bg-purple-500' : 'border-slate-600'}`}>
                  {importMode === 'overwrite' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-purple-300">⚡ Overwrite / Replace All</div>
                  <div className="text-[10px] text-slate-400">Puraana data delete karke sirf yeh naya data load karega</div>
                </div>
              </button>
            </div>

            {/* Overwrite Master Password Prompt */}
            {importMode === 'overwrite' && (
              <div className="mt-3 p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-purple-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-purple-400" />
                    <span>Master Admin Password Required:</span>
                  </label>
                  <span className="text-[10px] text-purple-300 font-medium">
                    (Password: abhi9919)
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showOverwritePassword ? 'text' : 'password'}
                    value={overwritePassword}
                    onChange={(e) => {
                      setOverwritePassword(e.target.value);
                      if (overwritePasswordError) setOverwritePasswordError(null);
                    }}
                    placeholder="Enter master password to authorize overwrite..."
                    className="w-full px-3 py-2 pr-10 rounded-lg bg-[#0d1020] border border-purple-700/60 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOverwritePassword(!showOverwritePassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                  >
                    {showOverwritePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-purple-300" />}
                  </button>
                </div>
                {overwritePasswordError && (
                  <p className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{overwritePasswordError}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-indigo-950">
            {existingCount > 0 && onClearAll ? (
              <button
                type="button"
                onClick={onClearAll}
                className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/70 text-rose-300 text-xs font-bold transition flex items-center gap-1.5"
                title="Puraana sabhi data Firestore aur Local se saaf karein"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Clear Existing Database First ({existingCount})</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold transition"
              >
                Cancel / Clear
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isProcessing}
                className={`px-6 py-2.5 rounded-xl text-white font-extrabold text-xs shadow-lg flex items-center gap-2 transition cursor-pointer ${
                  importMode === 'overwrite'
                    ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-950/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                }`}
              >
                <Upload className={`w-4 h-4 ${isProcessing ? 'animate-bounce' : ''}`} />
                <span>
                  {isProcessing
                    ? 'Importing Data...'
                    : importMode === 'overwrite'
                    ? `⚡ Replace All with ${parsedOrders.length} Orders`
                    : `Confirm & Import ${parsedOrders.length} Orders`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface GoogleSheetsPageProps {
  onOpenVaultModal?: () => void;
}

export const GoogleSheetsPage = React.memo<GoogleSheetsPageProps>(({ onOpenVaultModal }) => {
  const { sheetConfig, orders = [], updateSheetConfig, triggerSheetSync, pullOrdersFromGoogleSheet, deleteOrder, clearAllOrders, importOrders, resequenceAllOrders } = useOMS();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isResequencing, setIsResequencing] = useState(false);
  const [isResequenceModalOpen, setIsResequenceModalOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearPasswordInput, setClearPasswordInput] = useState('');
  const [showClearPassword, setShowClearPassword] = useState(false);
  const [clearPasswordError, setClearPasswordError] = useState<string | null>(null);
  const [resequenceStartNum, setResequenceStartNum] = useState<number>(1);
  const [urlInput, setUrlInput] = useState(sheetConfig.sheet_url);
  const [copied, setCopied] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  const MASTER_DELETE_PASSWORD = 'abhi9919';

  const handleManualSync = async () => {
    setIsSyncing(true);
    await triggerSheetSync();
    setTimeout(() => {
      setIsSyncing(false);
    }, 1200);
  };

  const handlePullFromSheet = async () => {
    setIsPulling(true);
    await pullOrdersFromGoogleSheet();
    setTimeout(() => {
      setIsPulling(false);
    }, 1000);
  };

  const handleOpenClearModal = () => {
    setClearPasswordInput('');
    setClearPasswordError(null);
    setShowClearPassword(false);
    setIsClearAllModalOpen(true);
  };

  const handleExecuteClearAll = async () => {
    if (clearPasswordInput.trim() !== MASTER_DELETE_PASSWORD) {
      setClearPasswordError('Galat Master Password! Database delete karne ke liye sahi password enter karein.');
      return;
    }
    setClearPasswordError(null);
    setIsClearing(true);
    await clearAllOrders();
    setIsClearing(false);
    setIsClearAllModalOpen(false);
    setClearPasswordInput('');
  };

  const handleExecuteResequence = async (startNum: number) => {
    setIsResequencing(true);
    await resequenceAllOrders(startNum);
    setIsResequencing(false);
    setIsResequenceModalOpen(false);
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
            <button
              onClick={handleOpenClearModal}
              className="px-3.5 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 font-bold text-xs shadow-md flex items-center gap-2 transition cursor-pointer"
              title="Delete all orders permanently to upload fresh clean data"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Clear All Data ({orders.length})</span>
            </button>
          )}

          {orders.length > 0 && (
            <button
              onClick={() => setIsResequenceModalOpen(true)}
              disabled={isResequencing}
              className="px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 border border-purple-400/30 text-white font-bold text-xs shadow-md shadow-purple-950/50 flex items-center gap-2 transition cursor-pointer"
              title="Fix and re-number order sequence cleanly"
            >
              <ShieldCheck className={`w-4 h-4 text-purple-200 ${isResequencing ? 'animate-spin' : ''}`} />
              <span>{isResequencing ? 'Re-sequencing...' : '🔢 Fix Order Series'}</span>
            </button>
          )}

          {onOpenVaultModal && (
            <button
              onClick={onOpenVaultModal}
              className="px-3.5 py-2.5 rounded-xl bg-purple-950/70 hover:bg-purple-900 border border-purple-800/80 text-purple-200 font-bold text-xs shadow-md flex items-center gap-2 transition cursor-pointer"
              title="Open Local Storage Vault & Zero-Loss Backup Folders"
            >
              <HardDrive className="w-4 h-4 text-purple-400" />
              <span>Local Vault ({orders.length})</span>
            </button>
          )}

          <button
            onClick={handlePullFromSheet}
            disabled={isPulling}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 text-white font-bold text-xs shadow-md shadow-emerald-950/50 flex items-center gap-2 transition cursor-pointer"
            title="Fetch all live orders directly from Google Sheet (Unlimited Cloud Storage)"
          >
            <Download className={`w-4 h-4 text-emerald-200 ${isPulling ? 'animate-bounce' : ''}`} />
            <span>{isPulling ? 'Pulling Data...' : '📥 Pull Live from Sheet'}</span>
          </button>

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-4 py-2.5 rounded-xl bg-[#0e1120] hover:bg-indigo-950 border border-slate-700/80 text-white font-bold text-xs shadow-md flex items-center gap-2 transition cursor-pointer"
            title="Push all current orders to Google Sheet Webhook"
          >
            <RefreshCw className={`w-4 h-4 text-slate-300 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : '📤 Push to Sheet'}</span>
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
      <DataUploadSection 
        onImport={importOrders} 
        onClearAll={handleOpenClearModal}
        existingCount={orders.length}
      />

      {/* 6. Section 4: All Orders Table */}
      <div className="bg-[#0b0e1b] border border-indigo-950 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <span>All Orders ({sortedOrders.length})</span>
          </h2>
          <div className="flex items-center gap-3">
            {orders.length > 0 && (
              <button
                type="button"
                onClick={handleOpenClearModal}
                className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Puraana sabhi data Firestore aur Local se saaf karein"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete All Orders</span>
              </button>
            )}
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Newest first • Click to edit
            </span>
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

      {/* Resequence / Fix Order Series Modal */}
      {isResequenceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101426] border border-purple-900/50 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-950/80 border border-purple-800 rounded-xl text-purple-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Fix & Reset Order ID Series</h3>
                  <p className="text-xs text-slate-400">Total {orders.length} orders in system</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResequenceModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This tool sorts all {orders.length} orders in <strong className="text-purple-300">descending order based on Order Date &amp; Time</strong> (newest punched orders first) and updates all <strong className="text-purple-300">Order IDs sequentially</strong> without touching or modifying the <strong className="text-emerald-400">delivery_date</strong> field in any way.
            </p>

            {/* Presets */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider">
                Choose Starting Order Number:
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResequenceStartNum(1)}
                  className={`p-3 rounded-xl border text-left transition ${
                    resequenceStartNum === 1
                      ? 'bg-purple-950/80 border-purple-500 text-white shadow'
                      : 'bg-[#151930] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-black">Start from #1</div>
                  <div className="text-[11px] text-slate-400">#1 to #{orders.length}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setResequenceStartNum(2160)}
                  className={`p-3 rounded-xl border text-left transition ${
                    resequenceStartNum === 2160
                      ? 'bg-purple-950/80 border-purple-500 text-white shadow'
                      : 'bg-[#151930] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-black">Start from #2160</div>
                  <div className="text-[11px] text-slate-400">#2160 to #{2160 + orders.length - 1}</div>
                </button>
              </div>

              {/* Custom start number input */}
              <div className="mt-3">
                <label className="block text-[11px] text-slate-400 mb-1">
                  Or enter custom start number:
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-purple-400">#</span>
                  <input
                    type="number"
                    min={1}
                    value={resequenceStartNum}
                    onChange={(e) => setResequenceStartNum(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-[#151930] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Live Preview Box */}
            <div className="bg-purple-950/40 border border-purple-800/40 rounded-xl p-3.5 text-xs text-purple-200">
              <div className="font-bold text-purple-300">Series Preview:</div>
              <div className="mt-1 font-mono text-sm font-black text-white">
                #{resequenceStartNum} ➔ #{resequenceStartNum + Math.max(0, orders.length - 1)}
              </div>
              <div className="text-[11px] text-purple-300/80 mt-1">
                All {orders.length} existing orders will be cleanly updated in local storage and Firestore.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResequenceModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResequencing}
                onClick={() => handleExecuteResequence(resequenceStartNum)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-950/50 flex items-center gap-2 transition cursor-pointer"
              >
                {isResequencing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{isResequencing ? 'Applying Series...' : 'Apply Series Re-Sequencing'}</span>
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

      {/* Clear All Orders Confirmation Modal with Password Lock */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101426] border border-rose-900/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Delete All Orders Permanently?</h3>
                  <p className="text-xs text-slate-400">Total {orders.length} orders in database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed bg-[#0b0e1b] border border-rose-950/60 p-3.5 rounded-xl">
              <p>
                Kya aap sach me sabhi <strong className="text-rose-400 font-bold">{orders.length} orders</strong> ko delete karna chahte hain?
              </p>
              <p className="text-slate-400 text-[11px]">
                • <strong className="text-slate-200">Cloud Firestore:</strong> Sabhi documents permanently delete ho jayenge.<br />
                • <strong className="text-slate-200">Local Vault &amp; IndexedDB:</strong> 100% clean reset ho jayega.<br />
                • Iske baad aap naya CSV / JSON data fresh upload kar sakte hain.
              </p>
            </div>

            {/* Password Authorization Box */}
            <div className="bg-rose-950/30 border border-rose-900/50 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-rose-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-rose-400" />
                  <span>Enter Master Admin Password:</span>
                </label>
                <span className="text-[10px] text-rose-300/80 font-mono bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/60">
                  Password: abhi9919
                </span>
              </div>

              <div className="relative">
                <input
                  type={showClearPassword ? 'text' : 'password'}
                  value={clearPasswordInput}
                  onChange={(e) => {
                    setClearPasswordInput(e.target.value);
                    if (clearPasswordError) setClearPasswordError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleExecuteClearAll();
                    }
                  }}
                  placeholder="Type abhi9919 to confirm deletion..."
                  autoFocus
                  className="w-full px-3 py-2.5 pr-10 rounded-xl bg-[#080a14] border border-rose-700/60 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowClearPassword(!showClearPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                >
                  {showClearPassword ? <EyeOff className="w-4 h-4 text-slate-300" /> : <Eye className="w-4 h-4 text-rose-300" />}
                </button>
              </div>

              {clearPasswordError && (
                <div className="p-2 rounded-lg bg-rose-900/40 border border-rose-700 text-rose-200 text-[11px] font-semibold flex items-center gap-1.5 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  <span>{clearPasswordError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                disabled={isClearing}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearing || !clearPasswordInput.trim()}
                onClick={handleExecuteClearAll}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-lg flex items-center gap-2 transition cursor-pointer ${
                  !clearPasswordInput.trim()
                    ? 'bg-rose-950/60 border border-rose-900 text-rose-400 cursor-not-allowed opacity-60'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                }`}
              >
                {isClearing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isClearing ? 'Deleting Everything...' : 'Authorize & Delete All Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

