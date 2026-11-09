import os
import requests
import json

url = "http://127.0.0.1:8000/upload"

tdr_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj\n4 0 obj\n<< /Length 80 >>\nstream\nBT\n/F1 12 Tf\n72 712 Td\n(TDR: Se requiere ingeniero de software con 5 agnos de exp) Tj\nET\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"

cv_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj\n4 0 obj\n<< /Length 75 >>\nstream\nBT\n/F1 12 Tf\n72 712 Td\n(CV: Soy ingeniero de software con 6 agnos de exp) Tj\nET\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"

with open("test_tdr.pdf", "wb") as f:
    f.write(tdr_pdf)
with open("test_cv.pdf", "wb") as f:
    f.write(cv_pdf)

files = {
    'tdr_file': ('test_tdr.pdf', open('test_tdr.pdf', 'rb'), 'application/pdf'),
    'cv_file': ('test_cv.pdf', open('test_cv.pdf', 'rb'), 'application/pdf')
}

print("Enviando petición a FastAPI...")
try:
    resp = requests.post(url, files=files)
    print("STATUS:", resp.status_code)
    try:
        print("JSON:", json.dumps(resp.json(), indent=2))
    except Exception:
        print("RAW CONTENT:", resp.text)
except Exception as e:
    print("Error conectando con el servidor local:", e)
