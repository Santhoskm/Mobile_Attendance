from celery import shared_task
from django.utils.timezone import now, localtime
from datetime import timedelta
from .models import ProjectAttendance, ProjectEmployee, Attendance
from .utils import get_place_name


@shared_task
def resolve_attendance_place_task(attendance_id, lat, lon, field):
    """
    field is either 'checkin_place' or 'checkout_place'.
    Runs in the background so face-check-in/out never waits on
    the external Nominatim call.
    """
    place = get_place_name(lat, lon)
    Attendance.objects.filter(id=attendance_id).update(**{field: place})


@shared_task
def mark_daily_absences():
    today = now().date()

    active_projects = ProjectAttendance.objects.filter(
        projectstartdate__lte=today,
        projectenddate__gte=today,
    )

    for project in active_projects:

        # backfill all past dates from project start up to yesterday
        d = project.projectstartdate
        while d < today:
            for assignment in ProjectEmployee.objects.filter(project=project).select_related('employee'):
                # FIX 2: Check specifically for a real check-in
                already_checked_in = Attendance.objects.filter(
                    employee=assignment.employee, project=project, date=d,
                    check_in__isnull=False
                ).exists()
                if not already_checked_in:
                    Attendance.objects.get_or_create(
                        employee=assignment.employee, project=project, date=d,
                        check_in__isnull=True,
                        defaults={
                            'status': 'Absent',
                            'remarks': 'Auto-marked absent by system',
                        }
                    )
            d += timedelta(days=1)

        # FIX 1: today — only mark absent if shift has ended (skip if no shift end time is configured)
        if not project.shiftendtime or localtime(now()).time() < project.shiftendtime:
            continue

        for assignment in ProjectEmployee.objects.filter(project=project).select_related('employee'):
            # FIX 2: Check specifically for a real check-in
            already_checked_in = Attendance.objects.filter(
                employee=assignment.employee, project=project, date=today,
                check_in__isnull=False
            ).exists()
            if not already_checked_in:
                Attendance.objects.get_or_create(
                    employee=assignment.employee, project=project, date=today,
                    check_in__isnull=True,
                    defaults={
                        'status': 'Absent',
                        'remarks': 'Auto-marked absent by system',
                    }
                )















'''from celery import shared_task
from django.utils.timezone import now, localtime
from datetime import timedelta
from .models import ProjectAttendance, ProjectEmployee, Attendance

@shared_task
def mark_daily_absences():
    today = now().date()

    active_projects = ProjectAttendance.objects.filter(
        projectstartdate__lte=today,
        projectenddate__gte=today,
    )

    for project in active_projects:

        # backfill all past dates from project start up to yesterday
        d = project.projectstartdate
        while d < today:
            for assignment in ProjectEmployee.objects.filter(project=project).select_related('employee'):
                existing = Attendance.objects.filter(
                    employee=assignment.employee, project=project, date=d
                ).first()
                if not existing:
                    Attendance.objects.create(
                        employee=assignment.employee,
                        project=project,
                        date=d,
                        status='Absent',
                        remarks='Auto-marked absent by system',
                    )
                elif existing.check_in is None:
                    existing.status  = 'Absent'
                    existing.remarks = 'Auto-marked absent by system'
                    existing.save(update_fields=['status', 'remarks'])
            d += timedelta(days=1)

        # today — only mark absent if shift has ended
        if project.shiftendtime and localtime(now()).time() < project.shiftendtime:
            continue

        for assignment in ProjectEmployee.objects.filter(project=project).select_related('employee'):
            existing = Attendance.objects.filter(
                employee=assignment.employee, project=project, date=today
            ).first()
            if not existing:
                Attendance.objects.create(
                    employee=assignment.employee,
                    project=project,
                    date=today,
                    status='Absent',
                    remarks='Auto-marked absent by system',
                )
            elif existing.check_in is None:
                existing.status  = 'Absent'
                existing.remarks = 'Auto-marked absent by system'
                existing.save(update_fields=['status', 'remarks'])'''
