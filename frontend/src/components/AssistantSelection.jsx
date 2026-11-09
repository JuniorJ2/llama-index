import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSearch, Scale, FileText, ChevronRight } from 'lucide-react';

export default function AssistantSelection({ user }) {
  const navigate = useNavigate();

  // Mapear los asistentes disponibles por área (simplificado)
  const assistants = [
    {
      id: 'tdr-cv',
      name: 'Auditoría TDR vs CV',
      description: 'Compara Términos de Referencia con Hojas de Vida de candidatos automáticamente.',
      icon: <FileSearch className="w-8 h-8 text-sky-500" />,
      area: ['RRHH', 'Sistemas', 'admin'],
    },
    {
      id: 'contracts',
      name: 'Análisis de Contratos',
      description: 'Revisa cláusulas y cumplimiento legal de documentos y adendas.',
      icon: <Scale className="w-8 h-8 text-indigo-500" />,
      area: ['Legal', 'admin'],
    },
    {
      id: 'reports',
      name: 'Resumen de Informes Técnicos',
      description: 'Extrae los puntos clave y recomendaciones de informes extensos.',
      icon: <FileText className="w-8 h-8 text-emerald-500" />,
      area: ['Sistemas', 'RRHH', 'Legal', 'admin'],
    }
  ];

  const userAssistants = assistants.filter(a => a.area.includes(user.area) || user.role === 'admin');

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-100">Mis Asistentes Inteligentes</h2>
        <p className="text-slate-400 mt-2">Selecciona la herramienta que necesitas usar hoy.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {userAssistants.map((assistant) => (
          <div 
            key={assistant.id}
            onClick={() => navigate(`/workspace/${assistant.id}`)}
            className="bg-slate-800 border border-slate-700 hover:border-sky-500/50 hover:bg-slate-800/80 p-6 rounded-xl cursor-pointer transition-all group flex flex-col h-full"
          >
            <div className="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              {assistant.icon}
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">{assistant.name}</h3>
            <p className="text-slate-400 text-sm flex-1">{assistant.description}</p>
            
            <div className="mt-6 flex items-center text-sky-500 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Iniciar Análisis <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>
        ))}
      </div>
      
      {userAssistants.length === 0 && (
        <div className="text-center text-slate-500 mt-20">
          No tienes asistentes asignados a tu área. Contacta a sistemas.
        </div>
      )}
    </div>
  );
}
