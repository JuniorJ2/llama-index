# 🏛️ Sistema Inteligente de Auditoría Documental y Contrataciones del Estado (TDR + CV)

> Plataforma corporativa basada en Inteligencia Artificial y RAG para la auditoría técnica de Términos de Referencia (TDR), calificación automatizada de Hojas de Vida (CV), contraste normativo con la Ley General de Contrataciones Públicas y asesoría institucional en tiempo real.

> [!IMPORTANT]
> **Documentación Técnica Detallada ("Por debajo"):**  
> Para consultar la ingeniería interna paso a paso (cómo lee el PDF, cómo opera el clasificador, cuándo usa vectores vs contexto íntegro, ventana de memoria de 12 mensajes, resumen a los 20 y cadena de respaldo de modelos), consulta el documento especializado:  
>  **[ARQUITECTURA_Y_PROCESOS.md](ARQUITECTURA_Y_PROCESOS.md)**

---

## 📌 Índice
1. [¿Qué hace este sistema? (Visión General)](#1-qué-hace-este-sistema-visión-general)
2. [Documentación Técnica y Procesos Internos](#2-documentación-técnica-y-procesos-internos)
3. [Aclaración de Repositorios: `llamaindex` vs `llamaindex-proyecto`](#3-aclaración-de-repositorios-llamaindex-vs-llamaindex-proyecto)
4. [Tecnologías Utilizadas (Tech Stack)](#4-tecnologías-utilizadas-tech-stack)
5. [Módulos y Funcionalidades Principales](#5-módulos-y-funcionalidades-principales)
6. [Gestión de Memoria y Ahorro de Tokens](#6-gestión-de-memoria-y-ahorro-de-tokens)
7. [Guía de Instalación Paso a Paso (Desde Cero)](#7-guía-de-instalación-paso-a-paso-desde-cero)
8. [Cómo Ejecutar el Sistema en Desarrollo](#8-cómo-ejecutar-el-sistema-en-desarrollo)
9. [Estructura del Proyecto](#9-estructura-del-proyecto)
10. [Cuentas de Acceso por Defecto](#10-cuentas-de-acceso-por-defecto)

---

## 1. ¿Qué hace este sistema? (Visión General)

El sistema resuelve uno de los cuellos de botella más críticos en la gestión pública y logística: la **elaboración deficiente de TDRs** y la **revisión manual de CVs de postulantes**.

Sus tres capacidades centrales son:
1. **Auditoría Exhaustiva de TDRs:** Detecta vicios ocultos, errores de digitación (ej. *"veinte"* en letras pero *"(40)"* en números), cronogramas desfasados respecto a la fecha real del servidor, inconsistencias aritméticas en los pagos (que sumen exactamente 100%) y omisiones frente a la **Plantilla Institucional Oficial** (`data/plantillas/TDR-FINALPLANTILLA.pdf`).
2. **Evaluación Objetiva de CVs frente a TDR:** Cruza el perfil requerido con el CV del postulante. Si el TDR exige experiencia computable *a partir de la colegiatura o título profesional*, la IA detecta la fecha del diploma, descarta experiencias anteriores y calcula con precisión mes a mes si cumple el perfil para sector público o privado.
3. **Asesor Normativo y Chat Libre con Internet en Tiempo Real:** Permite realizar consultas sobre la nueva **Ley N° 32069**, directivas del OSCE/OECE, SEACE y gestión de RRHH con conexión a Internet y fecha oficial del día. Además cuenta con **guardrails estrictos** que rechazan solicitudes ajenas (como recetas de cocina o entretenimiento).

---

## 2. Documentación Técnica y Procesos Internos

Si necesitas comprender **cómo funciona el sistema por debajo** (flujo de lectura de archivos, clasificación automática, cuotas de API de Google, ventana de 12 mensajes, resumen a partir de los 20 mensajes y arquitectura de streaming), consulta el manual técnico integral:

👉 **[📖 ARQUITECTURA_Y_PROCESOS.md](ARQUITECTURA_Y_PROCESOS.md)**

Contenido del manual técnico:
* **Pipeline de Ingestión y Extracción:** Cómo PyMuPDF lee texto digital y cómo activa Gemini OCR para diplomas y certificados escaneados.
* **Clasificación y Filtro:** Detección de `TDR`, `CV`, `CONTRATO`, `RECIBO`, `FACTURA`, `INFORME` y por qué el Chat Libre admite todo mientras las Apps especializadas rechazan tipos incompatibles.
* **Vector Store vs. Contexto Completo:** Por qué se usa `Gemini Embedding 1` solo para la plantilla oficial y se inyecta el texto íntegro en los CVs para no perder fechas de titulación.
* **Máquina de Estados de Prompting:** Cómo opera `_detect_mode` para alternar entre TDR, CV, matrices comparativas, ranking de candidatos y consultas generales.
* **Gestión de Memoria y Resumen Incremental:** Ventana activa de 12 mensajes y condensación automática a partir de los 20 mensajes en segundo plano.
* **Cadena de Respaldo Anticaídas:** Distribución de cuotas de 500 peticiones/día (`gemini-3.5-flash-lite` y `gemini-3.1-flash-lite`) frente a las 20 peticiones/día de `gemini-2.5-flash`.
* **Streaming SSE y Seguridad:** EventStream en tiempo real, roles RBAC y túnel seguro Cloudflare.

---

## 3. Aclaración de Repositorios: `llamaindex` vs `llamaindex-proyecto`

En tu computadora existen dos carpetas principales. Es importante entender qué es cada una:

| Carpeta | ¿Qué contiene? | ¿Se usa activamente? |
|---|---|---|
| **`d:\Usuario\SOPORTE\llamaindex-proyecto`** | **ESTE ES EL PROYECTO REAL.** Contiene el Backend (FastAPI), el Frontend (React/Vite), la Base de Datos, las plantillas oficiales, la lógica de negocio y los prompts. | **SÍ (Es el núcleo de la aplicación)**. Todo el desarrollo, base de datos y ejecución ocurre aquí. |
| **`d:\Usuario\SOPORTE\llamaindex`** | Es el repositorio oficial de código abierto de *LlamaIndex* clonado de GitHub. | **SÍ, pero solo como librería local:** En el archivo `pyproject.toml` (línea 10) se configuró para tomar `llama-index-core` directamente de esta carpeta. |

> 💡 **Nota para despliegue en otro servidor:** En un servidor nuevo de producción no necesitas clonar toda la carpeta `llamaindex`; simplemente se cambia en `pyproject.toml` la dependencia a `"llama-index-core (>=0.12.0)"` para que Poetry lo descargue de internet automáticamente.

---

## 4. Tecnologías Utilizadas (Tech Stack)

### Backend
- **Lenguaje:** Python 3.12
- **Framework API:** [FastAPI](https://fastapi.tiangolo.com/) (rápido, asíncrono y tipado con Pydantic)
- **Servidor ASGI:** Uvicorn con soporte de streaming SSE (*Server-Sent Events*)
- **Gestor de Paquetes:** Poetry (`pyproject.toml`)
- **Base de Datos & ORM:** SQLAlchemy + Alembic (por defecto SQLite `llamaindex.db`, configurable a PostgreSQL)
- **Seguridad y Auth:** JWT (*JSON Web Tokens*), contraseñas cifradas con `bcrypt`
- **Extracción de Documentos:** `PyMuPDF` (fitz) para PDFs digitales nativos + `Gemini Vision OCR` para páginas escaneadas y diplomas

### Frontend
- **Librería UI:** React 19 + Vite 8
- **Estilos:** TailwindCSS v4 + Iconos Lucide React
- **Renderizado Markdown:** React-Markdown + Remark-GFM + Rehype-Raw (diseñado para formatear tablas, chips interactivos y alertas visuales)
- **Consumo API:** EventSource / Fetch para Streaming SSE en tiempo real

### Inteligencia Artificial (Google Gemini)
- **`gemini-3.5-flash-lite`:** Motor principal titular para análisis RAG local, auditoría documental, extracción OCR en paralelo, clasificador, generación de títulos y resúmenes de memoria (500 consultas/día, ultrarrápido y con 1 millón de tokens de contexto).
- **`gemini-3.1-flash-lite`:** Respaldo primario automático independiente (otras 500 consultas/día) si el motor titular presenta saturación.
- **`gemini-2.5-flash` con Google Search Grounding:** Motor activo únicamente en el Chat Libre sin archivos, permitiendo búsquedas en internet y normativas al día.

---

## 5. Módulos y Funcionalidades Principales

### A) Ingestión Inteligente de Documentos y OCR Paralelo Etiquetado
- **Carga de Archivos:** Acepta PDFs de hasta 15 MB (hasta 3 archivos por tanda y 50 páginas por PDF).
- **Lectura Híbrida con Numeración Exacta de Página (`--- PÁGINA X ---`):**
  - Si una página tiene `>= 100` caracteres digitales (`MIN_CHARS_PER_PAGE=100`), se extrae al instante con su etiqueta `--- PÁGINA X ---`.
  - Si es una página escaneada/diploma (`< 100` caracteres), se procesa mediante **Gemini Vision OCR en lotes de 12 imágenes (`OCR_BATCH_SIZE=12`) ejecutando hasta 2 bloques en paralelo simultáneamente (`OCR_MAX_PARALLEL_BATCHES=2`)**, con pausa preventiva de `2.0s` (`OCR_BATCH_PAUSE_SEC=2.0`) únicamente si existe una segunda tanda (> 24 páginas escaneadas).
  - Todas las páginas (digitales y escaneadas) se reconstruyen en su orden real (`1..N`) conservando su marcador `--- PÁGINA X ---` para consultas exactas de ubicación de certificados.
- **Clasificador Automático:** Identifica si el PDF es un `TDR`, `CV`, `CONTRATO`, `INFORME` u `OTRO`.
- **Validación por Módulo (Hand-off):** Si en el módulo *TDR vs CV* subes una factura, el sistema la rechaza amablemente y te sugiere abrir el *Chat Libre*.

### B) Módulo TDR vs CV
1. **Auditoría de TDR Individual:**
   - Compara las secciones frente a `data/plantillas/TDR-FINALPLANTILLA.pdf`.
   - Distingue secciones obligatorias de las potestativas (rotuladas *"De corresponder"*, como Seguros u Otras Penalidades).
   - Revisa discrepancias de digitación (letras vs números).
   - Comprueba que la suma de porcentajes de pago sea exactamente 100%.
   - Inyecta la **fecha oficial del servidor** para detectar si el TDR tiene fechas vencidas o anacrónicas.
2. **Ficha de Postulante (Solo CV):**
   - Extrae datos personales, perfil profesional, cuadro de formación académica, experiencia laboral y certificaciones.
3. **Matriz Integrada (TDR + CV):**
   - Primero audita el TDR y luego califica requisito por requisito al candidato emitiendo el veredicto: `✅ CUMPLE`, `⚠️ CUMPLE PARCIALMENTE` o `❌ NO CUMPLE`.
4. **Comparativa entre Múltiples Candidatos:**
   - Si se suben 2 o más CVs a la sesión, genera un cuadro comparativo con ranking u orden de mérito.

### C) Chat Libre y Asesor Normativo
- Responde preguntas sobre contrataciones públicas y gestión institucional.
- **Salida a Internet:** Activa Google Search solo cuando no hay archivos adjuntos.
- **Guardrails de Seguridad:** Bloquea solicitudes ajenas (recetas de cocina, entretenimiento, tareas escolares) y previene inyecciones de prompt dentro de los PDFs.

---

## 6. Gestión de Memoria y Ahorro de Tokens

Para evitar agotar la cuota de la API en conversaciones largas, el sistema utiliza **Ventana Deslizante con Resumen Incremental**:
- **Ventana Activa:** Los últimos 12 mensajes siempre se envían íntegros al modelo.
- **Resumen Histórico:** A partir de los 20 mensajes, una tarea en segundo plano condensa los mensajes antiguos en un único párrafo en la base de datos (`history_summary`).
- **Ahorro:** Reduce el consumo de tokens entre un 85% y 90% por consulta. La memoria persiste intacta incluso si el usuario regresa después de semanas.

---

## 7. Guía de Instalación Paso a Paso (Desde Cero)

### Requisitos Previos:
- **Python:** Versión 3.12 (descargar de [python.org](https://www.python.org/downloads/))
- **Node.js:** Versión 18 o superior (descargar de [nodejs.org](https://nodejs.org/))
- **Poetry:** Gestor de dependencias de Python (`pip install poetry`)
- **API Key de Gemini:** Clave gratuita de [Google AI Studio](https://aistudio.google.com/)

---

### Paso 1: Clonar / Abrir el proyecto
Abre una terminal (PowerShell o CMD) en la carpeta del proyecto:
```bash
cd d:\Usuario\SOPORTE\llamaindex-proyecto
```

---

### Paso 2: Configurar las Variables de Entorno (`.env`)
Copia el archivo de ejemplo o edita el `.env`:
```bash
copy .env.example .env
```
Abre `.env` y asegúrate de colocar tu clave de Google Gemini:
```env
GEMINI_API_KEY=AIzaSy...tu_clave_aqui...
SECRET_KEY=un_secreto_super_seguro_para_jwt_en_produccion_cambiar
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
DATABASE_URL=sqlite:///./llamaindex.db

# Parámetros opcionales de Extracción y OCR (valores por defecto optimizados para Free Tier)
MIN_CHARS_PER_PAGE=100
OCR_BATCH_SIZE=12
OCR_MAX_PARALLEL_BATCHES=2
OCR_BATCH_PAUSE_SEC=2.0
```

---

### Paso 3: Instalar dependencias del Backend (Python)
Con Poetry instalado, ejecuta:
```bash
poetry install
```
*(Esto creará el entorno virtual e instalará FastAPI, PyMuPDF, SQLAlchemy, LlamaIndex y Gemini).*

---

### Paso 4: Instalar dependencias del Frontend (React/Vite)
Ingresa a la carpeta `frontend` e instala los paquetes de Node:
```bash
cd frontend
npm install
cd ..
```

---

## 8. Cómo Ejecutar el Sistema en Desarrollo

Para usar la aplicación necesitas tener corriendo **dos terminales**:

### Terminal 1: Iniciar el Backend (FastAPI)
Desde la raíz `d:\Usuario\SOPORTE\llamaindex-proyecto`:
```bash
poetry run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- La API estará lista en: `http://127.0.0.1:8000`
- Documentación interactiva Swagger: `http://127.0.0.1:8000/docs`

### Terminal 2: Iniciar el Frontend (React + Vite)
Desde la carpeta `frontend`:
```bash
cd frontend
npm run dev
```
- La aplicación abrirá en: **`http://localhost:5173`**

---

### (Opcional) Compartir la aplicación por Internet con Túnel
El proyecto incluye el ejecutable oficial `cloudflared.exe`. Para crear un enlace público seguro HTTPS sin abrir puertos ni instalar nada adicional:
```bash
.\cloudflared.exe tunnel --url http://127.0.0.1:5173 --protocol http2 --edge-ip-version 4 --no-autoupdate
```
*(O simplemente dale doble clic al archivo `iniciar_tunel.bat` en la raíz del proyecto).*

La consola te entregará una URL como `https://xxxxx.trycloudflare.com` que puedes compartir con cualquier persona.

---

## 9. Estructura del Proyecto

```text
llamaindex-proyecto/
├── app/
│   ├── main.py                    # Punto de entrada FastAPI, CORS, autenticación y arranque
│   ├── database.py                # Conexión SQLAlchemy y sesión de base de datos
│   ├── models_db.py               # Modelos de BD (User, ChatSession, ChatMessage, SessionDocument)
│   ├── models.py                  # Esquemas Pydantic para validación de datos
│   ├── auth.py                    # Cifrado de contraseñas (bcrypt) y tokens JWT
│   ├── routers/
│   │   ├── sessions.py            # Rutas de sesiones, subida de PDFs y chat en streaming
│   │   └── apps.py                # Catálogo de aplicaciones del sistema
│   └── services/
│       ├── analyzer.py            # Auditorías base de documentos
│       ├── apps.py                # Reglas de compatibilidad y hand-off entre módulos
│       ├── classifier.py          # Clasificador automático de documentos con Gemini
│       ├── context_builder.py     # Ensamblador de prompts, inyección de fecha y guardrails
│       ├── extraction.py          # Extracción PyMuPDF y OCR por lotes con Gemini Vision
│       ├── indexer.py             # Configuración LlamaIndex y carga de plantillas oficiales
│       └── streaming.py           # Generador SSE y conexión a Google Search Grounding
├── data/
│   ├── plantillas/                # Plantillas institucionales oficiales (TDR-FINALPLANTILLA.pdf)
│   └── uploads/                   # Archivos PDF subidos durante las sesiones de chat
├── frontend/
│   ├── src/                       # Código fuente React (MarkdownView, Sidebar, Chat, etc.)
│   ├── package.json               # Dependencias de Vite, React y TailwindCSS
│   └── vite.config.js             # Configuración del servidor y proxy hacia backend:8000
├── alembic/                       # Migraciones de base de datos
├── pyproject.toml                 # Dependencias del Backend gestionadas con Poetry
├── cloudflared.exe                # Binario de túnel seguro para compartir la aplicación
└── llamaindex.db                  # Base de datos SQLite local
```

---

## 10. Cuentas de Acceso por Defecto y Niveles de Usuario (RBAC)

El sistema cuenta con **Control de Acceso Basado en Roles (RBAC)** en 3 niveles, con métricas del Dashboard adaptadas a cada perfil:

| Usuario | Contraseña | Rol (`role`) | Área (`area`) | Alcance en el Dashboard |
|---|---|---|---|---|
| **`admin`** | `admin123` | `admin` (Administrador) | Sistemas | **Global:** Supervisión total de todas las áreas, métricas globales de IA y gestión de usuarios. |
| **`jefe_rrhh`** | `jefe123` | `jefe_area` (Jefe de Área) | RRHH | **Departamental:** Métricas y documentos de todos los colaboradores de RRHH. |
| **`rrhh`** | `rrhh123` | `empleado` (Analista) | RRHH | **Individual:** Métricas y expedientes propios únicamente. |
| **`jefe_logistica`** | `jefe123` | `jefe_area` (Jefe de Área) | Logística | **Departamental:** Supervisión exclusiva del área de Logística. |
| **`logistica`** | `logistica123` | `empleado` (Analista) | Logística | **Individual:** Métricas propias de Logística. |
