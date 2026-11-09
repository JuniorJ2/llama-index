from pydantic import BaseModel, Field
from typing import List, Optional, Literal

# --- Legacy (keep for compatibility until Paso 10) ---
class ChatRequest(BaseModel):
    session_id: str
    message: str

class ChatResponse(BaseModel):
    reply: str

class UploadResponse(BaseModel):
    session_id: str
    audit_report: str
    comparison_report: str

# --- Nuevos Modelos (PASO 2) ---

class SessionCreate(BaseModel):
    app_type: str = "general"

class SessionOut(BaseModel):
    id: str
    app_type: str
    title: str
    created_at: str
    updated_at: str
    has_documents: bool = False

class SessionListResponse(BaseModel):
    sessions: List[SessionOut]

class ChatMessageOut(BaseModel):
    id: Optional[int] = None
    role: str
    content: str
    attachments: Optional[str] = None
    created_at: str

class SessionDetailResponse(BaseModel):
    session: SessionOut
    messages: List[ChatMessageOut]

class SuggestedAction(BaseModel):
    label: str
    action: Literal["open_file_picker", "send_message", "new_session", "switch_app"]
    payload: Optional[str] = None

class UnifiedChatRequest(BaseModel):
    session_id: str
    message: str
    attachments: Optional[str] = None

class UnifiedChatResponse(BaseModel):
    reply: str
    session_title: Optional[str] = None
    suggested_actions: Optional[List[SuggestedAction]] = None

# --- Modelos de Eventos de Streaming (SSE) ---
class StageEvent(BaseModel):
    stage: Literal["leyendo", "clasificando", "indexando", "auditando", "comparando", "generando"]
    label: str
    status: Literal["start", "done"]

class TokenEvent(BaseModel):
    text: str

class DoneEvent(BaseModel):
    session_title: Optional[str] = None
    suggested_actions: Optional[List[SuggestedAction]] = None
    message_id: Optional[int] = None
    # Aviso cuando se suben documentos que no corresponden a la app dedicada actual
    notice: Optional[str] = None
    accepted_count: Optional[int] = None
    rejected_files: Optional[List[str]] = None

class ErrorEvent(BaseModel):
    message: str
