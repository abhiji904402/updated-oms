const fs = require('fs');
let code = fs.readFileSync('src/components/EditOrderModal.tsx', 'utf-8');

const brokenUi = `            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Late Delivery Reason
              </label>
              <textarea value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                placeholder="Reason if order was delivered late (e.g., Traffic, Rain)"
                rows={3}
                className="w-full bg-[#12162a] border border-indigo-950 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3.5">`;

code = code.replace(brokenUi, `          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">`);

fs.writeFileSync('src/components/EditOrderModal.tsx', code);
console.log('Fixed EditOrderModal');
