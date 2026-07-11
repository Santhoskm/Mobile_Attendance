from rest_framework import serializers
#from .models import Attendance,EmployeeRegistrationWorkforce,Projects
from .models import Attendance, EmployeeRegistrationWorkforce, ProjectAttendance
from .models import User


class AttendanceSerializer(serializers.ModelSerializer):

    employee_name = serializers.CharField(
        source='employee.empname',
        read_only=True
    )

    '''employee_no = serializers.CharField(
        source='employee.empid',
        read_only=True
    )

    employee = serializers.SlugRelatedField(
        queryset=EmployeeRegistrationWorkforce.objects.all(),
        slug_field='empid'
    )'''
    employee_no = serializers.CharField(source='employee.empno', read_only=True)
    employee = serializers.SlugRelatedField(queryset=EmployeeRegistrationWorkforce.objects.all(), slug_field='empno')

    class Meta:
        model = Attendance
        fields = '__all__'

class UserRegisterSerializer(serializers.ModelSerializer):

    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'empid',
            'email',
            'password'
        ]

    def create(self, validated_data):

        password = validated_data.pop('password')

        user = User(**validated_data)

        user.set_password(password)

        user.save()

        return user        



class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectAttendance
        fields = '__all__'
