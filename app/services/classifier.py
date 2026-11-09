import json
import asyncio
import re
from typing import Dict, List
from google import genai
from app.services.extraction import get_genai_client

MAX_CLASSIFICATION_CHARS = 3000

def _clean_json_string(text: str) -> str:
    """Intenta limpiar bloques de código o basura alrededor del JSON."""
    text = text.strip()
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if match:
        return match.group(1)
    
    # Try finding the first { and last }
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        return text[start:end+1]
    
    return text

def _sync_classify_document(text: str) -> Dict[str, str]:
    if not text or len(text.strip()) < 50:
        return {
            "type": "DESCONOCIDO",
            "description": "El documento está vacío o no tiene suficiente texto para clasificar.",
            "confidence": "baja"
        }
        
    client = get_genai_client()
    prompt = f"""
    Analiza el siguiente texto extraído de las primeras páginas de un documento y clasifícalo.
    Responde SOLAMENTE con un JSON válido con estas claves exactas:
    - "type": DEBE SER EXACTAMENTE UNO DE ["TDR", "CV", "CONTRATO", "ADENDA", "INFORME", "RECIBO", "FACTURA", "CERTIFICADO", "DESCONOCIDO"]
    - "description": descripción breve de qué trata el documento (máximo 1 línea)
    - "confidence": DEBE SER EXACTAMENTE UNA DE ["alta", "media", "baja"]

    Texto del documento:
    ---
    {text[:MAX_CLASSIFICATION_CHARS]}
    ---
    """
    
    CLASSIFIER_FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"]
    
    try:
        print(f"[LLM_CALL] Gemini API (clasificador) solicitada para texto de {len(text)} caracteres.")
        
        response = None
        last_error = None
        for model in CLASSIFIER_FALLBACK_MODELS:
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt
                )
                break
            except Exception as e:
                err_str = str(e)
                print(f"[CLASSIFY_RETRY] Modelo {model} falló ({e}). Intentando siguiente...")
                last_error = e
                if any(k in err_str.lower() for k in ["503", "unavailable", "demand", "429", "quota", "resource_exhausted", "404", "not_found", "not found"]):
                    import time
                    time.sleep(1)
                    continue
                else:
                    raise e
        
        if response is None and last_error:
            raise last_error
        
        cleaned_json = _clean_json_string(response.text)
        data = json.loads(cleaned_json)
        
        # Validar tipo y confidence
        valid_types = ["TDR", "CV", "CONTRATO", "ADENDA", "INFORME", "RECIBO", "FACTURA", "CERTIFICADO", "DESCONOCIDO"]
        valid_confidences = ["alta", "media", "baja"]
        
        if data.get("type") not in valid_types:
            data["type"] = "DESCONOCIDO"
            
        if data.get("confidence") not in valid_confidences:
            data["confidence"] = "baja"
            
        if "description" not in data:
            data["description"] = "Sin descripción"
            
        return data
        
    except Exception as e:
        return {
            "type": "DESCONOCIDO",
            "description": f"Error al analizar el documento. {str(e)}",
            "confidence": "baja",
            "error": True
        }

async def classify_document(text: str) -> Dict[str, str]:
    return await asyncio.to_thread(_sync_classify_document, text)

async def classify_many(texts: List[str]) -> List[Dict[str, str]]:
    tasks = [classify_document(text) for text in texts]
    return await asyncio.gather(*tasks)
