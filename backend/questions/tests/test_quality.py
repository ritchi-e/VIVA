from questions.quality import diversify_plan_items, is_grounded_item, score_planned_question


def test_score_planned_question_rewards_grounded_identifiers():
    chunks = [
        {
            "chunk_id": "c1",
            "content": "def train_resnet18(data): return Adam(lr=0.001).fit(data)",
            "source_ref": "train.py:12-40",
        }
    ]
    scores = score_planned_question(
        concept="train_resnet18",
        purpose="Explain why Adam was chosen for ResNet-18 training",
        source_quote="def train_resnet18(data): return Adam",
        chunks=chunks,
        other_concepts=["CIFAR-10 loading"],
    )
    assert scores["grounded"] >= 0.8
    assert scores["specificity"] >= 0.6
    assert scores["novelty"] >= 0.5
    assert scores["overall"] >= 0.6


def test_is_grounded_item_rejects_invalid_quote():
    ok, reason = is_grounded_item(
        question_type="implementation",
        source_quote="this quote is not in the submission at all",
        source_chunk_id="",
        chunks=[{"chunk_id": "c1", "content": "We used a ResNet-18 with batch normalization."}],
        concept="AVL trees",
        purpose="Explain rotations in general",
    )
    assert ok is False
    assert reason in {"invalid_quote", "missing_implementation_citation", "low_concept_overlap"}


def test_diversify_plan_items_drops_same_chunk_and_similar_concepts():
    items = [
        {"concept": "ResNet-18 backbone", "source_chunk_id": "c1", "_grounded": True},
        {"concept": "ResNet 18 backbone", "source_chunk_id": "c1", "_grounded": True},
        {"concept": "Adam optimizer schedule", "source_chunk_id": "c2", "_grounded": True},
        {"concept": "early stopping epochs", "source_chunk_id": "c3", "_grounded": True},
    ]
    selected = diversify_plan_items(items, budget=3)
    chunk_ids = [item["source_chunk_id"] for item in selected]
    assert len(selected) == 3
    assert chunk_ids.count("c1") == 1
    assert "c2" in chunk_ids
    assert "c3" in chunk_ids
