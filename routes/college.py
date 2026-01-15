"""College API routes."""
from flask import Blueprint, request, jsonify
from firebase_init import get_auth, db
from auth import require_auth, get_token_from_request, decode_jwt_token, disable_user_firebase, enable_user_firebase, register_user_firebase
from models import DepartmentModel, BatchModel, StudentModel, PerformanceModel, QuestionModel, TopicModel
from question_service import QuestionService
from cascade_service import CascadeService
from utils import error_response, success_response, validate_email, validate_username, validate_batch_name, audit_log

college_bp = Blueprint("college", __name__, url_prefix="/api/college")


# @college_bp.before_request
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
#     if payload.get("role") != "college":
#         return jsonify({"error": True, "code": "FORBIDDEN", "message": "Insufficient permissions"}), 403
#     
#     request.user = payload


@college_bp.route("/departments", methods=["GET", "OPTIONS"])
@require_auth(allowed_roles=["college"])
def list_departments():
    """List departments under this college."""
    college_id = request.user.get("college_id")
    depts = DepartmentModel().query(college_id=college_id, is_disabled=False)

    for d in depts:
        d.pop("firebase_uid", None)

    return success_response({"departments": depts})


@college_bp.route("/departments", methods=["POST", "OPTIONS"])
@require_auth(allowed_roles=["college"])
def create_department():
    """Create a department under this college (creates a Firebase user)."""
    data = request.json or {}
    college_id = request.user.get("college_id")

    required = ["name", "email", "password"]
    if not all(data.get(k) for k in required):
        return error_response("INVALID_INPUT", f"Required fields: {', '.join(required)}")

    if not validate_email(data["email"]):
        return error_response("INVALID_EMAIL", "Invalid email format")

    if len(data.get("password", "")) < 6:
        return error_response("INVALID_PASSWORD", "Password must be at least 6 characters")

    # Register firebase user for department
    firebase_uid = register_user_firebase(data["email"], data["password"], name=data.get("name"), role="department")
    if not firebase_uid:
        return error_response("AUTH_ERROR", "Failed to create Firebase user")

    dept_data = {
        "college_id": college_id,
        "name": data["name"],
        "email": data["email"],
        "firebase_uid": firebase_uid,
        "is_disabled": False
    }

    dept_id = DepartmentModel().create(dept_data)

    # update user profile to include department_id and college association
    try:
        from firebase_init import db
        db.collection("User").document(firebase_uid).update({"department_id": dept_id, "role": "department", "college_id": college_id})
    except Exception:
        pass

    audit_log(request.user.get("uid"), "create_department", "department", dept_id, {"name": data["name"]})

    return success_response({"department_id": dept_id}, "Department created", status_code=201)


@college_bp.route("/departments/<dept_id>", methods=["GET"])
@require_auth(allowed_roles=["college"])
def get_department(dept_id):
    """Get a department under this college."""
    dept = DepartmentModel().get(dept_id)
    if not dept or dept.get("college_id") != request.user.get("college_id"):
        return error_response("NOT_FOUND", "Department not found", status_code=404)

    dept.pop("firebase_uid", None)
    return success_response({"department": dept})


@college_bp.route("/departments/<dept_id>", methods=["PUT"])
@require_auth(allowed_roles=["college"])
def update_department_college(dept_id):
    """Update a department (college owner)."""
    dept = DepartmentModel().get(dept_id)
    if not dept or dept.get("college_id") != request.user.get("college_id"):
        return error_response("NOT_FOUND", "Department not found", status_code=404)

    data = request.json or {}
    update_data = {}
    if "name" in data:
        update_data["name"] = data["name"]
    if "email" in data:
        if not validate_email(data["email"]):
            return error_response("INVALID_EMAIL", "Invalid email format")
        update_data["email"] = data["email"]

    password = data.get("password")
    if password:
        if len(password) < 6:
            return error_response("INVALID_PASSWORD", "Password must be at least 6 characters")

    if update_data:
        DepartmentModel().update(dept_id, update_data)
        
    # Sync with Firebase
    firebase_uid = dept.get("firebase_uid")
    if firebase_uid:
        try:
            auth_updates = {}
            firestore_updates = {}
            
            if "email" in update_data:
                auth_updates["email"] = update_data["email"]
                firestore_updates["email"] = update_data["email"]
                
            if "name" in update_data:
                auth_updates["display_name"] = update_data["name"]
                firestore_updates["name"] = update_data["name"]
                
            if password:
                auth_updates["password"] = password
            
            if auth_updates:
                get_auth().update_user(firebase_uid, **auth_updates)
                
            if firestore_updates:
                db.collection("User").document(firebase_uid).set(firestore_updates, merge=True)
                
        except Exception as e:
            print(f"Warning: Failed to sync department update to Firebase: {e}")

    audit_log(request.user.get("uid"), "update_department", "department", dept_id, update_data)
    return success_response(None, "Department updated")


@college_bp.route("/departments/<dept_id>/disable", methods=["POST"])
@require_auth(allowed_roles=["college"])
def disable_department_college(dept_id):
    """Disable a department (college owner)."""
    dept = DepartmentModel().get(dept_id)
    if not dept or dept.get("college_id") != request.user.get("college_id"):
        return error_response("NOT_FOUND", "Department not found", status_code=404)

    DepartmentModel().delete(dept_id)
    if dept.get("firebase_uid"):
        disable_user_firebase(dept.get("firebase_uid"))
    audit_log(request.user.get("uid"), "disable_department", "department", dept_id)
    return success_response(None, "Department disabled")


@college_bp.route("/departments/<dept_id>/enable", methods=["POST"])
@require_auth(allowed_roles=["college"])
def enable_department_college(dept_id):
    """Enable a department (college owner)."""
    dept = DepartmentModel().get(dept_id)
    if not dept or dept.get("college_id") != request.user.get("college_id"):
        return error_response("NOT_FOUND", "Department not found", status_code=404)

    DepartmentModel().enable(dept_id)
    if dept.get("firebase_uid"):
        enable_user_firebase(dept.get("firebase_uid"))
    audit_log(request.user.get("uid"), "enable_department", "department", dept_id)
    return success_response(None, "Department enabled")


@college_bp.route("/departments/<dept_id>", methods=["DELETE"])
@require_auth(allowed_roles=["college"])
def delete_department_college(dept_id):
    """Permanently delete a department and all its cascading dependencies (college owner)."""
    dept = DepartmentModel().get(dept_id)
    if not dept or dept.get("college_id") != request.user.get("college_id"):
        return error_response("NOT_FOUND", "Department not found", status_code=404)

    # Use cascade delete to remove department and all dependent entities
    success, message, deleted_count = CascadeService.delete_department_cascade(dept_id, request.user.get("uid"))
    
    if not success:
        return error_response("DELETE_ERROR", message, status_code=400)

    return success_response({"deleted_count": deleted_count}, f"Department and {sum(deleted_count.values())-1} dependent entities deleted successfully")


@college_bp.route("/batches", methods=["GET", "OPTIONS"])
@require_auth(allowed_roles=["college"])
def list_batches_college():
    """List batches under this college."""
    if request.method == "OPTIONS":
        return "", 200

    college_id = request.user.get("college_id")
    batches = BatchModel().query(college_id=college_id, is_disabled=False)
    for b in batches:
        b.pop("firebase_uid", None)
    return success_response({"batches": batches})


@college_bp.route("/batches", methods=["POST", "OPTIONS"])
@require_auth(allowed_roles=["college"])
def create_batch_college():
    """Create a batch under this college (creates a Firebase user)."""
    if request.method == "OPTIONS":
        return "", 200

    college_id = request.user.get("college_id")
    data = request.json or {}

    required = ["department_id", "batch_name", "email", "password"]
    if not all(data.get(k) for k in required):
        return error_response("INVALID_INPUT", f"Required fields: {', '.join(required)}")

    dept = DepartmentModel().get(data["department_id"])
    if not dept or dept.get("college_id") != college_id:
        return error_response("NOT_FOUND", "Department not found or doesn't belong to this college", status_code=404)

    if not validate_batch_name(data["batch_name"]):
        return error_response("INVALID_FORMAT", "Batch name must be in format YYYY-YYYY")

    if not validate_email(data.get("email")):
        return error_response("INVALID_EMAIL", "Invalid email format")

    if len(data.get("password", "")) < 6:
        return error_response("INVALID_PASSWORD", "Password must be at least 6 characters")

    firebase_uid = register_user_firebase(data["email"], data["password"], name=data.get("batch_name"), role="batch")
    if not firebase_uid:
        return error_response("AUTH_ERROR", "Failed to create Firebase user")

    batch_data = {
        "department_id": data["department_id"],
        "college_id": college_id,
        "batch_name": data["batch_name"],
        "firebase_uid": firebase_uid,
        "is_disabled": False
    }

    batch_id = BatchModel().create(batch_data)

    try:
        from firebase_init import db
        db.collection("User").document(firebase_uid).update({"batch_id": batch_id, "role": "batch", "department_id": data["department_id"], "college_id": college_id})
    except Exception:
        pass

    audit_log(request.user.get("uid"), "create_batch", "batch", batch_id, {"batch_name": data["batch_name"]})
    return success_response({"batch_id": batch_id}, "Batch created", status_code=201)


@college_bp.route("/batches/<batch_id>", methods=["GET"])
@require_auth(allowed_roles=["college"])
def get_batch_college(batch_id):
    batch = BatchModel().get(batch_id)
    if not batch or batch.get("college_id") != request.user.get("college_id"):
        return error_response("NOT_FOUND", "Batch not found", status_code=404)
    batch.pop("firebase_uid", None)
    return success_response({"batch": batch})


@college_bp.route("/batches/<batch_id>", methods=["PUT"])
@require_auth(allowed_roles=["college"])
def update_batch_college(batch_id):
    batch = BatchModel().get(batch_id)
    if not batch or batch.get("college_id") != request.user.get("college_id"):
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

    audit_log(request.user.get("uid"), "update_batch", "batch", batch_id, update_data)
    return success_response(None, "Batch updated")


@college_bp.route("/batches/<batch_id>/disable", methods=["POST"])
@require_auth(allowed_roles=["college"])
def disable_batch_college(batch_id):
    batch = BatchModel().get(batch_id)
    if not batch or batch.get("college_id") != request.user.get("college_id"):
        return error_response("NOT_FOUND", "Batch not found", status_code=404)

    BatchModel().delete(batch_id)
    if batch.get("firebase_uid"):
        disable_user_firebase(batch.get("firebase_uid"))
    audit_log(request.user.get("uid"), "disable_batch", "batch", batch_id)
    return success_response(None, "Batch disabled")


@college_bp.route("/batches/<batch_id>/enable", methods=["POST"])
@require_auth(allowed_roles=["college"])
def enable_batch_college(batch_id):
    batch = BatchModel().get(batch_id)
    if not batch or batch.get("college_id") != request.user.get("college_id"):
        return error_response("NOT_FOUND", "Batch not found", status_code=404)

    BatchModel().enable(batch_id)
    if batch.get("firebase_uid"):
        enable_user_firebase(batch.get("firebase_uid"))
    audit_log(request.user.get("uid"), "enable_batch", "batch", batch_id)
    return success_response(None, "Batch enabled")


@college_bp.route("/batches/<batch_id>", methods=["DELETE"])
@require_auth(allowed_roles=["college"])
def delete_batch_college(batch_id):
    """Permanently delete a batch and all its cascading dependencies (college owner)."""
    batch = BatchModel().get(batch_id)
    if not batch or batch.get("college_id") != request.user.get("college_id"):
        return error_response("NOT_FOUND", "Batch not found", status_code=404)

    # Use cascade delete to remove batch and all dependent entities
    success, message, deleted_count = CascadeService.delete_batch_cascade(batch_id, request.user.get("uid"))
    
    if not success:
        return error_response("DELETE_ERROR", message, status_code=400)

    return success_response({"deleted_count": deleted_count}, f"Batch and {sum(deleted_count.values())-1} dependent entities deleted successfully")


@college_bp.route("/students", methods=["POST"])
@require_auth(allowed_roles=["college"])
def create_student_college():
    data = request.json or {}
    college_id = request.user.get("college_id")

    required = ["batch_id", "username", "email"]
    if not all(data.get(k) for k in required):
        return error_response("INVALID_INPUT", f"Required fields: {', '.join(required)}")

    batch = BatchModel().get(data["batch_id"]) 
    if not batch or batch.get("college_id") != college_id:
        return error_response("NOT_FOUND", "Batch not found or doesn't belong to this college", status_code=404)

    if not validate_username(data["username"]):
        return error_response("INVALID_USERNAME", "Invalid username (alphanumeric, 3-20 chars)")
    if not validate_email(data["email"]):
        return error_response("INVALID_EMAIL", "Invalid email format")

    if StudentModel().query(username=data["username"]):
        return error_response("CONFLICT", "Username already exists", status_code=409)
    if StudentModel().query(email=data["email"]):
        return error_response("CONFLICT", "Email already exists", status_code=409)

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
        "department_id": batch.get("department_id"),
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
        db.collection("User").document(firebase_uid).update({"student_id": student_id, "batch_id": data["batch_id"], "department_id": batch.get("department_id"), "college_id": college_id, "role": "student"})
    except Exception:
        pass

    audit_log(request.user.get("uid"), "create_student", "student", student_id, {"email": data["email"]})
    return success_response({"student_id": student_id, "password": password}, "Student created", status_code=201)


@college_bp.route("/students", methods=["GET"])
@require_auth(allowed_roles=["college"])
def list_students_college():
    batch_id = request.args.get("batch_id")
    college_id = request.user.get("college_id")

    filters = {"college_id": college_id}
    if batch_id:
        filters["batch_id"] = batch_id

    students = StudentModel().query(**filters)
    for s in students:
        s.pop("firebase_uid", None)
    return success_response({"students": students})


@college_bp.route("/students/<student_id>", methods=["GET"])
@require_auth(allowed_roles=["college"])
def get_student_college(student_id):
    student = StudentModel().get(student_id)
    if not student or student.get("college_id") != request.user.get("college_id"):
        return error_response("NOT_FOUND", "Student not found", status_code=404)
    student.pop("firebase_uid", None)
    
    # Resolve hierarchy names
    try:
        from models import CollegeModel, DepartmentModel, BatchModel
        college = CollegeModel().get(student.get("college_id"))
        dept = DepartmentModel().get(student.get("department_id"))
        batch = BatchModel().get(student.get("batch_id"))
        
        student["college_name"] = college.get("name") if college else "Unknown"
        student["department_name"] = dept.get("name") if dept else "Unknown"
        student["batch_name"] = batch.get("batch_name") if batch else "Unknown"
    except Exception:
        pass

    return success_response({"student": student})


@college_bp.route("/students/<student_id>", methods=["PUT"])
@require_auth(allowed_roles=["college"])
def update_student_college(student_id):
    student = StudentModel().get(student_id)
    if not student or student.get("college_id") != request.user.get("college_id"):
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

    audit_log(request.user.get("uid"), "update_student", "student", student_id, update_data)

    return success_response(None, "Student updated")


@college_bp.route("/students/<student_id>/disable", methods=["POST"])
@require_auth(allowed_roles=["college"])
def disable_student_college(student_id):
    student = StudentModel().get(student_id)
    if not student or student.get("college_id") != request.user.get("college_id"):
        return error_response("NOT_FOUND", "Student not found", status_code=404)

    StudentModel().delete(student_id)
    if student.get("firebase_uid"):
        try:
            disable_user_firebase(student.get("firebase_uid"))
        except Exception:
            pass
    audit_log(request.user.get("uid"), "disable_student", "student", student_id)
    return success_response(None, "Student disabled")


@college_bp.route("/students/<student_id>/enable", methods=["POST"])
@require_auth(allowed_roles=["college"])
def enable_student_college(student_id):
    student = StudentModel().get(student_id)
    if not student or student.get("college_id") != request.user.get("college_id"):
        return error_response("NOT_FOUND", "Student not found", status_code=404)

    StudentModel().enable(student_id)
    if student.get("firebase_uid"):
        try:
            enable_user_firebase(student.get("firebase_uid"))
        except Exception:
            pass
    audit_log(request.user.get("uid"), "enable_student", "student", student_id)
    return success_response(None, "Student enabled")


@college_bp.route("/students/<student_id>", methods=["DELETE"])
@require_auth(allowed_roles=["college"])
def delete_student_college(student_id):
    """Permanently delete a student and all their related records (college owner)."""
    student = StudentModel().get(student_id)
    if not student or student.get("college_id") != request.user.get("college_id"):
        return error_response("NOT_FOUND", "Student not found", status_code=404)

    # Use cascade delete to remove student and all their related records
    success, message, deleted_count = CascadeService.delete_student_cascade(student_id, request.user.get("uid"))
    
    if not success:
        return error_response("DELETE_ERROR", message, status_code=400)

    return success_response({"deleted_count": deleted_count}, f"Student and {sum(deleted_count.values())-1} related records deleted successfully")


@college_bp.route("/performance", methods=["GET"])
@require_auth(allowed_roles=["college"])
def get_performance():
    """Get performance data for departments under this college."""
    college_id = request.user.get("college_id")
    dept_id = request.args.get("department_id")
    batch_id = request.args.get("batch_id")
    student_id = request.args.get("student_id")
    
    filters = {"college_id": college_id}
    if dept_id:
        filters["department_id"] = dept_id
    if batch_id:
        filters["batch_id"] = batch_id
        
    performance = []
    
    if student_id:
        # 1. Verify student belongs to this college
        student = StudentModel().get(student_id)
        if not student or student.get("college_id") != college_id:
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


# ============================================================================
# QUESTION ENDPOINTS (College can create questions within their college)
# ============================================================================

@college_bp.route("/questions", methods=["POST", "OPTIONS"])
@require_auth(allowed_roles=["college"])
def create_question():
    """Create a question as College Admin (specify department, batch)."""
    if request.method == "OPTIONS":
        return "", 200
    
    data = request.json or {}
    response, status_code = QuestionService.create_question_by_college(request.user, data)
    return response, status_code


@college_bp.route("/questions", methods=["GET", "OPTIONS"])
@require_auth(allowed_roles=["college"])
def list_questions():
    """List all questions in this college."""
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        college_id = request.user.get("college_id")
        batch_id = request.args.get("batch_id")
        topic_id = request.args.get("topic_id")
        
        filters = {"college_id": college_id}
        if batch_id:
            filters["batch_id"] = batch_id
        if topic_id:
            filters["topic_id"] = topic_id
        
        questions = QuestionModel().query(**filters)
        return success_response({"questions": questions if questions else []})
    except Exception as e:
        return error_response("QUERY_ERROR", str(e)), 500


@college_bp.route("/questions/<question_id>", methods=["GET"])
@require_auth(allowed_roles=["college"])
def get_question(question_id):
    """Get question details."""
    question = QuestionModel().get(question_id)
    college_id = request.user.get("college_id")
    
    if not question or question.get("college_id") != college_id:
        return error_response("NOT_FOUND", "Question not found in your college"), 404
    
    return success_response({"question": question})


@college_bp.route("/questions/<question_id>", methods=["PUT"])
@require_auth(allowed_roles=["college"])
def update_question(question_id):
    """Update a question."""
    data = request.json or {}
    response, status_code = QuestionService.update_question(request.user, question_id, data)
    return response, status_code


@college_bp.route("/questions/<question_id>", methods=["DELETE"])
@require_auth(allowed_roles=["college"])
def delete_question(question_id):
    """Delete a question."""
    response, status_code = QuestionService.delete_question(request.user, question_id)
    return response, status_code
