from PIL import Image
import numpy as np
import io
from insightface.app import FaceAnalysis

face_app = FaceAnalysis(
    name="buffalo_l",
    providers=["CPUExecutionProvider"]
)

face_app.prepare(ctx_id=0, det_size=(640, 640))


def extract_embedding(image_bytes: bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    faces = face_app.get(np.array(img))

    if len(faces) == 0:
        raise ValueError("No face detected")

    if len(faces) > 1:
        raise ValueError("More than one face detected")

    return faces[0].normed_embedding