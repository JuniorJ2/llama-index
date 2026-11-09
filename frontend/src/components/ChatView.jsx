import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import MarkdownView from './MarkdownView';
import Dashboard from './Dashboard';
import { 
  Plus, Send, Paperclip, Loader2, Sparkles, User, FileText, Search, Settings, Grid, MoreVertical, Edit2, Trash2, Check, X, LogOut, Copy, Download, Square, RotateCcw,
  Scale, ChartColumn, TriangleAlert, ArrowRight, LayoutDashboard
} from 'lucide-react';
import html2pdf from 'html2pdf.js';

const API_BASE = '/api';

// Apariencia de cada app (el catálogo y las reglas vienen del backend: GET /api/apps)
const APP_ICONS = {
  'tdr-cv': { icon: FileText, color: 'text-emerald-400' },
  contracts: { icon: Scale, color: 'text-indigo-400' },
  reports: { icon: ChartColumn, color: 'text-amber-400' },
};
const DEFAULT_APP_ICON = { icon: FileText, color: 'text-sky-400' };

// Disparador neutral: el backend decide el tipo de análisis según los documentos clasificados
const DEFAULT_ANALYSIS_PROMPT = 'Analiza los documentos adjuntos.';

export default function ChatView({ user, authToken }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [stageInfo, setStageInfo] = useState(null); 
  const [filesToUpload, setFilesToUpload] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [inlineEditingIndex, setInlineEditingIndex] = useState(null);
  const [inlineEditingContent, setInlineEditingContent] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [pdfWidth, setPdfWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Apps: catálogo, app elegida antes de crear la sesión, app de la sesión abierta y aviso de incompatibilidad
  const [apps, setApps] = useState([]);
  const [pendingApp, setPendingApp] = useState(null);
  const [currentApp, setCurrentApp] = useState('general');
  const [appNotice, setAppNotice] = useState(null);
  const [viewMode, setViewMode] = useState('chat'); // 'chat' | 'dashboard'

  useEffect(() => {
    axios.get(`${API_BASE}/apps`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(res => setApps(res.data.apps || []))
      .catch(e => console.error('Error al cargar apps', e));
  }, [authToken]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, stageInfo]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const startResizing = React.useCallback((mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
    const handleMouseMove = (mouseMoveEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((rect.right - mouseMoveEvent.clientX) / rect.width) * 100;
      if (newWidth > 20 && newWidth < 80) {
        setPdfWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
      if (newFiles.length > 0) {
        setFilesToUpload(prev => [...prev, ...newFiles]);
      }
    }
  };

  const handleCopyHtml = async (id, index) => {
    const el = document.getElementById(id);
    if (el) {
      try {
        const blob = new Blob([el.innerHTML], { type: 'text/html' });
        const plainBlob = new Blob([el.innerText], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': blob, 'text/plain': plainBlob })
        ]);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
      } catch (err) {
        console.error('Failed to copy', err);
      }
    }
  };

  const handleDownloadPdf = (id, index) => {
    const element = document.getElementById(id);
    if (!element) return;
    
    const opt = {
      margin:       15,
      filename:     `Auditoria_IA_${index}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      pagebreak:    { mode: ['css', 'legacy'] },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById(id);
          if (el) {
            el.style.backgroundColor = '#ffffff';
            el.classList.remove('text-[#e3e3e3]', 'bg-transparent');
            el.classList.add('bg-white', 'md-light');
            
            const style = clonedDoc.createElement('style');
            style.innerHTML = `
              .md-body { color: #1e293b !important; }
              .md-body .md-table-wrap { overflow: visible !important; }
              .md-body th { white-space: normal !important; }
              .md-body h1, .md-body h2, .md-body h3 { page-break-after: avoid; break-after: avoid; }
              .md-body tr, .md-body img, .md-body .md-card { page-break-inside: avoid; break-inside: avoid; }
            `;
            el.appendChild(style);
          }
        }
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
  };

  const handleViewPdf = async (fname) => {
    try {
      const res = await axios.get(`${API_BASE}/uploads/${sessionId}_${fname}`, {
        headers: { Authorization: `Bearer ${authToken}` },
        responseType: 'blob'
      });
      const url = URL.createObjectURL(res.data);
      setSelectedPdfUrl(url);
    } catch (e) {
      console.error("Error cargando PDF seguro", e);
      alert("No tienes permiso para ver este archivo o ya no existe.");
    }
  };

  const loadSessions = async (query = '') => {
    try {
      const res = await axios.get(`${API_BASE}/sessions`, {
        params: query ? { search: query } : {},
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setSessions(res.data.sessions || []);
    } catch (e) {
      console.error("Error al cargar sesiones", e);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadSessions(searchTerm);
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, sessionId]);

  useEffect(() => {
    if (sessionId) {
      setViewMode('chat');
      setPendingApp(null);
      setAppNotice(null);
      if (!isGenerating) {
        loadSessionDetails(sessionId);
      }
    } else {
      setMessages([]);
      setFilesToUpload([]);
      setStageInfo(null);
      setCurrentApp('general');
    }
  }, [sessionId]);

  const loadSessionDetails = async (id) => {
    try {
      const res = await axios.get(`${API_BASE}/sessions/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setMessages(res.data.messages || []);
      if (res.data.session?.app_type) setCurrentApp(res.data.session.app_type);
    } catch (e) {
      if (e.response?.status === 404) navigate('/');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    window.location.reload();
  };

  const deleteSession = async (id) => {
    try {
      await axios.delete(`${API_BASE}/sessions/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (sessionId === id) navigate('/');
      loadSessions();
    } catch (e) {
      console.error(e);
    }
  };

  const saveEditSession = async (id) => {
    if (!editTitle.trim()) return;
    try {
      const formData = new FormData();
      formData.append('title', editTitle);
      await axios.patch(`${API_BASE}/sessions/${id}`, formData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setEditingSessionId(null);
      loadSessions();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveInlineEdit = async (index) => {
    const msg = messages[index];
    try {
      if (msg && msg.id) {
        const formData = new FormData();
        formData.append('content', inlineEditingContent);
        await axios.put(`${API_BASE}/sessions/${sessionId}/messages/${msg.id}`, formData, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
      }
      setMessages(prev => {
        const newMsg = prev.slice(0, index + 1); // Truncate messages after index
        newMsg[index] = { ...newMsg[index], content: inlineEditingContent };
        return newMsg;
      });
      setInlineEditingIndex(null);
      // Generate new response
      await executeChat(sessionId, "");
    } catch (e) {
      console.error(e);
    }
  };

  const handleRetry = async (index) => {
    const msg = messages[index];
    try {
      if (msg && msg.id) {
        const formData = new FormData();
        formData.append('content', msg.content);
        await axios.put(`${API_BASE}/sessions/${sessionId}/messages/${msg.id}`, formData, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
      }
      setMessages(prev => prev.slice(0, index + 1));
      await executeChat(sessionId, "");
    } catch (e) {
      console.error(e);
    }
  };

  const createSession = async (appId = 'general') => {
    const res = await axios.post(`${API_BASE}/sessions`, { app_type: appId }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    return res.data.id;
  };

  const processSSE = async (url, options, callbacks) => {
    try {
      abortControllerRef.current = new AbortController();
      const fetchOptions = { ...options, signal: abortControllerRef.current.signal };
      const response = await fetch(url, fetchOptions);
      if (!response.ok) throw new Error("Error en el servidor");
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        let eventName = null;
        for (const line of lines) {
          if (line.startsWith('event:')) eventName = line.substring(6).trim();
          else if (line.startsWith('data:')) {
            const dataStr = line.substring(5).trim();
            if (!dataStr) continue;
            const data = JSON.parse(dataStr);
            if (eventName === 'stage') callbacks.onStage?.(data);
            if (eventName === 'token') callbacks.onToken?.(data);
            if (eventName === 'done') callbacks.onDone?.(data);
            if (eventName === 'error') callbacks.onError?.(data);
            eventName = null;
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        callbacks.onDone?.({ session_title: null, aborted: true });
      } else {
        callbacks.onError?.({ message: e.message });
      }
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const executeChat = async (targetSessionId, userText, attachments = null) => {
    setIsGenerating(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    
    let fullReply = '';
    await processSSE(
      `${API_BASE}/sessions/${targetSessionId}/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
          session_id: targetSessionId, 
          message: userText,
          attachments: attachments ? JSON.stringify(attachments) : null
        })
      },
      {
        onStage: (data) => setStageInfo(data),
        onToken: (data) => {
          setStageInfo(null);
          fullReply += data.text;
          setMessages(prev => {
            const newMsg = [...prev];
            newMsg[newMsg.length - 1].content = fullReply;
            return newMsg;
          });
        },
        onDone: (data) => {
          setIsGenerating(false);
          setStageInfo(null);
          if (data.session_title) loadSessions();
          if (!data.aborted) loadSessionDetails(targetSessionId);
        },
        onError: (err) => {
          setIsGenerating(false);
          setStageInfo(null);
          setMessages(prev => {
            const newMsg = [...prev];
            newMsg[newMsg.length - 1].content += `\n\n**Error:** ${err.message}`;
            return newMsg;
          });
        }
      }
    );
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if ((!inputMsg.trim() && filesToUpload.length === 0) || isGenerating) return;

    let targetSessionId = sessionId;
    const appForSession = sessionId ? currentApp : (pendingApp || 'general');
    let createdNow = false;
    if (!targetSessionId) {
      targetSessionId = await createSession(appForSession);
      createdNow = true;
      setCurrentApp(appForSession);
      setPendingApp(null);
      navigate(`/c/${targetSessionId}`, { replace: true });
    }
    setAppNotice(null);

    const userText = inputMsg;
    setInputMsg('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    
    if (filesToUpload.length > 0) {
      const fileNames = filesToUpload.map(f => f.name);
      const uploadMsg = userText || 'Analiza estos documentos';
      setMessages(prev => [...prev, { role: 'user', content: uploadMsg, attachments: fileNames }]);
      
      const autoPrompt = userText || DEFAULT_ANALYSIS_PROMPT;
      await performUpload(targetSessionId, filesToUpload, autoPrompt, fileNames, { newSession: createdNow, appId: appForSession });
      return; 
    }

    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    await executeChat(targetSessionId, userText);
  };

  const performUpload = async (targetSessionId, files, autoPrompt = null, attachmentsList = null, opts = {}) => {
    setIsGenerating(true);
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    await processSSE(
      `${API_BASE}/sessions/${targetSessionId}/upload`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData
      },
      {
        onStage: (data) => setStageInfo(data),
        onDone: async (data) => {
          setIsGenerating(false);
          setStageInfo(null);
          setFilesToUpload([]);
          if (data.session_title) loadSessions();

          // Documentos que no corresponden a la app dedicada: aviso + botones de redirección
          if (data.notice) {
            const rejectedNames = data.rejected_files || [];
            setAppNotice({
              text: data.notice,
              actions: data.suggested_actions || [],
              files: files.filter(f => rejectedNames.includes(f.name)),
            });
          }

          // Ningún documento fue aceptado: se revierte el mensaje optimista y no se genera análisis
          if (data.accepted_count === 0) {
            setMessages(prev => prev.slice(0, -1));
            if (opts.newSession) {
              try {
                await axios.delete(`${API_BASE}/sessions/${targetSessionId}`, { headers: { Authorization: `Bearer ${authToken}` } });
              } catch (e) { console.error(e); }
              setPendingApp(opts.appId || null);
              navigate('/', { replace: true });
              loadSessions();
            }
            return;
          }
          
          if (autoPrompt) {
            await executeChat(targetSessionId, autoPrompt, attachmentsList);
          } else {
            await loadSessionDetails(targetSessionId);
          }
        },
        onError: (err) => {
          setIsGenerating(false);
          setStageInfo(null);
          setMessages(prev => [...prev, { role: 'assistant', content: `**Error al procesar archivos:** ${err.message}` }]);
        }
      }
    );
  };

  const handleFileSelect = (e) => {
    if (e.target.files) setFilesToUpload(Array.from(e.target.files));
  };

  const handleTextareaInput = (e) => {
    setInputMsg(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  const isEmpty = messages.length === 0 && !isGenerating && !stageInfo;

  const activeAppId = sessionId ? currentApp : (pendingApp || 'general');
  const activeApp = apps.find(a => a.id === activeAppId);
  const isDedicatedApp = activeAppId !== 'general' && !!activeApp;

  // Mueve los documentos rechazados a otra app (crea una sesión nueva en esa app y los sube allí)
  const handleSwitchApp = async (targetApp, files) => {
    if (isGenerating) return;
    setAppNotice(null);
    const newId = await createSession(targetApp);
    setCurrentApp(targetApp);
    setPendingApp(null);
    navigate(`/c/${newId}`);
    if (files && files.length > 0) {
      const names = files.map(f => f.name);
      setMessages([{ role: 'user', content: 'Analiza estos documentos', attachments: names }]);
      await performUpload(newId, files, DEFAULT_ANALYSIS_PROMPT, names, { newSession: true, appId: targetApp });
    }
  };

  const renderAppWelcome = () => {
    if (!isDedicatedApp || !activeApp.welcome) return null;
    const meta = APP_ICONS[activeApp.id] || DEFAULT_APP_ICON;
    const Icon = meta.icon;
    const w = activeApp.welcome;
    return (
      <div className="w-full max-w-[700px] px-4 md:px-0 mb-6">
        <div className="bg-[#171717] border border-[#303030] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#212121] border border-[#303030] flex items-center justify-center shrink-0">
              <Icon className={`w-5 h-5 ${meta.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-medium text-white">{w.title}</div>
              <div className="text-[12px] text-[#8e8e8e]">
                {activeApp.status === 'active' ? 'App dedicada' : 'App dedicada · Próximamente'}
              </div>
            </div>
            {!sessionId && (
              <button type="button" onClick={() => setPendingApp(null)} className="p-2 text-[#8e8e8e] hover:text-white hover:bg-[#212121] rounded-lg transition-colors" title="Volver al chat libre">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[14px] text-[#b4b4b4] leading-relaxed mb-4">{w.description}</p>
          <ol className="space-y-2 mb-4">
            {w.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px] text-[#d0d0d0]">
                <span className="w-5 h-5 rounded-full bg-[#212121] border border-[#303030] text-[11px] text-[#8e8e8e] flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-[#8e8e8e]">Acepta:</span>
            {w.accepts.map(t => (
              <span key={t} className="text-[12px] text-[#ececec] bg-[#212121] border border-[#303030] px-2.5 py-0.5 rounded-full">{t}</span>
            ))}
            <span className="text-[12px] text-[#8e8e8e] ml-1">· Adjunta con el botón + o arrastra los PDF aquí</span>
          </div>
        </div>
      </div>
    );
  };

  const renderAppNotice = () => {
    if (!appNotice) return null;
    return (
      <div className="w-full max-w-[700px] mx-auto px-4 md:px-0 mb-6">
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-4 flex gap-3">
          <TriangleAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="md-body text-[14px]"><MarkdownView content={appNotice.text} /></div>
            <div className="flex flex-wrap gap-2 mt-3">
              {appNotice.actions.filter(a => a.action === 'switch_app').map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSwitchApp(a.payload, appNotice.files)}
                  className="flex items-center gap-2 bg-[#212121] hover:bg-[#2f2f2f] border border-[#404040] text-[#ececec] text-[13px] px-3.5 py-2 rounded-full transition-colors"
                >
                  {a.label} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ))}
              <button type="button" onClick={() => setAppNotice(null)} className="text-[13px] text-[#8e8e8e] hover:text-white px-3 py-2 rounded-full transition-colors">
                Entendido
              </button>
            </div>
          </div>
          <button type="button" onClick={() => setAppNotice(null)} className="text-[#8e8e8e] hover:text-white self-start" title="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#131314] text-[#e3e3e3] font-sans selection:bg-blue-500/30 overflow-hidden">
      
      {/* Sidebar - ChatGPT Style */}
      <div className={`bg-[#000000] shrink-0 border-[#303030] overflow-hidden transition-all duration-300 ease-in-out hidden md:block ${isSidebarOpen ? 'w-[260px] border-r opacity-100' : 'w-0 border-r-0 opacity-0'}`}>
        <div className="w-[260px] flex flex-col h-full">
        
        {/* Header */}
        <div className="p-4 pt-5 pb-2 flex items-center gap-2">
          <button 
            onClick={() => { setViewMode('chat'); setPendingApp(null); setAppNotice(null); navigate('/'); }}
            className="flex-1 flex items-center justify-start gap-3 bg-[#171717] hover:bg-[#212121] text-white text-[14px] font-medium px-4 py-3 rounded-xl transition-colors border border-transparent cursor-pointer"
          >
            <div className="bg-white text-black p-0.5 rounded-full"><Plus className="w-4 h-4" /></div>
            Nuevo chat
          </button>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="p-3 text-[#8e8e8e] hover:text-white rounded-xl hover:bg-[#171717] transition-colors flex shrink-0 items-center justify-center" 
            title="Ocultar panel lateral"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
          </button>
        </div>

        {/* Menu Apps */}
        <div className="px-3 py-2 space-y-1">
          <div className="relative w-full">
            <Search className="w-5 h-5 text-[#8e8e8e] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Buscar conversaciones"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-[14px] text-white placeholder-[#8e8e8e] hover:bg-[#212121] focus:bg-[#212121] rounded-lg transition-colors py-2.5 pl-10 pr-3 outline-none"
            />
          </div>
          <button 
            onClick={() => { setViewMode('dashboard'); setAppNotice(null); }} 
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-[14px] rounded-xl transition-all cursor-pointer ${
              viewMode === 'dashboard' 
                ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/30 shadow-sm shadow-sky-500/10' 
                : 'text-[#ececec] hover:bg-[#212121] hover:text-white border border-transparent'
            }`}
          >
            <LayoutDashboard className={`w-5 h-5 ${viewMode === 'dashboard' ? 'text-sky-400' : 'text-[#8e8e8e]'}`} /> Dashboard & Métricas
          </button>
          <button 
            onClick={() => { setViewMode('apps'); setAppNotice(null); }} 
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-[14px] rounded-xl transition-all cursor-pointer ${
              viewMode === 'apps' 
                ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/30 shadow-sm shadow-sky-500/10' 
                : 'text-[#ececec] hover:bg-[#212121] hover:text-white border border-transparent'
            }`}
          >
            <Grid className={`w-5 h-5 ${viewMode === 'apps' ? 'text-sky-400' : 'text-[#8e8e8e]'}`} /> Apps
          </button>
          <button 
            onClick={() => { setViewMode('chat'); setAppNotice(null); setPendingApp('tdr-cv'); navigate('/'); }} 
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-[14px] rounded-xl transition-all cursor-pointer ${
              (viewMode === 'chat' && (pendingApp === 'tdr-cv' || (!sessionId && currentApp === 'tdr-cv'))) 
                ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/30 shadow-sm shadow-sky-500/10' 
                : 'text-[#ececec] hover:bg-[#212121] hover:text-white border border-transparent'
            }`}
          >
            <FileText className={`w-5 h-5 ${(viewMode === 'chat' && (pendingApp === 'tdr-cv' || (!sessionId && currentApp === 'tdr-cv'))) ? 'text-sky-400' : 'text-[#8e8e8e]'}`} /> TDR vs CV
          </button>
        </div>

        {/* Recientes */}
        <div className="flex-1 overflow-y-auto px-3 mt-4 space-y-0.5 custom-scrollbar pb-4">
          <div className="text-[12px] font-semibold text-[#8e8e8e] px-3 mb-2">Recientes</div>
          {sessions.map(s => {
            const isActive = s.id === sessionId && viewMode === 'chat';
            return (
              <div
                key={s.id}
                onClick={() => {
                  if (editingSessionId !== s.id) {
                    setViewMode('chat');
                    navigate(`/c/${s.id}`);
                  }
                }}
                className={`group w-full pl-3 pr-2 py-2.5 text-[14px] rounded-lg transition-colors cursor-pointer flex items-center justify-between border-l-2 select-none ${
                  isActive 
                    ? 'bg-[#212121] text-sky-300 font-medium border-sky-400 shadow-sm' 
                    : 'text-[#ececec] hover:bg-[#212121] hover:text-white border-transparent'
                }`}
              >
                {editingSessionId === s.id ? (
                  <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEditSession(s.id); }}
                      className="flex-1 bg-[#131314] text-white px-2 py-1 rounded outline-none border border-[#303030] text-sm"
                      autoFocus
                    />
                    <button type="button" onClick={() => saveEditSession(s.id)} className="text-emerald-500 hover:text-emerald-400 cursor-pointer p-1"><Check className="w-4 h-4"/></button>
                    <button type="button" onClick={() => setEditingSessionId(null)} className="text-[#8e8e8e] hover:text-white cursor-pointer p-1"><X className="w-4 h-4"/></button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 truncate mr-2">
                      <span className="truncate block">{s.title}</span>
                    </div>
                    <div 
                      className={`relative transition-opacity flex items-center ${activeDropdown === s.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    >
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown === s.id ? null : s.id);
                        }} 
                        onBlur={() => setTimeout(() => setActiveDropdown(null), 200)}
                        className="p-1 text-[#8e8e8e] hover:text-white hover:bg-[#303030] rounded cursor-pointer transition-colors"
                        title="Opciones"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {activeDropdown === s.id && (
                        <div className="absolute right-0 top-full mt-1 bg-[#282a2d] border border-[#303030] rounded-lg shadow-xl z-50 overflow-hidden w-32 py-1">
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditingSessionId(s.id); setEditTitle(s.title); setActiveDropdown(null); }}
                            className="w-full text-left px-3 py-2 text-[13px] text-[#e3e3e3] hover:bg-[#3c4043] flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Edit2 className="w-4 h-4" /> Editar
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); deleteSession(s.id); setActiveDropdown(null); }}
                            className="w-full text-left px-3 py-2 text-[13px] text-red-400 hover:bg-[#3c4043] flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-4 h-4" /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom User Profile */}
        <div className="p-3 mt-auto">
          <div className="w-full flex items-center justify-between p-2 rounded-xl transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center font-bold text-sm text-white shadow-sm">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-medium text-white truncate max-w-[100px]">{user.username}</span>
                <span className="text-[12px] text-[#8e8e8e]">{user.area || 'Admin'}</span>
              </div>
            </div>
            <button 
              onClick={handleLogout} 
              className="p-2 text-[#8e8e8e] hover:bg-[#212121] hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Main Content Area */}
      <div 
        ref={containerRef}
        className="flex-1 flex overflow-hidden relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag & Drop Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-[#131314]/90 backdrop-blur-sm border-2 border-dashed border-blue-500 rounded-2xl m-4 flex flex-col items-center justify-center pointer-events-none transition-all duration-200">
            <div className="bg-[#1e1f20] p-6 rounded-full mb-4 shadow-lg shadow-blue-500/20 animate-bounce">
              <FileText className="w-12 h-12 text-blue-400" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">Suelta tus PDFs aquí</h3>
            <p className="text-[#8e8e8e]">Los agregaremos a tu mensaje actual para analizarlos.</p>
          </div>
        )}

        <div className={`flex flex-col relative h-full ${selectedPdfUrl ? 'border-r border-[#303030]' : 'w-full'}`} style={{ width: selectedPdfUrl ? `calc(${100 - pdfWidth}% - 3px)` : '100%' }}>
        
        {/* Open sidebar button (desktop) */}
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="hidden md:flex absolute top-4 left-4 z-50 p-2 text-[#8e8e8e] hover:text-white bg-[#171717] hover:bg-[#212121] border border-[#303030] rounded-lg shadow-md transition-colors"
            title="Abrir panel lateral"
          >
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
          </button>
        )}

        {/* Header Mobile */}
        <div className="md:hidden p-4 flex items-center gap-2 bg-[#131314] shrink-0 border-b border-[#282a2d]">
           <button onClick={() => navigate('/')}><Plus className="w-5 h-5"/></button>
           <span className="font-medium text-sm">Auditor IA</span>
        </div>

        {/* Dynamic Glow Background for Empty State */}
        {isEmpty && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
             <div className="w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[120px] opacity-60 mix-blend-screen"></div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 flex flex-col">
          {viewMode === 'dashboard' ? (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
              <Dashboard 
                user={user} 
                onBackToChat={() => setViewMode('chat')}
                onSelectSession={(targetId) => {
                  setViewMode('chat');
                  navigate(`/c/${targetId}`);
                }}
              />
            </div>
          ) : viewMode === 'apps' ? (
            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar max-w-5xl mx-auto w-full space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#2d2d30]">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                    <Grid className="w-6 h-6 text-sky-400" /> Catálogo de Aplicaciones IA
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Módulos especializados para auditorías públicas, contrataciones y evaluación de expedientes.
                  </p>
                </div>
                <button 
                  onClick={() => setViewMode('chat')} 
                  className="text-xs text-slate-300 hover:text-white bg-[#212121] hover:bg-[#2f2f2f] px-3 py-1.5 rounded-lg border border-[#303030] hover:border-sky-500/40 transition-colors"
                >
                  ← Volver al Chat
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Card TDR vs CV */}
                <div 
                  onClick={() => { setViewMode('chat'); setPendingApp('tdr-cv'); setAppNotice(null); navigate('/'); }}
                  className="bg-[#1e1f20] hover:bg-[#252528] border border-[#303030] hover:border-sky-500/50 p-6 rounded-2xl cursor-pointer transition-all shadow-sm group"
                >
                  <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20 group-hover:scale-105 transition-transform mb-4">
                    <FileText className="w-6 h-6 text-sky-400" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-white group-hover:text-sky-300 transition-colors">TDR vs CV</h3>
                    <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">Activo</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Auditoría exhaustiva de Términos de Referencia, detección de vicios ocultos y cruce automatizado con currículums de postulantes.
                  </p>
                  <span className="text-xs text-sky-400 group-hover:text-sky-300 font-medium inline-flex items-center gap-1">
                    Iniciar Asistente →
                  </span>
                </div>

                {/* Card Auditoría de Contratos */}
                <div className="bg-[#1e1f20]/60 border border-[#2b2b2e] p-6 rounded-2xl opacity-75">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mb-4">
                    <Scale className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-300">Auditoría de Contratos</h3>
                    <span className="text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full">Próximamente</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    Revisión automática de adendas, penalidades, garantías y cumplimiento de cláusulas contractuales.
                  </p>
                  <span className="text-xs text-slate-500 font-medium">Disponible pronto</span>
                </div>

                {/* Card Resumen de Informes */}
                <div className="bg-[#1e1f20]/60 border border-[#2b2b2e] p-6 rounded-2xl opacity-75">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 mb-4">
                    <ChartColumn className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-300">Resumen de Informes</h3>
                    <span className="text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full">Próximamente</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    Extracción de conclusiones, recomendaciones e hitos en informes técnicos de gestión y rendición.
                  </p>
                  <span className="text-xs text-slate-500 font-medium">Disponible pronto</span>
                </div>
              </div>
            </div>
          ) : isEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 w-full">
              <h2 className="text-[32px] md:text-[40px] font-medium mb-8 text-center text-[#ececec] flex items-center justify-center gap-3">
                <Sparkles className="w-8 h-8 text-orange-400" /> Auditoría Inteligente
              </h2>

              {renderAppWelcome()}
              {renderAppNotice()}
              
              {/* Input Box rendering in CENTER for empty state (Claude style) */}
              <div className="w-full max-w-[700px] px-4 md:px-0">
                 <form onSubmit={handleSend} className="relative w-full">
                   
                    {filesToUpload.length > 0 && (
                      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 px-4">
                        {filesToUpload.map((f, i) => (
                          <div key={i} className="bg-[#2f2f2f] text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm border border-[#404040]">
                            <FileText className="w-3 h-3 text-sky-400" />
                            <span className="truncate max-w-[120px]">{f.name}</span>
                            <button type="button" onClick={() => setFilesToUpload(prev => prev.filter((_, idx) => idx !== i))} className="text-[#8e8e8e] hover:text-white ml-1">&times;</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-[#171717] rounded-3xl p-2 pr-3 flex flex-col gap-2 shadow-md border border-[#303030] focus-within:border-[#5f6368] transition-colors relative min-h-[120px]">
                      <textarea
                        ref={textareaRef}
                        value={inputMsg}
                        onChange={handleTextareaInput}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder={isDedicatedApp ? `Adjunta documentos o escribe tu consulta (${activeApp.name})...` : '¿En qué puedo ayudarte hoy?'}
                        className="w-full bg-transparent text-[#e3e3e3] placeholder-[#8e8e8e] border-0 outline-none focus:ring-0 resize-none px-4 pt-4 text-[16px] h-[60px]"
                      />

                      <div className="flex items-center justify-between px-2 pb-1">
                        <div className="flex items-center gap-2">
                          <input type="file" id="file-upload-center" multiple accept=".pdf" style={{ display: 'none' }} onChange={handleFileSelect} />
                          <button type="button" onClick={() => document.getElementById('file-upload-center').click()} className="p-2 text-[#b4b4b4] hover:bg-[#2f2f2f] rounded-full transition-colors shrink-0 flex items-center justify-center">
                            <Plus className="w-5 h-5" />
                          </button>
                          <span className={`text-xs px-2 py-1 rounded-md border ${isDedicatedApp ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-[#8e8e8e] bg-[#212121] border-[#303030]'}`}>
                            {isDedicatedApp ? `App: ${activeApp.name}` : 'Chat libre'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isGenerating ? (
                            <button type="button" onClick={handleStop} className="p-2 bg-[#303030] text-[#e3e3e3] hover:bg-[#3c4043] rounded-full transition-colors shrink-0 flex items-center justify-center">
                              <Square className="w-4 h-4" fill="currentColor" />
                            </button>
                          ) : (
                            <button type="submit" disabled={!inputMsg.trim() && filesToUpload.length === 0} className="p-2 bg-white text-black hover:bg-gray-200 disabled:bg-[#303030] disabled:text-[#8e8e8e] rounded-full transition-colors shrink-0 flex items-center justify-center">
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                 </form>

                 {/* Claude-style pill buttons below input */}
                 <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                    {apps.filter(a => a.id !== 'general').map(a => {
                      const meta = APP_ICONS[a.id] || DEFAULT_APP_ICON;
                      const Icon = meta.icon;
                      const soon = a.status !== 'active';
                      const selected = !sessionId && pendingApp === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          disabled={soon}
                          title={a.description}
                          onClick={() => { setPendingApp(a.id); setAppNotice(null); textareaRef.current?.focus(); }}
                          className={`flex items-center gap-2 border text-[#ececec] text-[13px] px-4 py-2 rounded-full transition-colors ${
                            selected ? 'bg-[#2f2f2f] border-emerald-500/50' : 'bg-[#171717] hover:bg-[#2f2f2f] border-[#303030]'
                          } ${soon ? 'opacity-60 cursor-not-allowed hover:bg-[#171717]' : ''}`}
                        >
                          <Icon className={`w-4 h-4 ${meta.color}`} /> {a.name}
                          {soon && <span className="text-[10px] text-[#8e8e8e] bg-[#212121] border border-[#303030] px-1.5 py-0.5 rounded-full">Pronto</span>}
                        </button>
                      );
                    })}
                    <button 
                      type="button"
                      onClick={() => setViewMode('dashboard')}
                      className="flex items-center gap-2 bg-[#171717] hover:bg-[#212121] border border-[#303030] hover:border-sky-500/40 text-[#ececec] hover:text-sky-300 text-[13px] px-4 py-2 rounded-full transition-all cursor-pointer shadow-sm"
                    >
                      <LayoutDashboard className="w-4 h-4 text-sky-400" /> Ir al Dashboard
                    </button>
                    <button className="flex items-center gap-2 bg-[#171717] hover:bg-[#2f2f2f] border border-[#303030] text-[#ececec] text-[13px] px-4 py-2 rounded-full transition-colors">
                      <Search className="w-4 h-4 text-orange-400" /> Consultar Normativa
                    </button>
                 </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8 space-y-8 pb-32">
              {messages.map((msg, i) => (
                <div key={i} className={`group flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-transparent flex-shrink-0 flex items-center justify-center mt-1">
                      <Sparkles className="w-6 h-6 text-blue-400" />
                    </div>
                  )}
                  <div className={`${
                    msg.role === 'user' ? 'max-w-[85%]' : 'flex-1 min-w-0'
                  }`}>
                    {/* File attachment cards for user messages */}
                    {msg.role === 'user' && msg.attachments && (typeof msg.attachments === 'string' ? JSON.parse(msg.attachments) : msg.attachments).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 justify-end">
                        {(typeof msg.attachments === 'string' ? JSON.parse(msg.attachments) : msg.attachments).map((fname, fi) => (
                          <div 
                            key={fi} 
                            onClick={() => handleViewPdf(fname)}
                            className="flex items-center gap-2.5 bg-[#1e3a5f] hover:bg-[#254673] cursor-pointer border border-[#2d5a8a] px-4 py-2.5 rounded-xl shadow-sm transition-colors"
                          >
                            <div className="w-8 h-8 bg-[#e74c3c] rounded-lg flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-[10px] font-bold">PDF</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[13px] text-white font-medium truncate max-w-[180px]">{fname}</span>
                              <span className="text-[11px] text-[#8eb8e0]">Documento adjunto</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col gap-1 w-full max-w-full">
                      {inlineEditingIndex === i ? (
                        <div className="bg-[#282a2d] p-3 rounded-2xl rounded-tr-sm w-full max-w-3xl">
                          <textarea
                            value={inlineEditingContent}
                            onChange={(e) => setInlineEditingContent(e.target.value)}
                            className="w-full bg-transparent text-[#e3e3e3] border-0 outline-none resize-none text-[15px] min-h-[80px]"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => setInlineEditingIndex(null)} className="px-3 py-1.5 text-xs text-[#8e8e8e] hover:bg-[#3c4043] rounded-lg transition-colors">Cancelar</button>
                            <button onClick={() => handleSaveInlineEdit(i)} className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">Guardar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div 
                            id={`msg-content-${i}`}
                            className={`px-5 py-3.5 text-[15px] leading-relaxed ${
                              msg.role === 'user' 
                                ? 'bg-[#282a2d] text-[#e3e3e3] rounded-2xl rounded-tr-sm inline-block whitespace-pre-wrap break-words' 
                                : 'bg-transparent md-body w-full'
                          }`}>
                            {msg.role === 'user' ? msg.content : <MarkdownView content={msg.content} />}
                          </div>
                          
                          {msg.role === 'user' && (
                            <div className="flex justify-end mt-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                              <button 
                                onClick={() => handleRetry(i)} 
                                className="flex items-center gap-1.5 text-xs text-[#8e8e8e] hover:text-[#e3e3e3] hover:bg-[#2f2f2f] transition-colors bg-[#212121] px-2.5 py-1.5 rounded-lg border border-[#303030]"
                                title="Reintentar este mensaje"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Reintentar
                              </button>
                              <button 
                                onClick={() => {
                                  setInlineEditingIndex(i);
                                  setInlineEditingContent(msg.content);
                                }} 
                                className="flex items-center gap-1.5 text-xs text-[#8e8e8e] hover:text-[#e3e3e3] hover:bg-[#2f2f2f] transition-colors bg-[#212121] px-2.5 py-1.5 rounded-lg border border-[#303030]"
                                title="Editar mensaje en este mismo lugar"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Editar
                              </button>
                            </div>
                          )}
                        </>
                      )}
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-2 mt-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleCopyHtml(`msg-content-${i}`, i)} className="flex items-center gap-1.5 text-xs text-[#8e8e8e] hover:text-[#e3e3e3] hover:bg-[#2f2f2f] transition-colors bg-[#212121] px-2.5 py-1.5 rounded-lg border border-[#303030]">
                            {copiedIndex === i ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />} {copiedIndex === i ? 'Copiado' : 'Copiar'}
                          </button>
                          <button onClick={() => handleDownloadPdf(`msg-content-${i}`, i)} className="flex items-center gap-1.5 text-xs text-[#8e8e8e] hover:text-white hover:bg-[#2f2f2f] transition-colors bg-[#212121] px-2.5 py-1.5 rounded-lg border border-[#303030]">
                            <Download className="w-3.5 h-3.5 text-red-400" /> Descargar PDF
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {renderAppNotice()}

              {stageInfo && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-full bg-transparent flex-shrink-0 flex items-center justify-center mt-1">
                    <Sparkles className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="px-5 py-3.5 bg-transparent text-[#e3e3e3] flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    <span className="text-sm text-[#a8a8a8]">{stageInfo.label}</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Input Area - Only shows if there are messages and not in dashboard or apps */}
        {!isEmpty && viewMode !== 'dashboard' && viewMode !== 'apps' && (
          <div className="shrink-0 w-full px-4 md:px-8 pb-6 pt-2 bg-gradient-to-t from-[#131314] via-[#131314] to-transparent relative z-20">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSend} className="relative">
                {filesToUpload.length > 0 && (
                  <div className="flex gap-2 mb-3 overflow-x-auto pb-1 px-2">
                    {filesToUpload.map((f, i) => (
                      <div key={i} className="bg-[#282a2d] text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm border border-[#3c4043]">
                        <FileText className="w-3 h-3 text-blue-400" />
                        <span className="truncate max-w-[120px]">{f.name}</span>
                        <button type="button" onClick={() => setFilesToUpload(prev => prev.filter((_, idx) => idx !== i))} className="text-[#8e8e8e] hover:text-white ml-1">&times;</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-[#171717] rounded-3xl p-2 pr-3 flex flex-col gap-2 shadow-md border border-[#303030] focus-within:border-[#5f6368] transition-colors">
                  <textarea
                    ref={textareaRef}
                    value={inputMsg}
                    onChange={handleTextareaInput}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Escribe tu consulta..."
                    className="w-full bg-transparent text-[#e3e3e3] placeholder-[#8e8e8e] border-0 outline-none focus:ring-0 resize-none px-4 pt-2 text-[15px] max-h-48"
                    rows="1"
                  />

                  <div className="flex items-center justify-between px-2 pb-1">
                    <div className="flex items-center gap-1">
                      <input type="file" id="file-upload-bottom" multiple accept=".pdf" style={{ display: 'none' }} onChange={handleFileSelect} />
                      <button type="button" onClick={() => document.getElementById('file-upload-bottom').click()} className="p-2 text-[#b4b4b4] hover:bg-[#2f2f2f] rounded-full transition-colors shrink-0 flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                      </button>
                      {isDedicatedApp && (
                        <span className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-md ml-1">App: {activeApp.name}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isGenerating ? (
                        <button type="button" onClick={handleStop} className="p-2 bg-[#303030] text-[#e3e3e3] hover:bg-[#3c4043] rounded-full transition-colors shrink-0 flex items-center justify-center">
                          <Square className="w-4 h-4" fill="currentColor" />
                        </button>
                      ) : (
                        <button type="submit" disabled={!inputMsg.trim() && filesToUpload.length === 0} className="p-2 bg-white text-black hover:bg-gray-200 disabled:bg-[#303030] disabled:text-[#8e8e8e] rounded-full transition-colors shrink-0 flex items-center justify-center">
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-center mt-3">
                  <span className="text-[11px] text-[#a8a8a8]">La IA puede cometer errores. Considera verificar la información importante.</span>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

        {/* PDF Preview Sidebar */}
        {selectedPdfUrl && (
          <>
            <div 
              className="w-1.5 cursor-col-resize hover:bg-blue-500 bg-[#303030] active:bg-blue-500 transition-colors z-50 shrink-0"
              onMouseDown={startResizing}
              title="Arrastra para cambiar el tamaño"
            />
            <div className="h-full bg-[#1e1f20] flex flex-col relative" style={{ width: `calc(${pdfWidth}% - 3px)` }}>
              <div className="h-[60px] flex items-center justify-between px-4 border-b border-[#303030] bg-[#131314] shrink-0">
              <span className="font-medium text-sm text-[#e3e3e3] truncate flex-1 flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-400" /> Previsualización de Documento
              </span>
              <button onClick={() => setSelectedPdfUrl(null)} className="p-2 hover:bg-[#282a2d] rounded-lg text-[#8e8e8e] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 w-full bg-[#3c4043] relative" style={{ pointerEvents: isResizing ? 'none' : 'auto' }}>
              <iframe src={selectedPdfUrl} className="w-full h-full border-0 absolute inset-0" title="PDF Preview" />
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
