import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Utensils, Truck, MessageSquare, LogOut, ChevronRight, PieChart, ClipboardList } from 'lucide-react';
import { useStore } from '../lib/store';
const Sidebar = () => {
    const { currentRole } = useStore();
    const menuItems = [
        { path: '/admin', icon: LayoutDashboard, label: 'Admin Dashboard', roles: ['admin'] },
        { path: '/outlet', icon: Utensils, label: 'Outlet Orders', roles: ['admin', 'outlet'] },
        { path: '/delivery', icon: Truck, label: 'Delivery Panel', roles: ['admin', 'delivery'] },
        { path: '/whatsapp', icon: MessageSquare, label: 'WhatsApp', roles: ['admin'] },
        { path: '/analytics', icon: PieChart, label: 'Analytics', roles: ['admin'] },
        { path: '/orders', icon: ClipboardList, label: 'Order History', roles: ['admin', 'outlet'] },
    ];
    const filteredMenu = menuItems.filter(item => item.roles.includes(currentRole));
    return (_jsxs("aside", { className: "w-72 bg-white border-r border-slate-200 flex flex-col h-full hidden lg:flex", children: [_jsx("div", { className: "p-8", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200", children: _jsx("span", { className: "text-white text-xl font-black italic", children: "B" }) }), _jsxs("div", { children: [_jsx("h1", { className: "font-bold text-slate-900 leading-tight", children: "Broomies" }), _jsx("p", { className: "text-[10px] text-blue-600 font-bold tracking-widest uppercase", children: "Bakery Official" })] })] }) }), _jsxs("nav", { className: "flex-1 px-4 space-y-2 overflow-y-auto", children: [_jsx("div", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-4 mt-2", children: "Main Menu" }), filteredMenu.map((item) => (_jsx(NavLink, { to: item.path, className: ({ isActive }) => `
              flex items-center justify-between px-4 py-3.5 rounded-xl transition-all group
              ${isActive
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}
            `, children: ({ isActive }) => (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(item.icon, { className: "w-5 h-5" }), _jsx("span", { className: "font-semibold", children: item.label })] }), _jsx(ChevronRight, { className: `w-4 h-4 opacity-0 transition-all ${isActive ? 'opacity-100' : 'group-hover:opacity-100'}` })] })) }, item.path)))] }), _jsx("div", { className: "p-4 border-t border-slate-100", children: _jsxs("button", { onClick: () => window.location.href = '/login', className: "flex items-center gap-3 w-full px-4 py-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all", children: [_jsx(LogOut, { className: "w-5 h-5" }), _jsx("span", { className: "font-semibold", children: "Logout" })] }) })] }));
};
export default Sidebar;
