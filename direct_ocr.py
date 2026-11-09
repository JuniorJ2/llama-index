import asyncio
from app.services.extraction import extract_document
from dotenv import load_dotenv
load_dotenv()

async def main():
    pdf_path = r"D:\Usuario\SOPORTE\.gemini\antigravity-ide\brain\520df58e-3fea-482d-ab56-f7c6c3284861\.user_uploaded\media_1790355131226.pdf"
    with open(pdf_path, 'rb') as f:
        pdf_bytes = f.read()
    
    text, method, pages = await extract_document('cv.pdf', pdf_bytes)
    print(f'METHOD: {method}')
    
    with open('ocr_result_direct.txt', 'w', encoding='utf-8') as f:
        f.write(text)
    print('GUARDADO EN ocr_result_direct.txt')

if __name__ == '__main__':
    asyncio.run(main())
