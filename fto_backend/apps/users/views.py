from django.contrib.auth import get_user_model
from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from apps.core.permissions import IsAdminOrCFI, IsInstructor, IsFlightOperations
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


class SetMyPinView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        pin = request.data.get("pin")
        if not pin or not str(pin).isdigit() or len(str(pin)) < 4 or len(str(pin)) > 6:
            return Response({"detail": "PIN must be a 4-to-6 digit number."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            request.user.set_pin(str(pin))
            return Response({"detail": "Operational PIN updated successfully."})
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


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

    @action(detail=True, methods=["post"], url_path="admin-reset-password")
    def admin_reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get("new_password")
        if not new_password or len(str(new_password)) < 8:
            return Response({"detail": "Password must be at least 8 characters long."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.invalidate_all_tokens()
        user.save()
        return Response({"detail": f"Password for {user.get_full_name()} reset successfully."})

    @action(detail=True, methods=["post"], url_path="set-pin")
    def set_user_pin(self, request, pk=None):
        user = self.get_object()
        if user != request.user:
            return Response({"detail": "Security Violation: Users can only set their own operational PIN."}, status=status.HTTP_403_FORBIDDEN)
        pin = request.data.get("pin")
        if not pin or not str(pin).isdigit() or len(str(pin)) < 4 or len(str(pin)) > 6:
            return Response({"detail": "PIN must be a 4-to-6 digit number."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user.set_pin(str(pin))
            return Response({"detail": "Operational PIN updated successfully."})
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


import re
import datetime
from django.utils import timezone
from django.db import transaction
from apps.scheduling.models import PriorFlightLog

def parse_time_str(val):
    if not val:
        return 0
    val_str = str(val).strip()
    if not val_str or val_str == ' ':
        return 0
    # Check for eGCA instrument string format e.g. "I:00:00, T:01:30"
    if 'I:' in val_str or 'T:' in val_str:
        matches = re.findall(r'(\d+):(\d+)', val_str)
        total_mins = 0
        for h, m in matches:
            total_mins += int(h) * 60 + int(m)
        return total_mins
    if ':' in val_str:
        parts = val_str.split(':')
        try:
            return int(parts[0]) * 60 + int(parts[1])
        except Exception:
            return 0
    try:
        return int(float(val_str) * 60)
    except Exception:
        return 0

def process_egca_logbook(file_obj, user_obj):
    filename = getattr(file_obj, 'name', '')
    rows_data = []
    
    if filename.endswith('.xls'):
        import xlrd
        content = file_obj.read()
        wb = xlrd.open_workbook(file_contents=content)
        sheet = wb.sheet_by_index(0)
        for r in range(1, sheet.nrows):
            row = [sheet.cell_value(r, c) for c in range(sheet.ncols)]
            rows_data.append(row)
    else:
        import openpyxl
        wb = openpyxl.load_workbook(file_obj, data_only=True)
        sheet = wb.active
        for row in sheet.iter_rows(min_row=2, values_only=True):
            rows_data.append(list(row))

    created_logs = []
    tot_dual_min = 0
    tot_pic_min = 0
    tot_inst_min = 0
    tot_instr_min = 0
    tot_night_min = 0

    today = timezone.now().date()
    seven_days_ago = today - datetime.timedelta(days=7)
    thirty_days_ago = today - datetime.timedelta(days=30)

    recent_7_day_min = 0
    recent_30_day_min = 0

    with transaction.atomic():
        PriorFlightLog.objects.filter(user=user_obj).delete()

        for row in rows_data:
            if not row or len(row) < 30:
                continue
            date_val = str(row[2]).strip() if row[2] else ""
            if not date_val:
                continue
            flight_date = None
            try:
                if "/" in date_val:
                    parts = date_val.split("/")
                    flight_date = datetime.date(int(parts[2]), int(parts[1]), int(parts[0]))
                elif "-" in date_val:
                    parts = date_val.split("-")
                    flight_date = datetime.date(int(parts[0]), int(parts[1]), int(parts[2]))
            except Exception:
                continue

            if not flight_date:
                continue

            ac_type  = str(row[3]).strip() if row[3] else ""
            ac_regn  = str(row[4]).strip() if row[4] else ""
            pic_name = str(row[6]).strip() if row[6] else ""
            cop_name = str(row[7]).strip() if row[7] else ""
            flt_from = str(row[8]).strip() if row[8] else ""
            flt_to   = str(row[9]).strip() if row[9] else ""
            dep_time = str(row[10]).strip() if row[10] else ""
            arr_time = str(row[12]).strip() if row[12] else ""

            se_day_dual = parse_time_str(row[13])
            se_day_pic  = parse_time_str(row[14])
            se_day_cop  = parse_time_str(row[15])
            se_n_dual   = parse_time_str(row[16])
            se_n_pic    = parse_time_str(row[17])
            se_n_cop    = parse_time_str(row[18])

            me_day_dual = parse_time_str(row[19])
            me_day_pic  = parse_time_str(row[20])
            me_day_cop  = parse_time_str(row[21])
            me_day_pius = parse_time_str(row[22])
            me_n_dual   = parse_time_str(row[23])
            me_n_pic    = parse_time_str(row[24])
            me_n_cop    = parse_time_str(row[25])
            me_n_pius   = parse_time_str(row[26])

            inst_sim    = parse_time_str(row[27])
            inst_act    = parse_time_str(row[28])
            instr       = parse_time_str(row[29])
            exercises   = str(row[30]).strip() if len(row) > 30 and row[30] else ""
            remarks     = str(row[32]).strip() if len(row) > 32 and row[32] else ""
            status_val  = str(row[33]).strip() if len(row) > 33 and row[33] else "Approved"

            dual_m = se_day_dual + se_n_dual + me_day_dual + me_n_dual
            pic_m  = se_day_pic + se_n_pic + me_day_pic + me_n_pic + me_day_pius + me_n_pius
            cop_m  = se_day_cop + se_n_cop + me_day_cop + me_n_cop
            inst_m = inst_sim + inst_act
            night_m= se_n_dual + se_n_pic + se_n_cop + me_n_dual + me_n_pic + me_n_cop

            tot_dual_min  += dual_m
            tot_pic_min   += pic_m
            tot_inst_min  += inst_m
            tot_instr_min += instr
            tot_night_min += night_m

            row_total_m = dual_m + pic_m + cop_m

            if flight_date >= seven_days_ago:
                recent_7_day_min += row_total_m
            if flight_date >= thirty_days_ago:
                recent_30_day_min += row_total_m

            log = PriorFlightLog.objects.create(
                user=user_obj,
                flight_date=flight_date,
                aircraft_type=ac_type,
                aircraft_regn=ac_regn,
                pic_name=pic_name,
                co_pilot_name=cop_name,
                flight_from=flt_from,
                flight_to=flt_to,
                departure_time=dep_time,
                arrival_time=arr_time,
                dual_minutes=dual_m,
                pic_minutes=pic_m,
                copilot_minutes=cop_m,
                instrument_minutes=inst_m,
                instructional_minutes=instr,
                exercises=exercises,
                remarks=remarks,
                approval_status=status_val,
            )
            created_logs.append(log)

        if hasattr(user_obj, "student_profile"):
            student = user_obj.student_profile
            student.previous_hours_total      = round((tot_dual_min + tot_pic_min) / 60, 1)
            student.previous_hours_dual       = round(tot_dual_min / 60, 1)
            student.previous_hours_pic        = round(tot_pic_min / 60, 1)
            student.previous_hours_instrument = round(tot_inst_min / 60, 1)
            student.previous_hours_night      = round(tot_night_min / 60, 1)
            student.hours_total              = student.previous_hours_total
            student.hours_dual               = student.previous_hours_dual
            student.hours_pic                = student.previous_hours_pic
            student.hours_instrument         = student.previous_hours_instrument
            student.hours_night              = student.previous_hours_night
            student.save()

        if hasattr(user_obj, "instructor_profile"):
            instructor = user_obj.instructor_profile
            instructor.previous_hours_total        = round((tot_dual_min + tot_pic_min + tot_instr_min) / 60, 1)
            instructor.previous_hours_instructional= round(tot_instr_min / 60, 1)
            instructor.previous_hours_pic          = round(tot_pic_min / 60, 1)
            instructor.previous_hours_instrument   = round(tot_inst_min / 60, 1)
            instructor.fdtl_weekly_remaining_min  = max(0, 1800 - recent_7_day_min)
            instructor.fdtl_monthly_remaining_min = max(0, 6000 - recent_30_day_min)
            instructor.save()

    return len(created_logs)


class InstructorViewSet(viewsets.ModelViewSet):
    queryset = Instructor.objects.select_related("user", "user__home_base").all()
    serializer_class = InstructorSerializer
    permission_classes = [IsFlightOperations]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["instrument_rating"]
    search_fields = ["user__first_name", "user__last_name", "cfi_licence_number"]
    ordering_fields = ["user__first_name", "user__last_name", "cfi_expiry", "fdtl_daily_remaining_min"]
    ordering = ["user__first_name"]

    @action(detail=True, methods=["post"], url_path="import-egca-logbook")
    def import_egca_logbook(self, request, pk=None):
        instructor = self.get_object()
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "No file uploaded. Please upload an .xls or .xlsx file."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            count = process_egca_logbook(file_obj, instructor.user)
            return Response({
                "detail": f"Successfully imported {count} flight log entries for {instructor.user.get_full_name()}.",
                "imported_count": count,
                "previous_hours_total": float(instructor.previous_hours_total),
            })
        except Exception as e:
            return Response({"detail": f"Failed to parse eGCA Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"], url_path="daily-flying")
    def daily_flying(self, request, pk=None):
        import datetime
        from django.utils import timezone
        from django.db.models import Sum, Count, F, ExpressionWrapper, DurationField
        from apps.scheduling.models import Flight, FlightStatus, PriorFlightLog

        instructor = self.get_object()
        user = instructor.user

        today = timezone.now().date()
        start_str = request.query_params.get("start_date")
        end_str = request.query_params.get("end_date")

        if start_str and end_str:
            try:
                start_date = datetime.datetime.strptime(start_str, "%Y-%m-%d").date()
                end_date = datetime.datetime.strptime(end_str, "%Y-%m-%d").date()
            except ValueError:
                start_date = today - datetime.timedelta(days=30)
                end_date = today
        else:
            days = int(request.query_params.get("days", 30))
            start_date = today - datetime.timedelta(days=days)
            end_date = today

        num_days = max(1, (end_date - start_date).days + 1)
        date_list = [start_date + datetime.timedelta(days=i) for i in range(num_days)]

        duration_expr = ExpressionWrapper(
            F("scheduled_end") - F("scheduled_start"),
            output_field=DurationField()
        )
        flight_qs = (
            Flight.objects
            .filter(
                instructor=instructor,
                scheduled_start__date__gte=start_date,
                scheduled_start__date__lte=end_date,
                status=FlightStatus.COMPLETED
            )
            .annotate(duration=duration_expr)
            .values("scheduled_start__date")
            .annotate(
                tot_duration=Sum("duration"),
                sorties=Count("id")
            )
        )

        flight_dict = {
            item["scheduled_start__date"]: {
                "hours": round((item["tot_duration"].total_seconds() / 3600.0) if item["tot_duration"] else 0.0, 2),
                "sorties": item["sorties"]
            }
            for item in flight_qs
        }

        prior_qs = (
            PriorFlightLog.objects
            .filter(
                user=user,
                flight_date__gte=start_date,
                flight_date__lte=end_date
            )
            .values("flight_date")
            .annotate(
                tot_mins=Sum("duration_minutes"),
                sorties=Count("id")
            )
        )
        for p in prior_qs:
            d = p["flight_date"]
            h = round((p["tot_mins"] or 0) / 60.0, 2)
            if d in flight_dict:
                flight_dict[d]["hours"] += h
                flight_dict[d]["sorties"] += p["sorties"]
            else:
                flight_dict[d] = {"hours": h, "sorties": p["sorties"]}

        daily_data = []
        tot_hrs = 0.0
        tot_sorties = 0

        for d in date_list:
            info = flight_dict.get(d, {"hours": 0.0, "sorties": 0})
            hrs = round(info["hours"], 2)
            sorties = info["sorties"]
            tot_hrs += hrs
            tot_sorties += sorties
            daily_data.append({
                "date": str(d),
                "label": d.strftime("%d %b"),
                "hours": hrs,
                "sorties": sorties
            })

        return Response({
            "instructor_id": str(instructor.id),
            "instructor_name": user.get_full_name(),
            "start_date": str(start_date),
            "end_date": str(end_date),
            "total_hours": round(tot_hrs, 2),
            "total_sorties": tot_sorties,
            "daily_data": daily_data,
        })


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.select_related("user", "user__home_base").all()
    serializer_class = StudentSerializer
    permission_classes = [IsFlightOperations]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["solo_approved", "target_licence", "user__home_base"]
    search_fields = ["user__first_name", "user__last_name", "spl_number", "batch_number"]
    ordering_fields = ["user__first_name", "user__last_name", "batch_number", "target_licence", "spl_expiry", "medical_expiry"]
    ordering = ["user__first_name"]

    @action(detail=True, methods=["get"], url_path="logbook")
    def logbook(self, request, pk=None):
        student = self.get_object()
        serializer = StudentLogbookSerializer(student)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="import-egca-logbook")
    def import_egca_logbook(self, request, pk=None):
        student = self.get_object()
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "No file uploaded. Please upload an .xls or .xlsx file."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            count = process_egca_logbook(file_obj, student.user)
            return Response({
                "detail": f"Successfully imported {count} flight log entries for {student.user.get_full_name()}.",
                "imported_count": count,
                "previous_hours_total": float(student.previous_hours_total),
            })
        except Exception as e:
            return Response({"detail": f"Failed to parse eGCA Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

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
    permission_classes = [IsFlightOperations]

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
