import asyncio
import httpx
import os
import sqlite3

API_URL='http://127.0.0.1:8000'

async def main():
    resp = await httpx.AsyncClient().post(f'{API_URL}/token', data={'username':'admin','password':'admin123'})
    token = resp.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    
    resp = await httpx.AsyncClient(headers=headers).post(f'{API_URL}/api/sessions', json={'app_type':'tdr-cv'})
    session_id = resp.json()['id']
    
    pdf_path = r'D:\Usuario\SOPORTE\.gemini\antigravity-ide\brain\520df58e-3fea-482d-ab56-f7c6c3284861\.user_uploaded\media_1790355131226.pdf'
    with open(pdf_path, 'rb') as f:
        async with httpx.AsyncClient(headers=headers, timeout=300.0).stream('POST', f'{API_URL}/api/sessions/{session_id}/upload', files={'files': ('real_cv.pdf', f, 'application/pdf')}) as response:
            async for chunk in response.aiter_lines():
                if chunk:
                    print(chunk)
                    
    conn = sqlite3.connect('llamaindex.db')
    cursor = conn.cursor()
    cursor.execute('SELECT extraction_method, extracted_text FROM session_documents WHERE session_id=?', (session_id,))
    row = cursor.fetchone()
    print('\n--- RESULTADOS DB ---')
    print(f'METODO: {row[0]}\nTEXTO:\n{row[1]}')

if __name__ == '__main__':
    asyncio.run(main())
