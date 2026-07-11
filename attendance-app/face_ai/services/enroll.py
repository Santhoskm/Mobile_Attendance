# import numpy as np
# from face_ai.services.face_service import extract_embedding
# from face_ai.db.db import get_conn


# def enroll_employee(employee_id: str, image_bytes_list: list):
#     vecs = [extract_embedding(img) for img in image_bytes_list]

#     avg = np.mean(vecs, axis=0)
#     avg = avg / np.linalg.norm(avg)

#     conn = get_conn()
#     cur = conn.cursor()

#     cur.execute("""
#         INSERT INTO face_enrollments (employee_id, avg_vector)
#         VALUES (%s, %s)
#         ON CONFLICT (employee_id)
#         DO UPDATE SET avg_vector = EXCLUDED.avg_vector,
#                       enrolled_at = NOW(),
#                       is_active = TRUE
#     """, (employee_id, avg.tolist()))

#     conn.commit()
#     cur.close()
#     conn.close()

#     print(f"Enrolled {employee_id} OK")





import numpy as np
from face_ai.services.face_service import extract_embedding
from face_ai.db.db import get_conn


def enroll_employee(employee_id: str, image_bytes_list: list):
    vecs = [extract_embedding(img) for img in image_bytes_list]

    avg = np.mean(vecs, axis=0)
    avg = avg / np.linalg.norm(avg)

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO face_enrollments
        (employee_id, avg_vector, enrolled_at, is_active)

        VALUES (%s, %s, NOW(), TRUE)

        ON CONFLICT (employee_id)
        DO UPDATE SET
            avg_vector = EXCLUDED.avg_vector,
            enrolled_at = NOW(),
            is_active = TRUE
    """, (
        employee_id,
        avg.tolist()
    ))

    conn.commit()
    cur.close()
    conn.close()

    print(f"Enrolled {employee_id} OK")