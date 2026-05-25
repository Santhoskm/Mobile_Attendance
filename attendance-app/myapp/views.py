from django.shortcuts import render
from rest_framework import viewsets
from .models import Attendance,EmployeeRegistrationWorkforce,ProjectAttendance,ProjectEmployee
from django.shortcuts import redirect
from .serializers import AttendanceSerializer
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from django.contrib.auth import authenticate
from .serializers import UserRegisterSerializer
from .models import User
from django.utils.timezone import now
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from face_ai.services.enroll import enroll_employee
from face_ai.tasks import verify_face_task
from .models import Attendance, EmployeeRegistrationWorkforce




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
    return render(request, 'present_today.html', context)


def absent_today(request):
    absent_employees = Attendance.objects.filter(status='Absent')
    context = {
        'absent_employees': absent_employees
    }
    return render(request, 'absent_today.html', context)

class AttendanceAPIView(viewsets.ModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer

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

        ProjectAttendance.objects.create(
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
        )

        # ProjectEmployee.objects.create(
        #         project=request.POST.get('projectname'),
        #         employee=request.POST.get('supervisor'),
        #     )
        return redirect('index2')

    return render(request, 'project.html',{"employees":employees})


class UserLoginAPIView(APIView):

    def post(self, request):

        empno = request.data.get('empno')
        password = request.data.get('password')

        if not empno or not password:
            return Response(
                {
                    'status': False,
                    'message': 'Empno and Password required'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user_obj = User.objects.get(empno=empno)

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

            return Response(
                {
                    'status': True,
                    'message': 'Login Successful',
                    'user_id': user.id,
                    'username': user.username,
                    'empno': user.empno,
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
    
class UserRegisterAPIView(APIView):

    def post(self, request):

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
@parser_classes([MultiPartParser, FormParser])
def face_enroll(request):
    empno = request.data.get("empno") or request.data.get("employee_id")
    image = request.FILES.get("image")

    if not empno or not image:
        return Response({"error": "empno and image required"}, status=400)

    employee = EmployeeRegistrationWorkforce.objects.filter(empno=empno).first()

    if not employee:
        return Response({"error": "Employee not found"}, status=404)

    enroll_employee(
        employee_id=empno,
        image_bytes_list=[image.read()]
    )

    return Response({
        "message": "Face enrolled successfully",
        "empno": empno
    })


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def face_check_in(request):
    empno = request.data.get("empno") or request.data.get("employee_id")
    image = request.FILES.get("image")

    if not empno or not image:
        return Response({"error": "empno and image required"}, status=400)

    employee = EmployeeRegistrationWorkforce.objects.filter(empno=empno).first()

    if not employee:
        return Response({"error": "Employee not found"}, status=404)

    task = verify_face_task.delay(empno, image.read())
    result = task.get(timeout=30)

    if not result["matched"]:
        return Response({
            "matched": False,
            "message": "Face verification failed",
            "confidence": result["confidence"]
        }, status=400)

    attendance, created = Attendance.objects.get_or_create(
        employee=employee,
        date=now().date(),
        defaults={
            "check_in": now().time(),
            "status": "Present"
        }
    )

    if not created:
        return Response({
            "matched": True,
            "message": "Already checked in today",
            "empno": empno
        })

    return Response({
        "matched": True,
        "message": "Check-in successful",
        "empno": empno,
        "confidence": result["confidence"]
    })


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def face_check_out(request):
    empno = request.data.get("empno") or request.data.get("employee_id")
    image = request.FILES.get("image")

    if not empno or not image:
        return Response({"error": "empno and image required"}, status=400)

    employee = EmployeeRegistrationWorkforce.objects.filter(empno=empno).first()

    if not employee:
        return Response({"error": "Employee not found"}, status=404)

    task = verify_face_task.delay(empno, image.read())
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
            "empno": empno
        }, status=400)

    if attendance.check_out:
        return Response({
            "matched": True,
            "message": "Already checked out today",
            "empno": empno
        })

    attendance.check_out = now().time()
    attendance.save()

    return Response({
        "matched": True,
        "message": "Check-out successful",
        "empno": empno,
        "confidence": result["confidence"]
    })