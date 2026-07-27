"""File-aware chat: questions about an uploaded file must be answered from its data."""

import io

from app.services import file_qa
from app.services import chat_bot


def _upload(client, headers, name, content):
    files = {"file": (name, io.BytesIO(content.encode()), "text/csv")}
    return client.post("/api/v1/files/upload", headers=headers, files=files)


def test_file_context_includes_real_aggregates(client, auth_headers, monkeypatch):
    # Capture the prompt the LLM receives so we can assert it carries real, full-dataset
    # numbers (not just a sample the model would have to guess from).
    captured = {}

    def fake_completion(messages, **kwargs):
        captured["system"] = messages[0]["content"]
        return "ok"

    monkeypatch.setattr(file_qa.llm, "chat_completion", fake_completion)

    fid = _upload(client, auth_headers, "sales.csv",
                  "region,sales\nUS,100\nEU,200\nUS,300\n").json()["id"]

    # Call the service directly with a DB session.
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        # Resolve the owner id from the uploaded file record.
        from app.models.uploaded_file import UploadedFile
        owner_id = db.query(UploadedFile).filter(UploadedFile.id == fid).first().owner_id
        answer = file_qa.answer_file_question(db, owner_id, fid, "total sales?")
    finally:
        db.close()

    assert answer == "ok"
    ctx = captured["system"]
    assert "sum=600.00" in ctx          # 100+200+300, computed over the full file
    assert "region" in ctx and "sales" in ctx


def test_chat_routes_file_questions_to_file_qa(client, auth_headers, monkeypatch):
    # A data question with a file attached must go through file QA, not the app-DB SQL
    # agent (which cannot see uploaded rows).
    monkeypatch.setattr(chat_bot, "answer_file_question", lambda db, u, f, m: "from-file-qa")
    # Force the intent classifier to return "sql" without calling the real LLM.
    monkeypatch.setattr(chat_bot.ChatOrchestrator, "_classify_intent", lambda self, m: "sql")

    fid = _upload(client, auth_headers, "q.csv", "a,b\n1,2\n").json()["id"]
    r = client.post("/api/v1/ai/chat", headers=auth_headers,
                    json={"message": "what is the total?", "file_id": fid})
    assert r.status_code == 200
    body = r.json()
    assert body["intent"] == "file_qa"
    assert body["reply"] == "from-file-qa"
