from llama_index.core import Document, VectorStoreIndex, Settings
from llama_index.core.llms import MockLLM
from llama_index.core.embeddings import MockEmbedding

Settings.llm = MockLLM()
Settings.embed_model = MockEmbedding(embed_dim=8)

docs = [Document(text="El TDR exige experiencia mínima de 3 años en soporte TI.")]
index = VectorStoreIndex.from_documents(docs)

respuesta = index.as_query_engine().query("¿Qué experiencia se exige?")
print(respuesta)