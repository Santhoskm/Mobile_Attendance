from django.contrib import admin
from .models import *
from import_export.admin import ImportExportModelAdmin
from import_export import resources, fields
from import_export.widgets import DateWidget
from datetime import datetime

from .models import ViolationType, Violation, ProjectDocument, ProjectEmployee
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
    list_display = ('employee', 'date', 'status','active_hours')
    search_fields = (
        'employee__empno',
        'employee__empname',
        'project_name',
        'status',
        'date',
    )

    def active_hours(self, obj):
        return obj.active_hours
    active_hours.short_description = "Active Hours"


class UserAdmin(ImportExportModelAdmin):
    list_display = ('username', 'email', 'is_staff', 'is_active')


class ProjectsAdmin(ImportExportModelAdmin):
    list_display = ('projectname',)



class ProjectWorkerAdmin(ImportExportModelAdmin):
    list_display = ('empname','role','projectname')




class ProjectEmployeeAdmin(ImportExportModelAdmin):
    list_display = ('employee','project','role','deletestatus')


admin.site.register(EmployeeRegistrationWorkforce,EmployeeRegistrationWorkforceAdmin)
admin.site.register(Attendance,AttendanceAdmin)
admin.site.register(ProjectAttendance)
admin.site.register(ProjectEmployee,ProjectEmployeeAdmin)
admin.site.register(User,UserAdmin)
admin.site.register(Projects,ProjectsAdmin)
admin.site.register(ViolationType)
admin.site.register(Violation)
admin.site.register(ProjectDocument)
admin.site.register(ProjectWorker,ProjectWorkerAdmin)
