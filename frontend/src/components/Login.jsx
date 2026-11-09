import React, { useState } from 'react';
import { Lock, User } from 'lucide-react';
import axios from 'axios';

export default function Login({ setAuthToken, setUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    try {
      const res = await axios.post('/token', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const { access_token, area, role, username: resUser } = res.data;

      localStorage.setItem('authToken', access_token);
      setAuthToken(access_token);

      try {
        const meRes = await axios.get('/users/me', {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        setUser(meRes.data);
      } catch {
        setUser({
          username: resUser || username,
          area: area || 'General',
          role: role || (username === 'admin' ? 'admin' : (username.includes('jefe') ? 'jefe_area' : 'empleado'))
        });
      }
    } catch (err) {
      setError('Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-sky-600 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-sky-600/20">
            <Lock className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-50">Plataforma IA Institucional</h1>
          <p className="text-slate-400 mt-2">Ingresa con tus credenciales corporativas</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Usuario</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 bg-slate-900 border border-slate-700 rounded-lg py-2.5 text-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Contraseña</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                className="block w-full pl-10 bg-slate-900 border border-slate-700 rounded-lg py-2.5 text-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Acceder al Sistema'}
          </button>
        </form>

        {/* Cuentas de demostración de los 3 niveles */}
        <div className="mt-6 pt-6 border-t border-slate-700/60">
          <p className="text-xs text-slate-400 mb-2 text-center font-medium">Accesos rápidos de prueba (RBAC):</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin', 'admin123')}
              className="text-[11px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 py-1.5 px-2 rounded-lg text-center transition-colors"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('jefe_rrhh', 'jefe123')}
              className="text-[11px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 py-1.5 px-2 rounded-lg text-center transition-colors"
            >
              Jefe RRHH
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('rrhh', 'rrhh123')}
              className="text-[11px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 py-1.5 px-2 rounded-lg text-center transition-colors"
            >
              Empleado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
