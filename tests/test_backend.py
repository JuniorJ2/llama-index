import pytest
import os
import asyncio
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.extraction import _sync_extract_pdf, ExtractionError, MAX_FILE_SIZE_MB, MAX_PAGES_PER_DOC
from app.services.classifier import _sync_classify_document, _clean_json_string
from app.services.context_builder import build_context_prompt, update_history_summary_background, SUMMARY_TRIGGER_MESSAGES
from app.models_db import ChatSession, ChatMessage, SessionDocument, User
from app.database import get_db, Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Setup test DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

# Helper to get auth token
def get_auth_headers(username="testuser"):
    db = TestingSessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if not user:
        from app.auth import get_password_hash
        user = User(username=username, hashed_password=get_password_hash("pass"), is_active=True)
        db.add(user)
        db.commit()
    db.close()
    
    response = client.post("/token", data={"username": username, "password": "pass"})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_clean_json_string():
    assert _clean_json_string('```json\n{"type": "TDR"}\n```') == '{"type": "TDR"}'
    assert _clean_json_string('```\n{"type": "CV"}\n```') == '{"type": "CV"}'
    assert _clean_json_string('Here is the json: {"type": "CV"}') == '{"type": "CV"}'

@patch("app.services.classifier.get_genai_client")
def test_classifier_logic(mock_client):
    # Empty text
    res = _sync_classify_document("")
    assert res["type"] == "DESCONOCIDO"
    assert not mock_client.called

    # Mock response
    mock_response = MagicMock()
    mock_response.text = '```json\n{"type": "TDR", "description": "Un TDR de prueba", "confidence": "alta"}\n```'
    
    mock_client_instance = MagicMock()
    mock_client_instance.models.generate_content.return_value = mock_response
    mock_client.return_value = mock_client_instance

    res = _sync_classify_document("Un texto suficientemente largo para clasificar y pasar la validación de 50 caracteres que tenemos puesta.")
    assert res["type"] == "TDR"
    assert res["confidence"] == "alta"


def test_extraction_validations():
    # Fake PDF signature
    fake_pdf = b"No es un pdf"
    with pytest.raises(ExtractionError, match="falta la firma %PDF"):
        _sync_extract_pdf("test.pdf", fake_pdf)

    # Size validation
    large_pdf = b"%PDF-1.4" + b"0" * (MAX_FILE_SIZE_MB * 1024 * 1024 + 100)
    with pytest.raises(ExtractionError, match="supera el tamaño máximo"):
        _sync_extract_pdf("test.pdf", large_pdf)

def test_security_session_isolation():
    headers1 = get_auth_headers("user1")
    headers2 = get_auth_headers("user2")

    # User 1 creates session
    res = client.post("/api/sessions", json={"app_type": "tdr-cv"}, headers=headers1)
    session_id = res.json()["id"]

    # User 2 tries to access it
    res_fail = client.get(f"/api/sessions/{session_id}", headers=headers2)
    assert res_fail.status_code == 404

    # User 2 tries to delete it
    res_del_fail = client.delete(f"/api/sessions/{session_id}", headers=headers2)
    assert res_del_fail.status_code == 404

@pytest.mark.asyncio
@patch("app.services.context_builder._sync_summarize_history")
async def test_context_builder_summary(mock_summarize):
    mock_summarize.return_value = "Resumen de prueba"
    
    db = TestingSessionLocal()
    user = db.query(User).first()
    session = ChatSession(id="test_sess", user_id=user.id, app_type="tdr-cv")
    db.add(session)
    
    # Add messages above threshold
    for i in range(SUMMARY_TRIGGER_MESSAGES + 5):
        msg = ChatMessage(session_id="test_sess", role="user", content=f"Msg {i}")
        db.add(msg)
    db.commit()
    
    await update_history_summary_background(db, session)
    
    assert session.history_summary == "Resumen de prueba"
    assert session.summarized_up_to_message_id is not None
    db.close()

from app.services.streaming import sse_stage, sse_token, format_sse
from app.models import StageEvent
import json

@pytest.mark.asyncio
async def test_sse_formatting():
    # Test Stage
    res = await sse_stage("leyendo", "Iniciando prueba", "start")
    assert res.startswith("event: stage\ndata: ")
    data = json.loads(res.split("data: ")[1].strip())
    assert data["stage"] == "leyendo"
    assert data["status"] == "start"

    # Test Token
    res_token = await sse_token("Hola")
    assert res_token.startswith("event: token\ndata: ")
    assert "Hola" in res_token

@patch("app.services.extraction.get_genai_client")
def test_ocr_fallback(mock_client):
    # Mock Gemini Flash for OCR
    mock_response = MagicMock()
    mock_response.text = "Texto extraido por OCR"
    mock_client_instance = MagicMock()
    mock_client_instance.models.generate_content.return_value = mock_response
    mock_client.return_value = mock_client_instance

    # PDF válido pero sin texto extraíble
    with patch("app.services.extraction.pymupdf.open") as mock_open:
        # Mock document and empty pages
        mock_doc = MagicMock()
        mock_doc.__len__.return_value = 1
        mock_doc.needs_pass = False
        mock_doc.is_encrypted = False
        mock_page = MagicMock()
        mock_page.get_text.return_value = ""
        mock_page.get_images.return_value = []
        # Support iterating over doc
        mock_doc.__iter__.return_value = iter([mock_page])
        mock_open.return_value = mock_doc
        
        pdf_content = b"%PDF-1.4\n" + b"A"*100 # Bypass signature and size
        with patch("app.services.extraction.perform_ocr_with_gemini", return_value="Texto extraido por OCR"):
            text, method, pages = _sync_extract_pdf("test.pdf", pdf_content)
        assert "Texto extraido por OCR" in text
        assert method == "ocr_gemini_hibrido"

@pytest.mark.asyncio
async def test_streaming_error_handling():
    # Test that the generator catches errors and emits an error event
    from app.services.streaming import generate_gemini_stream
    
    # Mock a client that raises an exception
    mock_client = MagicMock()
    mock_client.models.generate_content_stream.side_effect = Exception("API Caida")
    
    stream = generate_gemini_stream(mock_client, "model", "prompt")
    
    with pytest.raises(Exception, match="API Caida"):
        async for _ in stream:
            pass
