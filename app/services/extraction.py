import os
import re
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
import pymupdf
from typing import Tuple, List, Optional
from google import genai
from google.genai import types
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

MAX_FILE_SIZE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", "15"))
MAX_FILES_PER_MESSAGE = int(os.environ.get("MAX_FILES_PER_MESSAGE", "3"))
MAX_PAGES_PER_DOC = int(os.environ.get("MAX_PAGES_PER_DOC", "50"))
MIN_CHARS_PER_PAGE = int(os.environ.get("MIN_CHARS_PER_PAGE", "100"))
OCR_BATCH_SIZE = int(os.environ.get("OCR_BATCH_SIZE", "12"))   # Maximo de llamadas de imagenes   
OCR_MAX_PARALLEL_BATCHES = int(os.environ.get("OCR_MAX_PARALLEL_BATCHES", "2"))   # Maximo de lotes de imagenes a procesar simultaneamente
OCR_BATCH_PAUSE_SEC = float(os.environ.get("OCR_BATCH_PAUSE_SEC", "2.0"))  # Tiempo de espera entre lotes de imagenes

class ExtractionError(Exception):
    """Custom exception for errors during extraction intended to be shown to the user."""
    pass

def get_genai_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY no está configurada")
    return genai.Client(api_key=api_key)

OCR_FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"]

@retry(
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type(Exception),
    reraise=True
)
def perform_ocr_with_gemini(
    images_bytes: list[bytes],
    mime_type: str = "image/jpeg",
    page_numbers: Optional[List[int]] = None,
) -> str:
    client = get_genai_client()
    contents = []

    if page_numbers and len(page_numbers) == len(images_bytes):
        pages_str = ", ".join(str(p) for p in page_numbers)
        prompt = (
            f"A continuación se presentan {len(images_bytes)} páginas escaneadas de un mismo documento "
            f"(correspondientes exactamente a las páginas: {pages_str}). "
            "Extrae y transcribe fielmente todo el texto de cada página respetando su orden. "
            "Presta especial atención a preservar tablas (usa formato Markdown), "
            "encabezados y datos de certificados o diplomas exactamente como aparecen. "
            "OBLIGATORIO: Inicia la transcripción de cada página exactamente con su marcador "
            "'--- PÁGINA X ---' (reemplazando X por el número real de página indicado antes de cada imagen). "
            "No resumas ni agregues comentarios. Solo devuelve el texto extraído con sus respectivos encabezados de página."
        )
        for p_num, img in zip(page_numbers, images_bytes):
            contents.append(f"[IMAGEN DE LA PÁGINA {p_num}]")
            contents.append(types.Part.from_bytes(data=img, mime_type=mime_type))
        contents.append(prompt)
    else:
        prompt = (
            "A continuación se presentan varias páginas escaneadas de un mismo documento. "
            "Extrae y transcribe fielmente todo el texto de cada página en orden. "
            "Presta especial atención a preservar tablas (usa formato Markdown), "
            "encabezados y datos de certificados o diplomas exactamente como aparecen. "
            "Separa la transcripción de cada página con '--- PÁGINA ---'. "
            "No resumas ni agregues comentarios. Solo devuelve el texto extraído."
        )
        contents = [types.Part.from_bytes(data=img, mime_type=mime_type) for img in images_bytes]
        contents.append(prompt)

    print(f"[LLM_CALL] Gemini API (OCR) solicitada para procesar {len(images_bytes)} imágenes escaneadas en batch.")

    last_error = None
    for model in OCR_FALLBACK_MODELS:
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents
            )
            return response.text
        except Exception as e:
            err_str = str(e)
            print(f"[OCR_RETRY] Modelo {model} falló ({e}). Intentando siguiente modelo...")
            last_error = e
            if any(k in err_str.lower() for k in ["503", "unavailable", "demand", "429", "quota", "resource_exhausted", "404", "not_found", "not found"]):
                import time
                time.sleep(1.5)
                continue
            else:
                raise e
    if last_error:
        raise last_error


def _assign_ocr_pages_to_map(
    ocr_text: str,
    chunk_page_nums: List[int],
    pages_content: dict[int, str],
) -> None:
    """
    Asigna el texto devuelto por el OCR de un lote a cada número de página real en pages_content.
    Primero intenta emparejar marcadores explícitos '--- PÁGINA X ---'; si el modelo usó
    marcadores sin número o agrupados, hace fallback seguro sin perder texto.
    """
    if not ocr_text or not chunk_page_nums:
        return

    # 1. Intentar separar por marcador explícito con número: --- PÁGINA X ---
    pattern_numbered = re.compile(r"---\s*P[ÁA]GINA\s+(\d+)\s*---", re.IGNORECASE)
    matches = list(pattern_numbered.finditer(ocr_text))

    if matches:
        assigned_any = False
        for idx, match in enumerate(matches):
            p_num = int(match.group(1))
            start_pos = match.end()
            end_pos = matches[idx + 1].start() if idx + 1 < len(matches) else len(ocr_text)
            body = ocr_text[start_pos:end_pos].strip()
            if p_num in chunk_page_nums:
                pages_content[p_num] = f"--- PÁGINA {p_num} ---\n{body}"
                assigned_any = True

        # Si quedaron páginas del lote sin asignar pero el número de bloques coincide con el lote
        if assigned_any and len(matches) == len(chunk_page_nums) and not all(p in pages_content for p in chunk_page_nums):
            for p_num, match_idx in zip(chunk_page_nums, range(len(matches))):
                start_pos = matches[match_idx].end()
                end_pos = matches[match_idx + 1].start() if match_idx + 1 < len(matches) else len(ocr_text)
                body = ocr_text[start_pos:end_pos].strip()
                pages_content[p_num] = f"--- PÁGINA {p_num} ---\n{body}"
            return

        if assigned_any and all(p in pages_content for p in chunk_page_nums):
            return

    # 2. Fallback: separar por cualquier marcador --- PÁGINA --- (con o sin número)
    raw_parts = re.split(r"---\s*P[ÁA]GINA(?:\s+\d+)?\s*---", ocr_text, flags=re.IGNORECASE)
    parts = [p.strip() for p in raw_parts if p and p.strip()]

    if len(parts) == len(chunk_page_nums):
        for p_num, body in zip(chunk_page_nums, parts):
            pages_content[p_num] = f"--- PÁGINA {p_num} ---\n{body}"
        return

    # 3. Fallback seguro: si el modelo devolvió menos o más divisiones de las esperadas,
    # guardamos todo el bloque etiquetado con el rango exacto en la primera página no asignada del lote.
    unassigned = [p for p in chunk_page_nums if p not in pages_content]
    target_page = unassigned[0] if unassigned else chunk_page_nums[0]
    if len(chunk_page_nums) == 1:
        pages_content[target_page] = f"--- PÁGINA {target_page} ---\n{ocr_text.strip()}"
    else:
        pages_label = ", ".join(str(p) for p in chunk_page_nums)
        pages_content[target_page] = f"--- PÁGINAS {pages_label} ---\n{ocr_text.strip()}"


def _sync_extract_pdf(file_path: str, file_bytes: bytes) -> Tuple[str, str, int]:
    if not file_bytes.startswith(b'%PDF'):
        raise ExtractionError("El archivo no parece ser un PDF válido (falta la firma %PDF).")
        
    if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise ExtractionError(f"El archivo supera el tamaño máximo permitido de {MAX_FILE_SIZE_MB} MB.")
        
    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        raise ExtractionError("No se pudo abrir el archivo PDF. Puede estar corrupto.")
        
    if doc.needs_pass or doc.is_encrypted:
        raise ExtractionError("El archivo PDF está protegido con contraseña. Por favor, remueve la contraseña antes de subirlo.")
        
    page_count = len(doc)
    
    if page_count > MAX_PAGES_PER_DOC:
        raise ExtractionError(f"El documento tiene {page_count} páginas, superando el límite máximo de {MAX_PAGES_PER_DOC}.")
        
    pages_content: dict[int, str] = {}
    extraction_method = "texto_hibrido"
    scanned_pages: List[Tuple[int, bytes, str]] = []
    
    for i, page in enumerate(doc):
        page_num = i + 1
        page_text = page.get_text()
        
        # Si la página tiene texto nativo suficiente (>= MIN_CHARS_PER_PAGE = 100), lo usamos directamente con su número de página real.
        if len(page_text.strip()) >= MIN_CHARS_PER_PAGE:
            pages_content[page_num] = f"--- PÁGINA {page_num} ---\n{page_text.strip()}"
        else:
            # La página es probablemente un escaneo o imagen (ej. diploma o certificado).
            # Convertimos solo esta página a imagen y guardamos su número de página real para procesarla en batch.
            try:
                pix = page.get_pixmap(matrix=pymupdf.Matrix(1.0, 1.0)) # Resolución óptima para OCR ligero
                img_bytes = pix.tobytes("jpeg")
                scanned_pages.append((page_num, img_bytes, page_text.strip()))
            except Exception as e:
                print(f"Error convirtiendo página {page_num} a imagen: {e}")
                if page_text.strip():
                    pages_content[page_num] = f"--- PÁGINA {page_num} ---\n{page_text.strip()}"
                
    if scanned_pages:
        # Dividir en lotes de OCR_BATCH_SIZE (12 imágenes por defecto) y procesar hasta
        # OCR_MAX_PARALLEL_BATCHES (2 lotes simultáneos por defecto) por tanda.
        chunk_size = max(1, OCR_BATCH_SIZE)
        max_parallel = max(1, OCR_MAX_PARALLEL_BATCHES)
        extraction_method = "ocr_gemini_hibrido"

        chunks = [
            scanned_pages[i:i + chunk_size]
            for i in range(0, len(scanned_pages), chunk_size)
        ]

        def _process_single_chunk(chunk_idx: int, chunk_items: List[Tuple[int, bytes, str]]):
            c_page_nums = [item[0] for item in chunk_items]
            c_images = [item[1] for item in chunk_items]
            try:
                ocr_res = perform_ocr_with_gemini(
                    c_images,
                    mime_type="image/jpeg",
                    page_numbers=c_page_nums
                )
                return (chunk_idx, chunk_items, c_page_nums, ocr_res, None)
            except Exception as exc:
                return (chunk_idx, chunk_items, c_page_nums, None, exc)

        for wave_start in range(0, len(chunks), max_parallel):
            wave_chunks = chunks[wave_start:wave_start + max_parallel]
            with ThreadPoolExecutor(max_workers=len(wave_chunks)) as executor:
                futures = [
                    executor.submit(_process_single_chunk, wave_start + idx, ch)
                    for idx, ch in enumerate(wave_chunks)
                ]
                results = [f.result() for f in futures]

            for chunk_idx, chunk_items, chunk_page_nums, ocr_text, err in results:
                if err is None and ocr_text is not None:
                    _assign_ocr_pages_to_map(ocr_text, chunk_page_nums, pages_content)
                else:
                    print(f"Error procesando OCR en el lote {chunk_idx + 1} (páginas {chunk_page_nums}): {err}")
                    first_p, last_p = chunk_page_nums[0], chunk_page_nums[-1]
                    for p_num, _, fallback_txt in chunk_items:
                        if fallback_txt:
                            pages_content[p_num] = f"--- PÁGINA {p_num} ---\n{fallback_txt}"
                    pages_content.setdefault(
                        first_p,
                        f"--- PÁGINAS {first_p} A {last_p} ---\n"
                        f"[NOTA: No se pudieron leer las páginas escaneadas de la {first_p} a la {last_p} "
                        f"por un error temporal de Google ({str(err)[:50]}). Se ha omitido este pequeño bloque "
                        f"pero se continuó leyendo el resto del documento.]"
                    )

            # Pausa de seguridad (2s por defecto) solo si queda otra tanda de bloques por procesar
            if wave_start + max_parallel < len(chunks) and OCR_BATCH_PAUSE_SEC > 0:
                time.sleep(OCR_BATCH_PAUSE_SEC)
                
    # Ensamblar todas las páginas en su orden real del PDF (1 a page_count)
    ordered_blocks = [pages_content[p] for p in range(1, page_count + 1) if p in pages_content]
    text = "\n\n".join(ordered_blocks) + ("\n\n" if ordered_blocks else "")

    if not text or len(text.strip()) < 10:
        raise ExtractionError("El documento parece estar vacío o es ilegible.")
            
    return text, extraction_method, page_count

async def extract_document(file_path: str, file_bytes: bytes) -> Tuple[str, str, int]:
    return await asyncio.to_thread(_sync_extract_pdf, file_path, file_bytes)
