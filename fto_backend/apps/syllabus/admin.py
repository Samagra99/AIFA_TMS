from django.contrib import admin
from .models import SyllabusStage, SyllabusLesson, SyllabusExercise


class LessonInline(admin.TabularInline):
    model = SyllabusLesson
    extra = 0


class ExerciseInline(admin.TabularInline):
    model = SyllabusExercise
    extra = 0


@admin.register(SyllabusStage)
class StageAdmin(admin.ModelAdmin):
    list_display = ("licence_type", "stage_number", "title")
    inlines = [LessonInline]


@admin.register(SyllabusLesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("stage", "lesson_number", "title")
    inlines = [ExerciseInline]


@admin.register(SyllabusExercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ("exercise_code", "title", "lesson", "flight_type_required", "pass_grade")
