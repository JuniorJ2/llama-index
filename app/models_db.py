from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="empleado") # admin, empleado
    area = Column(String, default="RRHH") # RRHH, Logistica, Legal, etc.
    is_active = Column(Boolean, default=True)

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    app_type = Column(String, default="tdr-cv")  # "tdr-cv", "contracts", "reports", "general"
    title = Column(String, default="Nueva conversación")
    history_summary = Column(Text, nullable=True)
    summarized_up_to_message_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relaciones
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    documents = relationship("SessionDocument", back_populates="session", cascade="all, delete-orphan")
    user = relationship("User")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    role = Column(String)           # "user", "assistant", "system"
    content = Column(Text)          # El texto del mensaje
    attachments = Column(Text)      # JSON: [{"id": "...", "name": "TDR.pdf"}, ...]
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    session = relationship("ChatSession", back_populates="messages")

class SessionDocument(Base):
    __tablename__ = "session_documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    doc_type = Column(String, nullable=False) # TDR, CV, INFORME, CONTRATO, OTRO
    extracted_text = Column(Text, nullable=True)
    extraction_method = Column(String, nullable=True) # "texto" | "ocr_gemini"
    page_count = Column(Integer, nullable=True)
    file_path = Column(String, nullable=True) # PDF original en disco
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    session = relationship("ChatSession", back_populates="documents")
