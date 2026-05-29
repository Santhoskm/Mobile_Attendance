import psycopg2
from pgvector.psycopg2 import register_vector

DATABASE_URL = {
    "host": "127.0.0.1",
    "port": 5433,
    "database": "wms_db",
    "user": "postgres",
    "password": "12345"
}


def get_conn():
    conn = psycopg2.connect(**DATABASE_URL)
    register_vector(conn)
    return conn