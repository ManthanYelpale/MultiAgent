import logging
from sqlalchemy.orm import Session

from app.crud.uploaded_file import get_file_for_user
from app.models.chat import ChatHistory
from app.services.prompts import prompts
from app.services.llm import llm
from app.services.sql import generate_and_execute_sql
from app.services.rag import rag_service
from app.services.file_qa import answer_file_question

logger = logging.getLogger(__name__)

class ChatOrchestrator:
    def process_message(
        self,
        db: Session,
        user_id: int,
        file_id: int | None,
        message: str,
        chat_history: list[dict[str, str]]
    ) -> dict[str, str]:

        # 1. Classify Intent
        intent = self._classify_intent(message)

        # 2. Route. When a file is attached, data questions are answered from that file's
        #    actual contents (the NL-to-SQL agent only sees the app database, never the
        #    user's uploaded rows, so it cannot answer questions about a file).
        if file_id and intent in ("sql", "rag"):
            reply, intent = self._route_with_file(db, user_id, file_id, message, chat_history)
        elif intent == "sql":
            reply = self._route_sql(user_id, message)
        elif intent == "rag":
            reply = self._route_rag(user_id, message, file_id)
        else:
            reply = self._route_general(message, chat_history)

        # 3. Store in history
        self._store_exchange(db, user_id, file_id, message, reply, intent)

        return {
            "reply": reply,
            "intent": intent
        }

    def _route_with_file(self, db, user_id, file_id, message, chat_history):
        """Answer against an attached file: tabular -> data QA, PDF -> RAG."""
        db_file = get_file_for_user(db, user_id, file_id)
        if not db_file:
            return "I couldn't find that file.", "general"
        if db_file.file_type == "pdf":
            return self._route_rag(user_id, message, file_id), "rag"
        # CSV / Excel
        answer = answer_file_question(db, user_id, file_id, message)
        if answer is None:
            return self._route_general(message, chat_history), "general"
        return answer, "file_qa"

    def _classify_intent(self, message: str) -> str:
        system_prompt = prompts.render("intent_classifier")
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ]
        try:
            intent_raw = llm.chat_completion(messages, temperature=0.0, max_tokens=10).strip().lower()
            if "sql" in intent_raw: return "sql"
            if "rag" in intent_raw: return "rag"
            return "general"
        except Exception as e:
            logger.error(f"Intent classification failed: {e}")
            return "general"

    def _route_sql(self, user_id: int, message: str) -> str:
        # Runs on its own restricted connection. Critically, it no longer shares the
        # request's Session: a failed query used to leave that session needing a
        # rollback, and the subsequent history commit then raised PendingRollbackError.
        result = generate_and_execute_sql(user_id=user_id, question=message, execute=True)
        if result.get("summary"):
            return result["summary"]
        if result.get("error"):
            return f"Sorry — {result['error']}"
        return "I could not generate an answer for that data question."

    def _route_rag(self, user_id: int, message: str, file_id: int | None) -> str:
        file_ids = [file_id] if file_id else None
        result = rag_service.query_rag(owner_id=user_id, question=message, file_ids=file_ids)
        return result.get("answer", "I couldn't find an answer in your documents.")

    def _route_general(self, message: str, chat_history: list[dict[str, str]]) -> str:
        messages = [{"role": "system", "content": "You are a helpful AI assistant for a data analytics platform."}]
        for msg in chat_history[-5:]: # Keep last 5 for context
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": message})
        
        return llm.chat_completion(messages, temperature=0.5, max_tokens=500)

    def _store_exchange(self, db: Session, user_id: int, file_id: int | None, user_msg: str, ai_msg: str, intent: str):
        user_record = ChatHistory(user_id=user_id, file_id=file_id, role="user", content=user_msg)
        ai_record = ChatHistory(user_id=user_id, file_id=file_id, role="assistant", content=ai_msg, intent_routed_to=intent)
        db.add_all([user_record, ai_record])
        db.commit()

chat_orchestrator = ChatOrchestrator()
