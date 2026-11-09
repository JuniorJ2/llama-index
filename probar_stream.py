import asyncio
import httpx
import time
import os

API_URL = "http://127.0.0.1:8010"

async def main():
    print("Iniciando prueba de streaming...")
    start_time = time.time()
    
    # 1. Login
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{API_URL}/token", data={"username": "admin", "password": "admin123"})
        if resp.status_code != 200:
            print("Error en login:", resp.text)
            return
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
    print(f"Login exitoso en {time.time() - start_time:.2f}s")
    
    # 2. Crear sesión
    async with httpx.AsyncClient(headers=headers) as client:
        resp = await client.post(f"{API_URL}/api/sessions", json={"app_type": "tdr-cv"})
        session_id = resp.json()["id"]
        print(f"Sesión creada: {session_id}")
        
    # 3. Preparar archivo PDF
    pdf_path = "test_tdr.pdf"
    if not os.path.exists(pdf_path):
        # Create a dummy PDF if it doesn't exist
        print(f"No se encontró {pdf_path}. Creando un PDF de prueba usando ReportLab (asegúrate de tenerlo instalado) o copiando uno.")
        return
        
    # 4. Probar /upload (Streaming)
    print("\n--- INICIANDO UPLOAD (STREAM) ---")
    upload_start = time.time()
    first_event_time = None
    
    async with httpx.AsyncClient(headers=headers) as client:
        with open(pdf_path, "rb") as f:
            files = {"files": (pdf_path, f, "application/pdf")}
            async with client.stream("POST", f"{API_URL}/api/sessions/{session_id}/upload", files=files) as response:
                async for chunk in response.aiter_lines():
                    if chunk:
                        if first_event_time is None:
                            first_event_time = time.time()
                            print(f"\n[TIEMPO] Primer evento recibido a los {first_event_time - upload_start:.3f} segundos.")
                        print(f"[{time.time() - upload_start:.2f}s] {chunk}")
                        
    print("--- FIN UPLOAD ---\n")
    
    # 5. Probar /chat (Streaming)
    print("--- INICIANDO CHAT (STREAM) ---")
    chat_start = time.time()
    first_event_time_chat = None
    token_count = 0
    
    async with httpx.AsyncClient(headers=headers, timeout=60.0) as client:
        payload = {"session_id": session_id, "message": "Resume el documento que acabo de subir por favor."}
        async with client.stream("POST", f"{API_URL}/api/sessions/{session_id}/chat", json=payload) as response:
            async for chunk in response.aiter_lines():
                if chunk:
                    if first_event_time_chat is None:
                        first_event_time_chat = time.time()
                        print(f"\n[TIEMPO] Primer evento CHAT recibido a los {first_event_time_chat - chat_start:.3f} segundos.")
                    if "event: token" in chunk:
                        token_count += 1
                        print(f"[{time.time() - chat_start:.2f}s] {chunk}")
                    else:
                        print(f"[{time.time() - chat_start:.2f}s] {chunk}")
                        
    print(f"--- FIN CHAT (Tokens recibidos escalonados: {token_count}) ---\n")

if __name__ == "__main__":
    asyncio.run(main())
