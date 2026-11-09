import os
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex, Settings
from llama_index.llms.gemini import Gemini
from llama_index.embeddings.gemini import GeminiEmbedding

# Global index to avoid reloading
_index = None

def init_settings():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY no está configurada en las variables de entorno")
    
    # LlamaIndex (only used for audit_tdr) needs correct valid model names
    Settings.llm = Gemini(model="models/gemini-3.5-flash-lite", api_key=api_key)
    Settings.embed_model = GeminiEmbedding(model_name="models/gemini-embedding-001", api_key=api_key)


def get_template_index() -> VectorStoreIndex:
    global _index
    if _index is not None:
        return _index
        
    init_settings()
    
    # Path to data/plantillas
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    plantillas_dir = os.path.join(base_dir, "data", "plantillas")
    
    if not os.path.exists(plantillas_dir):
        print(f"Directorio no encontrado: {plantillas_dir}")
        return None
        
    print("Cargando plantillas...")
    reader = SimpleDirectoryReader(input_dir=plantillas_dir)
    docs = reader.load_data()
    
    print("Indexando plantillas...")
    _index = VectorStoreIndex.from_documents(docs)
    return _index
