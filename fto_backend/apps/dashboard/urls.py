from django.urls import path
from . import views

urlpatterns = [
    path('instructor/summary/',      views.instructor_summary,      name='dashboard-instructor-summary'),
    path('instructor/availability/', views.instructor_availability, name='dashboard-instructor-availability'),
    path('student/summary/',         views.student_summary,         name='dashboard-student-summary'),
]