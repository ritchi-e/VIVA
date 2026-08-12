from django.contrib import admin

from rag.models import KnowledgeNode, RetrievalLog


@admin.register(KnowledgeNode)
class KnowledgeNodeAdmin(admin.ModelAdmin):
    list_display = ("title", "node_type", "submission")


@admin.register(RetrievalLog)
class RetrievalLogAdmin(admin.ModelAdmin):
    list_display = ("submission", "latency_ms", "created_at")
