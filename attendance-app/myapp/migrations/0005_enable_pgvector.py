from django.db import migrations
from pgvector.django import VectorExtension


class Migration(migrations.Migration):

    dependencies = [
        ("myapp", "0003_alter_attendance_id_and_more"),
    ]

    operations = [
        VectorExtension(),
    ]