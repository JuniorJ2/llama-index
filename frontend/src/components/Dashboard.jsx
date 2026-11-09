import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  Activity, CheckCircle, AlertTriangle, FileText, ArrowLeft, 
  Users, MessageSquare, Shield, ShieldCheck, RefreshCw, Layers, ExternalLink
} from 'lucide-react';

// Paleta multicolor contrastada y moderna para diferenciar claramente cada área
const COLORS = ['#38bdf8', '#a855f7', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#14b8a6'];

export default function Dashboard({ user, onBackToChat, onSelectSession }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/stats', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      setStats(res.data);
    } catch (err) {
      console.error("Error fetching stats", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
        <p className="text-sm">Cargando métricas institucionales...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-6 rounded-2xl text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
        <p className="font-medium">No se pudieron cargar las métricas en este momento.</p>
        <button 
          onClick={fetchStats}
          className="px-4 py-2 bg-red-600/30 hover:bg-red-600/50 rounded-lg text-sm text-white transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const roleBadge = () => {
    if (stats.role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5" /> Administrador Global
        </span>
      );
    }
    if (stats.role === 'jefe_area') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm">
          <Shield className="w-3.5 h-3.5" /> Jefe de Área — {stats.area}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm">
        <Users className="w-3.5 h-3.5" /> Analista — {stats.area}
      </span>
    );
  };

  const distributionData = stats.distribution && stats.distribution.length > 0 
    ? stats.distribution 
    : (stats.area_distribution || []);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2d2d30]">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {onBackToChat && (
              <button
                onClick={onBackToChat}
                className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-[#212121] hover:bg-[#2f2f2f] px-3 py-1.5 rounded-lg border border-[#303030] hover:border-sky-500/40 transition-colors"
                title="Volver a la vista del Asistente"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Volver al Chat
              </button>
            )}
            {roleBadge()}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{stats.scope_title}</h1>
          <p className="text-xs text-slate-400">{stats.scope_desc}</p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 text-xs text-slate-300 hover:text-white bg-[#212121] hover:bg-[#2f2f2f] border border-[#303030] hover:border-sky-500/40 px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-sky-400' : ''}`} />
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Documentos */}
        <div className="bg-[#1e1f20] border border-[#303030] p-5 rounded-2xl shadow-sm hover:border-sky-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Documentos</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
              <FileText className="text-sky-400 w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white mt-3">{stats.total_documents.toLocaleString()}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">TDRs, CVs y anexos procesados</span>
        </div>

        {/* Card 2: Analizados Hoy (Celeste Institucional) */}
        <div className="bg-[#1e1f20] border border-[#303030] p-5 rounded-2xl shadow-sm hover:border-sky-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Analizados Hoy</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
              <CheckCircle className="text-sky-400 w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-sky-400 mt-3">{stats.analyzed_today.toLocaleString()}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Expedientes en la jornada</span>
        </div>

        {/* Card 3: Sesiones de Chat */}
        <div className="bg-[#1e1f20] border border-[#303030] p-5 rounded-2xl shadow-sm hover:border-sky-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Sesiones Activas</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Layers className="text-indigo-400 w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-indigo-300 mt-3">{stats.total_sessions.toLocaleString()}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Conversaciones de auditoría</span>
        </div>

        {/* Card 4: Consultas IA */}
        <div className="bg-[#1e1f20] border border-[#303030] p-5 rounded-2xl shadow-sm hover:border-sky-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Interacciones IA</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <MessageSquare className="text-amber-400 w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-amber-300 mt-3">{stats.total_messages.toLocaleString()}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Respuestas con Gemini 1.5</span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Queries Chart (Celeste Institucional) */}
        <div className="lg:col-span-2 bg-[#1e1f20] border border-[#303030] p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Actividad Diaria de Auditorías</h3>
              <p className="text-xs text-slate-500">Expedientes procesados en los últimos 7 días</p>
            </div>
            <span className="text-xs text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-full font-medium">
              En tiempo real
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.daily_queries}>
                <defs>
                  <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.45}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d30" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 11}} />
                <YAxis stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 11}} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{backgroundColor: '#18181b', borderColor: '#38bdf8', borderRadius: '0.75rem', color: '#f8fafc', fontSize: '12px'}}
                  itemStyle={{color: '#38bdf8'}}
                  formatter={(value) => [`${value} expedientes`, 'Procesados']}
                />
                <Area 
                  type="monotone" 
                  dataKey="queries" 
                  stroke="#38bdf8" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#colorQueries)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Pie Chart */}
        <div className="bg-[#1e1f20] border border-[#303030] p-6 rounded-2xl shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-200">{stats.distribution_label || "Distribución"}</h3>
            <p className="text-xs text-slate-500">
              {stats.role === 'admin' ? 'Uso consolidado por área' : (stats.role === 'jefe_area' ? 'Rendimiento por colaborador' : 'Tipos de archivos subidos')}
            </p>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            {distributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{backgroundColor: '#18181b', borderColor: '#38bdf8', borderRadius: '0.75rem', color: '#f8fafc', fontSize: '12px'}}
                    itemStyle={{color: '#f8fafc'}}
                    formatter={(val, name) => [`${val} (${entryPercent(val, distributionData)}%)`, name]}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(val) => <span className="text-[11px] text-slate-400">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-500">Sin datos de distribución todavía</p>
            )}
          </div>
        </div>
      </div>

      {/* Team Members Section (Visible for Admin and Jefe de Área) */}
      {stats.team_members && stats.team_members.length > 0 && (
        <div className="bg-[#1e1f20] border border-[#303030] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[#2d2d30] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                {stats.role === 'admin' ? 'Colaboradores del Sistema (Todas las Áreas)' : `Equipo del Área de ${stats.area}`}
              </h3>
              <p className="text-xs text-slate-500">Supervisión de usuarios y expedientes atendidos</p>
            </div>
            <span className="text-xs bg-[#2b2b2b] text-slate-300 px-2.5 py-1 rounded-lg border border-[#383838]">
              {stats.team_members.length} usuarios
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#18181a] text-slate-400 text-xs uppercase tracking-wider">
                  <th className="p-3.5 font-medium pl-5">Usuario</th>
                  <th className="p-3.5 font-medium">Rol</th>
                  <th className="p-3.5 font-medium">Área</th>
                  <th className="p-3.5 font-medium text-center">Sesiones Creadas</th>
                  <th className="p-3.5 font-medium text-center pr-5">Documentos Auditados</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-300 divide-y divide-[#2d2d30]">
                {stats.team_members.map(member => (
                  <tr key={member.id} className="hover:bg-[#252528] transition-colors">
                    <td className="p-3.5 pl-5 font-medium text-slate-200 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                        {member.username.charAt(0)}
                      </div>
                      <span>{member.username}</span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        member.role === 'admin' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30' :
                        member.role === 'jefe_area' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                        'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                      }`}>
                        {member.role === 'admin' ? 'Admin' : (member.role === 'jefe_area' ? 'Jefe de Área' : 'Analista')}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400">{member.area || 'Sistemas'}</td>
                    <td className="p-3.5 text-center font-semibold text-slate-200">{member.sessions_count}</td>
                    <td className="p-3.5 text-center font-semibold text-sky-400 pr-5">{member.documents_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Analyses Table */}
      <div className="bg-[#1e1f20] border border-[#303030] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-[#2d2d30] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Expedientes y Auditorías Recientes</h3>
            <p className="text-xs text-slate-500">Últimos documentos procesados en tu ámbito de permisos</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#18181a] text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-3.5 font-medium pl-5">Código</th>
                <th className="p-3.5 font-medium">Documento / Expediente</th>
                <th className="p-3.5 font-medium">Tipo</th>
                <th className="p-3.5 font-medium">Estado</th>
                <th className="p-3.5 font-medium">Responsable</th>
                <th className="p-3.5 font-medium">Fecha</th>
                <th className="p-3.5 font-medium text-right pr-5">Acción</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-300 divide-y divide-[#2d2d30]">
              {stats.recent_analyses && stats.recent_analyses.length > 0 ? (
                stats.recent_analyses.map((row) => (
                  <tr key={row.id} className="hover:bg-[#252528] transition-colors group">
                    <td className="p-3.5 pl-5 font-mono text-[11px] text-slate-400">{row.id}</td>
                    <td className="p-3.5 max-w-[280px]">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-200 truncate" title={row.name}>
                          {row.name}
                        </span>
                        {row.session_title && (
                          <span 
                            className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 truncate" 
                            title={`Conversación: ${row.session_title}`}
                          >
                            <MessageSquare className="w-3 h-3 text-sky-400 shrink-0" />
                            <span className="truncate">En chat: <strong className="font-normal text-slate-300">{row.session_title}</strong></span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="bg-[#2a2a2e] text-slate-300 px-2 py-0.5 rounded text-[11px] font-mono border border-[#38383c]">
                        {row.type}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium
                        ${row.status === 'Completado' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : ''}
                        ${row.status === 'Procesando' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : ''}
                        ${row.status === 'Error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : ''}
                      `}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-col">
                        <span className="text-slate-300 font-medium">{row.owner}</span>
                        <span className="text-[10px] text-slate-500">{row.area}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-400">{row.date}</td>
                    <td className="p-3.5 text-right pr-5">
                      {row.session_id && onSelectSession && (
                        <button
                          onClick={() => onSelectSession(row.session_id)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-400 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/25 px-3 py-1.5 rounded-lg border border-sky-500/30 hover:border-sky-500/50 transition-all shadow-sm shadow-sky-500/5 cursor-pointer"
                        >
                          Ver <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    No hay auditorías registradas en este ámbito todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function entryPercent(val, data) {
  const total = data.reduce((acc, curr) => acc + (curr.value || 0), 0);
  if (total === 0) return 0;
  return Math.round((val / total) * 100);
}
