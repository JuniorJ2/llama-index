from types import SimpleNamespace as D

from app.services.apps import is_compatible, build_incompatibility_notice
from app.services.context_builder import _detect_mode


def doc(t, name="x.pdf"):
    return D(doc_type=t, filename=name)


def test_general_chat_modes():
    assert _detect_mode([], "hola", "general") == "ASESOR"
    assert _detect_mode([doc("TDR"), doc("CV")], "", "general") == "COMPARACION"
    assert _detect_mode([doc("CV")], "", "general") == "CV"
    assert _detect_mode([doc("CONTRATO")], "", "general") == "CONTRATO"
    assert _detect_mode([doc("CONTRATO"), doc("ADENDA")], "", "general") == "CONTRATO"
    assert _detect_mode([doc("INFORME")], "", "general") == "INFORME"
    assert _detect_mode([doc("DESCONOCIDO", "dni.pdf")], "", "general") == "GENERAL"
    assert _detect_mode([doc("TDR")], "", "general") == "TDR"


def test_tdr_cv_app_keeps_legacy_behavior():
    assert _detect_mode([doc("TDR"), doc("DESCONOCIDO")], "", "tdr-cv") == "COMPARACION"
    assert _detect_mode([doc("TDR")], "", "tdr-cv") == "TDR"
    assert _detect_mode([doc("DESCONOCIDO")], "", "tdr-cv") == "CV"


def test_compatibility():
    assert is_compatible("tdr-cv", {"type": "CV"})
    assert is_compatible("tdr-cv", {"type": "TDR"})
    assert not is_compatible("tdr-cv", {"type": "CONTRATO"})
    assert not is_compatible("tdr-cv", {"type": "DESCONOCIDO"})
    assert is_compatible("tdr-cv", {"type": "DESCONOCIDO", "error": True})
    assert is_compatible("general", {"type": "CONTRATO"})


def test_notice_actions():
    text, actions = build_incompatibility_notice("tdr-cv", [("contrato.pdf", "CONTRATO")], 0)
    payloads = [a.payload for a in actions]
    # contracts está "coming_soon": no se ofrece como destino, solo el chat libre
    assert payloads == ["general"]
    assert "próximamente" in text


def test_followup_mode_after_previous_analysis():
    docs = [doc("TDR"), doc("CV")]
    # Si ya hubo un análisis previo y se hace una pregunta puntual:
    assert _detect_mode(docs, "¿en qué año sacó el título técnico?", "tdr-cv", has_previous_analysis=True) == "SEGUIMIENTO"
    assert _detect_mode(docs, "según la experiencia que dice el tdr ?", "tdr-cv", has_previous_analysis=True) == "SEGUIMIENTO"
    assert _detect_mode(docs, "cuál es su pretensión salarial?", "general", has_previous_analysis=True) == "SEGUIMIENTO"


def test_compare_candidates_mode():
    # 1 TDR y 2 CVs
    docs = [doc("TDR"), doc("CV", "andrea.pdf"), doc("CV", "carlos.pdf")]
    assert _detect_mode(docs, "¿cuál de los candidatos cumple más con el TDR?", "tdr-cv", has_previous_analysis=True) == "COMPARACION_CANDIDATOS"
    assert _detect_mode(docs, "compara los candidatos y dime quién tiene mejor cv", "general", has_previous_analysis=True) == "COMPARACION_CANDIDATOS"


def test_explicit_reanalysis_mode():
    docs = [doc("TDR"), doc("CV")]
    # Si el usuario pide explícitamente re-analizar o evaluar un nuevo cv:
    assert _detect_mode(docs, "analízame este cv con el mismo tdr", "tdr-cv", has_previous_analysis=True) == "COMPARACION"
    assert _detect_mode(docs, "vuelve a evaluar al postulante", "tdr-cv", has_previous_analysis=True) == "COMPARACION"
    # O si vienen nuevos adjuntos
    assert _detect_mode(docs, "revisa", "tdr-cv", has_previous_analysis=True, has_new_attachments=True) == "COMPARACION"


def test_system_date_and_guardrails_in_prompt():
    from app.services.context_builder import get_current_date_info, build_context_prompt
    from app.models_db import ChatSession
    from datetime import datetime

    info = get_current_date_info()
    assert info["anio"] == str(datetime.now().year)
    assert len(info["fecha_larga"]) > 5

    session = D(id="test-session", app_type="general", documents=[], messages=[], history_summary=None)
    prompt = build_context_prompt(session, "Dame una receta de cocina")

    # Verifica que el prompt contiene la fecha real, el guardrail de dominio y la advertencia de recetas
    assert info["fecha_corta"] in prompt
    assert "DELIMITACIÓN INSTITUCIONAL DE DOMINIO Y GUARDRAIL" in prompt
    assert "recetas de cocina" in prompt
    assert "Ley 32069" in prompt

