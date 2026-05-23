from face_ai.celery_app import celery
from face_ai.services.face_service import extract_embedding
from face_ai.services.verify import query_similarity


@celery.task(bind=True, max_retries=3)
def verify_face_task(self, employee_id, image_bytes):
    try:
        vec = extract_embedding(image_bytes)

        sim = query_similarity(employee_id, vec)

        return {
            "matched": sim >= 0.40,
            "confidence": sim
        }

    except Exception as e:
        raise self.retry(exc=e, countdown=3)