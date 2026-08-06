from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Instructor, Student, StudentDocument

User = get_user_model()


class FTOTokenObtainSerializer(TokenObtainPairSerializer):
    """Adds role, base, and token_version to the JWT payload."""
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"]          = user.role
        token["full_name"]     = user.get_full_name()
        token["home_base_id"]  = str(user.home_base_id) if user.home_base_id else None
        token["token_version"] = user.token_version
        return token


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "employee_id", "email", "phone", "first_name", "last_name",
                  "role", "home_base", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["employee_id", "email", "phone", "first_name", "last_name",
                  "role", "home_base", "password"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value


class InstructorSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)
    fdtl_daily_remaining_hrs = serializers.ReadOnlyField()
    type_ratings_detail = serializers.SerializerMethodField()

    class Meta:
        model = Instructor
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_type_ratings_detail(self, obj):
        import uuid
        from apps.infrastructure.models import AircraftType
        ids = obj.type_rating_ids or []
        if not ids:
            return []
        
        valid_uuid_strings = []
        code_labels = []

        for item in ids:
            item_str = str(item).strip()
            try:
                uuid.UUID(item_str)
                valid_uuid_strings.append(item_str)
            except (ValueError, AttributeError):
                code_labels.append({"id": item_str, "make_model": item_str, "icao_designator": item_str})

        db_details = []
        if valid_uuid_strings:
            types = AircraftType.objects.filter(id__in=valid_uuid_strings)
            db_details = [{"id": str(t.id), "make_model": t.make_model, "icao_designator": t.icao_designator} for t in types]

        return db_details + code_labels


from apps.syllabus.serializers import LicenceTypeSerializer

class StudentSerializer(serializers.ModelSerializer):
    user_detail           = UserSerializer(source="user", read_only=True)
    target_licence_detail = LicenceTypeSerializer(source="target_licence", read_only=True)
    is_medically_current  = serializers.ReadOnlyField()
    is_spl_current        = serializers.ReadOnlyField()

    class Meta:
        model = Student
        exclude = ["hours_total", "hours_pic", "hours_p1_us", "hours_dual", "hours_solo",
                   "hours_cross_country_dual", "hours_cross_country_pic", "hours_day", "hours_night",
                   "hours_instrument_simulated", "hours_instrument_actual", "hours_fstd", "hours_multi_engine"]
        read_only_fields = ["id", "created_at", "updated_at"]


class StudentLogbookSerializer(serializers.ModelSerializer):
    """Read-only logbook totals view."""
    class Meta:
        model = Student
        fields = ["id", "hours_total", "hours_pic", "hours_p1_us", "hours_dual", "hours_solo",
                  "hours_cross_country_dual", "hours_cross_country_pic", "hours_day", "hours_night",
                  "hours_instrument_simulated", "hours_instrument_actual", "hours_fstd", "hours_multi_engine"]
        read_only_fields = fields


class StudentDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    document_type_label = serializers.CharField(source="get_document_type_display", read_only=True)

    class Meta:
        model = StudentDocument
        fields = "__all__"
        read_only_fields = ["id", "uploaded_at", "created_at", "updated_at"]

    def get_file_url(self, obj):
        if obj.file_path:
            try:
                request = self.context.get("request")
                url = obj.file_path.url
                if request:
                    return request.build_absolute_uri(url)
                return url
            except Exception:
                return str(obj.file_path)
        return None
