"""
Catálogo de Apps del sistema.

- "general"   -> Chat Libre Inteligente: acepta cualquier documento y decide el análisis
                 según lo que clasifica el backend.
- "tdr-cv"    -> App dedicada: solo TDR y CV.
- "contracts" -> App dedicada (próximamente): contratos y adendas.
- "reports"   -> App dedicada (próximamente): informes técnicos.

Las apps dedicadas validan los documentos que se suben: lo que no les corresponde
no se guarda en la sesión y se le sugiere al usuario la app correcta (hand-off).
"""
from typing import Dict, List, Optional, Tuple

from app.models import SuggestedAction

GENERAL_APP = "general"

APPS: Dict[str, dict] = {
    "general": {
        "id": "general",
        "name": "Chat Libre",
        "description": "Pregunta lo que quieras o adjunta documentos: el asistente detecta qué son y los analiza.",
        "status": "active",
        "accepted_types": None,  # None = acepta todo
        "welcome": None,
    },
    "tdr-cv": {
        "id": "tdr-cv",
        "name": "TDR vs CV",
        "description": "Evalúa si el perfil de un postulante cumple un Término de Referencia.",
        "status": "active",
        "accepted_types": ["TDR", "CV"],
        "welcome": {
            "title": "Comparar TDR vs CV",
            "description": "Evalúa si el perfil de un postulante cumple los requisitos de un Término de Referencia, o revisa un CV por separado.",
            "accepts": ["TDR", "CV"],
            "steps": [
                "Adjunta el TDR y el CV: puedes subirlos juntos o uno por uno.",
                "Con ambos documentos obtienes la matriz de cumplimiento y el veredicto.",
                "Con solo el CV obtienes la ficha del postulante, sin cuadros de cumple / no cumple.",
            ],
        },
    },
    "contracts": {
        "id": "contracts",
        "name": "Auditoría de Contratos",
        "description": "Revisa cláusulas, plazos, penalidades y riesgos legales de contratos y adendas.",
        "status": "coming_soon",
        "accepted_types": ["CONTRATO", "ADENDA"],
        "welcome": {
            "title": "Auditoría de Contratos",
            "description": "Revisa objeto, vigencia, penalidades, obligaciones de las partes y riesgos legales de un contrato y sus adendas.",
            "accepts": ["Contrato", "Adenda"],
            "steps": [
                "Adjunta el contrato y, si existe, su adenda.",
                "Obtienes un reporte de cláusulas críticas, plazos y riesgos.",
            ],
        },
    },
    "reports": {
        "id": "reports",
        "name": "Resumen de Informes",
        "description": "Extrae conclusiones, hallazgos y recomendaciones de informes técnicos extensos.",
        "status": "coming_soon",
        "accepted_types": ["INFORME"],
        "welcome": {
            "title": "Resumen de Informes",
            "description": "Extrae conclusiones, observaciones, hallazgos y plan de acción de un informe técnico.",
            "accepts": ["Informe"],
            "steps": [
                "Adjunta el informe técnico.",
                "Obtienes un resumen ejecutivo con hallazgos y recomendaciones.",
            ],
        },
    },
}

# Tipo de documento -> app especializada que lo atiende
DOC_TYPE_TO_APP: Dict[str, str] = {
    "TDR": "tdr-cv",
    "CV": "tdr-cv",
    "CONTRATO": "contracts",
    "ADENDA": "contracts",
    "INFORME": "reports",
}

DOC_TYPE_LABELS: Dict[str, str] = {
    "TDR": "TDR (Términos de Referencia)",
    "CV": "CV",
    "CONTRATO": "contrato",
    "ADENDA": "adenda de contrato",
    "INFORME": "informe",
    "RECIBO": "recibo",
    "FACTURA": "factura",
    "CERTIFICADO": "certificado o constancia",
    "DESCONOCIDO": "documento no reconocido",
}


def is_valid_app(app_type: str) -> bool:
    return app_type in APPS


def is_dedicated(app_type: str) -> bool:
    return app_type in APPS and app_type != GENERAL_APP


def list_apps() -> List[dict]:
    return [
        {k: v for k, v in app.items() if k != "accepted_types"}
        for app in APPS.values()
    ]


def is_compatible(app_type: str, classification: dict) -> bool:
    """
    ¿Este documento corresponde a la app? El chat libre acepta todo.
    Si el clasificador falló (error de API), no bloqueamos al usuario.
    """
    app = APPS.get(app_type)
    if not app or app["accepted_types"] is None:
        return True
    if classification.get("error"):
        return True
    return classification.get("type") in app["accepted_types"]


def build_incompatibility_notice(
    app_type: str,
    rejected: List[Tuple[str, str]],
    accepted_count: int,
) -> Tuple[str, List[SuggestedAction]]:
    """
    Construye el aviso amigable (Markdown) y las acciones sugeridas para
    documentos que no corresponden a la app actual.
    `rejected` es una lista de (filename, doc_type).
    """
    app = APPS[app_type]
    accepted_labels = " y ".join(app["welcome"]["accepts"]) if app.get("welcome") else "los documentos de esta app"

    lines = [f"⚠️ **Documentos que no corresponden a la app {app['name']}**", ""]
    target_apps: List[str] = []
    for filename, doc_type in rejected:
        label = DOC_TYPE_LABELS.get(doc_type, "documento no reconocido")
        lines.append(f"- **{filename}** parece ser un {label}.")
        target = DOC_TYPE_TO_APP.get(doc_type)
        if target and target != app_type and target not in target_apps:
            target_apps.append(target)

    lines.append("")
    lines.append(f"Esta app analiza únicamente: **{accepted_labels}**.")

    actions: List[SuggestedAction] = []
    for target in target_apps:
        target_app = APPS[target]
        if target_app["status"] == "active":
            actions.append(SuggestedAction(
                label=f"Analizar en {target_app['name']}",
                action="switch_app",
                payload=target,
            ))
        else:
            lines.append(f"La app **{target_app['name']}** estará disponible próximamente.")

    # El chat libre siempre es una salida válida para consultar el archivo
    actions.append(SuggestedAction(
        label="Consultar en Chat Libre",
        action="switch_app",
        payload=GENERAL_APP,
    ))

    if accepted_count > 0:
        lines.append("")
        lines.append("Los demás documentos sí se procesaron correctamente.")

    return "\n".join(lines), actions
