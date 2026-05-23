from face_ai.db.db import get_conn


def query_similarity(employee_id: str, vec):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT 1 - (avg_vector <=> %s::vector) AS similarity
        FROM face_enrollments
        WHERE employee_id = %s
        AND is_active = TRUE
        LIMIT 1
    """, (vec.tolist(), employee_id))

    row = cur.fetchone()

    cur.close()
    conn.close()

    if row is None:
        return 0.0

    return float(row[0])