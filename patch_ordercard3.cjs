const fs = require('fs');
let code = fs.readFileSync('src/components/OrderCard.tsx', 'utf-8');

// Add local state
code = code.replace(
  "const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);",
  "const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);\n  const [localLateReason, setLocalLateReason] = useState(order.late_reason || '');\n\n  useEffect(() => {\n    setLocalLateReason(order.late_reason || '');\n  }, [order.late_reason]);"
);

const newUi = `              </div>

              {timeInfo.isOverdue && (
                <div className="pt-2 mt-2 border-t border-purple-900/30" onClick={(e) => e.stopPropagation()}>
                  <label className="block text-[10px] font-black text-rose-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Delay Reason</span>
                    {localLateReason ? <span className="text-emerald-400 text-[9px] font-bold">Saved ✓</span> : <span className="text-rose-500/70 text-[9px]">Required</span>}
                  </label>
                  <textarea
                    value={localLateReason}
                    onChange={(e) => setLocalLateReason(e.target.value)}
                    onBlur={() => updateOrder(order.id, { late_reason: localLateReason })}
                    className="w-full bg-slate-950 border border-rose-900/50 rounded-lg p-2 text-xs text-rose-200 placeholder:text-rose-500/50 focus:outline-none focus:border-rose-500 transition resize-none"
                    rows={2}
                    placeholder="Why is/was this order late? (e.g. Heavy Rain, Traffic)"
                  />
                </div>
              )}

            </div>`;

code = code.replace(
  "              </div>\n\n            </div>\n\n            {/* Perforation Line */}",
  newUi + "\n\n            {/* Perforation Line */}"
);

fs.writeFileSync('src/components/OrderCard.tsx', code);
console.log('Added late reason section to OrderCard');
