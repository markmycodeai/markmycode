"""Department API routes."""
from flask import Blueprint, request, jsonify
from firebase_init import get_auth, db
from auth import require_auth, register_user_firebase, get_token_from_request, decode_jwt_token, disable_user_firebase, enable_user_firebase
from models import (
    BatchModel, StudentModel, TopicModel, QuestionModel, NoteModel
)
from question_service import QuestionService
from cascade_service import CascadeService
from agent_wrappers import generate_hidden_testcases
from utils import (
    error_response, success_response, validate_batch_name, validate_email,
    validate_username, validate_google_drive_link, parse_csv_students, audit_log
)
import secrets

department_bp = Blueprint("department", __name__, url_prefix="/api/department")


# @department_bp.before_request
# def check_options():
#     """Handle CORS preflight requests and auth."""
#     if request.method == "OPTIONS":
#         return "", 200
#     
#     # Check authentication for non-OPTIONS requests
#     token = get_token_from_request()
#     if not token:
#         return jsonify({"error": True, "code": "NO_AUTH", "message": "Missing authorization token"}), 401
#     
#     payload = decode_jwt_token(token)
#     if not payload:
#         return jsonify({"error": True, "code": "INVALID_TOKEN", "message": "Invalid or expired token"}), 401
#     
#     if payload.get("role") != "department":
#         return jsonify({"error": True, "code": "FORBIDDEN", "message": "Insufficient permissions"}), 403
#     
#     request.user = payload


# ============================================================================
# BATCH ENDPOINTS
# ============================================================================

@department_bp.route("/batches", methods=["POST", "OPTIONS"])
@require_auth(allowed_roles=["department"])
def create_batch():
    """Create a batch and a corresponding batch user (password required)."""
    if request.method == "OPTIONS":
        return "", 200
    
    dept_id = request.user.get("department_id")
    data = request.json or {}
    
    required = ["batch_name", "email", "password"]
    if not all(data.get(k) for k in required):
        return error_response("INVALID_INPUT", f"Required fields: {', '.join(required)}")
    
    if not validate_batch_name(data["batch_name"]):
        return error_response("INVALID_FORMAT", "Batch name must be in format YYYY-YYYY")
    
    if not validate_email(data.get("email")):
        return error_response("INVALID_EMAIL", "Invalid email format")
    
    if len(data.get("password", "")) < 6:
        return error_response("INVALID_PASSWORD", "Password must be at least 6 characters")
    
    # Register firebase user for batch
    firebase_uid = register_user_firebase(data["email"], data["password"], name=data.get("batch_name"), role="batch")
    if not firebase_uid:
        return error_response("AUTH_ERROR", "Failed to create Firebase user")
    
    batch_data = {
        "department_id": dept_id,
        "college_id": request.user.get("college_id"),
        "batch_name": data["batch_name"],
        "firebase_uid": firebase_uid,
        "is_disabled": False
    }
    
    batch_id = BatchModel().create(batch_data)

    # update user profile to include batch and associations
    try:
        from firebase_init import db
        db.collection("User").document(firebase_uid).update({"batch_id": batch_id, "role": "batch", "department_id": dept_id, "college_id": request.user.get("college_id")})
    except Exception:
        pass

    audit_log(dept_id, "create_batch", "batch", batch_id, {"batch_name": data["batch_name"]})
    
    return success_response({"batch_id": batch_id}, "Batch created", status_code=201)


@department_bp.route("/batches", methods=["GET"])
@require_auth(allowed_roles=["department"])
def list_batches():
    """List batches under this department."""
    dept_id = request.user.get("department_id")
    batches = BatchModel().query(department_id=dept_id, is_disabled=False)
    
    return success_response({"batches": batches})


@department_bp.route("/batches/<batch_id>", methods=["GET"])
@require_auth(allowed_roles=["department"])
def get_batch_dept(batch_id):
    """Get a batch under this department."""
    batch = BatchModel().get(batch_id)
    if not batch or batch.get("department_id") != request.user.get("department_id"):
        return error_response("NOT_FOUND", "Batch not found", status_code=404)
    batch.pop("firebase_uid", None)
    return success_response({"batch": batch})


@department_bp.route("/batches/<batch_id>", methods=["PUT"])
@require_auth(allowed_roles=["department"])
def update_batch_dept(batch_id):
    """Update a batch under this department."""
    batch = BatchModel().get(batch_id)
    if not batch or batch.get("department_id") != request.user.get("department_id"):
        return error_response("NOT_FOUND", "Batch not found", status_code=404)

    data = request.json or {}
    update_data = {}
    if "batch_name" in data:
        if not validate_batch_name(data["batch_name"]):
            return error_response("INVALID_FORMAT", "Batch name must be in format YYYY-YYYY")
        update_data["batch_name"] = data["batch_name"]
    if "email" in data:
        if not validate_email(data["email"]):
            return error_response("INVALID_EMAIL", "Invalid email format")
        update_data["email"] = data["email"]
        
    password = data.get("password")
    if password:
        if len(password) < 6:
            return error_response("INVALID_PASSWORD", "Password must be at least 6 characters")

    if update_data:
        BatchModel().update(batch_id, update_data)
        
    # Sync with Firebase
    firebase_uid = batch.get("firebase_uid")
    if firebase_uid:
        try:
            auth_updates = {}
            firestore_updates = {}
            
            if "email" in update_data:
                auth_updates["email"] = update_data["email"]
                firestore_updates["email"] = update_data["email"]
                
            if "batch_name" in update_data:
                auth_updates["display_name"] = update_data["batch_name"]
                firestore_updates["name"] = update_data["batch_name"]
                
            if password:
                auth_updates["password"] = password
            
            if auth_updates:
                get_auth().update_user(firebase_uid, **auth_updates)
                
            if firestore_updates:
                db.collection("User").document(firebase_uid).set(firestore_updates, merge=True)
        
        except Exception as e:
            print(f"Warning: Failed to sync batch update to Firebase: {e}")

    audit_log(request.user.get("department_id"), "update_batch", "batch", batch_id, update_data)
    return success_response(None, "Batch updated")


@department_bp.route("/batches/<batch_id>/disable", methods=["POST"])
@require_auth(allowed_roles=["department"])
def disable_batch_dept(batch_id):
    """Disable a batch under this department."""
    batch = BatchModel().get(batch_id)
    if not batch or batch.get("department_id") != request.user.get("department_id"):
        return error_response("NOT_FOUND", "Batch not found", status_code=404)

    BatchModel().delete(batch_id)
    if batch.get("firebase_uid"):
        disable_user_firebase(batch.get("firebase_uid"))
    audit_log(request.user.get("department_id"), "disable_batch", "batch", batch_id)
    return success_response(None, "Batch disabled")


@department_bp.route("/batches/<batch_id>/enable", methods=["POST"])
@require_auth(allowed_roles=["department"])
def enable_batch_dept(batch_id):
    """Enable a batch under this department."""
    batch = BatchModel().get(batch_id)
    if not batch or batch.get("department_id") != request.user.get("department_id"):
        return error_response("NOT_FOUND", "Batch not found", status_code=404)

    BatchModel().enable(batch_id)
    if batch.get("firebase_uid"):
        enable_user_firebase(batch.get("firebase_uid"))
    audit_log(request.user.get("department_id"), "enable_batch", "batch", batch_id)
    return success_response(None, "Batch enabled")


@department_bp.route("/batches/<batch_id>", methods=["DELETE"])
@require_auth(allowed_roles=["department"])
def delete_batch_dept(batch_id):
    """Permanently delete a batch and all its cascading dependencies under this department."""
    batch = BatchModel().get(batch_id)
    if not batch or batch.get("department_id") != request.user.get("department_id"):
        return error_response("NOT_FOUND", "Batch not found", status_code=404)

    # Use cascade delete to remove batch and all dependent entities
    success, message, deleted_count = CascadeService.delete_batch_cascade(batch_id, request.user.get("uid"))
    
    if not success:
        return error_response("DELETE_ERROR", message, status_code=400)

    return success_response({"deleted_count": deleted_count}, f"Batch and {sum(deleted_count.values())-1} dependent entities deleted successfully")


# ============================================================================
# STUDENT ENDPOINTS (CSV UPLOAD)
# ============================================================================

@department_bp.route("/students/upload", methods=["POST"])
@require_auth(allowed_roles=["department"])
def upload_students():
    """Upload students via CSV file.
    
    CSV format (REQUIRED columns):
    username,email,password,college_id,department_id,batch_id
    
    NOTE: college_id and department_id must match the authenticated user's scope.
    batch_id must be under this department.
    """
    dept_id = request.user.get("department_id")
    college_id = request.user.get("college_id")
    
    if "file" not in request.files:
        return error_response("NO_FILE", "No file provided")
    
    batch_id = request.form.get("batch_id")
    if not batch_id:
        return error_response("INVALID_INPUT", "batch_id is required")
    
    # Verify batch belongs to this department
    batch = BatchModel().get(batch_id)
    if not batch or batch.get("department_id") != dept_id:
        return error_response("NOT_FOUND", "Batch not found or doesn't belong to this department", status_code=404)
    
    csv_file = request.files["file"]
    
    # Parse CSV (now requires hierarchy fields)
    students, error = parse_csv_students(csv_file)
    if error:
        return error_response("CSV_PARSE_ERROR", error)
    
    created_students = []
    errors = []
    
    for idx, student in enumerate(students, start=2):
        try:
            # CRITICAL: Validate CSV hierarchy fields match department scope
            csv_college_id = student.get("college_id", "").strip()
            csv_dept_id = student.get("department_id", "").strip()
            csv_batch_id = student.get("batch_id", "").strip()
            
            # Verify college matches authenticated user's college
            if csv_college_id != college_id:
                errors.append(f"Row {idx}: college_id '{csv_college_id}' doesn't match your college '{college_id}'")
                continue
            
            # Verify department matches authenticated user's department
            if csv_dept_id != dept_id:
                errors.append(f"Row {idx}: department_id '{csv_dept_id}' doesn't match your department '{dept_id}'")
                continue
            
            # Verify batch matches the provided batch_id
            if csv_batch_id != batch_id:
                errors.append(f"Row {idx}: batch_id '{csv_batch_id}' doesn't match selected batch '{batch_id}'")
                continue
            
            # Check uniqueness
            if StudentModel().query(username=student["username"]):
                errors.append(f"Row {idx}: Username '{student['username']}' already exists")
                continue
            if StudentModel().query(email=student["email"]):
                errors.append(f"Row {idx}: Email '{student['email']}' already exists")
                continue
            
            # Register in Firebase
            firebase_uid = register_user_firebase(student["email"], student["password"])
            if not firebase_uid:
                errors.append(f"Row {idx}: Failed to register {student['email']} in Firebase")
                continue
            
            # Create in Firestore with validated hierarchy
            student_data = {
                "batch_id": batch_id,
                "department_id": dept_id,
                "college_id": college_id,
                "username": student["username"],
                "email": student["email"],
                "firebase_uid": firebase_uid,
                "is_disabled": False,
                "password_reset_required": False
            }
            
            student_id = StudentModel().create(student_data)
            created_students.append({"student_id": student_id, "email": student["email"]})
        
        except Exception as e:
            errors.append(f"Row {idx}: Error creating student {student.get('email', 'unknown')}: {str(e)}")
    
    audit_log(dept_id, "bulk_upload_students", "batch", batch_id, {
        "total": len(students),
        "created": len(created_students),
        "errors": len(errors)
    })
    
    return success_response({
        "created": created_students,
        "errors": errors
    }, f"Created {len(created_students)} students")


@department_bp.route("/students", methods=["GET"])
@require_auth(allowed_roles=["department"])
def list_students():
    """List students under this department (optionally filtered by batch)."""
    dept_id = request.user.get("department_id")
    batch_id = request.args.get("batch_id")
    
    filters = {"department_id": dept_id}
    if batch_id:
        filters["batch_id"] = batch_id
    
    students = StudentModel().query(**filters)
    
    # Remove sensitive fields
    for student in students:
        student.pop("firebase_uid", None)
    
    return success_response({"students": students})


@department_bp.route("/students", methods=["POST"])
@require_auth(allowed_roles=["department"])
def create_student_dept():
    """Create a student under this department."""
    dept_id = request.user.get("department_id")
    college_id = request.user.get("college_id")
    data = request.json or {}

    required = ["batch_id", "username", "email"]
    if not all(data.get(k) for k in required):
        return error_response("INVALID_INPUT", f"Required fields: {', '.join(required)}")

    batch = BatchModel().get(data["batch_id"])
    if not batch or batch.get("department_id") != dept_id:
        return error_response("NOT_FOUND", "Batch not found or doesn't belong to this department", status_code=404)

    if not validate_username(data["username"]):
        return error_response("INVALID_USERNAME", "Invalid username (alphanumeric, 3-20 chars)")
    if not validate_email(data["email"]):
        return error_response("INVALID_EMAIL", "Invalid email format")

    if StudentModel().query(username=data["username"]):
        return error_response("CONFLICT", "Username already exists", status_code=409)
    if StudentModel().query(email=data["email"]):
        return error_response("CONFLICT", "Email already exists", status_code=409)

    # Determine password
    password = data.get("password")
    password_reset_required = False
    if password:
        if len(password) < 6:
            return error_response("INVALID_PASSWORD", "Password must be at least 6 characters")
    else:
        import secrets
        password = secrets.token_urlsafe(12)
        password_reset_required = True

    firebase_uid = register_user_firebase(data["email"], password, name=data.get("username"), role="student")
    if not firebase_uid:
        return error_response("AUTH_ERROR", "Failed to create Firebase user")

    student_data = {
        "batch_id": data["batch_id"],
        "department_id": dept_id,
        "college_id": college_id,
        "username": data["username"],
        "email": data["email"],
        "firebase_uid": firebase_uid,
        "is_disabled": False,
        "password_reset_required": password_reset_required
    }

    student_id = StudentModel().create(student_data)

    try:
        from firebase_init import db
        db.collection("User").document(firebase_uid).update({"student_id": student_id, "batch_id": data["batch_id"], "department_id": dept_id, "college_id": college_id, "role": "student"})
    except Exception:
        pass

    audit_log(dept_id, "create_student", "student", student_id, {"email": data["email"]})
    return success_response({"student_id": student_id, "password": password}, "Student created", status_code=201)


@department_bp.route("/students/<student_id>", methods=["GET"])
@require_auth(allowed_roles=["department"])
def get_student_dept(student_id):
    """Get student details under this department."""
    student = StudentModel().get(student_id)
    if not student or student.get("department_id") != request.user.get("department_id"):
        return error_response("NOT_FOUND", "Student not found", status_code=404)

    student.pop("firebase_uid", None)

    # Resolve hierarchy names
    try:
        from models import CollegeModel, DepartmentModel
        college = CollegeModel().get(student.get("college_id"))
        dept = DepartmentModel().get(student.get("department_id"))
        batch = BatchModel().get(student.get("batch_id"))
        
        student["college_name"] = college.get("name") if college else "Unknown"
        student["department_name"] = dept.get("name") if dept else "Unknown"
        student["batch_name"] = batch.get("batch_name") if batch else "Unknown"
    except Exception:
        pass

    return success_response({"student": student})


@department_bp.route("/students/<student_id>", methods=["PUT"])
@require_auth(allowed_roles=["department"])
def update_student_dept(student_id):
    """Update student details under this department."""
    student = StudentModel().get(student_id)
    if not student or student.get("department_id") != request.user.get("department_id"):
        return error_response("NOT_FOUND", "Student not found", status_code=404)

    data = request.json or {}
    update_data = {}
    if "username" in data:
        if not validate_username(data["username"]):
            return error_response("INVALID_USERNAME", "Invalid username (alphanumeric, 3-20 chars)")
        update_data["username"] = data["username"]
    if "email" in data:
        if not validate_email(data["email"]):
            return error_response("INVALID_EMAIL", "Invalid email format")
        update_data["email"] = data["email"]
        
    password = data.get("password")
    if password:
        if len(password) < 6:
            return error_response("INVALID_PASSWORD", "Password must be at least 6 characters")

    if update_data:
        StudentModel().update(student_id, update_data)
        
    # Sync with Firebase
    firebase_uid = student.get("firebase_uid")
    if firebase_uid:
        try:
            auth_updates = {}
            firestore_updates = {}
            
            if "email" in update_data:
                auth_updates["email"] = update_data["email"]
                firestore_updates["email"] = update_data["email"]
                
            if "username" in update_data:
                auth_updates["display_name"] = update_data["username"]
                firestore_updates["name"] = update_data["username"]
                
            if password:
                auth_updates["password"] = password
            
            if auth_updates:
                get_auth().update_user(firebase_uid, **auth_updates)
                
            if firestore_updates:
                db.collection("User").document(firebase_uid).set(firestore_updates, merge=True)
                
        except Exception as e:
            print(f"Warning: Failed to sync student update to Firebase: {e}")

    audit_log(request.user.get("department_id"), "update_student", "student", student_id, update_data)

    return success_response(None, "Student updated")


@department_bp.route("/students/<student_id>/disable", methods=["POST"])
@require_auth(allowed_roles=["department"])
def disable_student_dept(student_id):
    """Disable a student under this department."""
    student = StudentModel().get(student_id)
    if not student or student.get("department_id") != request.user.get("department_id"):
        return error_response("NOT_FOUND", "Student not found", status_code=404)

    StudentModel().delete(student_id)
    if student.get("firebase_uid"):
        try:
            from auth import disable_user_firebase as _disable
            _disable(student.get("firebase_uid"))
        except Exception:
            pass
    audit_log(request.user.get("department_id"), "disable_student", "student", student_id)
    return success_response(None, "Student disabled")


@department_bp.route("/students/<student_id>/enable", methods=["POST"])
@require_auth(allowed_roles=["department"])
def enable_student_dept(student_id):
    """Enable a student under this department."""
    student = StudentModel().get(student_id)
    if not student or student.get("department_id") != request.user.get("department_id"):
        return error_response("NOT_FOUND", "Student not found", status_code=404)

    StudentModel().enable(student_id)
    if student.get("firebase_uid"):
        try:
            from auth import enable_user_firebase as _enable
            _enable(student.get("firebase_uid"))
        except Exception:
            pass
    audit_log(request.user.get("department_id"), "enable_student", "student", student_id)
    return success_response(None, "Student enabled")


@department_bp.route("/students/<student_id>", methods=["DELETE"])
@require_auth(allowed_roles=["department"])
def delete_student_dept(student_id):
    """Permanently delete a student and all their related records under this department."""
    student = StudentModel().get(student_id)
    if not student or student.get("department_id") != request.user.get("department_id"):
        return error_response("NOT_FOUND", "Student not found", status_code=404)

    # Use cascade delete to remove student and all their related records
    success, message, deleted_count = CascadeService.delete_student_cascade(student_id, request.user.get("uid"))
    
    if not success:
        return error_response("DELETE_ERROR", message, status_code=400)

    return success_response({"deleted_count": deleted_count}, f"Student and {sum(deleted_count.values())-1} related records deleted successfully")


# ============================================================================
# TOPIC ENDPOINTS
# ============================================================================

@department_bp.route("/topics", methods=["POST", "OPTIONS"])
def create_topic():
    """Create a topic."""
    if request.method == "OPTIONS":
        return "", 200
    
    dept_id = request.user.get("department_id")
    data = request.json or {}
    
    if not data.get("name"):
        return error_response("INVALID_INPUT", "name is required")
    
    topic_data = {
        "department_id": dept_id,
        "name": data["name"]
    }
    
    topic_id = TopicModel().create(topic_data)
    audit_log(dept_id, "create_topic", "topic", topic_id, {"name": data["name"]})

    return success_response({"topic_id": topic_id}, "Topic created", status_code=201)


@department_bp.route("/topics", methods=["GET", "OPTIONS"])
def list_topics():
    """List topics under this department."""
    if request.method == "OPTIONS":
        return "", 200
    
    dept_id = request.user.get("department_id")
    topics = TopicModel().query(department_id=dept_id)
    
    return success_response({"topics": topics})


# ============================================================================
# QUESTION ENDPOINTS
# ============================================================================

@department_bp.route("/questions", methods=["POST"])
@require_auth(allowed_roles=["department"])
def create_question():
    """Create a question as Department Admin (specify batch only)."""
    data = request.json or {}
    response, status_code = QuestionService.create_question_by_department(request.user, data)
    return response, status_code


@department_bp.route("/questions", methods=["GET"])
@require_auth(allowed_roles=["department"])
def list_questions():
    """List questions (optionally filtered by batch/topic)."""
    dept_id = request.user.get("department_id")
    batch_id = request.args.get("batch_id")
    topic_id = request.args.get("topic_id")
    
    filters = {"department_id": dept_id}
    if batch_id:
        filters["batch_id"] = batch_id
    if topic_id:
        filters["topic_id"] = topic_id
    
    questions = QuestionModel().query(**filters)
    
    return success_response({"questions": questions})


@department_bp.route("/questions/<question_id>", methods=["GET"])
@require_auth(allowed_roles=["department"])
def get_question(question_id):
    """Get question details."""
    dept_id = request.user.get("department_id")
    question = QuestionModel().get(question_id)
    
    if not question or question.get("department_id") != dept_id:
        return error_response("NOT_FOUND", "Question not found", status_code=404)
    
    return success_response({"question": question})


@department_bp.route("/questions/<question_id>", methods=["PUT"])
@require_auth(allowed_roles=["department"])
def update_question(question_id):
    """Update question."""
    data = request.json or {}
    response, status_code = QuestionService.update_question(request.user, question_id, data)
    return response, status_code


@department_bp.route("/questions/<question_id>", methods=["DELETE"])
@require_auth(allowed_roles=["department"])
def delete_question(question_id):
    """Delete question."""
    response, status_code = QuestionService.delete_question(request.user, question_id)
    return response, status_code


# ============================================================================
# NOTES ENDPOINTS
# ============================================================================

@department_bp.route("/notes", methods=["POST"])
@require_auth(allowed_roles=["department"])
def create_note():
    """Create a note."""
    dept_id = request.user.get("department_id")
    data = request.json or {}
    
    required = ["topic_id", "title", "google_drive_link"]
    if not all(data.get(k) for k in required):
        return error_response("INVALID_INPUT", f"Required fields: {', '.join(required)}")
    
    # Verify topic belongs to this department
    topic = TopicModel().get(data["topic_id"])
    if not topic or topic.get("department_id") != dept_id:
        return error_response("NOT_FOUND", "Topic not found", status_code=404)
    
    if not validate_google_drive_link(data["google_drive_link"]):
        return error_response("INVALID_LINK", "Invalid Google Drive link")
    
    note_data = {
        "topic_id": data["topic_id"],
        "department_id": dept_id,
        "title": data["title"],
        "google_drive_link": data["google_drive_link"]
    }
    
    note_id = NoteModel().create(note_data)
    audit_log(dept_id, "create_note", "note", note_id, {"title": data["title"]})
    
    return success_response({"note_id": note_id}, "Note created", status_code=201)


@department_bp.route("/notes", methods=["GET"])
@require_auth(allowed_roles=["department"])
def list_notes():
    """List notes (optionally filtered by topic)."""
    dept_id = request.user.get("department_id")
    topic_id = request.args.get("topic_id")
    
    filters = {"department_id": dept_id}
    if topic_id:
        filters["topic_id"] = topic_id
    
    notes = NoteModel().query(**filters)
    
    return success_response({"notes": notes})


@department_bp.route("/notes/<note_id>", methods=["DELETE"])
@require_auth(allowed_roles=["department"])
def delete_note(note_id):
    """Delete note."""
    dept_id = request.user.get("department_id")
    note = NoteModel().get(note_id)
    
    if not note or note.get("department_id") != dept_id:
        return error_response("NOT_FOUND", "Note not found", status_code=404)
    
    NoteModel().delete(note_id)
    audit_log(dept_id, "delete_note", "note", note_id)
    
# ============================================================================
# PERFORMANCE ENDPOINTS
# ============================================================================

@department_bp.route("/performance", methods=["GET"])
@require_auth(allowed_roles=["department"])
def get_performance():
    """Get performance data for students in this department."""
    from models import PerformanceModel # Ensure imported
    
    dept_id = request.user.get("department_id")
    student_id = request.args.get("student_id")
    batch_id = request.args.get("batch_id")
    
    filters = {"department_id": dept_id}
    if batch_id:
        filters["batch_id"] = batch_id
    
    performance = []
    
    if student_id:
        # 1. Verify student belongs to this department
        student = StudentModel().get(student_id)
        if not student or student.get("department_id") != dept_id:
             return success_response({"performance": []})
             
        # 2. Try querying by the provided student_id (UUID)
        filters["student_id"] = student_id
        performance = PerformanceModel().query(**filters)
        
        # 3. Fallback
        if not performance:
             if student.get("firebase_uid"):
                filters["student_id"] = student.get("firebase_uid")
                performance = PerformanceModel().query(**filters)
    else:
        performance = PerformanceModel().query(**filters)
        
    # Enrich performance data
    if performance:
        question_ids = list(set([p.get("question_id") for p in performance if p.get("question_id")]))
        
        questions_map = {}
        for qid in question_ids:
            q = QuestionModel().get(qid)
            if q:
                questions_map[qid] = q
                
        topic_ids = list(set([q.get("topic_id") for q in questions_map.values() if q.get("topic_id")]))
        topics_map = {}
        
        for tid in topic_ids:
            t = TopicModel().get(tid)
            if t:
                topics_map[tid] = t
        
        for p in performance:
            qid = p.get("question_id")
            if qid in questions_map:
                question = questions_map[qid]
                p["question_title"] = question.get("title") or question.get("heading") or "Unknown Question"
                
                tid = question.get("topic_id")
                if tid and tid in topics_map:
                    p["topic_name"] = topics_map[tid].get("name") or topics_map[tid].get("topic_name")
                else:
                    p["topic_name"] = "Unknown Topic"
            else:
                p["question_title"] = "Unknown Question"
                p["topic_name"] = "Unknown Topic"

    return success_response({"performance": performance})
