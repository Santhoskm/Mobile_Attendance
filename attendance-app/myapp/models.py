from django.db import models
import datetime
from datetime import date
from dateutil.relativedelta import relativedelta
from django.contrib.auth.models import AbstractUser
from pgvector.django import VectorField




class User(AbstractUser):
    addemployeestatus=models.IntegerField(default='0')
    workerprofilestatus=models.IntegerField(default='0')
    workersmonitoringstatus=models.IntegerField(default='0')
    workerfeedbackstatus=models.IntegerField(default='0')
    passportmovementstatus=models.IntegerField(default='0')
    terminationstatus=models.IntegerField(default='0')
    trainingmatrixstatus=models.IntegerField(default='0')
    wicstatus=models.IntegerField(default='0')
    medicalleavestatus=models.IntegerField(default='0')
    dormitorymainstatus=models.IntegerField(default='0')
    adddormitorystatus=models.IntegerField(default='0')
    dormitorysubcontractstatus=models.IntegerField(default='0')
    financestatus=models.IntegerField(default='0')
    financemanagerstatus=models.IntegerField(default='0')
    financedirectorstatus=models.IntegerField(default='0')
    deloydashboardstatus=models.IntegerField(default='0')
    outsourcingprojectsstatus=models.IntegerField(default='0')
    addsubconstatus=models.IntegerField(default='0')
    addsubconemployeestatus=models.IntegerField(default='0')
    adddesignationstatus=models.IntegerField(default='0')
    bcaworkerliststatus=models.IntegerField(default='0')
    bcasubconworkerliststatus=models.IntegerField(default='0')
    outsourcingworkerliststatus=models.IntegerField(default='0')
    outsourcingsubconstatus=models.IntegerField(default='0')
    addprojectstatus=models.IntegerField(default='0')
    clientdashboardstatus=models.IntegerField(default='0')
    reportdownloadstatus=models.IntegerField(default='0')
    paymentdashboardstatus=models.IntegerField(default='0')
    paymentcreatestatus=models.IntegerField(default='0')
    balancedashboardstatus=models.IntegerField(default='0')
    ratescreatestatus=models.IntegerField(default='0')
    tradecreatestatus=models.IntegerField(default='0')
    bankingstatus=models.IntegerField(default='0')
    tradestatus=models.IntegerField(default='0')
    sidemenustatus=models.IntegerField(default='0')
    workerrequiredstatus=models.IntegerField(default='0')
    ppestatus=models.IntegerField(default='0')
    empno = models.CharField(max_length=200,default='')


class EmployeeRegistrationWorkforce(models.Model):
    empno = models.CharField(max_length=200)
    empname = models.CharField(max_length=200)
    joiningdate = models.DateField(null=True, blank=True)
    applicationdate = models.DateField(null=True,blank=True)
    nationality = models.CharField(max_length=150)
    contact = models.CharField(max_length=200)
    foreigncontact = models.CharField(max_length=200,default='NO')
    gender = models.CharField(max_length=200,default='NO')
    race = models.CharField(max_length=200,default='NO')
    dateofbirth= models.DateTimeField(null=True, blank=True)
    qualification = models.CharField(max_length=100)
    passportno = models.CharField(max_length=500)
    passportexpirydate = models.DateField(null=True, blank=True)
    passportreceive = models.CharField(max_length=400,default='NO')
    passportreceivedate=models.DateField(null=True, blank=True)
    finno = models.CharField(max_length=200)
    wpno = models.CharField(max_length=200)
    nricno = models.CharField(max_length=200,default='0')
    wpexpirydate = models.DateField(null=True, blank=True)
    workknown= models.CharField(max_length=200)
    singaporeexperience= models.CharField(max_length=200)
    trade1stskill=models.CharField(max_length=300)
    trade2ndskill=models.CharField(max_length=300)
    csocawshicexpirydate=models.DateField(null=True, blank=True)
    opsocawshppexpirydate=models.DateField(null=True, blank=True)
    mhsocpwcpoexpirydate=models.DateField(null=True, blank=True)
    tunnelsocexpirydate=models.DateField(null=True, blank=True)
    workcategories=models.CharField(max_length=3000,default='NO')
    csocvalidbcss=models.CharField(max_length=200,default='NO')
    opsocvalidbcss=models.CharField(max_length=200,default='NO')
    mhsocvalidbcss=models.CharField(max_length=200,default='NO')
    tunnelsocvalidbcss=models.CharField(max_length=200,default='NO')
    email= models.CharField(max_length=300,default='NO')
    industry= models.CharField(max_length=300,default='NO')
    type= models.CharField(max_length=300,default='NO')
    hospital= models.CharField(max_length=300,default='NO')
    accomdationaddress= models.CharField(max_length=800)
    arrivaldate=models.DateField(null=True, blank=True)
    airticket= models.CharField(max_length=300,default='NO')
    securitybond= models.CharField(max_length=300,default='NO')
    points = models.CharField(max_length=3000,default='NO')
    tmpoints = models.CharField(max_length=3000,default='NO')
    tmvalues = models.CharField(max_length=3000,default='NO')
    arrivaldocument=models.FileField(upload_to='store/pdfs',default='',blank=True)
    image=models.ImageField(upload_to='store/images',default='',blank=True)
    document=models.FileField(upload_to='store/pdfs',default='',blank=True)
    others=models.FileField(upload_to='store/pdfs',default='',blank=True)
    education=models.FileField(upload_to='store/pdfs',default='',blank=True)
    vaccination=models.FileField(upload_to='store/pdfs',default='',blank=True)
    loa=models.FileField(upload_to='store/pdfs',default='',blank=True)
    workpermit=models.FileField(upload_to='store/pdfs',default='',blank=True)
    #skillseckdate=models.DateField(null=True, blank=True)
    #skillctmsdate=models.DateField(null=True, blank=True)
    skillsdate = models.CharField(max_length=3000,default='NO')
    skillstext = models.CharField(max_length=3000,default='NO')
    points=models.FloatField(null=True, blank=True, default=0.0)
    sestartdate=models.DateField(null=True, blank=True)
    seenddate=models.DateField(null=True, blank=True)
    terminationstatus=models.IntegerField(default=0)
    securityeffectivedate = models.DateField(null=True,blank=True)
    securityexpirydate = models.DateField(null=True,blank=True)
    insuredcompany = models.CharField(max_length=700,default='NO')
    emphomeleavedate=models.DateField(null=True, blank=True)
    emphomeleavetodate=models.DateField(null=True, blank=True)
    empmedicalleavedate=models.DateField(null=True, blank=True)
    empmedicalleavetodate=models.DateField(null=True, blank=True)
    emptrainingdate=models.DateField(null=True, blank=True)
    emptrainingtodate=models.DateField(null=True, blank=True)
    empprofilestatus = models.CharField(max_length=150,default='NO')
    nojobworkerstatus=models.IntegerField(default='0')
    passportreceivedstatus=models.IntegerField(default='0')
    noofconstructionyears = models.CharField(max_length=600,default='NO')
    ietexperience=models.CharField(max_length=700,default='NO')


    def __str__(self):
        return f"{self.empno} - {self.empname}"
    
    def save(self, *args, **kwargs):
        if self.joiningdate:
           jd = self.joiningdate
           if isinstance(jd, str):
              try:
                jd = datetime.datetime.strptime(jd, "%Y-%m-%d").date()
              except ValueError:
                 jd = datetime.datetime.strptime(jd, "%d-%m-%Y").date()
           today = date.today()
           diff = relativedelta(today, jd)
           self.ietexperience = (
            f"{diff.years} years {diff.months} months {diff.days} days"
           )
        super().save(*args, **kwargs)


class Attendance(models.Model):

    STATUS_CHOICES = (
        ('Present', 'Present'),
        ('Absent', 'Absent'),
        ('Leave', 'Leave'),
        ('Half Day', 'Half Day'),
    )

    employee = models.ForeignKey(
        EmployeeRegistrationWorkforce,
        on_delete=models.CASCADE
    )

    date = models.DateField()

    check_in = models.TimeField(
        null=True,
        blank=True
    )

    check_out = models.TimeField(
        null=True,
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='Present'
    )

    remarks = models.TextField(
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    checkin_latitude   = models.FloatField(null=True, blank=True)
    checkin_longitude  = models.FloatField(null=True, blank=True)
    checkin_place      = models.CharField(max_length=500, null=True, blank=True)  # ← ADD

    checkout_latitude  = models.FloatField(null=True, blank=True)
    checkout_longitude = models.FloatField(null=True, blank=True)
    checkout_place     = models.CharField(max_length=500, null=True, blank=True)  # ← ADD

    def __str__(self):
        return f"{self.employee.empno} - {self.date}"
    

class ProjectAttendance(models.Model):
    projectname= models.CharField(max_length=500)
    projectcode = models.CharField(max_length=500)
    clientname = models.CharField(max_length=500)
    supervisor = models.CharField(max_length=500)
    projectstartdate = models.DateField(null=True, blank=True)
    projectenddate = models.DateField(null=True, blank=True)
    shiftstarttime = models.TimeField(null=True, blank=True)
    shiftendtime = models.TimeField(null=True, blank=True)
    threshold = models.TimeField(null=True, blank=True)
    geozone = models.CharField(max_length=500)
    siteaddress = models.CharField(max_length=500)
    description = models.CharField(max_length=500)

    def employee_count(self):
        return self.projectemployee_set.count()
    

class ProjectEmployee(models.Model):
    project = models.ForeignKey(
        ProjectAttendance,
        on_delete=models.CASCADE
    )

    employee = models.ForeignKey(
        EmployeeRegistrationWorkforce,
        on_delete=models.CASCADE
    )

    assigned_date = models.DateField(auto_now_add=True)    


class FaceEnrollment(models.Model):
    employee_id = models.CharField(max_length=20, unique=True)
    avg_vector = VectorField(dimensions=512)
    enrolled_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "face_enrollments"

    def __str__(self):
        return self.employee_id