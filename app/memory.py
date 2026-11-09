from typing import Dict, List

# Dictionary to hold session history
# session_id -> list of dicts {"role": "user"|"assistant", "content": "..."}
_sessions: Dict[str, List[Dict[str, str]]] = {}

def get_history(session_id: str) -> List[Dict[str, str]]:
    if session_id not in _sessions:
        _sessions[session_id] = []
    return _sessions[session_id]

def add_message(session_id: str, role: str, content: str):
    if session_id not in _sessions:
        _sessions[session_id] = []
    _sessions[session_id].append({"role": role, "content": content})
