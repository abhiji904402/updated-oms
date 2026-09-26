import React from 'react';
import { useStore } from '../lib/store';
import { Bell, Search, Menu, User } from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
  onOpenAddModal?: () => void;
  onOpenPasswordModal?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu, onOpenAddModal, onOpenPasswordModal }) => {
  const { currentRole } = useStore();

  return (
    <header className="h-20 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search orders, customers, riders..."
            className="w-full bg-slate-50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="h-10 w-px bg-slate-200 mx-2"></div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-900 capitalize">{currentRole}</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-100">
            {currentRole[0].toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};

export { Header };
export default Header;
