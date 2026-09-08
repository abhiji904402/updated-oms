const fs = require('fs');
let code = fs.readFileSync('src/components/RoleSwitcher.tsx', 'utf-8');

code = code.replace(
  "import { ShieldCheck, Store, Truck, ChevronDown } from 'lucide-react';",
  "import { ShieldCheck, Store, Truck, ChevronDown, Briefcase } from 'lucide-react';"
);

code = code.replace(
  "{session.role === 'admin' && <ShieldCheck className=\"w-4 h-4 text-rose-400\" />}",
  "{session.role === 'admin' && <ShieldCheck className=\"w-4 h-4 text-rose-400\" />}\n        {session.role === 'manager' && <Briefcase className=\"w-4 h-4 text-purple-400\" />}"
);

const adminBlock = `            {/* Admin Option */}
            <button
              onClick={() => handleRoleSelect('admin')}
              className={\`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition \${
                session.role === 'admin'
                  ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
                  : 'hover:bg-slate-800 text-slate-300'
              }\`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-rose-400" />
                <div>
                  <div className="text-xs font-bold">Admin Central</div>
                  <div className="text-[11px] text-slate-400">Full control & analytics</div>
                </div>
              </div>
              {session.role === 'admin' && <span className="w-2 h-2 rounded-full bg-rose-500"></span>}
            </button>`;

const managerBlock = `
            {/* Manager Option */}
            <button
              onClick={() => handleRoleSelect('manager')}
              className={\`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition \${
                session.role === 'manager'
                  ? 'bg-purple-500/15 border border-purple-500/40 text-purple-300'
                  : 'hover:bg-slate-800 text-slate-300'
              }\`}
            >
              <div className="flex items-center gap-2.5">
                <Briefcase className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="text-xs font-bold">Manager View</div>
                  <div className="text-[11px] text-slate-400">Track, Assign & Confirm</div>
                </div>
              </div>
              {session.role === 'manager' && <span className="w-2 h-2 rounded-full bg-purple-500"></span>}
            </button>`;

code = code.replace(adminBlock, adminBlock + managerBlock);

fs.writeFileSync('src/components/RoleSwitcher.tsx', code);
console.log('RoleSwitcher.tsx patched');
