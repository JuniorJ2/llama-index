import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UploadCloud, File, Send, Loader2, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function Workspace({ user, authToken }) {
  const { assistantId } = useParams();
  const navigate = useNavigate();
  
  const [tdrFile, setTdrFile] = useState(null);
  const [cvFile, setCvFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Si no es el asistente TDR-CV, mostramos un mensaje de construcción
  if (assistantId !== 'tdr-cv') {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-slate-400">
        <h2 className="text-2xl text-slate-200 mb-2">En Construcción</h2>
        <p>El asistente "{assistantId}" estará disponible pronto.</p>
        <button onClick={() => navigate('/assistants')} className="mt-4 text-sky-500 hover:underline">
          Volver a Mis Asistentes
        </button>
      </div>
    );
  }

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!tdrFile || !cvFile) return alert("Sube ambos archivos");
    
    setLoading(true);
    const formData = new FormData();
    formData.append('tdr_file', tdrFile);
    formData.append('cv_file', cvFile);

    try {
      const res = await axios.post('/upload', formData, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      setSessionId(res.data.session_id);
      setChatHistory([
        { role: 'assistant', content: '### 📝 Reporte de Auditoría (TDR)\n' + res.data.audit_report },
        { role: 'assistant', content: '### 🤝 Comparación TDR vs CV\n' + res.data.comparison_report },
        { role: 'assistant', content: 'El análisis inicial ha finalizado. Puedes hacerme preguntas adicionales.' }
      ]);
    } catch (err) {
      alert("Error en el análisis: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputMsg.trim() || !sessionId) return;

    const userMsg = inputMsg;
    setInputMsg('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await axios.post('/chat', 
        { session_id: sessionId, message: userMsg },
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      setChatHistory(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Error: ' + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate('/assistants')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Auditoría TDR vs CV</h2>
          <p className="text-slate-400 text-sm">Espacio de trabajo inteligente</p>
        </div>
      </div>

      {!sessionId ? (
        // Upload Section
        <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center p-8">
          <form onSubmit={handleUpload} className="max-w-2xl w-full">
            <div className="grid grid-cols-2 gap-8 mb-8">
              {/* Dropzone TDR */}
              <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-sky-500 hover:bg-slate-700/30 transition-colors relative">
                <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".pdf" onChange={e => setTdrFile(e.target.files[0])} required />
                <File className="w-10 h-10 text-sky-500 mx-auto mb-4" />
                <h4 className="text-slate-200 font-medium mb-1">Documento TDR</h4>
                <p className="text-slate-400 text-sm">{tdrFile ? tdrFile.name : 'Arrastra el PDF aquí'}</p>
              </div>
              
              {/* Dropzone CV */}
              <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-sky-500 hover:bg-slate-700/30 transition-colors relative">
                <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".pdf" onChange={e => setCvFile(e.target.files[0])} required />
                <UserFileIcon />
                <h4 className="text-slate-200 font-medium mb-1">Currículum Vitae</h4>
                <p className="text-slate-400 text-sm">{cvFile ? cvFile.name : 'Arrastra el PDF aquí'}</p>
              </div>
            </div>
            
            <div className="text-center">
              <button disabled={loading} type="submit" className="bg-sky-600 hover:bg-sky-500 text-white font-medium px-8 py-3 rounded-lg shadow-lg flex items-center gap-2 mx-auto disabled:opacity-50">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                {loading ? 'Analizando con IA...' : 'Comenzar Auditoría'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        // Chat Section (Split Pane)
        <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
          <div className="col-span-1 bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col">
            <h3 className="font-medium text-slate-200 mb-4 flex items-center gap-2"><File className="w-4 h-4"/> Archivos Analizados</h3>
            <div className="space-y-3">
              <div className="bg-slate-900 p-3 rounded-lg text-sm text-slate-300 border border-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-500"></span> TDR: {tdrFile?.name}
              </div>
              <div className="bg-slate-900 p-3 rounded-lg text-sm text-slate-300 border border-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> CV: {cvFile?.name}
              </div>
            </div>
            <div className="mt-8 text-xs text-slate-500 text-center">
              * El visor de PDF en vivo se implementará en la Fase 3.
            </div>
          </div>
          
          <div className="col-span-2 bg-slate-800 border border-slate-700 rounded-xl flex flex-col overflow-hidden">
            <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center justify-between">
              <span className="text-slate-200 font-medium">Chat con Documentos</span>
              <span className="text-xs px-2 py-1 bg-sky-500/20 text-sky-400 rounded-full border border-sky-500/30">Gemini 2.5 Flash</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-xl prose prose-invert prose-sm ${msg.role === 'user' ? 'bg-sky-600 text-white' : 'bg-slate-900 border border-slate-700 text-slate-200'}`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl text-slate-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Procesando...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            <form onSubmit={handleSend} className="p-4 border-t border-slate-700 bg-slate-900/50 flex gap-2">
              <input 
                type="text" 
                value={inputMsg}
                onChange={e => setInputMsg(e.target.value)}
                placeholder="Pregunta sobre el contrato o los requisitos..." 
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
              />
              <button type="submit" disabled={loading} className="bg-sky-600 hover:bg-sky-500 text-white p-2 px-4 rounded-lg disabled:opacity-50">
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function UserFileIcon() {
  return (
    <svg className="w-10 h-10 text-emerald-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
    </svg>
  );
}
