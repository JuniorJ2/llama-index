import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, LogOut, Database, ShieldAlert } from 'lucide-react';

export default function DashboardLayout({ children, user, setAuthToken }) {
  const handleLogout = () => {
    setAuthToken(null);
    localStorage.removeItem('authToken');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex text-slate-300">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">{user.username.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-slate-50 font-semibold">{user.username}</h2>
              <p className="text-xs text-slate-500">{user.area}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavLink to="/" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-sky-600/10 text-sky-500' : 'hover:bg-slate-800/50 hover:text-slate-100'}`}>
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </NavLink>
          <NavLink to="/assistants" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-sky-600/10 text-sky-500' : 'hover:bg-slate-800/50 hover:text-slate-100'}`}>
            <Database className="w-5 h-5" /> Mis Asistentes IA
          </NavLink>
          <NavLink to="/reports" className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-slate-800/50 hover:text-slate-100">
            <FileText className="w-5 h-5" /> Reportes
          </NavLink>
          
          {user.role === 'admin' && (
            <NavLink to="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-slate-800/50 hover:text-slate-100 mt-8">
              <Settings className="w-5 h-5" /> Configuración
            </NavLink>
          )}
        </nav>

        <div className="p-4 mt-auto">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
            <LogOut className="w-5 h-5" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0b1120]">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur">
          <h1 className="text-xl font-semibold text-slate-100">Plataforma Analítica</h1>
          <div className="flex items-center gap-4">
            <ShieldAlert className="w-5 h-5 text-slate-500" />
            <span className="text-sm text-slate-500">Sesión Segura</span>
          </div>
        </header>
        <div className="flex-1 p-8 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
