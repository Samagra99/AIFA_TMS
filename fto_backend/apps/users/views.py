from django.contrib.auth import get_user_model
from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from apps.core.permissions import IsAdminOrCFI, IsInstructor
from .models import Instructor, Student, StudentDocument
from .serializers import (
    FTOTokenObtainSerializer, UserSerializer, UserCreateSerializer,
    ChangePasswordSerializer, InstructorSerializer,
    StudentSerializer, StudentLogbookSerializer, StudentDocumentSerializer,
)

User = get_user_model()


class FTOTokenObtainView(TokenObtainPairView):
    serializer_class = FTOTokenObtainSerializer


class LogoutView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            request.user.invalidate_all_tokens()
        except Exception:
            pass
        return Response({"detail": "Logged out successfully."}, status=status.HTTP_205_RESET_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.UpdateAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.invalidate_all_tokens()
        request.user.save()
        return Response({"detail": "Password changed. Please log in again."})


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("first_name", "last_name")
    permission_classes = [IsAdminOrCFI]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["role", "home_base", "is_active"]
    search_fields = ["first_name", "last_name", "email"]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer


class InstructorViewSet(viewsets.ModelViewSet):
    queryset = Instructor.objects.select_related("user", "user__home_base").all()
    serializer_class = InstructorSerializer
    permission_classes = [IsAdminOrCFI]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["instrument_rating"]
    search_fields = ["user__first_name", "user__last_name", "cfi_licence_number"]


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.select_related("user", "user__home_base").all()
    serializer_class = StudentSerializer
    permission_classes = [IsInstructor]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["solo_approved", "target_licence", "user__home_base"]
    search_fields = ["user__first_name", "user__last_name", "spl_number", "batch_number"]

    @action(detail=True, methods=["get"], url_path="logbook")
    def logbook(self, request, pk=None):
        student = self.get_object()
        serializer = StudentLogbookSerializer(student)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="compliance")
    def compliance_check(self, request, pk=None):
        from django.utils import timezone
        student = self.get_object()
        today = timezone.now().date()
        return Response({
            "student_id":    str(student.id),
            "name":          student.user.get_full_name(),
            "spl_valid":     bool(student.spl_expiry and student.spl_expiry > today),
            "spl_expiry":    student.spl_expiry,
            "medical_valid": bool(student.medical_expiry and student.medical_expiry > today),
            "medical_expiry":student.medical_expiry,
            "frtol_valid":   bool(not student.frtol_expiry or student.frtol_expiry > today),
            "frtol_expiry":  student.frtol_expiry,
            "solo_approved": student.solo_approved,
        })


class StudentDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = StudentDocumentSerializer
    permission_classes = [IsInstructor]

    def get_queryset(self):
        return StudentDocument.objects.filter(
            student_id=self.kwargs["student_pk"],
            is_superseded=False,
        )

    def perform_create(self, serializer):
        serializer.save(
            student_id=self.kwargs["student_pk"],
            uploaded_by=self.request.user,
        )
