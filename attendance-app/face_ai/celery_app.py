from celery import Celery

celery = Celery(
    "wms_cv",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
)