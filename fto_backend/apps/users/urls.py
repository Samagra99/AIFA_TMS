from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import FTOTokenObtainView, LogoutView, MeView, ChangePasswordView, SetMyPinView

urlpatterns = [
    path("token/",          FTOTokenObtainView.as_view(), name="token_obtain"),
    path("token/refresh/",  TokenRefreshView.as_view(),   name="token_refresh"),
    path("logout/",         LogoutView.as_view(),          name="logout"),
    path("me/",             MeView.as_view(),              name="me"),
    path("me/password/",    ChangePasswordView.as_view(),  name="change_password"),
    path("me/pin/",         SetMyPinView.as_view(),        name="set_my_pin"),
]
