import json
from django.shortcuts import render
from rest_framework import viewsets
from .models import Attendance,EmployeeRegistrationWorkforce,ProjectAttendance,ProjectEmployee,ProjectHandover,ProjectEmployeeRoleLog
from datetime import date
from django.shortcuts import redirect
from .serializers import AttendanceSerializer
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from django.contrib.auth import authenticate
from .serializers import UserRegisterSerializer
from .models import User
from django.utils.timezone import now
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from face_ai.services.enroll import enroll_employee
from face_ai.tasks import verify_face_task
from .models import Attendance, EmployeeRegistrationWorkforce
from .utils import get_place_name
from .tasks import resolve_attendance_place_task
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import FaceEnrollment
from rest_framework import generics
from .models import ProjectAttendance
from .serializers import ProjectSerializer
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import Violation, ViolationType, ProjectDocument
from django.utils.timezone import localtime
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages

from django.db.models import Q
from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required
from openpyxl import Workbook
from django.http import HttpResponse
from django.db.models import Count, Q
from datetime import datetime, timedelta
from calendar import monthrange



def logout_web(request):
    return redirect('login_web')


# Create your views here.
def index(request):
    totalemployees=EmployeeRegistrationWorkforce.objects.filter(terminationstatus='0').count()
    presentcount=Attendance.objects.filter(status='Present').count()
    absentcount=Attendance.objects.filter(status='Absent').count()
    leavecount=Attendance.objects.filter(status='Leave').count()
    halfdaycount=Attendance.objects.filter(status='Half Day').count()
    recent_checkins= Attendance.objects.all()[:5]
    context={
        'totalemployees': totalemployees,
        'presentcount': presentcount,
        'absentcount': absentcount,
        'leavecount': leavecount,
        'halfdaycount': halfdaycount,
        'recent_checkins': recent_checkins
    }
    return render(request, 'index.html', context)


def present_today(request):
    present_employees = Attendance.objects.filter(status='Present')
    print("present_employees",present_employees)
    context = {
        'present_employees': present_employees
    }
    return render_page(request, 'present_today.html', context)


def absent_today(request):
    absent_employees = Attendance.objects.filter(status='Absent')
    context = {
        'absent_employees': absent_employees
    }
    return render_page(request, 'absent_today.html', context)

class AttendanceAPIView(viewsets.ModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]


def index2(request):    
    totalemployees=EmployeeRegistrationWorkforce.objects.filter(terminationstatus='0').count()
    presentcount=Attendance.objects.filter(status='Present').count()
    absentcount=Attendance.objects.filter(status='Absent').count()
    leavecount=Attendance.objects.filter(status='Leave').count()
    halfdaycount=Attendance.objects.filter(status='Half Day').count()
    recent_checkins= Attendance.objects.all()[:5]
    projects=ProjectAttendance.objects.all()
    employees = EmployeeRegistrationWorkforce.objects.all()
    context={
        'totalemployees': totalemployees,
        'presentcount': presentcount,
        'absentcount': absentcount,
        'leavecount': leavecount,
        'halfdaycount': halfdaycount,
        'recent_checkins': recent_checkins,
        'projects': projects,
        'employees': employees,
    }
    return render(request, 'index2.html', context)

def create_project(request):
    employees = EmployeeRegistrationWorkforce.objects.all()
    print("employees",employees)

    if request.method == "POST":

        '''Projects.objects.create(
            projectname=request.POST.get('projectname'),
            projectcode=request.POST.get('projectcode'),
            clientname=request.POST.get('clientname'),
            supervisor=request.POST.get('supervisor'),

            projectstartdate=request.POST.get('projectstartdate'),
            projectenddate=request.POST.get('projectenddate'),

            shiftstarttime=request.POST.get('shiftstarttime'),
            shiftendtime=request.POST.get('shiftendtime'),

            threshold=request.POST.get('threshold'),

            geozone=request.POST.get('geozone'),
            siteaddress=request.POST.get('siteaddress'),
            description=request.POST.get('description'),
        )'''

        def _to_float(value):
            try:
                return float(value)
            except (TypeError, ValueError):
                return None

        project = ProjectAttendance.objects.create(
            projectname      = request.POST.get('projectname'),
            projectcode      = request.POST.get('projectcode'),
            clientname       = request.POST.get('clientname'),
            projectstartdate = request.POST.get('projectstartdate')or None,
            projectenddate   = request.POST.get('projectenddate')or None,
            shiftstarttime   = request.POST.get('shiftstarttime')or None,
            shiftendtime     = request.POST.get('shiftendtime')or None,
            threshold        = request.POST.get('threshold')or None,
            site_latitude    = _to_float(request.POST.get('site_latitude')),
            site_longitude   = _to_float(request.POST.get('site_longitude')),
            siteaddress      = request.POST.get('siteaddress'),
            description      = request.POST.get('description', ''),
        )



        supervisor_empno = request.POST.get('supervisor')
        if supervisor_empno:
            sup_emp = EmployeeRegistrationWorkforce.objects.filter(empno=supervisor_empno).first()
            if sup_emp:
                ProjectEmployee.objects.get_or_create(
                    project=project, employee=sup_emp, defaults={'role': 'Supervisor'}
                )

        # ProjectEmployee.objects.create(
        #         project=request.POST.get('projectname'),
        #         employee=request.POST.get('supervisor'),
        #     )
        return redirect('index2')

    return render_page(request, 'project.html',{"employees":employees})


# class UserLoginAPIView(APIView):

#     def post(self, request):

#         empid = request.data.get('empid')
#         password = request.data.get('password')

#         if not empid or not password:
#             return Response(
#                 {
#                     'status': False,
#                     'message': 'empid and Password required'
#                 },
#                 status=status.HTTP_400_BAD_REQUEST
#             )

#         try:
#             user_obj = User.objects.get(empid=empid)

#         except User.DoesNotExist:
#             return Response(
#                 {
#                     'status': False,
#                     'message': 'Employee Number Not Found'
#                 },
#                 status=status.HTTP_404_NOT_FOUND
#             )

#         user = authenticate(
#             request,
#             username=user_obj.username,
#             password=password
#         )

#         if user is not None:

#             return Response(
#                 {
#                     'status': True,
#                     'message': 'Login Successful',
#                     'user_id': user.id,
#                     'username': user.username,
#                     'empid': user.empid,
#                 },
#                 status=status.HTTP_200_OK
#             )

#         return Response(
#             {
#                 'status': False,
#                 'message': 'Invalid Password'
#             },
#             status=status.HTTP_401_UNAUTHORIZED
#         )    





def _get_employee(empno):
    return EmployeeRegistrationWorkforce.objects.filter(empno=empno).first()

def _role_in_project(empno, project_id):
    pe = ProjectEmployee.objects.filter(
        project_id=project_id,
        employee__empno=empno
    ).first()
    return pe.role if pe else None

def _is_supervisor(empno, project_id):
    return _role_in_project(empno, project_id) == 'Supervisor'

def _is_web_admin(user):
    return user.is_superuser

def _is_web_admin(user):
    """Full admin — sees everything. Adjust this check to whatever flag you use for admins."""
    return user.is_superuser or user.is_staff

def render_page(request, template_name, context=None):
    context = context or {}
    context['is_web_admin'] = _is_web_admin(request.user)
    return render(request, template_name, context)

def _supervised_project_ids(empid):
    """All project IDs where this empid is an active Supervisor."""
    return list(
        ProjectEmployee.objects.filter(
            employee__empno=empid,
            role='Supervisor',
            deletestatus=0
        ).values_list('project_id', flat=True)
    )













class UserLoginAPIView(APIView):

    def post(self, request):

        empid = request.data.get('empid')
        password = request.data.get('password')

        if not empid or not password:
            return Response(
                {
                    'status': False,
                    'message': 'Empno and Password required'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user_obj = User.objects.get(empid=empid)

        except User.DoesNotExist:
            return Response(
                {
                    'status': False,
                    'message': 'Employee Number Not Found'
                },
                status=status.HTTP_404_NOT_FOUND
            )

        user = authenticate(
            request,
            username=user_obj.username,
            password=password
        )

        if user is not None:

            refresh = RefreshToken.for_user(user)

            return Response(
                {
                    'status': True,
                    'message': 'Login Successful',
                    'user_id': user.id,
                    'username': user.username,
                    'empid': user.empid,
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                },
                status=status.HTTP_200_OK
            )

        return Response(
            {
                'status': False,
                'message': 'Invalid Password'
            },
            status=status.HTTP_401_UNAUTHORIZED
        )
    


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_api(request):
    """
    POST /logout/
    Body: { refresh }

    Blacklists the refresh token so it can never be used again to
    get a new access token, even if it leaks.
    """
    refresh_token = request.data.get("refresh")
    if not refresh_token:
        return Response({"status": False, "message": "refresh token required"}, status=400)

    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
    except TokenError:
        return Response({"status": False, "message": "Invalid or already-blacklisted token"}, status=400)

    return Response({"status": True, "message": "Logged out successfully"})

# class UserRegisterAPIView(APIView):

#     def post(self, request):

#         empid = request.data.get('empid')

#         # Check employee exists
#         employee_exists = EmployeeRegistrationWorkforce.objects.filter(
#             empid=empid
#         ).exists()

#         if not employee_exists:
#             return Response(
#                 {
#                     'status': False,
#                     'message': 'Employee not found. Registration not allowed.'
#                 },
#                 status=status.HTTP_400_BAD_REQUEST
#             )

#         serializer = UserRegisterSerializer(data=request.data)

#         if serializer.is_valid():

#             serializer.save()

#             return Response(
#                 {
#                     'status': True,
#                     'message': 'User Registered Successfully',
#                     'data': serializer.data
#                 },
#                 status=status.HTTP_201_CREATED
#             )

#         return Response(
#             {
#                 'status': False,
#                 'errors': serializer.errors
#             },
#             status=status.HTTP_400_BAD_REQUEST
#         ) 

class UserRegisterAPIView(APIView):

    def post(self, request):

        empid = request.data.get('empid')

        # CHECK EMPLOYEE EXISTS
        employee_exists = EmployeeRegistrationWorkforce.objects.filter(
            empno=empid
        ).exists()

        if not employee_exists:
            return Response(
                {
                    'status': False,
                    'message': 'Employee not found. Registration not allowed.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # CHECK EMPNO ALREADY REGISTERED
        already_registered = User.objects.filter(
            empid=empid
        ).exists()

        if already_registered:
            return Response(
                {
                    'status': False,
                    'message': 'This Employee Number is already registered.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = UserRegisterSerializer(data=request.data)

        if serializer.is_valid():

            serializer.save()

            return Response(
                {
                    'status': True,
                    'message': 'User Registered Successfully',
                    'data': serializer.data
                },
                status=status.HTTP_201_CREATED
            )

        return Response(
            {
                'status': False,
                'errors': serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    








@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def face_enroll(request):
    empid = request.user.empid
    image = request.FILES.get("image")

    if not empid or not image:
        return Response({"error": "empid and image required"}, status=400)

    employee = EmployeeRegistrationWorkforce.objects.filter(empno=empid).first()

    if not employee:
        return Response({"error": "Employee not found"}, status=404)
    try:
        enroll_employee(
           employee_id=empid,
           image_bytes_list=[image.read()]
        )

        return Response({
           "message": "Face enrolled successfully",
           "empid": empid
        })
    except ValueError as e:
        return Response({"error": str(e)}, status=400)



'''@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def face_check_in(request):
    empid = request.data.get("empid") or request.data.get("employee_id")
    image = request.FILES.get("image")
    lat   = request.data.get("latitude")
    lon   = request.data.get("longitude")
    project_id = request.data.get("project_id")
    project_name = request.data.get("project_name") or "NAN"

    if not empid or not image:
        return Response({"error": "empid and image required"}, status=400)
    if not lat or not lon:
        return Response({"error": "latitude and longitude required"}, status=400)

    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return Response({"error": "Invalid coordinates"}, status=400)

    employee = EmployeeRegistrationWorkforce.objects.filter(empno=empid).first()

    if not employee:
        return Response({"error": "Employee not found"}, status=404)

    project = None
    if project_id:
        project = ProjectAttendance.objects.filter(id=project_id).first()

    task   = verify_face_task.delay(empid, image.read())
    result = task.get(timeout=30)

    if not result["matched"]:
        return Response({
            "matched": False,
            "message": "Face verification failed",
            "confidence": result["confidence"]
        }, status=400)

    # Get place name from coordinates
    place = get_place_name(lat, lon)

    attendance, created = Attendance.objects.get_or_create(
        employee=employee,
        date=now().date(),
        defaults={
            "check_in":          now().time(),
            "status":            "Present",
            "checkin_latitude":  lat,
            "checkin_longitude": lon,
            "checkin_place":     place,   # ← SAVE
            "project": project,
            "project_name": project.projectname if project else project_name,
        }
    )

    if not created:
        return Response({
            "matched": True,
            "message": "Already checked in today",
            "empid": empid
        })

    return Response({
        "matched":           True,
        "message":           "Check-in successful",
        "empid":             empid,
        "confidence":        result["confidence"],
        "checkin_latitude":  lat,
        "checkin_longitude": lon,
        "checkin_place":     place,   # ← RETURN TO APP
    })'''



@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def face_check_in(request):
    empid = request.user.empid
    image = request.FILES.get("image")
    lat   = request.data.get("latitude")
    lon   = request.data.get("longitude")
    project_id = request.data.get("project_id")
    request_id = request.data.get("request_id")

    if not empid or not image:
        return Response({"error": "empid and image required"}, status=400)
    if not lat or not lon:
        return Response({"error": "latitude and longitude required"}, status=400)

    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return Response({"error": "Invalid coordinates"}, status=400)

    employee = EmployeeRegistrationWorkforce.objects.filter(empno=empid).first()
    if not employee:
        return Response({"error": "Employee not found"}, status=404)

    project = None
    if project_id:
        project = ProjectAttendance.objects.filter(id=project_id).first()
        if not project:
            return Response({"error": "Project not found"}, status=404)

    if project and project.shiftstarttime and project.shiftendtime:
        now_time = localtime(now()).time()
        if now_time < project.shiftstarttime or now_time > project.shiftendtime:
            return Response({
                "error":       "Check-in not allowed outside shift hours",
                "shift_start": str(project.shiftstarttime),
                "shift_end":   str(project.shiftendtime),
            }, status=400)


    # ---- DEDUP CHECK (ADD) ----
    if request_id:
        existing_req = Attendance.objects.filter(request_id=request_id).first()
        if existing_req:
            return Response({
                "matched": True,
                "message": "Check-in successful",
                "empid": empid,
                "checkin_latitude": existing_req.checkin_latitude,
                "checkin_longitude": existing_req.checkin_longitude,
                "checkin_place": existing_req.checkin_place,
            })

    # ---- ONE ACTIVE CHECK-IN ACROSS ALL PROJECTS (ADD) ----
    open_attendance = Attendance.objects.filter(
        employee=employee,
        date=localtime(now()).date(),
        check_in__isnull=False,
        check_out__isnull=True
    ).first()

    if open_attendance:
        return Response({
            "matched": True,
            "error": "already_checked_in",
            "message": f"You are already checked in to {open_attendance.project.projectname if open_attendance.project else 'another project'}. Please check out first.",
            "active_project": open_attendance.project.projectname if open_attendance.project else None,
            "active_project_id": open_attendance.project_id,
        })

    # ---- FACE VERIFY ----
    task   = verify_face_task.delay(empid, image.read())
    result = task.get(timeout=30)

    if not result["matched"]:
        return Response({
            "matched": False,
            "message": "Face verification failed",
            "confidence": result["confidence"]
        }, status=400)

    place = get_place_name(lat, lon)

    # ---- CREATE NEW RECORD (CHANGED — no more get_or_create, allow multiple per day for different projects) ----
    attendance = Attendance.objects.create(
        employee=employee,
        project=project,                 # ADD
        date=now().date(),
        #check_in=now().time(),
        check_in=localtime(now()).time(),
        status="Present",
        checkin_latitude=lat,
        checkin_longitude=lon,
        checkin_place=place,
        request_id=request_id,           # ADD
    )


    if project and project.site_latitude and project.site_longitude:
        from math import radians, sin, cos, sqrt, atan2
        def _haversine(la1, lo1, la2, lo2):
            R = 6371000
            p1, p2 = radians(la1), radians(la2)
            a = sin(radians(la2-la1)/2)**2 + cos(p1)*cos(p2)*sin(radians(lo2-lo1)/2)**2
            return R * 2 * atan2(sqrt(a), sqrt(1-a))
        distance = _haversine(lat, lon, project.site_latitude, project.site_longitude)

        is_supervisor = ProjectEmployee.objects.filter(
            project=project, employee=employee, role='Supervisor'
        ).exists()
        if distance > 100 and not is_supervisor:
            Violation.objects.create(
                project         = project,
                employee        = employee,
                empno           = employee.empno,
                violation_date  = now().date(),
                description     = f"Checked in {distance:.0f}m away from site (limit: 100m). Location: {place}",
                location        = f"{lat},{lon}",
                raised_by_empno = "SYSTEM",
                status          = "Pending",
            )




    return Response({
        "matched":           True,
        "message":           "Check-in successful",
        "empid":             empid,
        "confidence":        result["confidence"],
        "checkin_latitude":  lat,
        "checkin_longitude": lon,
        "checkin_place":     place,
        "project_id":        project.id if project else None,
        "project_name":      project.projectname if project else None,
    })

'''@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def face_check_out(request):
    empid = request.data.get("empid") or request.data.get("employee_id")
    image = request.FILES.get("image")
    lat   = request.data.get("latitude")
    lon   = request.data.get("longitude")

    if not empid or not image:
        return Response({"error": "empid and image required"}, status=400)
    if not lat or not lon:
        return Response({"error": "latitude and longitude required"}, status=400)

    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return Response({"error": "Invalid coordinates"}, status=400)

    employee = EmployeeRegistrationWorkforce.objects.filter(empno=empid).first()
    if not employee:
        return Response({"error": "Employee not found"}, status=404)

    task   = verify_face_task.delay(empid, image.read())
    result = task.get(timeout=30)

    if not result["matched"]:
        return Response({
            "matched": False,
            "message": "Face verification failed",
            "confidence": result["confidence"]
        }, status=400)

    attendance = Attendance.objects.filter(
        employee=employee,
        date=now().date()
    ).first()

    if not attendance:
        return Response({
            "message": "No check-in found today. Please check in first.",
            "empid": empid
        }, status=400)

    if attendance.check_out:
        return Response({
            "matched": True,
            "message": "Already checked out today",
            "empid": empid
        })

    # Get place name from coordinates
    place = get_place_name(lat, lon)

    attendance.check_out          = now().time()
    attendance.checkout_latitude  = lat
    attendance.checkout_longitude = lon
    attendance.checkout_place     = place   # ← SAVE
    attendance.save()

    return Response({
        "matched":            True,
        "message":            "Check-out successful",
        "empid":              empid,
        "confidence":         result["confidence"],
        "checkout_latitude":  lat,
        "checkout_longitude": lon,
        "checkout_place":     place,   # ← RETURN TO APP
    })'''


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def face_check_out(request):
    empid = request.user.empid
    image = request.FILES.get("image")
    lat   = request.data.get("latitude")
    lon   = request.data.get("longitude")
    project_id = request.data.get("project_id")  # ADD

    if not empid or not image:
        return Response({"error": "empid and image required"}, status=400)
    if not lat or not lon:
        return Response({"error": "latitude and longitude required"}, status=400)

    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return Response({"error": "Invalid coordinates"}, status=400)

    employee = EmployeeRegistrationWorkforce.objects.filter(empno=empid).first()
    if not employee:
        return Response({"error": "Employee not found"}, status=404)

    # ---- FIND THE OPEN CHECK-IN (CHANGED — no longer filter by date, filter by check_out null) ----
    attendance = Attendance.objects.filter(
        employee=employee,
        date=localtime(now()).date(),
        check_in__isnull=False,
        check_out__isnull=True
    ).first()

    if not attendance:
        return Response({
            "matched": True,
            "error": "no_open_checkin",          # ADD
            "message": "No active check-in found. Please check in first.",
            "empid": empid
        }, status=400)

    # ---- WRONG PROJECT CHECK (ADD) ----
    if project_id and str(attendance.project_id) != str(project_id):
        return Response({
            "matched": True,
            "error": "wrong_project",
            "message": f"You are checked in to {attendance.project.projectname}, not this project.",
            "active_project": attendance.project.projectname,
            "active_project_id": attendance.project_id,
        })

    # ---- FACE VERIFY ----
    task   = verify_face_task.delay(empid, image.read())
    result = task.get(timeout=30)

    if not result["matched"]:
        return Response({
            "matched": False,
            "message": "Face verification failed",
            "confidence": result["confidence"]
        }, status=400)

    place = get_place_name(lat, lon)

    attendance.check_out          = localtime(now()).time()
    attendance.checkout_latitude  = lat
    attendance.checkout_longitude = lon
    attendance.checkout_place     = place
    attendance.save()

    project = attendance.project
    if project and project.site_latitude and project.site_longitude:
        from math import radians, sin, cos, sqrt, atan2
        def _haversine(la1, lo1, la2, lo2):
            R = 6371000
            p1, p2 = radians(la1), radians(la2)
            a = sin(radians(la2-la1)/2)**2 + cos(p1)*cos(p2)*sin(radians(lo2-lo1)/2)**2
            return R * 2 * atan2(sqrt(a), sqrt(1-a))
        distance = _haversine(lat, lon, project.site_latitude, project.site_longitude)
        is_supervisor = ProjectEmployee.objects.filter(
            project=project, employee=employee, role='Supervisor'
        ).exists()
        if distance > 100 and not is_supervisor:
            Violation.objects.create(
                project         = project,
                employee        = employee,
                empno           = employee.empno,
                violation_date  = now().date(),
                description     = f"Checked out {distance:.0f}m away from site (limit: 100m). Location: {place}",
                location        = f"{lat},{lon}",
                raised_by_empno = "SYSTEM",
                status          = "Pending",
            )

    return Response({
        "matched":            True,
        "message":            "Check-out successful",
        "empid":              empid,
        "confidence":         result["confidence"],
        "checkout_latitude":  lat,
        "checkout_longitude": lon,
        "checkout_place":     place,
        "project_id":         attendance.project_id,
        "project_name":       attendance.project.projectname if attendance.project else None,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def check_face_enrollment(request):
    empid = request.user.empid

    if not empid:
        return Response({
            "enrolled": False,
            "error": "empid required"
        }, status=400)

    face_exists = FaceEnrollment.objects.filter(
        employee_id=empid,
        is_active=True
    ).exists()

    return Response({
        "enrolled": face_exists,
        "empid": empid
    })


'''@api_view(["GET"])
@permission_classes([IsAuthenticated])
def attendance_status(request):
    empid = request.user.empid
    employee = EmployeeRegistrationWorkforce.objects.filter(empno=empid).first()
    if not employee:
        return Response({"isCheckedIn": False})

    today = localtime(now()).date()

    open_attendance = Attendance.objects.filter(
        employee=employee,
        date=today,
        check_in__isnull=False,
        check_out__isnull=True
    ).first()

    if not open_attendance:
        return Response({"isCheckedIn": False})

    return Response({
        "isCheckedIn": True,
        "project_id": open_attendance.project_id,
        "project_name": open_attendance.project.projectname if open_attendance.project else None,
        "check_in_time": open_attendance.check_in.strftime("%H:%M:%S") if open_attendance.check_in else None,
        "check_in_place": open_attendance.checkin_place,
    })'''




'''@api_view(["GET"])
@permission_classes([IsAuthenticated])
def attendance_status(request):
    empid = request.user.empid
    employee = EmployeeRegistrationWorkforce.objects.filter(empno=empid).first()
    if not employee:
        return Response({"is_checked_in": False, "is_checked_out": False})

    today = localtime(now()).date()

    attendance = Attendance.objects.filter(
        employee=employee,
        date=today,
        check_in__isnull=False
    ).order_by('-check_in').first()

    if not attendance:
        return Response({"is_checked_in": False, "is_checked_out": False})

    return Response({
        "is_checked_in": True,
        "is_checked_out": attendance.check_out is not None,
        "project_id": attendance.project_id,
        "project_name": attendance.project.projectname if attendance.project else None,
        "check_in_time": attendance.check_in.strftime("%H:%M:%S") if attendance.check_in else None,
        "check_out_time": attendance.check_out.strftime("%H:%M:%S") if attendance.check_out else None,
        "checkin_place": attendance.checkin_place,
        "checkout_place": attendance.checkout_place,
    })'''



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def attendance_status(request):
    empid = request.user.empid
    employee = EmployeeRegistrationWorkforce.objects.filter(empno=empid).first()
    if not employee:
        return Response({"is_checked_in": False, "is_checked_out": False})

    today = localtime(now()).date()

    open_attendance = Attendance.objects.filter(
        employee=employee,
        date=today,
        check_in__isnull=False,
        check_out__isnull=True
    ).order_by('-check_in').first()

    if open_attendance:
        return Response({
            "is_checked_in": True,
            "is_checked_out": False,
            "project_id": open_attendance.project_id,
            "project_name": open_attendance.project.projectname if open_attendance.project else None,
            "check_in_time": open_attendance.check_in.strftime("%H:%M:%S") if open_attendance.check_in else None,
            "check_out_time": None,
            "checkin_place": open_attendance.checkin_place,
            "checkout_place": None,
        })

    last_completed = Attendance.objects.filter(
        employee=employee,
        date=today,
        check_in__isnull=False,
        check_out__isnull=False
    ).order_by('-check_out').first()

    if last_completed:
        return Response({
            "is_checked_in": False,
            "is_checked_out": True,
            "project_id": last_completed.project_id,
            "project_name": last_completed.project.projectname if last_completed.project else None,
            "check_in_time": last_completed.check_in.strftime("%H:%M:%S") if last_completed.check_in else None,
            "check_out_time": last_completed.check_out.strftime("%H:%M:%S") if last_completed.check_out else None,
            "checkin_place": last_completed.checkin_place,
            "checkout_place": last_completed.checkout_place,
        })

    return Response({"is_checked_in": False, "is_checked_out": False})



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_project_checkins(request):
    empid = request.user.empid
    employee = EmployeeRegistrationWorkforce.objects.filter(empno=empid).first()
    if not employee:
        return Response({"status": False, "checkins": []})

    records = Attendance.objects.filter(
        employee=employee,
        check_in__isnull=False
    ).order_by('-date', '-check_in')[:50]

    checkins = [{
        "id": r.id,
        "project_id": r.project_id,
        "project_name": r.project.projectname if r.project else "N/A",
        "date":str(r.date),
        "check_in_time": f"{r.date} {r.check_in}" if r.check_in else None,
        "check_out_time": f"{r.date} {r.check_out}" if r.check_out else None,
        "checkin_place": r.checkin_place or "",
        "checkout_place": r.checkout_place or "",
        "checkin_latitude": r.checkin_latitude,
        "checkin_longitude": r.checkin_longitude,
        "checkout_latitude": r.checkout_latitude,
        "checkout_longitude": r.checkout_longitude,
        "status":r.status, 
    } for r in records]

    return Response({"status": True, "checkins": checkins})



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_profile(request):
    empid = request.user.empid

    if not empid:
        return Response({"error": "empid required"}, status=400)

    employee = EmployeeRegistrationWorkforce.objects.filter(empno=empid).first()
    if not employee:
        return Response({"error": "Employee not found"}, status=404)

    # ---- Personal & Employment ----
    full_name = employee.empname
    designation = employee.trade1stskill or "N/A"
    worker_type = employee.workcategories or "N/A"
    status_label = "Inactive" if employee.terminationstatus else "Active"
    joined_date = employee.joiningdate.strftime("%d %b %Y") if employee.joiningdate else None

    # ---- Work Permit ----
    work_permit_no = employee.wpno
    wp_expiry = employee.wpexpirydate.isoformat() if employee.wpexpirydate else None

    # ---- Current Project Assignment ----
    open_attendance = Attendance.objects.filter(
        employee=employee,
        check_out__isnull=True
    ).order_by('-date').first()

    project_name = None
    project_role = designation
    supervisor_name = None
    shift_hours = None
    site_address = None

    if open_attendance and open_attendance.project:
        project_name = open_attendance.project.projectname
    elif open_attendance:
        project_name = open_attendance.project_name

    # Try to enrich with ProjectAttendance details (matched by name)
    if project_name:
        '''proj_attendance = Projects.objects.filter(projectname=project_name).first()
        if proj_attendance:
            supervisor_name = proj_attendance.supervisor'''
        proj_attendance = ProjectAttendance.objects.filter(projectname=project_name).first()
        if proj_attendance:
            sup_pe = ProjectEmployee.objects.filter(project=proj_attendance, role='Supervisor').select_related('employee').first()
            supervisor_name = sup_pe.employee.empname if sup_pe else None
            site_address = proj_attendance.siteaddress
            if proj_attendance.shiftstarttime and proj_attendance.shiftendtime:
                shift_hours = f"{proj_attendance.shiftstarttime.strftime('%H:%M')} - {proj_attendance.shiftendtime.strftime('%H:%M')}"

    # ---- Attendance Summary (current month) ----
    today = now().date()
    month_records = Attendance.objects.filter(
        employee=employee,
        date__year=today.year,
        date__month=today.month
    )

    days_present = month_records.filter(status='Present').count()
    days_absent = month_records.filter(status='Absent').count()

    # "Late" - if you don't have a dedicated status, you can compute based on check_in vs shift start.
    # For now, fallback to 0 unless you add a 'Late' status value.
    days_late = month_records.filter(status='Half Day').count()

    total_days = month_records.exclude(status='Leave').count()
    attendance_rate = round((days_present / total_days) * 100) if total_days > 0 else None

    last_record = Attendance.objects.filter(employee=employee).order_by('-date', '-check_in').first()
    last_check_in = None
    last_check_out = None
    if last_record:
        if last_record.check_in:
            last_check_in = f"{last_record.date.strftime('%d %b %Y')} - {last_record.check_in.strftime('%I:%M %p')}"
        if last_record.check_out:
            last_check_out = f"{last_record.date.strftime('%d %b %Y')} - {last_record.check_out.strftime('%I:%M %p')}"

    # ---- Certifications (built from expiry-date fields on EmployeeRegistrationWorkforce) ----
    certifications = []

    cert_fields = [
        ("CSOC — Construction Safety Orientation Course", employee.csocawshicexpirydate),
        ("OPSOC — Operations Safety Orientation Course", employee.opsocawshppexpirydate),
        ("MHSOC — Materials Handling Safety Orientation", employee.mhsocpwcpoexpirydate),
        ("Tunnel SOC — Tunnelling Safety Orientation", employee.tunnelsocexpirydate),
    ]

    for name, expiry in cert_fields:
        if not expiry:
            continue
        days_left = (expiry - today).days
        if days_left < 0:
            cert_status = "expired"
        elif days_left <= 60:
            cert_status = "expiring_soon"
        else:
            cert_status = "valid"

        certifications.append({
            "name": name,
            "status": cert_status,
            "expiry_date": expiry.strftime("%d %b %Y"),
        })

    return Response({
        "full_name": full_name,
        "designation": designation,
        "worker_type": worker_type,
        "status": status_label,
        "joined_date": joined_date,

        "ic_passport_no": employee.passportno or employee.nricno,
        "contact_number": employee.contact,
        "email": employee.email,
        "nationality": employee.nationality,

        "work_permit_no": work_permit_no,
        "work_permit_expiry": wp_expiry,

        "project_name": project_name,
        "project_role": project_role,
        "supervisor_name": supervisor_name,
        "shift_hours": shift_hours,
        "site_address": site_address,

        "attendance_summary": {
            "days_present": days_present,
            "days_absent": days_absent,
            "days_late": days_late,
            "attendance_rate": attendance_rate,
            "last_check_in": last_check_in,
            "last_check_out": last_check_out,
        },

        "certifications": certifications,
    })




class ProjectListCreateAPIView(generics.ListCreateAPIView):
    queryset = ProjectAttendance.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]





@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_projects(request):
    """
    GET /my-projects/

    Returns every project this empno is assigned to, plus the role
    (Supervisor / Employee) they hold in that specific project.
    """
    empid = request.user.empid
    if not empid:
        return Response({"status": False, "message": "empid required"}, status=400)

    employee = _get_employee(empid)
    if not employee:
        return Response({"status": False, "message": "Employee not found"}, status=404)

    assignments = ProjectEmployee.objects.filter(
        employee=employee
    ).select_related('project')

    projects = [{
        "project_id":    a.project.id,
        "project_name":  a.project.projectname,
        #"project_code":  a.project.projectcode,
        #"site_address":  a.project.siteaddress,
        #"shift_start":   a.project.shiftstarttime.strftime("%H:%M") if a.project.shiftstarttime else None,
        #"shift_end":     a.project.shiftendtime.strftime("%H:%M") if a.project.shiftendtime else None,
        "role":          a.role,                 # ← what drives the UI inside this project
    } for a in assignments]

    return Response({"status": True, "empno": employee.empno, "projects": projects})



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def project_employee_list(request, project_id):
    """
    GET /projects/<project_id>/employees/?empid=xxx

    Only a user who is Supervisor IN THIS PROJECT can see the employee list.
    A user who is merely an Employee here (even if Supervisor elsewhere)
    gets a 403.
    """
    requester_empid = request.user.empid
    if not requester_empid:
        return Response({"status": False, "message": "empid required"}, status=400)

    role = _role_in_project(requester_empid, project_id)
    if role is None:
        return Response({"status": False, "message": "You are not assigned to this project."}, status=403)

    if role != 'Supervisor':
        return Response(
            {"status": False, "message": "Only the project supervisor can view the employee list."},
            status=403
        )

    project = ProjectAttendance.objects.filter(id=project_id).first()
    if not project:
        return Response({"status": False, "message": "Project not found."}, status=404)

    assignments = ProjectEmployee.objects.filter(project=project).select_related('employee')

    employees = [{
        "empno":       a.employee.empno,
        "empname":     a.employee.empname,
        "role":        a.role,
        "designation": a.employee.trade1stskill,
        "contact":     a.employee.contact,
    } for a in assignments]

    return Response({"status": True, "project_name": project.projectname, "employees": employees})



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def project_employee_profile(request, project_id):
    """
    GET /projects/<project_id>/employee-profile/?empid=xxx&target_empno=yyy

    - empid       = the user making the request
    - target_empno = whose profile to view (defaults to empid's own profile)

    Rules:
      - If requester is Supervisor in this project → can view any employee
        assigned to this project.
      - If requester is Employee in this project → can ONLY view their own
        profile (target_empno must equal empid, or be omitted).
      - If requester is not assigned to this project at all → 403.
    """
    requester_empid = request.user.empid
    target_empno = request.GET.get("target_empno") or requester_empid

    if not requester_empid:
        return Response({"status": False, "message": "empid required"}, status=400)

    role = _role_in_project(requester_empid, project_id)
    if role is None:
        return Response({"status": False, "message": "You are not assigned to this project."}, status=403)

    if role == 'Employee' and target_empno != requester_empid:
        return Response(
            {"status": False, "message": "Employees can only view their own profile."},
            status=403
        )

    # Confirm target employee is actually assigned to this project
    target_in_project = ProjectEmployee.objects.filter(
        project_id=project_id,
        employee__empno=target_empno
    ).exists()

    if not target_in_project:
        return Response({"status": False, "message": "That employee is not part of this project."}, status=404)

    employee = _get_employee(target_empno)
    if not employee:
        return Response({"status": False, "message": "Employee not found."}, status=404)

    project = ProjectAttendance.objects.filter(id=project_id).first()

    # ---- Attendance summary for this employee, scoped to this project ----
    today = now().date()
    month_records = Attendance.objects.filter(
        employee=employee,
        project_id=project_id,
        date__year=today.year,
        date__month=today.month
    )
    days_present = month_records.filter(status='Present').count()
    days_absent = month_records.filter(status='Absent').count()
    total_days = month_records.exclude(status='Leave').count()
    attendance_rate = round((days_present / total_days) * 100) if total_days > 0 else None

    last_record = Attendance.objects.filter(
        employee=employee, project_id=project_id
    ).order_by('-date', '-check_in').first()

    return Response({
        "status": True,
        "empno": employee.empno,
        "empname": employee.empname,
        "role_in_project": _role_in_project(target_empno, project_id),
        "designation": employee.trade1stskill,
        "nationality": employee.nationality,
        "contact": employee.contact,
        "work_permit_no": employee.wpno,
        "work_permit_expiry": employee.wpexpirydate.isoformat() if employee.wpexpirydate else None,
        "project_name": project.projectname if project else None,
        "attendance_summary": {
            "days_present": days_present,
            "days_absent": days_absent,
            "attendance_rate": attendance_rate,
            "last_check_in": str(last_record.check_in) if last_record and last_record.check_in else None,
            "last_check_out": str(last_record.check_out) if last_record and last_record.check_out else None,
        },
    })



def _violation_detail(v):
    return {
        "id":                v.id,
        "project_id":        v.project_id,
        "project_name":      v.project.projectname,
        "empno":             v.empno,
        "employee_name":     v.employee.empname,
        "violation_type":    v.violation_type.name if v.violation_type else None,
        "violation_date":    str(v.violation_date),
        "description":       v.description,
        "location":          v.location,
        "evidence_url":      v.evidence.url if v.evidence else None,
        "raised_by_empno":   v.raised_by_empno,
        "status":            v.status,
        "penalty":           v.penalty,
        "reviewed_by_empno": v.reviewed_by_empno,
        "reviewed_at":       str(v.reviewed_at) if v.reviewed_at else None,
        "review_remarks":    v.review_remarks,
        "created_at":        str(v.created_at),
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def violation_type_list(request):
    types = ViolationType.objects.filter(is_active=True).values("id", "name", "severity", "description")
    return Response({"status": True, "violation_types": list(types)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def submit_violation(request):
    """
    POST /violations/submit/
    Body: project_id, empno (the offending employee), raised_by_empno, description, ...

    The raiser must themselves be assigned to that project (supervisor or employee)
    so violations can't be filed from outside.
    """
    project_id      = request.data.get("project_id")
    empno           = request.data.get("empno", "").strip()
    raised_by_empno = request.user.empid
    description     = request.data.get("description", "").strip()

    if not project_id or not empno or not raised_by_empno or not description:
        return Response(
            {"status": False, "message": "project_id, empno, raised_by_empno and description are required."},
            status=400,
        )

    raiser_role = _role_in_project(raised_by_empno, project_id)
    if raiser_role is None:
        return Response({"status": False, "message": "You are not assigned to this project."}, status=403)

    employee = _get_employee(empno)
    if not employee:
        return Response({"status": False, "message": "Employee not found."}, status=404)

    target_in_project = ProjectEmployee.objects.filter(project_id=project_id, employee=employee).exists()
    if not target_in_project:
        return Response({"status": False, "message": "That employee is not part of this project."}, status=404)

    vtype = None
    vtype_id = request.data.get("violation_type_id")
    if vtype_id:
        vtype = ViolationType.objects.filter(id=vtype_id).first()

    v = Violation.objects.create(
        project_id=project_id,
        employee=employee,
        empno=employee.empno,
        violation_type=vtype,
        violation_date=request.data.get("violation_date") or now().date(),
        description=description,
        location=request.data.get("location", ""),
        evidence=request.FILES.get("evidence"),
        raised_by_empno=raised_by_empno,
        penalty=request.data.get("penalty", ""),
        status="Pending",
    )

    return Response(
        {"status": True, "message": "Violation submitted.", "violation": _violation_detail(v)},
        status=201,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def violation_list(request):
    """
    GET /violations/?empid=xxx&project_id=yyy
    - Supervisor in that project → sees all violations for the project
      (optionally filtered by ?status=)
    - Employee in that project   → sees only their own violations
    """
    empid = request.user.empid
    project_id = request.GET.get("project_id")

    if not empid or not project_id:
        return Response({"status": False, "message": "empid and project_id required"}, status=400)

    role = _role_in_project(empid, project_id)
    if role is None:
        return Response({"status": False, "message": "You are not assigned to this project."}, status=403)

    qs = Violation.objects.filter(project_id=project_id).select_related("employee", "violation_type")

    if role != 'Supervisor':
        qs = qs.filter(empno=empid)

    filter_status = request.GET.get("status")
    if filter_status:
        qs = qs.filter(status=filter_status)

    qs = qs.order_by("-created_at")
    return Response({"status": True, "violations": [_violation_detail(v) for v in qs]})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def supervisor_review_violation(request, violation_id):
    """
    POST /violations/<id>/review/
    Body: { reviewer_empno, action: "approve"|"reject", review_remarks, penalty }

    Only the Supervisor of that violation's project can review it.
    """
    try:
        v = Violation.objects.get(id=violation_id)
    except Violation.DoesNotExist:
        return Response({"status": False, "message": "Not found."}, status=404)

    reviewer_empno = request.user.empid
    if not reviewer_empno:
        return Response({"status": False, "message": "reviewer_empno required."}, status=400)

    if not _is_supervisor(reviewer_empno, v.project_id):
        return Response(
            {"status": False, "message": "Only this project's supervisor can review violations."},
            status=403
        )

    if v.status != "Pending":
        return Response({"status": False, "message": f"Violation is already '{v.status}'."}, status=400)

    action = request.data.get("action", "approve")

    v.reviewed_by_empno = reviewer_empno
    v.reviewed_at = now()
    v.review_remarks = request.data.get("review_remarks", "")
    if request.data.get("penalty"):
        v.penalty = request.data.get("penalty")

    v.status = "Rejected" if action == "reject" else "Reviewed"
    v.save()

    msg = "Violation rejected." if action == "reject" else "Violation reviewed and approved."
    return Response({"status": True, "message": msg, "violation": _violation_detail(v)})



def _document_detail(d):
    return {
        "id":               d.id,
        "project_id":       d.project_id,
        "project_name":     d.project.projectname,
        "empno":            d.empno,
        "employee_name":    d.employee.empname,
        "direction":        d.direction,
        "sent_by_empno":    d.sent_by_empno,
        "title":            d.title,
        "document_type":    d.document_type,
        "description":      d.description,
        "file_url":         d.file.url if d.file else None,
        "related_violation_id": d.related_violation_id,
        "status":           d.status,
        "acknowledged_at":  str(d.acknowledged_at) if d.acknowledged_at else None,
        "created_at":       str(d.created_at),
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def send_document(request):
    """
    POST /documents/send/
    Body: project_id, sender_empno, target_empno, title, file, ...

    - If sender is the project's Supervisor → direction = SUPERVISOR_TO_EMP,
      target_empno must be an Employee in this project.
    - If sender is an Employee in this project → direction = EMP_TO_SUPERVISOR,
      target_empno is ignored (always goes to that project's supervisor);
      the employee can only send documents about themselves.
    """
    project_id   = request.data.get("project_id")
    sender_empno = request.user.empid
    title        = request.data.get("title", "").strip()
    file_obj     = request.FILES.get("file")

    if not project_id or not sender_empno or not title or not file_obj:
        return Response(
            {"status": False, "message": "project_id, sender_empno, title and file are required."},
            status=400,
        )

    sender_role = _role_in_project(sender_empno, project_id)
    if sender_role is None:
        return Response({"status": False, "message": "You are not assigned to this project."}, status=403)

    if sender_role == 'Supervisor':
        target_empno = request.data.get("target_empno", "").strip()
        if not target_empno:
            return Response({"status": False, "message": "target_empno required."}, status=400)

        target_role = _role_in_project(target_empno, project_id)
        if target_role is None:
            return Response({"status": False, "message": "Target employee is not in this project."}, status=404)

        direction = "SUPERVISOR_TO_EMP"
        employee_for_record = _get_employee(target_empno)

    else:  # sender is a plain Employee — always goes to their project's supervisor
        direction = "EMP_TO_SUPERVISOR"
        employee_for_record = _get_employee(sender_empno)

    related_violation = None
    rv_id = request.data.get("related_violation_id")
    if rv_id:
        related_violation = Violation.objects.filter(id=rv_id, project_id=project_id).first()

    doc = ProjectDocument.objects.create(
        project_id=project_id,
        employee=employee_for_record,
        empno=employee_for_record.empno,
        direction=direction,
        sent_by_empno=sender_empno,
        title=title,
        document_type=request.data.get("document_type", "General"),
        description=request.data.get("description", ""),
        file=file_obj,
        related_violation=related_violation,
        status="Sent",
    )

    return Response(
        {"status": True, "message": "Document sent.", "document": _document_detail(doc)},
        status=201,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def document_list(request):
    """
    GET /documents/?empid=xxx&project_id=yyy
    - Supervisor in that project → sees all documents for the project
      (optionally ?direction= / ?empno= to filter to one employee)
    - Employee in that project   → sees only documents about themselves
    """
    empid = request.user.empid
    project_id = request.GET.get("project_id")

    if not empid or not project_id:
        return Response({"status": False, "message": "empid and project_id required"}, status=400)

    role = _role_in_project(empid, project_id)
    if role is None:
        return Response({"status": False, "message": "You are not assigned to this project."}, status=403)

    qs = ProjectDocument.objects.filter(project_id=project_id).select_related("employee")

    if role == 'Supervisor':
        target_empno = request.GET.get("empno")
        if target_empno:
            qs = qs.filter(empno=target_empno)
    else:
        qs = qs.filter(empno=empid)

    direction = request.GET.get("direction")
    if direction:
        qs = qs.filter(direction=direction)

    qs = qs.order_by("-created_at")
    return Response({"status": True, "documents": [_document_detail(d) for d in qs]})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def acknowledge_document(request, document_id):
    """
    POST /documents/<id>/acknowledge/
    Body: { empid }

    Whoever receives the document (supervisor or employee, depending on direction)
    can acknowledge it.
    """
    try:
        d = ProjectDocument.objects.get(id=document_id)
    except ProjectDocument.DoesNotExist:
        return Response({"status": False, "message": "Not found."}, status=404)

    empid = request.user.empid
    role = _role_in_project(empid, d.project_id)
    if role is None:
        return Response({"status": False, "message": "You are not assigned to this project."}, status=403)

    is_recipient = (
        (d.direction == "SUPERVISOR_TO_EMP" and empid == d.empno) or
        (d.direction == "EMP_TO_SUPERVISOR" and role == "Supervisor")
    )
    if not is_recipient:
        return Response({"status": False, "message": "You are not the recipient of this document."}, status=403)

    d.status = "Acknowledged"
    d.acknowledged_at = now()
    d.save()

    return Response({"status": True, "message": "Document acknowledged.", "document": _document_detail(d)})




@login_required(login_url='login_web')
def settings_view(request):
    return render_page(request, 'settings.html')



@login_required(login_url='login_web')
def tasks(request):
    return render_page(request, 'tasks.html')



@login_required(login_url='login_web')
def violationsadmin(request):
    if _is_web_admin(request.user):
        base_qs = Violation.objects.all()
    else:
        supervised_ids = _supervised_project_ids(request.user.empid)
        base_qs = Violation.objects.filter(project_id__in=supervised_ids)

    violations = (
        base_qs
        .select_related('employee', 'project', 'violation_type')
        .order_by('-created_at')
    )

    status_filter = request.GET.get('status')
    if status_filter in ('Pending', 'Reviewed', 'Rejected'):
        violations = violations.filter(status=status_filter)

    today = localtime(now()).date()

    for v in violations:
        name = v.employee.empname.split()
        if len(name) >= 2:
            v.initials = name[0][0] + name[-1][0]
        else:
            v.initials = name[0][:2].upper()

    pending_count = base_qs.filter(status='Pending').count()
    reviewed_today_count = base_qs.filter(
        status__in=['Reviewed', 'Rejected'],
        reviewed_at__date=today
    ).count()
    total_month_count = base_qs.filter(
        created_at__year=today.year,
        created_at__month=today.month
    ).count()

    context = {
        'violations': violations,
        'pending_count': pending_count,
        'reviewed_today_count': reviewed_today_count,
        'total_month_count': total_month_count,
        'status_filter': status_filter,
    }
    return render_page(request, 'violations.html', context)


@login_required(login_url='login_web')
def resolve_violation_admin(request, violation_id):
    v = get_object_or_404(Violation, id=violation_id)

    if request.method == "POST":
        action = request.POST.get('action', 'resolve')
        remarks = request.POST.get('review_remarks', '').strip()
        penalty = request.POST.get('penalty', '').strip()

        v.review_remarks = remarks
        if penalty:
            v.penalty = penalty
        v.reviewed_by_empno = request.user.username
        v.reviewed_at = now()
        v.status = 'Rejected' if action == 'reject' else 'Reviewed'
        v.save()

        messages.success(request, f"Violation for {v.empno} marked as {v.status}.")

    return redirect('violationsadmin')


@login_required(login_url='login_web')
def reports100726(request):
    employees = EmployeeRegistrationWorkforce.objects.annotate(
    days_present=Count(
        'attendance_records',
        filter=Q(attendance_records__status='Present')
    ),
    days_absent=Count(
        'attendance_records',
        filter=Q(attendance_records__status='Absent')
    ),
    days_leave=Count(
        'attendance_records',
        filter=Q(attendance_records__status='Leave')
    ),
    half_days=Count(
        'attendance_records',
        filter=Q(attendance_records__status='Half Day')
    )
    )
    for emp in employees:
        total_duration = timedelta()
        attendances = Attendance.objects.filter(employee=emp,check_in__isnull=False,check_out__isnull=False)

    for att in attendances:
        check_in = datetime.combine(att.date, att.check_in)
        check_out = datetime.combine(att.date, att.check_out)

        # Handles overnight shifts
        if check_out < check_in:
            check_out += timedelta(days=1)

        total_duration += (check_out - check_in)

    hours = int(total_duration.total_seconds() // 3600)
    minutes = int((total_duration.total_seconds() % 3600) // 60)

    emp.total_hours = f"{hours}h {minutes}m"
    context={"employees":employees}
    return render_page(request, 'reports.html',context)


@login_required(login_url='login_web')
def reports(request):
    selected_month = request.GET.get("month")
    attendance_filter = Q()
    if selected_month:
        year, month = map(int, selected_month.split("-"))

        attendance_filter &= Q(
            attendance_records__date__year=year,
            attendance_records__date__month=month
        )

        attendance_queryset = Attendance.objects.filter(
            date__year=year,
            date__month=month
        )

    else:
        attendance_queryset = Attendance.objects.all()
    employees = EmployeeRegistrationWorkforce.objects.annotate(
        days_present=Count(
            'attendance_records',
            filter=Q(attendance_records__status='Present')
        ),
        days_absent=Count(
            'attendance_records',
            filter=Q(attendance_records__status='Absent')
        ),
        days_leave=Count(
            'attendance_records',
            filter=Q(attendance_records__status='Leave')
        ),
        half_days=Count(
            'attendance_records',
            filter=Q(attendance_records__status='Half Day')
        )
    )

    # Calculate total active hours for each employee
    for emp in employees:
        total_duration = timedelta()

        attendances = Attendance.objects.filter(
            employee=emp,
            check_in__isnull=False,
            check_out__isnull=False
        )

        for attendance in attendances:
            start = datetime.combine(attendance.date, attendance.check_in)
            end = datetime.combine(attendance.date, attendance.check_out)

            # Handle overnight shifts
            if end < start:
                end += timedelta(days=1)

            total_duration += (end - start)

        total_minutes = int(total_duration.total_seconds() // 60)

        hours = total_minutes // 60
        minutes = total_minutes % 60

        emp.total_active_hours = f"{hours}h {minutes}m"
     # Employee initials
    for attendance in employees:
        name = attendance.empname.split()

        if len(name) >= 2:
            attendance.initials = (
                name[0][0] + name[-1][0]
            ).upper()
        else:
            attendance.initials = name[0][:2].upper()

    daily_data = []

    if selected_month:
       days = monthrange(year, month)[1]
    else:
      today = datetime.today()
      year = today.year
      month = today.month
      days = monthrange(year, month)[1]

    for day in range(1, days + 1):
        present_count = Attendance.objects.filter(
        date__year=year,
        date__month=month,
        date__day=day,
        status="Present"
        ).count()

        daily_data.append({
        "day": day,
        "count": present_count,
        })
    max_count = max([d["count"] for d in daily_data], default=1)
    if max_count == 0:
       max_count = 1
    for d in daily_data:
        d["height"] = int((d["count"] / max_count) * 100)
    month_title = ""
    if selected_month:
       dt = datetime.strptime(selected_month, "%Y-%m")
       month_title = dt.strftime("%B %Y")   # July 2026
    else:
      dt = datetime.today()
      month_title = dt.strftime("%B %Y")
      selected_month = dt.strftime("%Y-%m")
    days_in_month = monthrange(year, month)[1]
    employee_count = EmployeeRegistrationWorkforce.objects.count()
    present_count = Attendance.objects.filter(date__year=year,date__month=month,status="Present").count()
    total_expected = employee_count * days_in_month
    if total_expected:
       avg_attendance = round((present_count / total_expected) * 100)
    else:
       avg_attendance = 0
    today = datetime.today()
    current_month_violations = Violation.objects.filter(violation_date__year=today.year,violation_date__month=today.month).count()
    context = {
        "employees": employees,
        "attendance.initials":attendance.initials,
        "daily_data": daily_data,
        "selected_month": selected_month,
        "month_title": month_title,
        "avg_attendance":avg_attendance,
        "current_month_violations":current_month_violations
    }

    return render_page(request, "reports.html", context)





@login_required(login_url='login_web')
def attendance040726(request):
    emplist=Attendance.objects.all().order_by('-date')
    for attendance in emplist:
        name = attendance.employee.empname.split()
        if len(name) >= 2:
           attendance.initials = name[0][0] + name[-1][0]
        else:
          attendance.initials = name[0][:2]
    return render_page(request, 'attendance.html',{"emplist":emplist})



@login_required(login_url='login_web')
def attendanceworkingfine(request):
    status = request.GET.get('status')

    emplist = Attendance.objects.all().order_by('-date')

    if status:
        emplist = emplist.filter(status=status)

    for attendance in emplist:
        name = attendance.employee.empname.split()
        if len(name) >= 2:
            attendance.initials = name[0][0] + name[-1][0]
        else:
            attendance.initials = name[0][:2].upper()

    context = {
        "emplist": emplist,
        "selected_status": status,
    }

    return render_page(request, "attendance.html", context)



@login_required(login_url='login_web')
def attendance(request):

    projects = ProjectAttendance.objects.all()

    status = request.GET.get("status")
    selected_date = request.GET.get("date")
    project = request.GET.get("project")
    month = request.GET.get("month")
    export = request.GET.get("export")

    if _is_web_admin(request.user):
        emplist = Attendance.objects.all().order_by("-date")
    else:
        supervised_ids = _supervised_project_ids(request.user.empid)
        emplist = Attendance.objects.filter(
            project_id__in=supervised_ids
        ).order_by("-date")

    # Status Filter
    #if status:
        #emplist = emplist.filter(status=status)

    # Date Filter
    if selected_date:
        emplist = emplist.filter(date=selected_date)

    # Project Filter
    if project:
        emplist = emplist.filter(project_id=project)

    # Monthly Filter
    if month:
        year, month_no = month.split("-")
        emplist = emplist.filter(
            date__year=year,
            date__month=month_no
        )

    if _is_web_admin(request.user):
        violation_qs = Violation.objects.all()
    else:
        violation_qs = Violation.objects.filter(project_id__in=supervised_ids)

    if selected_date:
        violation_qs = violation_qs.filter(violation_date=selected_date)
    if project:
        violation_qs = violation_qs.filter(project_id=project)
    if month:
        year, month_no = month.split("-")
        violation_qs = violation_qs.filter(violation_date__year=year, violation_date__month=month_no)

    total_present = emplist.filter(status="Present").count()
    total_absent = emplist.filter(status="Absent").count()
    total_checked_out = emplist.filter(status="Present").exclude(check_out__isnull=True).count()
    total_violations = violation_qs.count()

    if status == "Present":
        emplist = emplist.filter(status="Present")
    elif status == "Absent":
        emplist = emplist.filter(status="Absent")
    elif status == "CheckedOut":
        emplist = emplist.filter(status="Present").exclude(check_out__isnull=True)
    elif status == "Violation":
        violation_filter = Q()
        for v in violation_qs:
            # Match the exact employee, date, and project of the violation
            violation_filter |= Q(employee=v.employee, date=v.violation_date, project=v.project)
        
        if violation_filter:
            emplist = emplist.filter(violation_filter)
        else:
            emplist = emplist.none() # If no violations, show an empty list

    # Employee initials
    for attendance in emplist:
        name = attendance.employee.empname.split()

        if len(name) >= 2:
            attendance.initials = (
                name[0][0] + name[-1][0]
            ).upper()
        else:
            attendance.initials = name[0][:2].upper()

        attendance.face_enrolled = FaceEnrollment.objects.filter(
            employee_id=attendance.employee.empno,
            is_active=True
        ).exists()

    # Export Excel
    if export == "excel":

        wb = Workbook()
        ws = wb.active
        ws.title = "Attendance"

        ws.append([
            "Employee",
            "Project",
            "Date",
            "Check In",
            "Check Out",
            "Hours",
            "Status"
        ])

        for i in emplist:
            ws.append([
                str(i.employee),
                str(i.project),
                i.date.strftime("%d-%m-%Y"),
                str(i.check_in),
                str(i.check_out),
                str(i.active_hours),
                i.status
            ])

        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

        response["Content-Disposition"] = (
            'attachment; filename="Attendance.xlsx"'
        )

        wb.save(response)

        return response

    context = {
        "emplist": emplist,
        "projects": projects,
        "selected_status": status,
        "selected_date": selected_date,
        "selected_project": project,
        "selected_month": month,
        "present_count": total_present,
        "absent_count": total_absent,
        "checked_out_count": total_checked_out,
        "violations_count": total_violations,
    }
    return render_page(request, "attendance.html", context)



@login_required(login_url='login_web')
def attendance090726(request):
    projects = list(ProjectAttendance.objects.all())
    status = request.GET.get('status')
    selected_date = request.GET.get('date')

    if _is_web_admin(request.user):
        emplist = Attendance.objects.all().order_by('-date')
    else:
        supervised_ids = _supervised_project_ids(request.user.empid)
        emplist = Attendance.objects.filter(project_id__in=supervised_ids).order_by('-date')

    # Filter by status
    if status:
        emplist = emplist.filter(status=status)

    # Filter by date
    if selected_date:
        emplist = emplist.filter(date=selected_date)

    for attendance in emplist:
        name = attendance.employee.empname.split()
        if len(name) >= 2:
            attendance.initials = (name[0][0] + name[-1][0]).upper()
        else:
            attendance.initials = name[0][:2].upper()
        attendance.face_enrolled = FaceEnrollment.objects.filter(
            employee_id=attendance.employee.empno, is_active=True
        ).exists()

    context = {
        "emplist": emplist,
        "selected_status": status,
        "selected_date": selected_date,
        "projects":projects
    }

    return render_page(request, "attendance.html", context)



@login_required(login_url='login_web')
def geofence(request):
    empid=request.user.empid
    context = {
        'projectsnew': Projects.objects.all(),
        'geofencezones': GeofenceZone.objects.all(),
        'empid':empid
    }
    return render_page(request, 'geofence.html', context)



@login_required(login_url='login_web')
def assignments2(request,id):
    empid=request.user.empid
    context = {
        'projects': Projects.objects.all(),
        'empid':empid
    }
    return render(request, 'assignments.html', context)


'''def assignments(request,id):
    projectsname1 = ProjectAttendance.objects.get(id=id)
    projectsname = projectsname1.projectname
    projectslist=ProjectAttendance.objects.all()
    context = {
        'projects': ProjectAttendance.objects.filter(id=id),
        'projectsname': projectsname,
        'projecthandover': ProjectHandover.objects.filter(project_id=id),
        'projectslist':projectslist
    }
    return render(request, 'assignments2.html', context)'''

'''def assignments(request,id):
    project = ProjectAttendance.objects.get(id=id)
    projectsname = project.projectname
    projectslist = ProjectAttendance.objects.all()
    emplist=ProjectWorker.objects.filter(projectname=projectname)

    assigned_ids = ProjectWorker.objects.filter(projectname=project).values_list('empname_id', flat=True)
    available_employees = EmployeeRegistrationWorkforce.objects.exclude(id__in=assigned_ids)

    role_logs = ProjectWorkerRoleLog.objects.filter(project=project).select_related('employee')
    role_summary = {}
    for log in role_logs:
        emp_id = log.employee_id
        role_summary.setdefault(emp_id, {'empname': log.employee.empname, 'worker_days': 0, 'supervisor_days': 0})
        key = 'supervisor_days' if log.role == '1' else 'worker_days'
        role_summary[emp_id][key] += log.days_in_role()

    team = ProjectWorker.objects.filter(projectname=project).select_related('empname').order_by('-role')

    context = {
        'projects': ProjectAttendance.objects.filter(id=id),
        'projectsname': projectsname,
        'projecthandover': ProjectHandover.objects.filter(project_id=id),
        'projectslist': projectslist,
        'available_employees': available_employees,
        'role_summary': role_summary.values(),
        'team': team,
    }
    return render(request, 'assignments2.html', context)'''


@login_required(login_url='login_web')
def assignments(request, id):
    username = request.user.empid
    project = get_object_or_404(ProjectAttendance, id=id)

    if not _is_web_admin(request.user):
        roleaccess = _role_in_project(request.user.empid, id)
        if roleaccess != 'Supervisor':
            messages.error(request, "You don't have access to that project's team page.")
            return redirect('projectsadmin')
    else:
        roleaccess = 'Supervisor'

    projectsname = project.projectname
    projectslist = ProjectAttendance.objects.all()


    emplist = ProjectEmployee.objects.filter(project=project).select_related('employee')

    assigned_ids = ProjectEmployee.objects.filter(project=project).values_list('employee_id', flat=True)
    available_employees = EmployeeRegistrationWorkforce.objects.exclude(id__in=assigned_ids)

    role_logs = ProjectEmployeeRoleLog.objects.filter(project=project).select_related('employee')
    role_summary = {}
    for log in role_logs:
        emp_id = log.employee_id
        role_summary.setdefault(emp_id, {'empname': log.employee.empname, 'worker_days': 0, 'supervisor_days': 0})
        key = 'supervisor_days' if log.role == 'Supervisor' else 'worker_days'
        role_summary[emp_id][key] += log.days_in_role()

    team = ProjectEmployee.objects.filter(project=project, deletestatus=0).select_related('employee').order_by('-role')

    workers_list = team.filter(role='Employee')

    today = date.today()
    roster = []
    for pw in team:
        emp = pw.employee

        today_attendance = Attendance.objects.filter(
            employee=emp, project=project, date=today
        ).first()
        today_status = today_attendance.status if today_attendance else 'Absent'

        face_enrolled = FaceEnrollment.objects.filter(
            employee_id=emp.empno, is_active=True
        ).exists()

        wp_valid = bool(emp.wpexpirydate and emp.wpexpirydate >= today)

        roster.append({
            'pe_id': pw.id,
            'employee': emp,
            'role': pw.role,
            'designation': emp.trade1stskill or 'N/A',
            'assigned_date': pw.assigned_date,
            'today_status': today_status,
            'face_enrolled': face_enrolled,
            'wp_valid': wp_valid,
        })

    context = {
        'projects': ProjectAttendance.objects.filter(id=id),
        'projectsname': projectsname,
        'projecthandover': ProjectHandover.objects.filter(project_id=id),
        'projectslist': projectslist,
        'emplist': emplist,
        'available_employees': available_employees,
        'role_summary': role_summary.values(),
        'team': team,
        'workers_list': workers_list,
        'roster': roster,
    }
    return render_page(request, 'assignments2.html', context)




@login_required(login_url='login_web')
def remove_worker(request, id):
    pe = get_object_or_404(ProjectEmployee, id=id)
    project_id = pe.project_id
    pe.deletestatus = 1
    pe.save(update_fields=['deletestatus'])
    messages.success(request, f"{pe.employee.empname} was removed from the project.")
    return redirect('assignments', id=project_id)


@login_required(login_url='login_web')
def remove_supervisor(request, id):
    pe = get_object_or_404(ProjectEmployee, id=id)
    project_id = pe.project_id
    pe.deletestatus = 1
    pe.save(update_fields=['deletestatus'])
    messages.success(request, f"{pe.employee.empname} was removed from the project.")
    return redirect('assignments', id=project_id)



'''def projectsadmin(request):
    username = request.user.username
    projects = list(ProjectAttendance.objects.all())

    active_count = sum(1 for p in projects if p.status == 'Active')
    inactive_count = len(projects) - active_count

    context = {
        'projects': projects,
        'employees': EmployeeRegistrationWorkforce.objects.all(),
        'active_count': active_count,
        'inactive_count': inactive_count,
    }
    return render(request, 'projects.html', context)'''

@login_required(login_url='login_web')
def projectsadmin(request):
    username = request.user.username

    if _is_web_admin(request.user):
        projects = list(ProjectAttendance.objects.all())
    else:
        supervised_ids = _supervised_project_ids(request.user.empid)
        projects = list(ProjectAttendance.objects.filter(id__in=supervised_ids))

    active_count = sum(1 for p in projects if p.status == 'Active')
    inactive_count = len(projects) - active_count

    context = {
        'projects': projects,
        'employees': EmployeeRegistrationWorkforce.objects.all(),
        'active_count': active_count,
        'inactive_count': inactive_count,
    }
    return render_page(request, 'projects.html', context)





@login_required(login_url='login_web')
def enrollment(request):
    return render_page(request, 'enrollment.html')


@login_required(login_url='login_web')
def employees(request):
    search = request.GET.get('search', '')
    employees = EmployeeRegistrationWorkforce.objects.all()
    if search:
         employees = employees.filter(
            Q(empname__icontains=search) |
            Q(empno__icontains=search)
        )

    context = {
        'employees': employees
    }
    return render_page(request, 'employees.html', context)

# def toggle_supervisor(request, id):
#     employee = EmployeeRegistrationWorkforce.objects.filter(id=id).update(supervisorstatus='1')     
#     return redirect('employees')

def toggle_supervisor(request, id):
    if request.method == "POST":
        employee = EmployeeRegistrationWorkforce.objects.get(id=id)

        if 'supervisor' in request.POST:
            employee.supervisorstatus = '1'
        else:
            employee.supervisorstatus = '0'

        employee.save()

    return redirect('employees')

@login_required(login_url='login_web')
def dashboard(request):
    username=request.user.username
    context = {
        'totalemployees': EmployeeRegistrationWorkforce.objects.count(),
        'presentcount': Attendance.objects.filter(status='Present').count(),
        'absentcount': Attendance.objects.filter(status='Absent').count(),
        'late_checkinscount': Attendance.objects.filter(status='Late Check-in').count(),
    }
    return render_page(request, 'dashboard.html', context)



def update_geofence(request, id):
    zone = GeofenceZone.objects.get(id=id)

    if request.method == "POST":
        zone.geofence_name = request.POST.get("geofence_name")
        zone.radius = request.POST.get("radius")
        zone.centre_latitude = request.POST.get("latitude")
        zone.centre_longitude = request.POST.get("longitude")
        zone.activefromtime = request.POST.get("activefromtime")
        zone.activeuntiltime = request.POST.get("activeuntiltime")
        zone.linkedproject = request.POST.get("project_id")
        zone.save()

    return redirect("geofence")


def delete_geofence(request, id):
    geofence_zone = GeofenceZone.objects.get(id=id)
    geofence_zone.delete()
    return redirect('geofence')

def create_geofence(request):
    projectsnew = Projects.objects.all()

    if request.method == "POST":
        project_id = request.POST.get('project_id')

        project = Projects.objects.get(id=project_id)

        GeofenceZone.objects.create(
            geofence_name=request.POST.get('geofence_name'),
            linkedproject=project.projectname,
            zonetype=request.POST.get('zonetype'),
            centre_latitude=request.POST.get('latitude'),
            centre_longitude=request.POST.get('longitude'),
            radius=request.POST.get('radius'),
            activefromtime=request.POST.get('activefromtime'),
            activeuntiltime=request.POST.get('activeuntiltime')
        )

        return redirect('index2')

    return render_page(request, 'add_geofence.html', {'projectsnew': projectsnew})



def employee_search(request):
    query = request.GET.get('q', '')

    employees = EmployeeRegistrationWorkforce.objects.filter(
        empname__icontains=query
    )[:10]

    data = list(employees.values('id', 'empname', 'empno'))

    return JsonResponse(data, safe=False)    


'''def log_role_change(project, employee, new_role):
    ProjectWorkerRoleLog.objects.filter(
        project=project, employee=employee, end_date__isnull=True
    ).update(end_date=date.today())
    ProjectWorkerRoleLog.objects.create(
        project=project, employee=employee, role=new_role
    )'''


def log_role_change(project, employee, new_role):
    ProjectEmployeeRoleLog.objects.filter(
        project=project, employee=employee, end_date__isnull=True
    ).update(end_date=date.today())
    ProjectEmployeeRoleLog.objects.create(
        project=project, employee=employee, role=new_role
    )




'''def change_supervisor(request):
    if request.method == "POST":

        project_id = request.POST.get("project_id")
        newproject=ProjectAttendance.objects.get(id=project_id)
        projectname=newproject.projectname
        projectcode=newproject.projectcode
        currentsupervisor=newproject.supervisor
        newsupervisor = request.POST.get("newsupervisor")
        handoverdate= request.POST.get("handoverdate")
        handoverperiod= request.POST.get("handoverperiod")
        handoverreason= request.POST.get("handoverreason")
        if not handoverdate:
            handoverdate=None
        ProjectHandover.objects.create(
            projectname=projectname,
            projectcode=projectcode,
            currentsupervisor=currentsupervisor,
            newsupervisor=newsupervisor,
            handoverdate=handoverdate,
            handoverperiod=handoverperiod,
            handoverreason=handoverreason,
            project_id=project_id
        )
        ProjectAttendance.objects.filter(id=project_id).update(supervisor=newsupervisor)
        return redirect("projects")'''


def change_supervisor(request):
    if request.method == "POST":
        project_id = request.POST.get("project_id")
        new_emp_id = request.POST.get("newsupervisor")

        if not new_emp_id:
            messages.error(request, "Please select an employee to assign as supervisor.")
            return redirect("assignments", id=project_id)

        project = ProjectAttendance.objects.get(id=project_id)
        existing_supervisors = ProjectEmployee.objects.filter(project=project, role='Supervisor')
        currentsupervisor = ", ".join(p.employee.empname for p in existing_supervisors) or ''

        new_employee = EmployeeRegistrationWorkforce.objects.get(id=new_emp_id)

        ProjectEmployee.objects.update_or_create(
            project=project, employee=new_employee,
            defaults={'role': 'Supervisor'}
        )
        log_role_change(project, new_employee, 'Supervisor')



        handoverdate = request.POST.get("handoverdate") or None
        handoverperiod = request.POST.get("handoverperiod") or "0"
        handoverreason = request.POST.get("handoverreason") or "Supervisor assignment"

        ProjectHandover.objects.create(
            project_id=project_id,
            projectname=project.projectname,
            projectcode=project.projectcode,
            currentsupervisor=currentsupervisor,
            newsupervisor=new_employee.empname,
            handoverdate=handoverdate,
            handoverperiod=handoverperiod,
            handoverreason=handoverreason,
        )
        return redirect("assignments", id=project_id)


'''def toggle_project_role(request, project_id, employee_id):
    project = get_object_or_404(ProjectAttendance, id=project_id)
    employee = get_object_or_404(EmployeeRegistrationWorkforce, id=employee_id)
    pw = get_object_or_404(ProjectWorker, projectname=project, empname=employee)

    if pw.role == '1':
        # demote supervisor -> employee
        pw.role = '0'
        pw.save()
        log_role_change(project, employee, '0')
    else:
        # promote employee -> supervisor, demote whoever currently holds it
        old_supervisor_pw = ProjectWorker.objects.filter(projectname=project, role='1').exclude(id=pw.id).first()
        if old_supervisor_pw:
            old_supervisor_pw.role = '0'
            old_supervisor_pw.save()
            log_role_change(project, old_supervisor_pw.empname, '0')
        pw.role = '1'
        pw.save()
        log_role_change(project, employee, '1')

    return redirect('assignments', id=project_id)'''


def toggle_project_role(request, project_id, employee_id):
    project = get_object_or_404(ProjectAttendance, id=project_id)
    employee = get_object_or_404(EmployeeRegistrationWorkforce, id=employee_id)
    pe = get_object_or_404(ProjectEmployee, project=project, employee=employee)

    new_role = 'Employee' if pe.role == 'Supervisor' else 'Supervisor'
    pe.role = new_role
    pe.save()
    log_role_change(project, employee, new_role)

    return redirect('assignments', id=project_id)


@require_POST
def move_workersfine(request):
    data = json.loads(request.body)
    worker_ids      = data.get('worker_ids', [])
    target_project  = data.get('target_project_id')
    start_date      = data.get('start_date')
    end_date        = data.get('end_date')

    project = ProjectAttendance.objects.get(projectcode='001')

    for eid in worker_ids:
        emp = EmployeeRegistrationWorkforce.objects.get(empno=eid)

    ProjectEmployee.objects.get_or_create(
        project=project,
        employee=emp,
        defaults={'role': 'Employee'}
    )

    return JsonResponse({'success': True})



@require_POST
def move_workers(request):
    data = json.loads(request.body)

    worker_ids = data.get('worker_ids', [])
    target_project = data.get('target_project_id')
    start_date = data.get('start_date')
    end_date = data.get('end_date')

    project = ProjectAttendance.objects.get(id=target_project)

    for eid in worker_ids:
        emp = EmployeeRegistrationWorkforce.objects.get(empno=eid)

        ProjectWorker.objects.create(
            projectname=project,
            empname=emp,
            type='Temporary',   # Must match your choices exactly
            start_date=start_date,
            end_date=end_date
        )

    return JsonResponse({'success': True})



def move_workers27(request):
    print("Request Method:", request.method)

    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    data = json.loads(request.body)

    print(data)

    return JsonResponse({
        "success": True,
        "message": "Received successfully"
    })




def add_workers300626(request,id):
    emplist=EmployeeRegistrationWorkforce.objects.all()
    project = get_object_or_404(ProjectAttendance, pk=id)
    project_name = project.projectname
    if request.method == "POST":

        worker_ids = request.POST.getlist("workers")

        for worker_id in worker_ids:

            employee = EmployeeRegistrationWorkforce.objects.get(id=worker_id)

            ProjectWorker.objects.create(
                projectname=project,
                empname=employee,
                role='0'          # Worker
            )
        messages.success(
            request,
            f"Workers were successfully added to project {project.projectname}."
        )

        return redirect("add_workers",id=id)
    return render_page(request,'add_workers.html',{"emplist":emplist})



@login_required(login_url='login_web')
def add_workers(request, id):
    project = get_object_or_404(ProjectAttendance, pk=id)

    if not _is_web_admin(request.user) and not _is_supervisor(request.user.empid, id):
        messages.error(request, "You don't have access to add employees to that project.")
        return redirect('projectsadmin')

    assigned_workers = ProjectEmployee.objects.filter(
        project=project
    ).values_list('employee_id', flat=True)

    emplist = EmployeeRegistrationWorkforce.objects.exclude(
        id__in=assigned_workers
    )

    if request.method == "POST":
        worker_ids = request.POST.getlist("workers")

        for worker_id in worker_ids:
            employee = EmployeeRegistrationWorkforce.objects.get(id=worker_id)

            ProjectEmployee.objects.get_or_create(
                project=project,
                employee=employee,
                defaults={'role': 'Employee'}
            )
            log_role_change(project, employee, 'Employee')

        messages.success(
            request,
            f"Workers were successfully added to project {project.projectname}."
        )

        return redirect("assignments", id=id)

    return render_page(request, "add_workers.html", {
        "emplist": emplist
    })





def employee_role_history(request):
    search = request.GET.get('search', '')
    project_id = request.GET.get('project', '')

    employees = EmployeeRegistrationWorkforce.objects.all()
    if search:
        employees = employees.filter(
            Q(empname__icontains=search) | Q(empno__icontains=search)
        )

    data = []
    for emp in employees:
        logs = ProjectEmployeeRoleLog.objects.filter(employee=emp).select_related('project').order_by('-start_date')
        if project_id:
            logs = logs.filter(project_id=project_id)

        if not logs.exists():
            continue

        worker_days = 0
        supervisor_days = 0
        periods = []
        for log in logs:
            days = log.days_in_role()
            if log.role == 'Supervisor':
                supervisor_days += days
            else:
                worker_days += days
            periods.append({
                'project': log.project.projectname,
                'role': log.role, 
                'start_date': log.start_date,
                'end_date': log.end_date,
                'days': days,
            })

        data.append({
            'employee': emp,
            'worker_days': worker_days,
            'supervisor_days': supervisor_days,
            'total_days': worker_days + supervisor_days,
            'periods': periods,
        })

    context = {
        'data': data,
        'search': search,
        'projects': ProjectAttendance.objects.all(),
        'selected_project': project_id,
    }
    return render_page(request, 'employee_role_history.html', context)




def login_web070726(request):

    if request.method == "POST":

        empid = request.POST.get("empid")
        password = request.POST.get("password")

        if not empid or not password:
            return render(request, "login.html", {
                "error": "Employee Number and Password are required."
            })

        try:
            user_obj = User.objects.get(empid=empid)
        except User.DoesNotExist:
            return render(request, "login.html", {
                "error": "Employee Number Not Found."
            })

        user = authenticate(
            request,
            username=user_obj.username,
            password=password
        )

        if user is not None:
            login(request, user)
            return redirect("dashboard")   # Change to your dashboard URL name

        return render(request, "login.html", {
            "error": "Invalid Password."
        })

    return render(request, "login.html")



def login_web(request):

    if request.method == "POST":

        empid = request.POST.get("empid")
        password = request.POST.get("password")

        if not empid or not password:
            return render(request, "login.html", {
                "error": "Employee Number and Password are required."
            })

        # Check in Django User table
        try:
            user_obj = User.objects.get(empid=empid)
        except User.DoesNotExist:
            return render(request, "login.html", {
                "error": "Employee Number Not Found."
            })

        # Authenticate
        user = authenticate(
            request,
            username=user_obj.username,
            password=password
        )

        if user is None:
            return render(request, "login.html", {
                "error": "Invalid Password."
            })

        # If Super Admin, don't check EmpWorkforce table
        if user.is_superuser:
            login(request, user)
            return redirect("dashboard")

        # Normal employee validation
        #if not EmpWorkforce.objects.filter(empid=empid).exists():
        if not EmployeeRegistrationWorkforce.objects.filter(empno=empid).exists():
            return render(request, "login.html", {
                "error": "Employee record not found."
            })

        login(request, user)
        return redirect("dashboard")

    return render(request, "login.html")




def _cert_status(expiry):
    if not expiry:
        return 'None'
    return 'Valid' if expiry >= date.today() else 'Expired'


def employee_profile(request, id):
    employee = get_object_or_404(EmployeeRegistrationWorkforce, id=id)

    face_enrolled = FaceEnrollment.objects.filter(
        employee_id=employee.empno, is_active=True
    ).exists()

    assignment = ProjectEmployee.objects.filter(employee=employee).select_related('project').first()
   
    attendance_history = Attendance.objects.filter( employee=employee ).select_related('project').order_by('-date')

    supervisor_assignment = None
    if assignment and assignment.role == 'Employee':
        supervisor_assignment = ProjectEmployee.objects.filter(
            project=assignment.project, role='Supervisor'
        ).select_related('employee').first()

    certifications = [
        {'name': 'CSOC / AWSHCS', 'expiry': employee.csocawshicexpirydate, 'status': _cert_status(employee.csocawshicexpirydate)},
        {'name': 'OPSOC', 'expiry': employee.opsocawshppexpirydate, 'status': _cert_status(employee.opsocawshppexpirydate)},
        {'name': 'MHSOC', 'expiry': employee.mhsocpwcpoexpirydate, 'status': _cert_status(employee.mhsocpwcpoexpirydate)},
        {'name': 'Tunnel SOC', 'expiry': employee.tunnelsocexpirydate, 'status': _cert_status(employee.tunnelsocexpirydate)},
    ]

    context = {
        'employee': employee,
        'face_enrolled': face_enrolled,
        'assignment': assignment,
        'supervisor_assignment': supervisor_assignment,
        'certifications': certifications,
        'attendance_history':attendance_history
    }
    return render_page(request, 'employee_profile.html', context)


def supervisor_profile(request, id):
    employee = get_object_or_404(EmployeeRegistrationWorkforce, id=id)

    face_enrolled = FaceEnrollment.objects.filter(
        employee_id=employee.empno, is_active=True
    ).exists()

    assignment = ProjectEmployee.objects.filter(employee=employee, role='Supervisor').select_related('project').first()
    attendance_history = Attendance.objects.filter( employee=employee ).select_related('project').order_by('-date')

    team_members = []
    if assignment:
        team_members = ProjectEmployee.objects.filter(
            project=assignment.project, role='Employee'
        ).select_related('employee')

    certifications = [
        {'name': 'CSOC / AWSHCS', 'expiry': employee.csocawshicexpirydate, 'status': _cert_status(employee.csocawshicexpirydate)},
        {'name': 'OPSOC', 'expiry': employee.opsocawshppexpirydate, 'status': _cert_status(employee.opsocawshppexpirydate)},
        {'name': 'MHSOC', 'expiry': employee.mhsocpwcpoexpirydate, 'status': _cert_status(employee.mhsocpwcpoexpirydate)},
        {'name': 'Tunnel SOC', 'expiry': employee.tunnelsocexpirydate, 'status': _cert_status(employee.tunnelsocexpirydate)},
    ]

    context = {
        'employee': employee,
        'face_enrolled': face_enrolled,
        'assignment': assignment,
        'team_members': team_members,
        'certifications': certifications,
        'attendance_history':attendance_history
    }
    return render_page(request, 'supervisor_profile.html', context)



def register_web(request):

    if request.method == "POST":

        empid = request.POST.get("empid").strip()
        #username = request.POST.get("username")
        password = request.POST.get("password")

        # Check Employee Exists
        if not EmployeeRegistrationWorkforce.objects.filter(empno=empid).exists():
            return render(request, "register.html", {
                "error": "Employee not found. Registration not allowed."
            })

        # Check Already Registered
        if User.objects.filter(empid=empid).exists():
            return render(request, "register.html", {
                "error": "This Employee Number is already registered."
            })

        # Create User
        name=EmployeeRegistrationWorkforce.objects.get(empno=empid)
        username=name.empname
        user = User.objects.create_user(
            username=username,
            empid=empid,
            password=password
        )

        return redirect("login_web")

    return render(request, "register.html")



def edit_project(request, id):
    project = get_object_or_404(ProjectAttendance, id=id)
    
    if request.method == "POST":
        def _to_float(value):
            try:
                return float(value)
            except (TypeError, ValueError):
                return None

        project.projectname = request.POST.get('projectname')
        project.projectcode = request.POST.get('projectcode')
        project.clientname = request.POST.get('clientname')
        
        project.projectstartdate = request.POST.get('projectstartdate') or None
        project.projectenddate = request.POST.get('projectenddate') or None
        
        project.shiftstarttime = request.POST.get('shiftstarttime') or None
        project.shiftendtime = request.POST.get('shiftendtime') or None
        project.threshold = request.POST.get('threshold') or None
        
        project.site_latitude = _to_float(request.POST.get('site_latitude'))
        project.site_longitude = _to_float(request.POST.get('site_longitude'))
        project.siteaddress = request.POST.get('siteaddress')
        project.description = request.POST.get('description', '')

        project.save()
        return redirect('projectsadmin')
        
    return redirect('projectsadmin')
