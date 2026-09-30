import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Printer, XCircle, Sparkles } from 'lucide-react';

const COMMON_WORDS = [
  "Cake", "Pastry", "Chocolate", "Truffle", "Vanilla", "Strawberry", "Butterscotch", "Pineapple", "Black Forest", "Red Velvet",
  "Pizza", "Burger", "Sandwich", "Fries", "Garlic Bread", "Pasta", "Coke", "Pepsi", "Water",
  "Birthday", "Anniversary", "Message", "Urgent", "Pickup", "Delivery", "Custom", "Shape",
  "Photo Cake", "Eggless", "Fondant", "Cupcake", "Brownie", "Muffin", "Tart", "Pie", "Bread",
  "Cookies", "Biscuits", "Puff", "Roll", "Patties", "Donut", "Macaron",
  "Half kg", "1 kg", "2 kg", "White Forest", "Mango", "Blueberry", "Choco Lava", "Cold Coffee", "Frappe", "Shake",
  "Box", "Candle", "Knife", "Tag", "Ribbon", "Base", "Stand"
].sort();

export const KOTPrintPage: React.FC = () => {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Extract the current word being typed
  const currentWordMatch = text.match(/([a-zA-Z0-9]+)$/);
  const currentWord = currentWordMatch ? currentWordMatch[1] : '';

  useEffect(() => {
    if (currentWord.length >= 1) {
      const lowerWord = currentWord.toLowerCase();
      const matches = COMMON_WORDS.filter(w => w.toLowerCase().startsWith(lowerWord) || w.toLowerCase().includes(lowerWord));
      setSuggestions(matches.slice(0, 8)); // top 8 matches
    } else {
      setSuggestions([]);
    }
  }, [currentWord]);

  const applySuggestion = (suggestion: string) => {
    if (!currentWordMatch) return;
    
    // Replace the current word with the suggestion
    const matchLength = currentWordMatch[1].length;
    const matchIndex = currentWordMatch.index;
    
    if (matchIndex !== undefined) {
      const newText = text.substring(0, matchIndex) + suggestion + " ";
      setText(newText);
      setSuggestions([]);
      
      // Focus back
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>KOT Print</title>
          <style>
            body { 
              font-family: monospace; 
              padding: 20px; 
              margin: 0; 
              color: #000; 
              font-size: 14px;
              width: 80mm; /* typical thermal paper width */
            }
            .header {
              text-align: center;
              font-weight: bold;
              font-size: 18px;
              margin-bottom: 10px;
              border-bottom: 1px dashed #000;
              padding-bottom: 5px;
            }
            .time {
              text-align: center;
              font-size: 12px;
              margin-bottom: 15px;
            }
            .content {
              white-space: pre-wrap;
              font-size: 16px;
              font-weight: bold;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              border-top: 1px dashed #000;
              padding-top: 5px;
              font-size: 12px;
            }
            @media print {
              body { width: 100%; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">BROOMIES KOT</div>
          <div class="time">${new Date().toLocaleString()}</div>
          <div class="content">${text}</div>
          <div class="footer">--- END ---</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full pb-24">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Printer className="w-7 h-7 text-purple-400" />
            Custom KOT Print
          </h1>
          <p className="text-slate-400 text-sm mt-1">Type custom notes, messages, or ad-hoc items to print instantly.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setText('')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold flex items-center gap-2 transition"
          >
            <XCircle className="w-5 h-5" />
            Clear
          </button>
          <button
            onClick={handlePrint}
            disabled={!text.trim()}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold flex items-center gap-2 transition shadow-lg shadow-purple-900/20"
          >
            <Printer className="w-5 h-5" />
            Print Note
          </button>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
        
        {/* Word Suggestions Bar */}
        <div className="mb-3 flex flex-wrap gap-2 min-h-[36px]">
          {suggestions.length > 0 ? (
            suggestions.map(suggestion => (
              <button
                key={suggestion}
                onClick={() => applySuggestion(suggestion)}
                className="bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-lg text-sm font-semibold transition flex items-center gap-1 shadow-sm"
              >
                <Sparkles className="w-3 h-3 text-indigo-400" />
                {suggestion}
              </button>
            ))
          ) : (
            <div className="text-slate-500 text-sm italic flex items-center h-full">
              {text.trim() ? "Keep typing for word suggestions..." : "Start typing to see suggestions..."}
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start typing your Kitchen Order Ticket or Custom Note here..."
          className="w-full h-[400px] bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition resize-none font-mono text-lg"
        />
        
        <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>{text.length} characters</span>
          <span>Press Print when ready</span>
        </div>
      </div>
    </div>
  );
};
