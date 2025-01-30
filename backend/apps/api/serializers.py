from rest_framework import serializers

from .models import Trench


class TrenchSerializer(serializers.ModelSerializer):
    length = serializers.ReadOnlyField()

    class Meta:
        model = Trench
        fields = "__all__"
