import json
import asyncio
from typing import AsyncGenerator, List, Dict, Any, Optional
from pydantic import BaseModel
from app.models import StageEvent, TokenEvent, DoneEvent, ErrorEvent, SuggestedAction

def format_sse(event_type: str, data: BaseModel) -> str:
    """Format data as Server-Sent Event."""
    # We serialize the pydantic model to json
    return f"event: {event_type}\ndata: {data.model_dump_json()}\n\n"

async def sse_stage(stage: str, label: str, status: str) -> str:
    event = StageEvent(stage=stage, label=label, status=status)
    return format_sse("stage", event)

async def sse_token(text: str) -> str:
    event = TokenEvent(text=text)
    return format_sse("token", event)

async def sse_done(
    session_title: Optional[str] = None,
    suggested_actions: Optional[List[SuggestedAction]] = None,
    message_id: Optional[int] = None,
    notice: Optional[str] = None,
    accepted_count: Optional[int] = None,
    rejected_files: Optional[List[str]] = None,
) -> str:
    event = DoneEvent(
        session_title=session_title,
        suggested_actions=suggested_actions,
        message_id=message_id,
        notice=notice,
        accepted_count=accepted_count,
        rejected_files=rejected_files,
    )
    return format_sse("done", event)

async def sse_error(message: str) -> str:
    event = ErrorEvent(message=message)
    return format_sse("error", event)

def _sync_stream_gemini(client, model, contents, queue: asyncio.Queue, loop: asyncio.AbstractEventLoop, enable_search: bool = False):
    try:
        # Priorizamos modelos con cupo de 500 peticiones/día (Flash Lite) antes que los de 20/día
        if enable_search:
            fallback_models = ["gemini-2.5-flash", "gemini-3.5-flash"]
        else:
            fallback_models = [model, "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"]
        models_to_try = []
        for m in fallback_models:
            if m not in models_to_try:
                models_to_try.append(m)
                
        last_error = None
        for current_model in models_to_try:
            try:
                config = None
                if enable_search:
                    try:
                        from google.genai import types
                        config = types.GenerateContentConfig(
                            tools=[types.Tool(google_search=types.GoogleSearch())],
                            temperature=0.2
                        )
                    except Exception as cfg_err:
                        print(f"[SEARCH_CONFIG_WARN] No se pudo configurar google_search: {cfg_err}")
                        config = None

                response = client.models.generate_content_stream(model=current_model, contents=contents, config=config)
                for chunk in response:
                    if chunk.text:
                        asyncio.run_coroutine_threadsafe(queue.put({"type": "token", "text": chunk.text}), loop)
                asyncio.run_coroutine_threadsafe(queue.put({"type": "done"}), loop)
                return
            except Exception as e:
                err_str = str(e)
                print(f"[STREAM_WARN] Modelo {current_model} falló: {e}")
                last_error = e
                # Si el modelo falla por saturación (503), cuota (429) o no disponible (404), intentamos el siguiente fallback
                if any(k in err_str.lower() for k in ["503", "unavailable", "demand", "429", "quota", "resource_exhausted", "404", "not_found", "not found"]):
                    import time
                    time.sleep(1)
                    continue
                else:
                    raise e
        if last_error:
            err_str = str(last_error)
            if "429" in err_str or "quota" in err_str.lower() or "resource_exhausted" in err_str.lower():
                raise Exception("Límite de solicitudes de Gemini API alcanzado (Cuota 429). Por favor espera unos segundos e intenta nuevamente.")
            raise last_error
    except Exception as e:
        asyncio.run_coroutine_threadsafe(queue.put({"type": "error", "message": str(e)}), loop)

async def generate_gemini_stream(client, model, contents, enable_search: bool = False) -> AsyncGenerator[str, None]:
    """
    Yields text chunks from Gemini as they arrive, running the synchronous client in a thread.
    """
    queue = asyncio.Queue()
    loop = asyncio.get_running_loop()
    
    # Run the blocking stream in a background thread
    task = asyncio.create_task(asyncio.to_thread(_sync_stream_gemini, client, model, contents, queue, loop, enable_search))
    
    while True:
        item = await queue.get()
        if item["type"] == "token":
            yield item["text"]
        elif item["type"] == "error":
            raise Exception(item["message"])
        elif item["type"] == "done":
            break
