import logging
import os
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import faiss
except ImportError:
    faiss = None

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None

from app.services.llm import llm
from app.services.prompts import prompts


class RAGService:
    def __init__(self):
        self.embedding_model_name = "BAAI/bge-small-en-v1.5"
        self._model = None
        self._index = None
        self.chunks_metadata: list[dict[str, Any]] = []

    @property
    def model(self):
        if self._model is None and SentenceTransformer is not None:
            try:
                logger.info(f"Loading embedding model {self.embedding_model_name}...")
                self._model = SentenceTransformer(self.embedding_model_name)
            except Exception as e:
                logger.error(f"Error loading embedding model: {e}")
        return self._model

    def extract_pdf_pages(self, filepath: str) -> list[tuple[int, str]]:
        if pypdf is None:
            raise RuntimeError("pypdf is not installed.")

        pages = []
        reader = pypdf.PdfReader(filepath)
        for idx, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append((idx, text.strip()))
        return pages

    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunks.append(text[start:end])
            start += chunk_size - overlap
        return chunks

    def index_pdf_file(
        self,
        filepath: str,
        filename: str,
        file_id: int,
        owner_id: int,
    ) -> int:
        pages = self.extract_pdf_pages(filepath)
        new_chunks = []
        new_meta = []

        for page_num, text in pages:
            chunks = self.chunk_text(text)
            for chunk in chunks:
                new_chunks.append(chunk)
                new_meta.append(
                    {
                        "file_id": file_id,
                        "filename": filename,
                        "owner_id": owner_id,
                        "page_number": page_num,
                        "text": chunk,
                    }
                )

        if not new_chunks:
            return 0

        # Compute embeddings
        if self.model is not None and faiss is not None:
            embeddings = self.model.encode(new_chunks, normalize_embeddings=True)
            dimension = embeddings.shape[1]

            if self._index is None:
                self._index = faiss.IndexFlatIP(dimension)

            self._index.add(np.array(embeddings, dtype=np.float32))
            self.chunks_metadata.extend(new_meta)
        else:
            # Fallback when heavy ML model fails to load: store text for basic keyword match
            self.chunks_metadata.extend(new_meta)

        return len(new_chunks)

    def query_rag(
        self,
        owner_id: int,
        question: str,
        file_ids: list[int] | None = None,
        top_k: int = 3,
    ) -> dict[str, Any]:
        # Filter metadata by user owner_id and requested file_ids
        eligible_indices = [
            idx
            for idx, meta in enumerate(self.chunks_metadata)
            if meta["owner_id"] == owner_id and (file_ids is None or meta["file_id"] in file_ids)
        ]

        if not eligible_indices:
            return {
                "question": question,
                "answer": "No indexed PDF document chunks found for your query. Please index your PDF file first.",
                "sources": [],
            }

        retrieved_sources = []

        if self.model is not None and self._index is not None and faiss is not None:
            query_vector = self.model.encode([question], normalize_embeddings=True)
            k_search = min(top_k * 5, self._index.ntotal)
            scores, indices = self._index.search(np.array(query_vector, dtype=np.float32), k_search)

            for score, idx in zip(scores[0], indices[0]):
                if idx in eligible_indices:
                    meta = self.chunks_metadata[idx]
                    retrieved_sources.append(
                        {
                            "file_id": meta["file_id"],
                            "filename": meta["filename"],
                            "page_number": meta["page_number"],
                            "score": float(score),
                            "snippet": meta["text"],
                        }
                    )
                if len(retrieved_sources) >= top_k:
                    break
        else:
            # Simple keyword search fallback
            keywords = question.lower().split()
            scored_meta = []
            for idx in eligible_indices:
                meta = self.chunks_metadata[idx]
                score = sum(1.0 for kw in keywords if kw in meta["text"].lower())
                if score > 0:
                    scored_meta.append((score, meta))

            scored_meta.sort(key=lambda x: x[0], reverse=True)
            for score, meta in scored_meta[:top_k]:
                retrieved_sources.append(
                    {
                        "file_id": meta["file_id"],
                        "filename": meta["filename"],
                        "page_number": meta["page_number"],
                        "score": float(score),
                        "snippet": meta["text"],
                    }
                )

        if not retrieved_sources:
            return {
                "question": question,
                "answer": "No relevant text passages found in your uploaded documents matching the question.",
                "sources": [],
            }

        # Build context prompt for Groq LLM
        context_str = "\n\n".join(
            [
                f"--- Document: {src['filename']} (Page {src['page_number']}) ---\n{src['snippet']}"
                for src in retrieved_sources
            ]
        )

        system_prompt = prompts.render("rag_agent", context_str=context_str)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ]

        answer = llm.chat_completion(messages, temperature=0.2, max_tokens=1024)

        return {
            "question": question,
            "answer": answer,
            "sources": retrieved_sources,
        }


rag_service = RAGService()
