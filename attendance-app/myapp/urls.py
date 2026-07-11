from django.urls import path
from .import views
from rest_framework.routers import DefaultRouter
from .views import AttendanceAPIView
from django.urls import path,include
from .views import UserLoginAPIView,UserRegisterAPIView
from rest_framework_simplejwt.views import TokenRefreshView
from .views import face_enroll, face_check_in, face_check_out
from .views import check_face_enrollment
from .views import ProjectListCreateAPIView

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
path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
path('logout/', views.logout_api, name='logout_api'),
path("face-enroll/", face_enroll),
path("face-check-in/", face_check_in),
path("face-check-out/", face_check_out),
path("face-enrollment-check/", check_face_enrollment),
path('projects/', ProjectListCreateAPIView.as_view(), name='projects'),
path('attendance-status/', views.attendance_status, name='attendance_status'),
path('my-project-checkins/', views.my_project_checkins, name='my_project_checkins'),
path('my-profile/', views.my_profile, name='my_profile'),
path('employee-search/', views.employee_search, name='employee_search'),

path('dashboard',views.dashboard,name='dashboard'),
path('employees/',         views.employees,        name='employees'),
path('employee-role-history/', views.employee_role_history, name='employee_role_history'),
path('enrollment/',        views.enrollment,       name='enrollment'),
path('employee-profile/<int:id>/',  views.employee_profile, name='employee_profile'),
path('supervisor-profile/<int:id>/',  views.supervisor_profile, name='supervisor_profile'),
path('projectsadmin/',          views.projectsadmin,         name='projectsadmin'),
path('assignments/<int:id>/',       views.assignments,      name='assignments'),
path('geofence/',          views.geofence,         name='geofence'),
path('attendance/',        views.attendance,       name='attendance'),
path('reports/',           views.reports,          name='reports'),
path('violationsadmin/',        views.violationsadmin,       name='violationsadmin'),
path('tasks/',             views.tasks,            name='tasks'),
path('settings/',          views.settings_view,    name='settings'),
path('delete_geofence/<int:id>/', views.delete_geofence, name="delete_geofence"),
path('update_geofence/<int:id>/', views.update_geofence, name="update_geofence"),
path('toggle-supervisor/<int:id>/', views.toggle_supervisor, name="toggle_supervisor"),
path('change-supervisor/', views.change_supervisor, name='change_supervisor'),
path('toggle-project-role/<int:project_id>/<int:employee_id>/', views.toggle_project_role, name='toggle_project_role'),
path('move-workers/', views.move_workers, name='move_workers'),
path('add-workers/<int:id>', views.add_workers, name='add_workers'),
path('remove-worker/<int:id>/', views.remove_worker, name='remove_worker'),
path('loginweb',views.login_web,name='login_web'),
path('registerweb',views.register_web,name='register_web'),
path('remove-supervisor/<int:id>/', views.remove_supervisor, name='remove_supervisor'),
path('logoutweb',views.logout_web,name='logout_web'),



path('my-projects/', views.my_projects, name='my_projects'),
path('projects/<int:project_id>/employees/', views.project_employee_list, name='project_employee_list'),
path('projects/<int:project_id>/employee-profile/', views.project_employee_profile, name='project_employee_profile'),

path('violation-types/', views.violation_type_list, name='violation_type_list'),
path('violations/', views.violation_list, name='violation_list'),
path('violations/submit/', views.submit_violation, name='submit_violation'),
path('violations/<int:violation_id>/review/', views.supervisor_review_violation, name='supervisor_review_violation'),
path('violationsadmin/<int:violation_id>/resolve/', views.resolve_violation_admin, name='resolve_violation_admin'),

path('documents/', views.document_list, name='document_list'),
path('documents/send/', views.send_document, name='send_document'),
path('documents/<int:document_id>/acknowledge/', views.acknowledge_document, name='acknowledge_document'),
path('edit-project/<int:id>/', views.edit_project, name='edit_project'),

]
