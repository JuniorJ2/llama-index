import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import ChatView from './components/ChatView';

function App() {
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (authToken) {
      // Validate token
      fetch('/users/me', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      .then(res => {
        if (!res.ok) throw new Error("Invalid token");
        return res.json();
      })
      .then(data => setUser(data))
      .catch(() => {
        setAuthToken(null);
        localStorage.removeItem('authToken');
      });
    }
  }, [authToken]);

  if (!authToken) {
    return <Login setAuthToken={setAuthToken} setUser={setUser} />;
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-50">Cargando...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<ChatView user={user} authToken={authToken} />} />
        <Route path="/c/:sessionId" element={<ChatView user={user} authToken={authToken} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
