const fs = require('fs');
let code = fs.readFileSync('src/components/LoginPage.tsx', 'utf-8');

// Import generic icon for Manager, let's use 'UserCog' or 'Briefcase' if available. Actually, just import 'Briefcase' from lucide-react.
code = code.replace(
  "import { ShieldCheck, Store, Truck, Lock, Eye, EyeOff, AlertCircle, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';",
  "import { ShieldCheck, Store, Truck, Lock, Eye, EyeOff, AlertCircle, Sparkles, ArrowRight, CheckCircle2, Briefcase } from 'lucide-react';"
);

// Add Manager tab in grid
const outletTabStart = `            <button
              type="button"
              onClick={() => {
                setLoginRole('outlet');`;
                
const managerTab = `            <button
              type="button"
              onClick={() => {
                setLoginRole('manager');
                setPasswordInput('');
                setErrorMessage(null);
              }}
              className={\`py-2.5 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 \${
                loginRole === 'manager'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-950 border border-purple-400/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }\`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Manager</span>
            </button>

`;

code = code.replace("grid grid-cols-3", "grid grid-cols-4");
code = code.replace(outletTabStart, managerTab + outletTabStart);

// Manager Header Info
const managerHeaderInfo = `            {/* Manager Header Info */}
            {loginRole === 'manager' && (
              <div className="p-3.5 bg-purple-950/20 border border-purple-900/40 rounded-2xl text-xs space-y-1">
                <div className="font-extrabold text-purple-300 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  Manager Access
                </div>
                <div className="text-[11px] text-slate-400">
                  Track orders, confirm deliveries, and assign riders.
                </div>
              </div>
            )}
`;

code = code.replace("{/* Outlet Selection */}", managerHeaderInfo + "\n            {/* Outlet Selection */}");

fs.writeFileSync('src/components/LoginPage.tsx', code);
console.log('LoginPage.tsx patched');
