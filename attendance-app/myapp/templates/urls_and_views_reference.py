# urls.py — add these to your app's urls.py

from django.urls import path
from . import views

urlpatterns = [
    path('',                   views.dashboard,        name='dashboard'),
    path('employees/',         views.employees,        name='employees'),
    path('enrollment/',        views.enrollment,       name='enrollment'),
    path('employee-profile/',  views.employee_profile, name='employee_profile'),
    path('projects/',          views.projects,         name='projects'),
    path('assignments/',       views.assignments,      name='assignments'),
    path('geofence/',          views.geofence,         name='geofence'),
    path('attendance/',        views.attendance,       name='attendance'),
    path('reports/',           views.reports,          name='reports'),
    path('violations/',        views.violations,       name='violations'),
    path('tasks/',             views.tasks,            name='tasks'),
    path('settings/',          views.settings_view,    name='settings'),

    # existing functional URLs (keep as-is)
    path('present-today/',     views.presenttoday,     name='presenttoday'),
    path('absent-today/',      views.absenttoday,      name='absenttoday'),
    path('create-project/',    views.create_project,   name='create_project'),
    path('create-geofence/',   views.create_geofence,  name='create_geofence'),
]


# ─────────────────────────────────────────────────────────────
# views.py — minimal view stubs for each page
# ─────────────────────────────────────────────────────────────

from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required

# DASHBOARD
@login_required
def dashboard(request):
    context = {
        'totalemployees': Employee.objects.count(),
        'presentcount': Attendance.objects.filter(...).count(),
        'absentcount': ...,
        'late_checkinscount': ...,
    }
    return render(request, 'dashboard.html', context)

# EMPLOYEES
@login_required
def employees(request):
    return render(request, 'employees.html')

# FACE ENROLLMENT
@login_required
def enrollment(request):
    return render(request, 'enrollment.html')

# EMPLOYEE PROFILE
@login_required
def employee_profile(request):
    # pass employee object via GET param e.g. ?id=9
    return render(request, 'employee_profile.html')

# PROJECTS
@login_required
def projects(request):
    context = {
        'projects': Project.objects.all(),
        'employees': Employee.objects.all(),
    }
    return render(request, 'projects.html', context)

# ASSIGNMENTS
@login_required
def assignments(request):
    context = {
        'projects': Project.objects.all(),
    }
    return render(request, 'assignments.html', context)

# GEOFENCE
@login_required
def geofence(request):
    context = {
        'projectsnew': Project.objects.all(),
    }
    return render(request, 'geofence.html', context)

# ATTENDANCE
@login_required
def attendance(request):
    return render(request, 'attendance.html')

# REPORTS
@login_required
def reports(request):
    return render(request, 'reports.html')

# VIOLATIONS
@login_required
def violations(request):
    return render(request, 'violations.html')

# TASKS
@login_required
def tasks(request):
    return render(request, 'tasks.html')

# SETTINGS
@login_required
def settings_view(request):
    return render(request, 'settings.html')
