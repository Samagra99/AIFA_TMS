from rest_framework import serializers
from .ba_models import BAEquipment, BATestEntry

class BAEquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = BAEquipment
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

class BATestEntrySerializer(serializers.ModelSerializer):
    person_name = serializers.SerializerMethodField()
    equipment_display = serializers.SerializerMethodField()

    class Meta:
        model = BATestEntry
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'conducted_by']

    def get_person_name(self, obj):
        return obj.person.get_full_name() if obj.person else None

    def get_equipment_display(self, obj):
        if obj.equipment:
            return f"{obj.equipment.equipment_number} — {obj.equipment.model_name}"
        return obj.equipment_number

    def validate_person(self, value):
        if value.role not in ['student', 'instructor', 'cfi']:
            raise serializers.ValidationError("Person must be a student, instructor, or cfi.")
        return value
