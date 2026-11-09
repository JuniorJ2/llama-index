import pymupdf
import os
from llama_index.core import Settings
from google import genai
from app.services.indexer import get_template_index

# Global google.genai client
_genai_client = None

def get_genai_client():
    global _genai_client
    if _genai_client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY no está configurada")
        _genai_client = genai.Client(api_key=api_key)
    return _genai_client

from google.genai import types

def extract_text_from_pdf(pdf_path: str) -> str:
    text = ""
    try:
        doc = pymupdf.open(pdf_path)
        needs_ocr = False
        
        for page in doc:
            page_text = page.get_text()
            text += page_text + "\n"
            
            # Si una sola página no tiene texto (ej: es la foto de un certificado)
            if len(page_text.strip()) < 20:
                # Verificamos si la página tiene imágenes para no lanzar OCR por páginas en blanco
                if len(page.get_images()) > 0 or len(page_text.strip()) == 0:
                    needs_ocr = True
            
        # Si alguna página necesita OCR (escaneados mixtos) o el texto total es muy corto
        if needs_ocr or len(text.strip()) < 50:
            client = get_genai_client()
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()
                
            print("Detectadas páginas escaneadas o sin texto nativo. Usando Gemini OCR...")
            prompt = "Extrae y transcribe todo el texto de este documento PDF. Presta especial atención a traducir a texto las imágenes, certificados o páginas escaneadas. Mantén la estructura original. No agregues comentarios, solo devuelve todo el texto del documento."
            response = client.models.generate_content(
                model="gemini-3.5-flash-lite",
                contents=[
                    types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                    prompt
                ]
            )
            return response.text
    except Exception as e:
        print(f"Error extrayendo texto del PDF {pdf_path}: {e}")
    return text

def validate_documents(tdr_text: str, cv_text: str) -> bool:
    prompt = f"""
    Evalúa los siguientes dos textos y responde SOLO con "SI" o "NO".
    ¿El texto 1 parece ser un documento de tipo TDR (Términos de Referencia) y el texto 2 parece ser un CV (Curriculum Vitae)?
    
    Texto 1 (posible TDR):
    {tdr_text[:2000]}
    
    Texto 2 (posible CV):
    {cv_text[:2000]}
    """
    client = get_genai_client()
    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt
    )
    return "SI" in str(response.text).strip().upper()

def audit_tdr(tdr_text: str) -> str:
    index = get_template_index()
    if not index:
        return "No hay plantillas RAG disponibles para realizar la auditoría."
        
    query_engine = index.as_query_engine(similarity_top_k=3)
    
    prompt = f"""
    Eres un auditor experto en contrataciones y servicios.
    Compara y audita el siguiente TDR basándote en las plantillas y lineamientos provistos en tu contexto (RAG).
    Verifica:
    1. ¿Está bien redactado?
    2. ¿Tiene todos los campos necesarios (objetivo, perfil, entregables, etc.)?
    3. ¿Los requisitos son claros y medibles?
    
    Proporciona tus observaciones y correcciones de manera estructurada en Markdown.
    
    TDR a auditar:
    ---
    {tdr_text[:15000]}
    ---
    """
    
    response = query_engine.query(prompt)
    return str(response)

def compare_tdr_cv(tdr_text: str, cv_text: str) -> str:
    prompt = f"""
    Actúa como un reclutador experto. Tu tarea es comparar el siguiente TDR con el CV del candidato punto por punto.
    
    Debes estructurar tu respuesta evaluando si el candidato cumple (utiliza ✓) o no cumple (utiliza ✗) con los siguientes aspectos que pida el TDR:
    - Experiencia ✓/✗
    - Formación académica ✓/✗
    - Certificaciones ✓/✗
    - Competencias ✓/✗
    
    Para cada punto, justifica brevemente por qué cumple o no cumple basándote en la evidencia del CV. Formatea tu respuesta en Markdown.
    
    TDR:
    ---
    {tdr_text[:10000]}
    ---
    
    CV del Candidato:
    ---
    {cv_text[:10000]}
    ---
    """
    client = get_genai_client()
    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt
    )
    return str(response.text)

def chat_with_docs(message: str, history_context: str) -> str:
    prompt = f"""
    Eres un asistente de IA experto en contrataciones y análisis de TDRs y CVs.
    El usuario subió previamente un TDR y un CV, que ya fueron analizados.
    
    A continuación, se muestra el historial de la conversación, donde el 'system' o 'assistant' proporcionó información previa, o el 'user' hizo preguntas:
    
    --- Historial ---
    {history_context}
    --- Fin Historial ---
    
    Responde a la nueva pregunta del usuario manteniendo el tono profesional y basándote en el contexto de la conversación.
    
    Pregunta del usuario: {message}
    """
    client = get_genai_client()
    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt
    )
    return str(response.text)
