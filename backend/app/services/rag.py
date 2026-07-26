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
        # Authoritative FAISS-id -> metadata mapping. Never infer this from list position.
        self._vector_id_to_meta: dict[int, dict[str, Any]] = {}

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

        # Compute embeddings.
        #
        # The vector store and chunks_metadata are two parallel structures whose offsets
        # must line up: query_rag() looks up chunks_metadata[faiss_id] and reads owner_id
        # off it to enforce tenant isolation. Previously the fallback branch appended
        # metadata WITHOUT adding a vector, so a single transient model-load failure
        # desynchronised the offsets permanently — after which a FAISS hit resolved to a
        # different user's chunk and the owner_id filter was checking the wrong record.
        #
        # Every chunk now records whether it is vector-backed, and vector ids are tracked
        # explicitly rather than inferred from list position.
        if self.model is not None and faiss is not None:
            embeddings = self.model.encode(new_chunks, normalize_embeddings=True)
            dimension = embeddings.shape[1]

            if self._index is None:
                self._index = faiss.IndexFlatIP(dimension)
            elif self._index.d != dimension:
                raise RuntimeError(
                    f"Embedding dimension changed ({self._index.d} -> {dimension}); "
                    "refusing to corrupt the existing index."
                )

            next_vector_id = self._index.ntotal
            self._index.add(np.array(embeddings, dtype=np.float32))
            for offset, meta in enumerate(new_meta):
                meta["vector_id"] = next_vector_id + offset
                self.chunks_metadata.append(meta)
                self._vector_id_to_meta[meta["vector_id"]] = meta
        else:
            # Fallback when the embedding model is unavailable: retain the text for the
            # keyword path, but mark it as having no vector so it can never be resolved
            # by a FAISS id.
            for meta in new_meta:
                meta["vector_id"] = None
                self.chunks_metadata.append(meta)

        return len(new_chunks)

    def query_rag(
        self,
        owner_id: int,
        question: str,
        file_ids: list[int] | None = None,
        top_k: int = 3,
    ) -> dict[str, Any]:
        requested_file_ids = set(file_ids) if file_ids is not None else None

        def _is_eligible(meta: dict[str, Any]) -> bool:
            if meta["owner_id"] != owner_id:
                return False
            return requested_file_ids is None or meta["file_id"] in requested_file_ids

        eligible = [meta for meta in self.chunks_metadata if _is_eligible(meta)]

        if not eligible:
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

            for score, vector_id in zip(scores[0], indices[0]):
                if vector_id < 0:  # FAISS pads short result sets with -1
                    continue
                # Resolve through the explicit id map, then re-check ownership on the
                # record we actually retrieved.
                meta = self._vector_id_to_meta.get(int(vector_id))
                if meta is None or not _is_eligible(meta):
                    continue
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
            for meta in eligible:
                text_lower = meta["text"].lower()
                score = sum(1.0 for kw in keywords if kw in text_lower)
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
