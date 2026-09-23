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


class RubricCriterionReplaceItemSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=128)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    weight = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=1)
    max_score = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, default=10)
    order = serializers.IntegerField(required=False, min_value=0, default=0)
    category = serializers.CharField(required=False, allow_blank=True, max_length=64, default="")


class RubricReplaceCriteriaSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    template_id = serializers.CharField(required=False, allow_blank=True, max_length=64)
    criteria = RubricCriterionReplaceItemSerializer(many=True)
