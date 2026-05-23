from django.contrib import admin
from .models import *
from import_export.admin import ImportExportModelAdmin
from import_export import resources, fields
from import_export.widgets import DateWidget

# Register your models here.


class EmployeeRegistrationWorkforceResource(resources.ModelResource):

    joiningdate = fields.Field(
        column_name='joiningdate',
        attribute='joiningdate',
        widget=DateWidget(format='%d-%m-%Y')
    )

    applicationdate = fields.Field(
        column_name='applicationdate',
        attribute='applicationdate',
        widget=DateWidget(format='%d-%m-%Y')
    )

    passportexpirydate = fields.Field(
        column_name='passportexpirydate',
        attribute='passportexpirydate',
        widget=DateWidget(format='%d-%m-%Y')
    )

    arrivaldate = fields.Field(
        column_name='arrivaldate',
        attribute='arrivaldate',
        widget=DateWidget(format='%d-%m-%Y')
    )

    securityeffectivedate = fields.Field(
        column_name='securityeffectivedate',
        attribute='securityeffectivedate',
        widget=DateWidget(format='%d-%m-%Y')
    )

    securityexpirydate = fields.Field(
        column_name='securityexpirydate',
        attribute='securityexpirydate',
        widget=DateWidget(format='%d-%m-%Y')
    )

    wpexpirydate= fields.Field(
        column_name='wpexpirydate',
        attribute='wpexpirydate',
        widget=DateWidget(format='%d-%m-%Y')
    )
    passportexpirydate = fields.Field(
        column_name='passportexpirydate',
        attribute='passportexpirydate',
        widget=DateWidget(format='%d-%m-%Y')
    )
    
    passportreceivedate = fields.Field(
        column_name='passportreceivedate',
        attribute='passportreceivedate',
        widget=DateWidget(format='%d-%m-%Y')
    )

    sestartdate=fields.Field(
        column_name='sestartdate',
        attribute='sestartdate',
        widget=DateWidget(format='%d-%m-%Y')
    )


    class Meta:
        model = EmployeeRegistrationWorkforce


class EmployeeRegistrationWorkforceAdmin(ImportExportModelAdmin):
    resource_class = EmployeeRegistrationWorkforceResource
    list_display = ('empno','empname',)


class AttendanceAdmin(ImportExportModelAdmin):
    list_display = ('employee', 'date', 'status')


class UserAdmin(ImportExportModelAdmin):
    list_display = ('username', 'email', 'is_staff', 'is_active')


admin.site.register(EmployeeRegistrationWorkforce,EmployeeRegistrationWorkforceAdmin)
admin.site.register(Attendance,AttendanceAdmin)
admin.site.register(ProjectAttendance)
admin.site.register(ProjectEmployee)
admin.site.register(User,UserAdmin)