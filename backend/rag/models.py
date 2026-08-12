from django.db import models

from common.models import SoftDeleteModel, UUIDModel


class KnowledgeNode(UUIDModel, SoftDeleteModel):
    """Structured representation of concepts extracted from a submission."""

    class NodeType(models.TextChoices):
        PROBLEM = "problem", "Problem"
        OBJECTIVE = "objective", "Objective"
        METHODOLOGY = "methodology", "Methodology"
        METHOD = "method", "Method"
        ALGORITHM = "algorithm", "Algorithm"
        DATASET = "dataset", "Dataset"
        PREPROCESSING = "preprocessing", "Preprocessing"
        IMPLEMENTATION = "implementation", "Implementation"
        ARCHITECTURE = "architecture", "Architecture"
        COMPONENT = "component", "Component"
        DEPENDENCY = "dependency", "Dependency"
        RESULT = "result", "Result"
        METRIC = "metric", "Metric"
        FINDING = "finding", "Finding"
        CONCLUSION = "conclusion", "Conclusion"
        LIMITATION = "limitation", "Limitation"
        CLAIM = "claim", "Claim"
        ASSUMPTION = "assumption", "Assumption"
        TERM = "term", "Term"

    submission = models.ForeignKey(
        "submissions.Submission",
        on_delete=models.CASCADE,
        related_name="knowledge_nodes",
    )
    node_type = models.CharField(max_length=32, choices=NodeType.choices)
    title = models.CharField(max_length=512)
    content = models.TextField(blank=True)
    confidence = models.FloatField(default=0.5)
    source_ref = models.CharField(max_length=512, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
    )

    class Meta:
        indexes = [models.Index(fields=["submission", "node_type"])]


class RetrievalLog(UUIDModel, SoftDeleteModel):
    submission = models.ForeignKey(
        "submissions.Submission",
        on_delete=models.CASCADE,
        related_name="retrieval_logs",
        null=True,
        blank=True,
    )
    query = models.TextField()
    results = models.JSONField(default=list, blank=True)
    filters = models.JSONField(default=dict, blank=True)
    latency_ms = models.PositiveIntegerField(default=0)
