import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useStore } from '../lib/store';
import { Lock, LayoutDashboard, Utensils, Truck } from 'lucide-react';
const LoginPage = ({ onLogin }) => {
    const { setRole } = useStore();
    const [selectedRole, setSelectedRole] = useState('admin');
    const handleLogin = (e) => {
        e.preventDefault();
        setRole(selectedRole);
        onLogin();
    };
    const roles = [
        { id: 'admin', label: 'Broomies Central Admin', icon: LayoutDashboard, color: 'bg-blue-500' },
        { id: 'outlet', label: 'Outlet Manager', icon: Utensils, color: 'bg-amber-500' },
        { id: 'delivery', label: 'Delivery Rider', icon: Truck, color: 'bg-green-500' },
    ];
    return (_jsx("div", { className: "min-h-screen bg-slate-50 flex items-center justify-center p-4", children: _jsxs("div", { className: "max-w-md w-full", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-200", children: _jsx("span", { className: "text-white text-3xl font-black italic", children: "B" }) }), _jsx("h1", { className: "text-3xl font-bold text-slate-900", children: "Broomies Bakery" }), _jsx("p", { className: "text-slate-500 mt-2", children: "Order Management System" })] }), _jsx("div", { className: "bg-white rounded-2xl border border-slate-200 shadow-xl p-8", children: _jsxs("form", { onSubmit: handleLogin, className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-4", children: "Choose Your Role" }), _jsx("div", { className: "grid grid-cols-1 gap-3", children: roles.map((role) => (_jsxs("button", { type: "button", onClick: () => setSelectedRole(role.id), className: `flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${selectedRole === role.id
                                                ? 'border-blue-600 bg-blue-50'
                                                : 'border-slate-100 hover:border-slate-200'}`, children: [_jsx("div", { className: `p-2 rounded-lg ${role.color} text-white`, children: _jsx(role.icon, { className: "w-5 h-5" }) }), _jsx("span", { className: `font-semibold ${selectedRole === role.id ? 'text-blue-900' : 'text-slate-600'}`, children: role.label })] }, role.id))) })] }), _jsxs("button", { type: "submit", className: "w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2", children: ["Sign In ", _jsx(Lock, { className: "w-5 h-5" })] })] }) }), _jsx("p", { className: "text-center text-slate-400 text-sm mt-8", children: "\u00A9 2024 Broomies Bakery Official" })] }) }));
};
export default LoginPage;
