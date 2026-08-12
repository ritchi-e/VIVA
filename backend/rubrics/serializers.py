from rest_framework import serializers

from rubrics.models import Rubric, RubricCriterion


class RubricCriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RubricCriterion
        fields = (
            "id",
            "rubric",
            "learning_outcome",
            "name",
            "description",
            "weight",
            "max_score",
            "order",
            "category",
        )
        read_only_fields = ("id", "rubric")


class RubricSerializer(serializers.ModelSerializer):
    criteria = RubricCriterionSerializer(many=True, read_only=True)

    class Meta:
        model = Rubric
        fields = ("id", "assignment", "title", "description", "criteria", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class RubricCriterionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RubricCriterion
        fields = (
            "learning_outcome",
            "name",
            "description",
            "weight",
            "max_score",
            "order",
            "category",
        )
