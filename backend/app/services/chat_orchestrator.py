import logging
from sqlalchemy.orm import Session

from app.models.chat import ChatHistory
from app.services.prompt_manager import prompt_manager
from app.services.groq_service import groq_service
from app.services.sql_service import generate_and_execute_sql
from app.services.rag_service import rag_service

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
        
        # 2. Route
        if intent == "sql":
            reply = self._route_sql(db, message)
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

    def _classify_intent(self, message: str) -> str:
        system_prompt = prompt_manager.render("intent_classifier")
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ]
        try:
            intent_raw = groq_service.chat_completion(messages, temperature=0.0, max_tokens=10).strip().lower()
            if "sql" in intent_raw: return "sql"
            if "rag" in intent_raw: return "rag"
            return "general"
        except Exception as e:
            logger.error(f"Intent classification failed: {e}")
            return "general"

    def _route_sql(self, db: Session, message: str) -> str:
        result = generate_and_execute_sql(db, message, execute=True)
        if result.get("summary"):
            return result["summary"]
        if result.get("error"):
            return f"Error executing data query: {result['error']}"
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
        
        return groq_service.chat_completion(messages, temperature=0.5, max_tokens=500)

    def _store_exchange(self, db: Session, user_id: int, file_id: int | None, user_msg: str, ai_msg: str, intent: str):
        user_record = ChatHistory(user_id=user_id, file_id=file_id, role="user", content=user_msg)
        ai_record = ChatHistory(user_id=user_id, file_id=file_id, role="assistant", content=ai_msg, intent_routed_to=intent)
        db.add_all([user_record, ai_record])
        db.commit()

chat_orchestrator = ChatOrchestrator()
