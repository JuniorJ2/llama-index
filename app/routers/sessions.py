import os
import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.models_db import User, ChatSession, ChatMessage, SessionDocument
from app.auth import get_current_active_user
from app.models import (
    SessionCreate, SessionOut, SessionListResponse, 
    SessionDetailResponse, ChatMessageOut, UnifiedChatRequest
)
from app.services.extraction import extract_document, MAX_FILE_SIZE_MB, MAX_FILES_PER_MESSAGE
from app.services.classifier import classify_many
from app.services.streaming import (
    sse_stage, sse_token, sse_done, sse_error, generate_gemini_stream
)
from app.services.context_builder import (
    build_context_prompt, update_history_summary_background, 
    remove_session_index, get_or_create_session_index
)
from app.services.extraction import get_genai_client
from app.services.apps import is_valid_app, is_dedicated, is_compatible, build_incompatibility_notice

MAX_MESSAGE_CHARS = int(os.environ.get("MAX_MESSAGE_CHARS", "4000"))

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

def get_user_session(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)) -> ChatSession:
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    return session

def _db_session_to_out(session: ChatSession) -> SessionOut:
    return SessionOut(
        id=session.id,
        app_type=session.app_type,
        title=session.title,
        created_at=session.created_at.isoformat() if session.created_at else "",
        updated_at=session.updated_at.isoformat() if session.updated_at else "",
        has_documents=len(session.documents) > 0
    )

@router.get("", response_model=SessionListResponse)
async def list_sessions(search: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    query = db.query(ChatSession).filter(ChatSession.user_id == current_user.id)
    if search:
        query = query.filter(
            (ChatSession.title.ilike(f"%{search}%")) |
            (ChatSession.messages.any(ChatMessage.content.ilike(f"%{search}%")))
        )
    sessions = query.order_by(ChatSession.updated_at.desc()).limit(30).all()
    return SessionListResponse(sessions=[_db_session_to_out(s) for s in sessions])

@router.post("", response_model=SessionOut)
async def create_session(data: SessionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if not is_valid_app(data.app_type):
        raise HTTPException(status_code=400, detail=f"App desconocida: {data.app_type}")
    new_session = ChatSession(
        user_id=current_user.id,
        app_type=data.app_type,
        title="Nueva conversación",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return _db_session_to_out(new_session)

@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session(session: ChatSession = Depends(get_user_session)):
    messages_out = []
    # Sort by ID or created_at
    for msg in sorted(session.messages, key=lambda m: m.id):
        messages_out.append(ChatMessageOut(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            attachments=msg.attachments,
            created_at=msg.created_at.isoformat() if msg.created_at else ""
        ))
    return SessionDetailResponse(
        session=_db_session_to_out(session),
        messages=messages_out
    )

@router.delete("/{session_id}")
async def delete_session(session: ChatSession = Depends(get_user_session), db: Session = Depends(get_db)):
    # Remove files from disk
    for doc in session.documents:
        if doc.file_path and os.path.exists(doc.file_path):
            try:
                os.remove(doc.file_path)
            except Exception:
                pass
    remove_session_index(session.id)
    db.delete(session)
    db.commit()
    return {"status": "ok"}

@router.patch("/{session_id}")
async def update_session_title(session_id: str, title: str = Form(...), session: ChatSession = Depends(get_user_session), db: Session = Depends(get_db)):
    session.title = title
    db.commit()
    return {"status": "ok"}

@router.put("/{session_id}/messages/{message_id}")
async def update_message_content(
    session_id: str, 
    message_id: int, 
    content: str = Form(...),
    session: ChatSession = Depends(get_user_session), 
    db: Session = Depends(get_db)
):
    msg = db.query(ChatMessage).filter(
        ChatMessage.id == message_id, 
        ChatMessage.session_id == session.id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    msg.content = content
    
    # Truncate conversation: delete all messages in this session after the edited one
    db.query(ChatMessage).filter(
        ChatMessage.session_id == session.id,
        ChatMessage.id > message_id
    ).delete(synchronize_session=False)
    
    db.commit()
    return {"status": "ok", "content": content}

@router.post("/{session_id}/upload")
async def upload_documents_stream(
    session: ChatSession = Depends(get_user_session),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    if len(files) > MAX_FILES_PER_MESSAGE:
        raise HTTPException(status_code=400, detail=f"Máximo {MAX_FILES_PER_MESSAGE} archivos permitidos.")

    async def stream_generator():
        try:
            yield await sse_stage("leyendo", "Leyendo documentos...", "start")
            
            extracted_results = []
            for f in files:
                bytes_content = await f.read()
                try:
                    text, method, pages = await extract_document(f.filename, bytes_content)
                    extracted_results.append({
                        "filename": f.filename,
                        "text": text,
                        "method": method,
                        "pages": pages,
                        "bytes": bytes_content
                    })
                except Exception as e:
                    yield await sse_error(f"Error en {f.filename}: {str(e)}")
                    return
                    
            yield await sse_stage("leyendo", "Documentos leídos correctamente.", "done")
            yield await sse_stage("clasificando", "Clasificando documentos...", "start")
            
            texts_to_classify = [res["text"] for res in extracted_results]
            classifications = await classify_many(texts_to_classify)
            
            yield await sse_stage("clasificando", "Documentos clasificados.", "done")

            # Apps dedicadas: solo se aceptan los tipos que les corresponden.
            # El Chat Libre (general) acepta todo.
            accepted_pairs = []
            rejected_pairs = []
            for res, classification in zip(extracted_results, classifications):
                if not is_dedicated(session.app_type) or is_compatible(session.app_type, classification):
                    accepted_pairs.append((res, classification))
                else:
                    rejected_pairs.append((res["filename"], classification.get("type", "DESCONOCIDO")))

            notice = None
            suggested_actions = None
            if rejected_pairs:
                notice, suggested_actions = build_incompatibility_notice(
                    session.app_type, rejected_pairs, len(accepted_pairs)
                )

            if not accepted_pairs:
                # Nada que guardar: se avisa al usuario y termina el flujo
                yield await sse_done(
                    session_title=session.title,
                    suggested_actions=suggested_actions,
                    notice=notice,
                    accepted_count=0,
                    rejected_files=[name for name, _ in rejected_pairs],
                )
                return

            yield await sse_stage("indexando", "Guardando y procesando...", "start")
            
            docs_to_save = []
            for res, classification in accepted_pairs:
                doc_type = classification.get("type", "DESCONOCIDO")
                
                # In a real app we might save to S3 or a secure local dir
                file_path = f"data/uploads/{session.id}_{res['filename']}"
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                with open(file_path, "wb") as disk_file:
                    disk_file.write(res["bytes"])
                    
                new_doc = SessionDocument(
                    session_id=session.id,
                    filename=res["filename"],
                    doc_type=doc_type,
                    extracted_text=res["text"],
                    extraction_method=res["method"],
                    page_count=res["pages"],
                    file_path=file_path,
                    uploaded_at=datetime.now(timezone.utc)
                )
                db.add(new_doc)
                docs_to_save.append(new_doc)
                
            session.updated_at = datetime.now(timezone.utc)
            db.commit()
            
            # Nota: Ya no generamos Embeddings (VectorStoreIndex) para los documentos de la sesión
            # porque Gemini 1.5 Flash tiene 1 millón de tokens de contexto, así que inyectamos el
            # texto completo del CV directamente en el prompt. Esto ahorra cuota de Embeddings (Error 429).
            remove_session_index(session.id)
            
            yield await sse_stage("indexando", "Archivos procesados correctamente.", "done")
            yield await sse_done(
                session_title=session.title,
                suggested_actions=suggested_actions,
                notice=notice,
                accepted_count=len(accepted_pairs),
                rejected_files=[name for name, _ in rejected_pairs],
            )
            
        except Exception as e:
            yield await sse_error(f"Error inesperado: {str(e)}")
            
    return StreamingResponse(
        stream_generator(), 
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )

@router.post("/{session_id}/chat")
async def chat_stream(
    request: UnifiedChatRequest,
    session: ChatSession = Depends(get_user_session),
    db: Session = Depends(get_db)
):
    if len(request.message) > MAX_MESSAGE_CHARS:
        raise HTTPException(status_code=400, detail="El mensaje es demasiado largo.")
        
    if request.message.strip():
        user_msg = ChatMessage(
            session_id=session.id,
            role="user",
            content=request.message,
            attachments=request.attachments,
            created_at=datetime.now(timezone.utc)
        )
        db.add(user_msg)
        session.updated_at = datetime.now(timezone.utc)
        db.commit()
    
    # Background history summary
    asyncio.create_task(update_history_summary_background(db, session))

    async def stream_generator():
        try:
            # Emit stage immediately so frontend sees < 1s latency
            yield await sse_stage("generando", "Generando respuesta...", "start")
            
            # Launch title generation concurrently if needed
            title_task = None
            if session.title == "Nueva conversación":
                title_prompt = f"Genera un título muy corto (máximo 4 palabras) para esta conversación basándote en este mensaje. RESPONDE SOLO CON EL TÍTULO SIN COMILLAS NI TEXTO EXTRA:\n\nMensaje: {request.message}"
                def _sync_gen_title():
                    print("[LLM_CALL] Gemini API (generar título) solicitada.")
                    client = get_genai_client()
                    for t_model in ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash"]:
                        try:
                            return client.models.generate_content(model=t_model, contents=title_prompt)
                        except Exception as e:
                            print(f"[LLM_CALL] Fallback en título ({t_model}) falló: {e}")
                            continue
                    return None
                title_task = asyncio.create_task(asyncio.to_thread(_sync_gen_title))

            # Build context (RAG embeddings) in a thread so it doesn't block the async loop
            is_audit = "auditar" in request.message.lower() or "comparar" in request.message.lower()
            prompt = await asyncio.to_thread(build_context_prompt, session, request.message, is_audit, request.attachments)
                        
            client = get_genai_client()
            full_response = ""
            
            # Solo el Chat Libre sin documentos adjuntos (modo Asesor normativo/conversacional) usa Google Search Grounding.
            # Todas las Apps dedicadas (tdr-cv, contracts, reports) y auditorías con archivos funcionan 100% locales sin internet.
            is_chat_libre = (session.app_type or "general") == "general"
            has_no_docs = len(session.documents or []) == 0
            enable_search = is_chat_libre and has_no_docs
            model_to_use = "gemini-2.5-flash" if enable_search else "gemini-3.5-flash-lite"
            
            print(f"[LLM_CALL] Gemini API ({model_to_use}, search={enable_search}) solicitada.")
            async for token in generate_gemini_stream(client, model_to_use, prompt, enable_search=enable_search):
                full_response += token
                yield await sse_token(token)
                
            yield await sse_stage("generando", "Respuesta completada.", "done")
            
            # Await title if it was launched
            title = session.title
            if title_task:
                try:
                    title_resp = await title_task
                    if title_resp is not None and title_resp.text:
                        title = title_resp.text.strip().replace('"', '').split('\n')[0][:50]
                    else:
                        title = request.message[:30] + ("..." if len(request.message) > 30 else "")
                    session.title = title
                except Exception as e:
                    print(f"Error generating title: {e}")
                    title = request.message[:30] + ("..." if len(request.message) > 30 else "")
                    session.title = title
            
            # Save assistant message
            asst_msg = ChatMessage(
                session_id=session.id,
                role="assistant",
                content=full_response,
                created_at=datetime.now(timezone.utc)
            )
            db.add(asst_msg)
            db.commit()
            
            # Emit done with the title (which will be updated in frontend)
            yield await sse_done(session_title=title, message_id=asst_msg.id)
            
        except asyncio.CancelledError:
            print("[INFO] Cliente desconectado (Stop). Guardando respuesta parcial...")
            if full_response.strip():
                asst_msg = ChatMessage(
                    session_id=session.id,
                    role="assistant",
                    content=full_response,
                    created_at=datetime.now(timezone.utc)
                )
                db.add(asst_msg)
                db.commit()
            raise
        except Exception as e:
            yield await sse_error(f"Error generando respuesta: {str(e)}")

    return StreamingResponse(
        stream_generator(), 
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )
