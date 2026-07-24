import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    from groq import Groq
except ImportError:
    Groq = None


class GroqService:
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.model = settings.GROQ_MODEL
        self.client = None
        # Only initialize if a real API key is set
        if self.api_key and self.api_key != "your_groq_api_key_here" and Groq is not None:
            try:
                self.client = Groq(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Groq client initialization warning: {e}")

    def is_configured(self) -> bool:
        return self.client is not None

    def chat_completion(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> str:
        if not self.is_configured():
            return (
                "[Groq API Key not configured]. Please add a valid GROQ_API_KEY to your .env file "
                "to enable live Llama 3.3 70B inference."
            )

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            logger.error(f"Groq API call error: {exc}")
            return f"[Groq LLM Error]: {exc}"


groq_service = GroqService()
