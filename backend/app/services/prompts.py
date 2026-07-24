import os
import yaml
from string import Template
from typing import Any

from app.core.config import settings

class PromptManager:
    def __init__(self, prompts_dir: str = "prompts"):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.prompts_dir = os.path.abspath(os.path.join(current_dir, "..", "..", prompts_dir))
        self._cache = {}

    def _load(self, name: str) -> dict[str, Any]:
        if name in self._cache:
            return self._cache[name]
            
        path = os.path.join(self.prompts_dir, f"{name}.yaml")
        if not os.path.exists(path):
            raise FileNotFoundError(f"Prompt template {name}.yaml not found in {self.prompts_dir}")
            
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            
        self._cache[name] = data
        return data

    def render(self, name: str, **kwargs) -> str:
        data = self._load(name)
        template_str = data.get("template", "")
        
        # Use string.Template to safely substitute $var
        # This avoids issues with curly braces { } commonly used in LLM prompts
        template = Template(template_str)
        return template.safe_substitute(**kwargs)

prompts = PromptManager()
