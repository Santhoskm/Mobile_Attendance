from app.services.enroll import enroll_employee

with open("test_images/santhosh.jpeg", "rb") as f:
    image_bytes = f.read()

enroll_employee(
    employee_id="EMP001",
    image_bytes_list=[image_bytes]
)