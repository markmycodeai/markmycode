
"""Admin API routes."""
from flask import Blueprint, request, jsonify
from auth import require_auth, register_user_firebase, disable_user_firebase, enable_user_firebase, get_token_from_request, decode_jwt_token
from firebase_init import get_auth, db
from models import (
    CollegeModel, DepartmentModel, BatchModel, StudentModel,
    QuestionModel, TopicModel, NoteModel, PerformanceModel, is_college_disabled,
    is_department_disabled, is_batch_disabled,
    disable_college_cascade, disable_department_cascade, disable_batch_cascade,
    enable_college_cascade, enable_department_cascade, enable_batch_cascade
)
from question_service import QuestionService
from topic_service import TopicService
from note_service import NoteService
from cascade_service import CascadeService
from agent_wrappers import generate_hidden_testcases
from utils import (
    validate_email, validate_username, validate_batch_name,
    error_response, success_response, audit_log
)

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


# @admin_bp.before_request
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
#     if payload.get("role") != "admin":
#         return jsonify({"error": True, "code": "FORBIDDEN", "message": "Insufficient permissions"}), 403
#     
#     request.user = payload


# ============================================================================
# COLLEGE ENDPOINTS
# ============================================================================

@admin_bp.route("/colleges", methods=["POST", "OPTIONS"])
@require_auth(allowed_roles=["admin"])
def create_college():
    """Create a college and a corresponding college user (password required)."""
    data = request.json or {}
    
    required = ["name", "email", "password"]
    if not all(data.get(k) for k in required):
        return error_response("INVALID_INPUT", f"Required fields: {', '.join(required)}")
    
    if not validate_email(data["email"]):
        return error_response("INVALID_EMAIL", "Invalid email format")
    
    if len(data.get("password", "")) < 6:
        return error_response("INVALID_PASSWORD", "Password must be at least 6 characters")
    
    # Register firebase user for college
    firebase_uid = register_user_firebase(data["email"], data["password"], name=data.get("name"), role="college")
    if not firebase_uid:
        return error_response("AUTH_ERROR", "Failed to create Firebase user")
    
    college_data = {
        "name": data["name"],
        "email": data["email"],
        "firebase_uid": firebase_uid,
        "is_disabled": False
    }
    
    college_id = CollegeModel().create(college_data)

    # update user profile to include college_id
    try:
        from firebase_init import db
        db.collection("User").document(firebase_uid).update({"college_id": college_id, "role": "college"})
    except Exception:
        pass

    audit_log(request.user.get("uid"), "create_college", "college", college_id, {"name": data["name"]})
    
    return success_response({"college_id": college_id}, "College created", status_code=201)


@admin_bp.route("/colleges", methods=["GET", "OPTIONS"])
@require_auth(allowed_roles=["admin"])
def list_colleges():
    """List all colleges (admin only)."""
    if request.method == "OPTIONS":
        return "", 200
    
    colleges = CollegeModel().query()
    # Remove sensitive fields
    for c in colleges:
        c.pop("firebase_uid", None)
    return success_response({"colleges": colleges})


@admin_bp.route("/colleges/<college_id>", methods=["GET"])
@require_auth(allowed_roles=["admin"])
def get_college(college_id):
    """Get college details."""
    college = CollegeModel().get(college_id)
    if not college:
        return error_response("NOT_FOUND", "College not found", status_code=404)
    
    college.pop("firebase_uid", None)
    return success_response({"college": college})


@admin_bp.route("/colleges/<college_id>", methods=["PUT"])
@require_auth(allowed_roles=["admin"])
def update_college(college_id):
    """Update college details including password."""
    college = CollegeModel().get(college_id)
    if not college:
        return error_response("NOT_FOUND", "College not found", status_code=404)
    
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
    
    # Update DB
    if update_data:
        CollegeModel().update(college_id, update_data)
        
    # Sync with Firebase
    firebase_uid = college.get("firebase_uid")
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
            
            # 1. Update Auth
            if auth_updates:
                get_auth().update_user(firebase_uid, **auth_updates)
                
            # 2. Update Firestore User Doc
            if firestore_updates:
                db.collection("User").document(firebase_uid).set(firestore_updates, merge=True)
                
        except Exception as e:
            print(f"Warning: Failed to sync college update to Firebase: {e}")
            # Consider if we should rollback? For now, we log it.

    audit_log(request.user.get("uid"), "update_college", "college", college_id, update_data)
    
    return success_response(None, "College updated")


@admin_bp.route("/colleges/<college_id>/disable", methods=["POST"])
@require_auth(allowed_roles=["admin"])
def disable_college(college_id):
    """Disable a college and cascade to all departments, batches, and students."""
    college = CollegeModel().get(college_id)
    if not college:
        return error_response("NOT_FOUND", "College not found", status_code=404)
    
    disable_college_cascade(college_id)
    audit_log(request.user.get("uid"), "disable_college_cascade", "college", college_id)
    
    return success_response(None, "College and all related departments, batches, and students disabled")


@admin_bp.route("/colleges/<college_id>/enable", methods=["POST"])
@require_auth(allowed_roles=["admin"])
def enable_college(college_id):
    """Enable a college and cascade to all departments, batches, and students."""
    college = CollegeModel().get(college_id)
    if not college:
        return error_response("NOT_FOUND", "College not found", status_code=404)
    
    enable_college_cascade(college_id)
    audit_log(request.user.get("uid"), "enable_college_cascade", "college", college_id)
    
    return success_response(None, "College and all related departments, batches, and students enabled")


@admin_bp.route("/colleges/<college_id>", methods=["DELETE"])
@require_auth(allowed_roles=["admin"])
def delete_college(college_id):
    """Permanently delete a college and all its cascading dependencies."""
    college = CollegeModel().get(college_id)
    if not college:
        return error_response("NOT_FOUND", "College not found", status_code=404)

    # Use cascade delete to remove college and all dependent entities
    success, message, deleted_count = CascadeService.delete_college_cascade(college_id, request.user.get("uid"))
    
    if not success:
        return error_response("DELETE_ERROR", message, status_code=400)

    return success_response({"deleted_count": deleted_count}, f"College and {sum(deleted_count.values())-1} dependent entities deleted successfully")


# ============================================================================
# DEPARTMENT ENDPOINTS
# ============================================================================

@admin_bp.route("/departments", methods=["POST"])
@require_auth(allowed_roles=["admin"])
def create_department():
    """Create a department under a college and create a department user (password required)."""
    data = request.json or {}
    
    required = ["college_id", "name", "email", "password"]
    if not all(data.get(k) for k in required):
        return error_response("INVALID_INPUT", f"Required fields: {', '.join(required)}")
    
    if not CollegeModel().get(data["college_id"]):
        return error_response("NOT_FOUND", "College not found")
    
    if not validate_email(data["email"]):
        return error_response("INVALID_EMAIL", "Invalid email format")
    
    if len(data.get("password", "")) < 6:
        return error_response("INVALID_PASSWORD", "Password must be at least 6 characters")
    
    # Register firebase user for department
    firebase_uid = register_user_firebase(data["email"], data["password"], name=data.get("name"), role="department")
    if not firebase_uid:
        return error_response("AUTH_ERROR", "Failed to create Firebase user")
    
    dept_data = {
        "college_id": data["college_id"],
        "name": data["name"],
        "email": data["email"],
        "firebase_uid": firebase_uid,
        "is_disabled": False
    }
    
    dept_id = DepartmentModel().create(dept_data)

    # update user profile to include department_id and college association
    try:
        from firebase_init import db
        db.collection("User").document(firebase_uid).update({"department_id": dept_id, "role": "department", "college_id": data["college_id"]})
    except Exception:
        pass

    audit_log(request.user.get("uid"), "create_department", "department", dept_id, {"name": data["name"]})
    
    return success_response({"department_id": dept_id}, "Department created", status_code=201)


@admin_bp.route("/departments", methods=["GET"])
@require_auth(allowed_roles=["admin"])
def list_departments():
    """List departments (optionally filtered by college)."""
    college_id = request.args.get("college_id")
    
    if college_id:
        depts = DepartmentModel().query(college_id=college_id)
    else:
        depts = DepartmentModel().query()
    
    # Remove sensitive fields
    for d in depts:
        d.pop("firebase_uid", None)
    
    return success_response({"departments": depts})


@admin_bp.route("/departments/<dept_id>", methods=["GET"])
@require_auth(allowed_roles=["admin"])
def get_department(dept_id):
    """Get department details."""
    dept = DepartmentModel().get(dept_id)
    if not dept:
        return error_response("NOT_FOUND", "Department not found", status_code=404)
    
    dept.pop("firebase_uid", None)
    return success_response({"department": dept})


@admin_bp.route("/departments/<dept_id>", methods=["PUT"])
@require_auth(allowed_roles=["admin"])
def update_department(dept_id):
    """Update department - college_id is immutable after creation."""
    dept = DepartmentModel().get(dept_id)
    if not dept:
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
    
    # college_id cannot be changed
    if "college_id" in data and data["college_id"] != dept.get("college_id"):
        return error_response("FORBIDDEN", "Cannot change college after department creation")
    
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


@admin_bp.route("/departments/<dept_id>/disable", methods=["POST"])
@require_auth(allowed_roles=["admin"])
def disable_department(dept_id):
    """Disable a department and cascade to all batches and students."""
    dept = DepartmentModel().get(dept_id)
    if not dept:
        return error_response("NOT_FOUND", "Department not found", status_code=404)
    
    disable_department_cascade(dept_id)
    audit_log(request.user.get("uid"), "disable_department_cascade", "department", dept_id)
    
    return success_response(None, "Department and all related batches and students disabled")


@admin_bp.route("/departments/<dept_id>/enable", methods=["POST"])
@require_auth(allowed_roles=["admin"])
def enable_department(dept_id):
    """Enable a department and cascade to all batches and students."""
    dept = DepartmentModel().get(dept_id)
    if not dept:
        return error_response("NOT_FOUND", "Department not found", status_code=404)
    
    enable_department_cascade(dept_id)
    audit_log(request.user.get("uid"), "enable_department_cascade", "department", dept_id)
    
    return success_response(None, "Department and all related batches and students enabled")


# ============================================================================
# BATCH ENDPOINTS
# ============================================================================

@admin_bp.route("/batches", methods=["POST"])
@require_auth(allowed_roles=["admin"])
def create_batch():
    """Create a batch and a corresponding batch user (password required)."""
    data = request.json or {}
    
    required = ["department_id", "college_id", "batch_name", "email", "password"]
    if not all(data.get(k) for k in required):
        return error_response("INVALID_INPUT", f"Required fields: {', '.join(required)}")
    
    if not DepartmentModel().get(data["department_id"]):
        return error_response("NOT_FOUND", "Department not found")
    
    if not CollegeModel().get(data["college_id"]):
        return error_response("NOT_FOUND", "College not found")
    
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
        "department_id": data["department_id"],
        "college_id": data["college_id"],
        "batch_name": data["batch_name"],
        "email": data["email"],
        "firebase_uid": firebase_uid,
        "is_disabled": False
    }
    
    batch_id = BatchModel().create(batch_data)

    # update user profile to include batch_id and associations
    try:
        from firebase_init import db
        db.collection("User").document(firebase_uid).update({"batch_id": batch_id, "role": "batch", "department_id": data["department_id"], "college_id": data["college_id"]})
    except Exception:
        pass

    audit_log(request.user.get("uid"), "create_batch", "batch", batch_id, {"batch_name": data["batch_name"]})
    
    return success_response({"batch_id": batch_id}, "Batch created", status_code=201)


@admin_bp.route("/batches", methods=["GET"])
@require_auth(allowed_roles=["admin"])
def list_batches():
    """List batches (optionally filtered by department)."""
    dept_id = request.args.get("department_id")
    
    if dept_id:
        batches = BatchModel().query(department_id=dept_id)
    else:
        batches = BatchModel().query()
    
    for b in batches:
        b.pop("firebase_uid", None)
    
    return success_response({"batches": batches})


@admin_bp.route("/batches/<batch_id>", methods=["GET"])
@require_auth(allowed_roles=["admin"])
def get_batch(batch_id):
    """Get batch details."""
    batch = BatchModel().get(batch_id)
    if not batch:
        return error_response("NOT_FOUND", "Batch not found", status_code=404)
    
    batch.pop("firebase_uid", None)
    return success_response({"batch": batch})


@admin_bp.route("/batches/<batch_id>", methods=["PUT"])
@require_auth(allowed_roles=["admin"])
def update_batch(batch_id):
    """Update batch - department_id and college_id are immutable."""
    batch = BatchModel().get(batch_id)
    if not batch:
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

    # Prevent changing department or college after batch creation
    if "department_id" in data and data["department_id"] != batch.get("department_id"):
        return error_response("FORBIDDEN", "Cannot change department after batch creation")
    
    if "college_id" in data and data["college_id"] != batch.get("college_id"):
        return error_response("FORBIDDEN", "Cannot change college after batch creation")

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


@admin_bp.route("/batches/<batch_id>/disable", methods=["POST"])
@require_auth(allowed_roles=["admin"])
def disable_batch(batch_id):
    """Disable a batch and cascade to all students."""
    batch = BatchModel().get(batch_id)
    if not batch:
        return error_response("NOT_FOUND", "Batch not found", status_code=404)
    
    disable_batch_cascade(batch_id)
    audit_log(request.user.get("uid"), "disable_batch_cascade", "batch", batch_id)
    
    return success_response(None, "Batch and all related students disabled")


@admin_bp.route("/batches/<batch_id>/enable", methods=["POST"])
@require_auth(allowed_roles=["admin"])
def enable_batch(batch_id):
    """Enable a batch and cascade to all students."""
    batch = BatchModel().get(batch_id)
    if not batch:
        return error_response("NOT_FOUND", "Batch not found", status_code=404)
    
    enable_batch_cascade(batch_id)
    audit_log(request.user.get("uid"), "enable_batch_cascade", "batch", batch_id)
    
    return success_response(None, "Batch and all related students enabled")


@admin_bp.route("/departments/<dept_id>", methods=["DELETE"])
@require_auth(allowed_roles=["admin"])
def delete_department(dept_id):
    """Permanently delete a department and all its cascading dependencies."""
    dept = DepartmentModel().get(dept_id)
    if not dept:
        return error_response("NOT_FOUND", "Department not found", status_code=404)

    # Use cascade delete to remove department and all dependent entities
    success, message, deleted_count = CascadeService.delete_department_cascade(dept_id, request.user.get("uid"))
    
    if not success:
        return error_response("DELETE_ERROR", message, status_code=400)

    return success_response({"deleted_count": deleted_count}, f"Department and {sum(deleted_count.values())-1} dependent entities deleted successfully")


@admin_bp.route("/batches/<batch_id>", methods=["DELETE"])
@require_auth(allowed_roles=["admin"])
def delete_batch(batch_id):
    """Permanently delete a batch and all its cascading dependencies."""
    batch = BatchModel().get(batch_id)
    if not batch:
        return error_response("NOT_FOUND", "Batch not found", status_code=404)

    # Use cascade delete to remove batch and all dependent entities
    success, message, deleted_count = CascadeService.delete_batch_cascade(batch_id, request.user.get("uid"))
    
    if not success:
        return error_response("DELETE_ERROR", message, status_code=400)

    return success_response({"deleted_count": deleted_count}, f"Batch and {sum(deleted_count.values())-1} dependent entities deleted successfully")


@admin_bp.route("/students/<student_id>", methods=["PUT"])
@require_auth(allowed_roles=["admin"])
def update_student(student_id):
    """Update student details."""
    student = StudentModel().get(student_id)
    if not student:
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
    
    # Handle batch change
    if "batch_id" in data:
        batch = BatchModel().get(data["batch_id"])
        if not batch:
            return error_response("NOT_FOUND", "Batch not found")
        update_data["batch_id"] = data["batch_id"]
        update_data["department_id"] = batch.get("department_id")
        update_data["college_id"] = batch.get("college_id")

    if update_data:
        StudentModel().update(student_id, update_data)
        
    # Sync changes to Firebase User collection & Auth
    if student.get("firebase_uid"):
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
            
            if "batch_id" in update_data:
                firestore_updates["batch_id"] = update_data["batch_id"]
                firestore_updates["department_id"] = update_data["department_id"]
                firestore_updates["college_id"] = update_data["college_id"]
            
            # 1. Update Auth
            if auth_updates:
                get_auth().update_user(student.get("firebase_uid"), **auth_updates)
                
            # 2. Update Firestore
            if firestore_updates:
                db.collection("User").document(student.get("firebase_uid")).set(firestore_updates, merge=True)
                
        except Exception as e:
            print(f"Warning: Failed to sync to Firebase: {e}")
        
    audit_log(request.user.get("uid"), "update_student", "student", student_id, update_data)

    return success_response(None, "Student updated")


@admin_bp.route("/students/<student_id>", methods=["DELETE"])
@require_auth(allowed_roles=["admin"])
def delete_student(student_id):
    """Permanently delete a student and all their related records."""
    student = StudentModel().get(student_id)
    if not student:
        return error_response("NOT_FOUND", "Student not found", status_code=404)

    # Use cascade delete to remove student and all their related records
    success, message, deleted_count = CascadeService.delete_student_cascade(student_id, request.user.get("uid"))
    
    if not success:
        return error_response("DELETE_ERROR", message, status_code=400)

    return success_response({"deleted_count": deleted_count}, f"Student and {sum(deleted_count.values())-1} related records deleted successfully")


# ============================================================================
# STUDENT ENDPOINTS
# ============================================================================

@admin_bp.route("/students", methods=["POST"])
@require_auth(allowed_roles=["admin"])
def create_student():
    """Create a student."""
    data = request.json or {}
    
    required = ["batch_id", "username", "email"]
    if not all(data.get(k) for k in required):
        return error_response("INVALID_INPUT", f"Required fields: {', '.join(required)}")
    
    batch = BatchModel().get(data["batch_id"])
    if not batch:
        return error_response("NOT_FOUND", "Batch not found")
    
    if not validate_username(data["username"]):
        return error_response("INVALID_USERNAME", "Invalid username (alphanumeric, 3-20 chars)")
    
    if not validate_email(data["email"]):
        return error_response("INVALID_EMAIL", "Invalid email format")
    
    # Check uniqueness
    if StudentModel().query(username=data["username"]):
        return error_response("CONFLICT", "Username already exists", status_code=409)
    if StudentModel().query(email=data["email"]):
        return error_response("CONFLICT", "Email already exists", status_code=409)
    
    # Generate temporary password
    import secrets
    temp_password = secrets.token_urlsafe(12)
    
    # Determine password
    password = data.get("password")
    if password:
        if len(password) < 6:
            return error_response("INVALID_PASSWORD", "Password must be at least 6 characters")
        password_reset_required = False
    else:
        import secrets
        password = secrets.token_urlsafe(12)
        password_reset_required = True

    # Register in Firebase with provided/generated password
    firebase_uid = register_user_firebase(data["email"], password, name=data.get("username"), role="student")
    if not firebase_uid:
        return error_response("AUTH_ERROR", "Failed to create Firebase user")
    
    student_data = {
        "batch_id": data["batch_id"],
        "department_id": batch.get("department_id"),
        "college_id": batch.get("college_id"),
        "username": data["username"],
        "email": data["email"],
        "firebase_uid": firebase_uid,
        "is_disabled": False,
        "password_reset_required": password_reset_required
    }
    
    student_id = StudentModel().create(student_data)

    # update user profile with student_id and associations
    try:
        from firebase_init import db
        db.collection("User").document(firebase_uid).set({
            "uid": firebase_uid,
            "email": data["email"],
            "name": data.get("username"),
            "role": "student",
            "student_id": student_id,
            "batch_id": data["batch_id"],
            "department_id": batch.get("department_id"),
            "college_id": batch.get("college_id"),
            "is_disabled": False
        }, merge=True)
    except Exception as e:
        print(f"Warning: Failed to update User document: {e}")

    audit_log(request.user.get("uid"), "create_student", "student", student_id, {"email": data["email"]})
    
    return success_response({"student_id": student_id, "password": password}, "Student created", status_code=201)


@admin_bp.route("/students", methods=["GET"])
@require_auth(allowed_roles=["admin"])
def list_students():
    """List students (optionally filtered by batch)."""
    batch_id = request.args.get("batch_id")
    
    if batch_id:
        students = StudentModel().query(batch_id=batch_id)
    else:
        students = StudentModel().query()
    
    # Pre-fetch lookup maps to avoid N+1 queries
    # This assumes reasonable dataset size. For huge datasets, pagination + specific lookups would be better.
    try:
        colleges = {c['id']: c.get('name', 'Unknown') for c in CollegeModel().query()}
        departments = {d['id']: d.get('name', 'Unknown') for d in DepartmentModel().query()}
        batches = {b['id']: b.get('batch_name', 'Unknown') for b in BatchModel().query()}
    except Exception as e:
        print(f"Warning: Failed to fetch lookup maps: {e}")
        colleges, departments, batches = {}, {}, {}

    # Remove sensitive fields and attach names
    for student in students:
        student.pop("firebase_uid", None)
        student['college_name'] = colleges.get(student.get('college_id'), student.get('college_id'))
        student['department_name'] = departments.get(student.get('department_id'), student.get('department_id'))
        student['batch_name'] = batches.get(student.get('batch_id'), student.get('batch_id'))
    
    return success_response({"students": students})


@admin_bp.route("/students/<student_id>", methods=["GET"])
@require_auth(allowed_roles=["admin"])
def get_student(student_id):
    """Get student details."""
    student = StudentModel().get(student_id)
    if not student:
        return error_response("NOT_FOUND", "Student not found", status_code=404)
    
    student.pop("firebase_uid", None)

    # Attach names
    try:
        college = CollegeModel().get(student.get("college_id"))
        department = DepartmentModel().get(student.get("department_id"))
        batch = BatchModel().get(student.get("batch_id"))
        
        student["college_name"] = college.get("name") if college else student.get("college_id")
        student["department_name"] = department.get("name") if department else student.get("department_id")
        student["batch_name"] = batch.get("batch_name") if batch else student.get("batch_id")
    except Exception:
        pass

    return success_response({"student": student})


@admin_bp.route("/students/<student_id>/disable", methods=["POST"])
@require_auth(allowed_roles=["admin"])
def disable_student(student_id):
    """Disable a student."""
    student = StudentModel().get(student_id)
    if not student:
        return error_response("NOT_FOUND", "Student not found", status_code=404)
    
    StudentModel().delete(student_id)
    disable_user_firebase(student.get("firebase_uid"))
    audit_log(request.user.get("uid"), "disable_student", "student", student_id)
    
    return success_response(None, "Student disabled")


@admin_bp.route("/students/<student_id>/enable", methods=["POST"])
@require_auth(allowed_roles=["admin"])
def enable_student(student_id):
    """Enable a student."""
    student = StudentModel().get(student_id)
    if not student:
        return error_response("NOT_FOUND", "Student not found", status_code=404)
    
    StudentModel().enable(student_id)
    enable_user_firebase(student.get("firebase_uid"))
    audit_log(request.user.get("uid"), "enable_student", "student", student_id)
    
    return success_response(None, "Student enabled")


# ============================================================================
# PERFORMANCE ENDPOINTS
# ============================================================================

@admin_bp.route("/performance", methods=["GET"])
@require_auth(allowed_roles=["admin"])
def get_performance():
    """Get performance data (with optional filters)."""
    college_id = request.args.get("college_id")
    dept_id = request.args.get("department_id")
    batch_id = request.args.get("batch_id")
    student_id = request.args.get("student_id")
    
    filters = {}
    if college_id:
        filters["college_id"] = college_id
    if dept_id:
        filters["department_id"] = dept_id
    if batch_id:
        filters["batch_id"] = batch_id
    
    # Special handling for student_id to support legacy/mismatched IDs
    performance = []
    
    if student_id:
        # 1. Try querying by the provided student_id (UUID)
        filters["student_id"] = student_id
        performance = PerformanceModel().query(**filters)
        
        # 2. Fallback: If no results found, check if records use Firebase UID
        if not performance:
            student = StudentModel().get(student_id)
            if student and student.get("firebase_uid"):
                filters["student_id"] = student.get("firebase_uid")
                performance = PerformanceModel().query(**filters)
    else:
        # No specific student, just apply other filters
        performance = PerformanceModel().query(**filters)
    
    # Enrich performance data with Question and Topic details
    if performance:
        # 1. Collect Question IDs
        question_ids = list(set([p.get("question_id") for p in performance if p.get("question_id")]))
        
        # 2. Fetch Questions (Batch fetch would be ideal, but looping for now or using a helper if exists)
        # Assuming no batch_get, so we loop or query. Optimizing by fetching all questions might be heavy if db is large.
        # But for a single student profile, N is small.
        # However, listing ALL performance (no student_id) could be huge.
        # Admin usually filters.
        
        # Let's verify we have access to models
        from models import QuestionModel, TopicModel
        
        questions_map = {}
        # Optimization: If fetching for a single student, N is generic.
        # If fetching for dashboard (many students), this loop is bad. 
        # But this endpoint is mostly used with filters.
        
        for qid in question_ids:
            q = QuestionModel().get(qid)
            if q:
                questions_map[qid] = q
                
        # 3. Collect Topic IDs
        topic_ids = list(set([q.get("topic_id") for q in questions_map.values() if q.get("topic_id")]))
        topics_map = {}
        
        for tid in topic_ids:
            t = TopicModel().get(tid)
            if t:
                topics_map[tid] = t
        
        # 4. Enrich Records
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


@admin_bp.route("/performance/summary", methods=["GET"])
@require_auth(allowed_roles=["admin"])
def get_performance_summary():
    """Get aggregated performance summary."""
    # This is a complex aggregation that could be cached
    # For now, return a placeholder
    return success_response({
        "summary": "Performance aggregation endpoint - implement with Firestore aggregation"
    })


# ============================================================================
# QUESTION ENDPOINTS (Admin can create questions for any college/dept/batch)
# ============================================================================

@admin_bp.route("/questions", methods=["POST", "OPTIONS"])
@require_auth(allowed_roles=["admin"])
def create_question():
    """Create a question as Super Admin (specify college, department, batch)."""
    if request.method == "OPTIONS":
        return "", 200
    
    data = request.json or {}
    return QuestionService.create_question_by_admin(request.user, data)


@admin_bp.route("/questions", methods=["GET", "OPTIONS"])
@require_auth(allowed_roles=["admin"])
def list_questions():
    """List all questions (super admin can see everything)."""
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        questions = QuestionModel().query()
        return success_response({"questions": questions if questions else []})
    except Exception as e:
        return error_response("QUERY_ERROR", str(e)), 500


@admin_bp.route("/questions/<question_id>", methods=["GET"])
@require_auth(allowed_roles=["admin"])
def get_question(question_id):
    """Get question details."""
    question = QuestionModel().get(question_id)
    if not question:
        return error_response("NOT_FOUND", "Question not found", status_code=404)
    
    return success_response({"question": question})


@admin_bp.route("/questions/<question_id>", methods=["PUT"])
@require_auth(allowed_roles=["admin"])
def update_question(question_id):
    """Update a question."""
    data = request.json or {}
    response, status_code = QuestionService.update_question(request.user, question_id, data)
    return response, status_code


@admin_bp.route("/questions/<question_id>", methods=["DELETE"])
@require_auth(allowed_roles=["admin"])
def delete_question(question_id):
    """Delete a question."""
    response, status_code = QuestionService.delete_question(request.user, question_id)
    return response, status_code


# ============================================================================
# TOPIC ENDPOINTS
# ============================================================================

@admin_bp.route("/topics", methods=["POST", "OPTIONS"])
@require_auth(allowed_roles=["admin"])
def create_topic():
    """Create a topic as Super Admin (specify college, department, batch)."""
    if request.method == "OPTIONS":
        return "", 200
    
    data = request.json or {}
    response, status_code = TopicService.create_topic_by_admin(request.user, data)
    return response, status_code


@admin_bp.route("/topics", methods=["GET", "OPTIONS"])
@require_auth(allowed_roles=["admin"])
def list_topics():
    """List all topics (super admin can see everything)."""
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        topics = TopicModel().query()
        return success_response({"topics": topics if topics else []})
    except Exception as e:
        return error_response("QUERY_ERROR", str(e)), 500


@admin_bp.route("/topics/<topic_id>", methods=["GET"])
@require_auth(allowed_roles=["admin"])
def get_topic(topic_id):
    """Get topic details."""
    topic = TopicModel().get(topic_id)
    if not topic:
        return error_response("NOT_FOUND", "Topic not found"), 404
    
    return success_response({"topic": topic})


@admin_bp.route("/topics/<topic_id>", methods=["PUT"])
@require_auth(allowed_roles=["admin"])
def update_topic(topic_id):
    """Update a topic."""
    data = request.json or {}
    response, status_code = TopicService.update_topic(request.user, topic_id, data)
    return response, status_code


@admin_bp.route("/topics/<topic_id>", methods=["DELETE"])
@require_auth(allowed_roles=["admin"])
def delete_topic(topic_id):
    """Delete a topic."""
    response, status_code = TopicService.delete_topic(request.user, topic_id)
    return response, status_code


# ============================================================================
# NOTE ENDPOINTS
# ============================================================================

@admin_bp.route("/notes", methods=["POST", "OPTIONS"])
@require_auth(allowed_roles=["admin"])
def create_note():
    """Create a note as Super Admin (specify college, department, batch)."""
    if request.method == "OPTIONS":
        return "", 200
    
    data = request.json or {}
    response, status_code = NoteService.create_note_by_admin(request.user, data)
    return response, status_code


@admin_bp.route("/notes", methods=["GET", "OPTIONS"])
@require_auth(allowed_roles=["admin"])
def list_notes():
    """List all notes (super admin can see everything)."""
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        notes = NoteModel().query()
        return success_response({"notes": notes if notes else []})
    except Exception as e:
        return error_response("QUERY_ERROR", str(e)), 500


@admin_bp.route("/notes/<note_id>", methods=["GET"])
@require_auth(allowed_roles=["admin"])
def get_note(note_id):
    """Get note details."""
    note = NoteModel().get(note_id)
    if not note:
        return error_response("NOT_FOUND", "Note not found"), 404
    
    return success_response({"note": note})


@admin_bp.route("/notes/<note_id>", methods=["PUT"])
@require_auth(allowed_roles=["admin"])
def update_note(note_id):
    """Update a note."""
    data = request.json or {}
    response, status_code = NoteService.update_note(request.user, note_id, data)
    return response, status_code


@admin_bp.route("/notes/<note_id>", methods=["DELETE"])
@require_auth(allowed_roles=["admin"])
def delete_note(note_id):
    """Delete a note."""
    response, status_code = NoteService.delete_note(request.user, note_id)
    return response, status_code


@admin_bp.route("/generate-testcases", methods=["POST", "OPTIONS"])
@require_auth(allowed_roles=["admin"])
def generate_testcases_admin():
    """Generate hidden test cases for a question using AI agent (Admin only)."""
    if request.method == "OPTIONS":
        return "", 200
    
    data = request.json or {}
    
    required = ["question_id", "description", "sample_input", "sample_output"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return error_response("INVALID_INPUT", f"Missing required fields: {', '.join(missing)}", status_code=400)
    
    question_id = data["question_id"]
    description = data["description"]
    sample_input = data["sample_input"]
    sample_output = data["sample_output"]
    
    try:
        # Verify question exists (no batch restriction for admin)
        question = QuestionModel().get(question_id)
        if not question:
            return error_response("NOT_FOUND", "Question not found", status_code=404)
        
        # Generate test cases using AI agent
        result = generate_hidden_testcases(description, sample_input, sample_output)
        
        if not result["success"]:
            return error_response("GENERATION_FAILED", result["error"], status_code=500)
        
        # Log audit trail
        audit_log(
            admin_id=request.user.get("user_id"),
            action="GENERATE_TESTCASES",
            target_type="question",
            target_id=question_id,
            details=f"Generated {len(result['testcases'])} test cases"
        )
        
        return success_response({
            "testcases": result["testcases"],
            "count": len(result["testcases"])
        })
    
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Test case generation error: {str(e)}", exc_info=True)
        return error_response("INTERNAL_ERROR", "Failed to generate test cases", status_code=500)
