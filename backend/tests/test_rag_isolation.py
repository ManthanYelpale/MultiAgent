"""RAG tenant isolation, including the desync-after-model-failure scenario."""

from app.services.rag import RAGService


def test_query_never_returns_other_users_chunks_after_desync():
    r = RAGService()
    # Simulate: user 1's chunks were indexed while the embedding model was unavailable
    # (no vectors), then user 2 indexed successfully and got vector id 0.
    r.chunks_metadata.extend([
        {"file_id": 1, "filename": "alice.pdf", "owner_id": 1, "page_number": 1,
         "text": "alice secret", "vector_id": None},
    ])
    bob = {"file_id": 2, "filename": "bob.pdf", "owner_id": 2, "page_number": 1,
           "text": "bob secret", "vector_id": 0}
    r.chunks_metadata.append(bob)
    r._vector_id_to_meta[0] = bob

    # Alice queries for content that only exists in Bob's document.
    result = r.query_rag(owner_id=1, question="bob secret")
    assert all(s["file_id"] != 2 for s in result["sources"])


def test_purge_user_removes_all_their_chunks():
    r = RAGService()
    r.chunks_metadata.extend([
        {"file_id": 1, "filename": "a.pdf", "owner_id": 1, "page_number": 1, "text": "x", "vector_id": None},
        {"file_id": 2, "filename": "b.pdf", "owner_id": 2, "page_number": 1, "text": "y", "vector_id": None},
    ])
    removed = r.purge_user(1)
    assert removed == 1
    assert all(m["owner_id"] != 1 for m in r.chunks_metadata)
