const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

code = code.replace(
  "              {session.role === 'outlet' ? (",
  "              {session.role === 'outlet' || session.role === 'manager' ? ("
);

// If role is manager, hide the "Add Order" button.
const addOrderBtn = `{/* 2. + Add Order Button */}
                  <button
                    onClick={() => {
                      onOpenAddModal();
                      setIsOpenMobile(false);
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-900/50 flex items-center justify-start gap-3 transition active:scale-[0.98]"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Order</span>
                  </button>`;

code = code.replace(
  addOrderBtn, 
  `{/* 2. + Add Order Button */}
                  {session.role !== 'manager' && (
                    <button
                      onClick={() => {
                        onOpenAddModal();
                        setIsOpenMobile(false);
                      }}
                      className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-900/50 flex items-center justify-start gap-3 transition active:scale-[0.98]"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Add Order</span>
                    </button>
                  )}`
);

// Do the same for the outlet/manager block (the first one)
const addOrderBtnOutletBlock = `{/* 2. + Add Order Button */}
                  <button
                    onClick={() => {
                      onOpenAddModal();
                      setIsOpenMobile(false);
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-900/50 flex items-center justify-start gap-3 transition active:scale-[0.98]"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Order</span>
                  </button>`;

code = code.replace(
  addOrderBtnOutletBlock, 
  `{/* 2. + Add Order Button */}
                  {session.role !== 'manager' && (
                    <button
                      onClick={() => {
                        onOpenAddModal();
                        setIsOpenMobile(false);
                      }}
                      className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-900/50 flex items-center justify-start gap-3 transition active:scale-[0.98]"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Add Order</span>
                    </button>
                  )}`
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
console.log('Sidebar.tsx patched');
