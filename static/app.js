let sessionId = null;
let authToken = localStorage.getItem('authToken');

// Elementos de Login
const loginSection = document.getElementById('login-section');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');

const uploadForm = document.getElementById('upload-form');
const submitBtn = document.getElementById('submit-btn');
const uploadLoader = document.getElementById('upload-loader');
const uploadSection = document.getElementById('upload-section');
const chatSection = document.getElementById('chat-section');
const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

// Verificar sesión al inicio
if (authToken) {
    checkSession();
}

async function checkSession() {
    try {
        const response = await fetch('/users/me', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const data = await response.json();
            showApp(data.username, data.area);
        } else {
            logout();
        }
    } catch (e) {
        logout();
    }
}

function showApp(username, area) {
    loginSection.style.display = 'none';
    appContainer.style.display = 'block';
    userInfo.textContent = `Bienvenido, ${username} | Área: ${area}`;
}

function logout() {
    authToken = null;
    localStorage.removeItem('authToken');
    loginSection.style.display = 'block';
    appContainer.style.display = 'none';
    chatSection.style.display = 'none';
    uploadSection.style.display = 'block';
    chatHistory.innerHTML = '';
}

logoutBtn.addEventListener('click', logout);

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    loginBtn.disabled = true;
    
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    try {
        const response = await fetch('/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        const data = await response.json();
        if (response.ok) {
            authToken = data.access_token;
            localStorage.setItem('authToken', authToken);
            showApp(username, data.area);
        } else {
            alert('Error: ' + data.detail);
        }
    } catch (e) {
        alert('Error conectando al servidor');
    }
    loginBtn.disabled = false;
});


uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const tdrFile = document.getElementById('tdr-file').files[0];
    const cvFile = document.getElementById('cv-file').files[0];
    
    if (!tdrFile || !cvFile) {
        alert('Por favor, selecciona ambos archivos PDF.');
        return;
    }
    
    const formData = new FormData();
    formData.append('tdr_file', tdrFile);
    formData.append('cv_file', cvFile);
    
    submitBtn.disabled = true;
    uploadLoader.style.display = 'block';
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = { detail: "Error del servidor: " + text.substring(0, 100) };
        }
        
        if (response.ok) {
            sessionId = data.session_id;
            
            chatSection.style.display = 'flex';
            uploadSection.style.display = 'none';
            
            addMessage('bot', '### 📝 Reporte de Auditoría (TDR)\n' + data.audit_report);
            addMessage('bot', '### 🤝 Comparación TDR vs CV\n' + data.comparison_report);
            
            addMessage('bot', 'El análisis inicial ha finalizado. Puedes hacerme preguntas adicionales sobre estos documentos en este chat.');
            
        } else {
            alert('Error: ' + data.detail);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Ocurrió un error al procesar los documentos.');
    } finally {
        submitBtn.disabled = false;
        uploadLoader.style.display = 'none';
    }
});

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message || !sessionId) return;
    
    addMessage('user', message);
    chatInput.value = '';
    sendBtn.disabled = true;
    
    // Add temporary loading message
    const tempId = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot';
    loadingDiv.id = tempId;
    loadingDiv.innerHTML = '<div class="loader" style="width: 20px; height: 20px; border-width: 3px; margin: 0;"></div>';
    chatHistory.appendChild(loadingDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    
    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                session_id: sessionId,
                message: message
            })
        });
        
        const data = await response.json();
        document.getElementById(tempId).remove();
        
        if (response.ok) {
            addMessage('bot', data.reply);
        } else {
            addMessage('bot', 'Error: ' + data.detail);
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById(tempId).remove();
        addMessage('bot', 'Ocurrió un error de conexión.');
    } finally {
        sendBtn.disabled = false;
        chatInput.focus();
    }
}

function addMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    
    // Use marked.js for bot responses (Markdown)
    if (sender === 'bot') {
        msgDiv.innerHTML = marked.parse(text);
    } else {
        msgDiv.textContent = text;
    }
    
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}
