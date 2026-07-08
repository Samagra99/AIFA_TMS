from django import forms
from django.contrib import admin
from .models import SyllabusStage, SyllabusLesson, SyllabusExercise


class LessonInline(admin.TabularInline):
    model = SyllabusLesson
    extra = 0


class ExerciseInline(admin.TabularInline):
    model = SyllabusExercise
    extra = 0

class SyllabusExerciseForm(forms.ModelForm):
    # 1. Create a friendly multi-select dropdown field for the UI
    prerequisites = forms.ModelMultipleChoiceField(
        queryset=SyllabusExercise.objects.all(),
        required=False,
        label="Prerequisites (Select Exercises)",
        help_text="Hold Ctrl (or Cmd on Mac) to select multiple exercises."
    )

    class Meta:
        model = SyllabusExercise
        fields = '__all__'
        # 2. Hide the raw, ugly UUID text box from the admin panel
        exclude = ['prerequisite_ids']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # 3. Change the dropdown text to show "D2 - Taxying" instead of "SyllabusExercise object"
        self.fields['prerequisites'].label_from_instance = lambda obj: f"{obj.exercise_code} - {obj.title}"
        
        # 4. If you are editing an existing exercise, pre-select the ones already saved
        if self.instance and self.instance.pk and self.instance.prerequisite_ids:
            self.fields['prerequisites'].initial = SyllabusExercise.objects.filter(
                id__in=self.instance.prerequisite_ids
            )

    def save(self, commit=True):
        instance = super().save(commit=False)
        
        # 5. Intercept the save: Convert the friendly objects back into a list of UUID strings
        selected_exercises = self.cleaned_data.get('prerequisites', [])
        instance.prerequisite_ids = [str(ex.id) for ex in selected_exercises]
        
        if commit:
            instance.save()
        return instance


# @admin.register(SyllabusExercise)
# class SyllabusExerciseAdmin(admin.ModelAdmin):
#     # Tell Django to use our custom form
#     form = SyllabusExerciseForm
    
#     # Optional: Make the list view nicer to look at!
#     list_display = ('exercise_code', 'title', 'flight_type_required', 'sequence_order')
#     search_fields = ('exercise_code', 'title')
#     ordering = ('sequence_order',)

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
    form = SyllabusExerciseForm
    list_display = ("exercise_code", "title", "lesson", "flight_type_required", "pass_grade")
    search_fields = ('exercise_code', 'title')
    ordering = ('sequence_order',)
