from django.urls import path
from .import views
from rest_framework.routers import DefaultRouter
from .views import AttendanceAPIView
from django.urls import path,include
from .views import UserLoginAPIView,UserRegisterAPIView
from .views import face_enroll, face_check_in



router = DefaultRouter()
router.register('attendance', AttendanceAPIView)


urlpatterns = [

path('index', views.index, name="index"),
path('index2', views.index2, name="index2"),
path('present-today', views.present_today, name="presenttoday"),
path('absent-today', views.absent_today, name="absenttoday"),
path('api/', include(router.urls)),
path('create-project', views.create_project, name="create_project"),
path('login/', UserLoginAPIView.as_view(), name='login'),
path('register/', UserRegisterAPIView.as_view()),
path("face-enroll/", face_enroll),
path("face-check-in/", face_check_in),




]