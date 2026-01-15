"""Batch API routes."""
from flask import Blueprint, request, jsonify
from firebase_init import get_auth, db
from auth import require_auth, register_user_firebase, disable_user_firebase, enable_user_firebase, get_token_from_request, decode_jwt_token
from models import StudentModel, BatchModel, QuestionModel, TopicModel, NoteModel, PerformanceModel
from question_service import QuestionService
from topic_service import TopicService
from note_service import NoteService
from cascade_service import CascadeService
from agent_wrappers import generate_hidden_testcases
from utils import validate_email, error_response, success_response, audit_log
import logging

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

batch_bp = Blueprint("batch", __name__, url_prefix="/api/batch")


# ============================================================================
# STUDENT ENDPOINTS
# ============================================================================

@batch_bp.route("/students", methods=["GET", "OPTIONS"])
@require_auth(allowed_roles=["batch"])
def get_students():
    """Get all students in this batch."""
    if request.method == "OPTIONS":
        return "", 200
    
    batch_id = request.user.get("batch_id")
    if not batch_id:
        return error_response("NO_BATCH", "Batch ID not found in token", status_code=400)
    
    try:
        students = StudentModel().query(batch_id=batch_id)
        return success_response({"students": students})
    except Exception as e:
        return error_response("QUERY_ERROR", str(e), status_code=500)


@batch_bp.route("/students", methods=["POST"])
@require_auth(allowed_roles=["batch"])
def create_student():
    """Create a new student in this batch."""
    batch_id = request.user.get("batch_id")
    if not batch_id:
        return error_response("NO_BATCH", "Batch ID not found in token", status_code=400)
    
    data = request.json or {}
    
    required = ["username", "email", "password"]
    if not all(data.get(k) for k in required):
        return error_response("INVALID_INPUT", f"Required fields: {', '.join(required)}")
    
    if not validate_email(data["email"]):
        return error_response("INVALID_EMAIL", "Invalid email format")
    
    if len(data.get("password", "")) < 6:
        return error_response("INVALID_PASSWORD", "Password must be at least 6 characters")
    
    try:
        # Check if student with this username or email already exists
        if StudentModel().query(username=data["username"]):
            return error_response("USERNAME_EXISTS", "Username already exists", status_code=409)
        existing = StudentModel().query(email=data["email"])
        if existing:
            return error_response("EMAIL_EXISTS", "Student with this email already exists", status_code=409)
        
        # Get batch to extract hierarchy
        batch = BatchModel().get(batch_id)
        if not batch:
            return error_response("NOT_FOUND", "Batch not found", status_code=404)
        
        college_id = batch.get("college_id")
        department_id = batch.get("department_id")
        if not college_id or not department_id:
            return error_response("INCOMPLETE_BATCH", "Batch missing hierarchy information", status_code=400)
        
        # Register Firebase user
        firebase_uid = register_user_firebase(data["email"], data["password"], name=data.get("username"), role="student")
        if not firebase_uid:
            return error_response("AUTH_ERROR", "Failed to create Firebase user")
        
        # Create student record with full hierarchy (CANONICAL FIELD: username)
        student_data = {
            "username": data["username"],
            "email": data["email"],
            "firebase_uid": firebase_uid,
            "batch_id": batch_id,
            "college_id": college_id,
            "department_id": department_id,
            "is_active": True
        }
        
        student_id = StudentModel().create(student_data)
        
        # Update Firebase user profile with FULL HIERARCHY
        try:
            from firebase_init import db
            db.collection("User").document(firebase_uid).update({
                "batch_id": batch_id,
                "college_id": college_id,
                "department_id": department_id,
                "role": "student"
            })
        except Exception:
            pass
        
        audit_log(request.user.get("uid"), "create_student", "student", student_id, {"username": data["username"], "email": data["email"], "batch_id": batch_id, "college_id": college_id, "department_id": department_id})
        
        return success_response({"student_id": student_id}, "Student created", status_code=201)
    except Exception as e:
        return error_response("CREATE_ERROR", str(e), status_code=500)


@batch_bp.route("/students/<student_id>", methods=["GET"])
@require_auth(allowed_roles=["batch"])
def get_student(student_id):
    """Get student details."""
    batch_id = request.user.get("batch_id")
    
    try:
        student = StudentModel().get(student_id)
        if not student:
            return error_response("NOT_FOUND", "Student not found", status_code=404)
        
        if student.get("batch_id") != batch_id:
            return error_response("FORBIDDEN", "Student does not belong to your batch", status_code=403)
        
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
    except Exception as e:
        return error_response("QUERY_ERROR", str(e), status_code=500)


@batch_bp.route("/students/<student_id>", methods=["PUT"])
@require_auth(allowed_roles=["batch"])
def update_student(student_id):
    """Update student details."""
    batch_id = request.user.get("batch_id")
    
    try:
        student = StudentModel().get(student_id)
        if not student:
            return error_response("NOT_FOUND", "Student not found", status_code=404)
        
        if student.get("batch_id") != batch_id:
            return error_response("FORBIDDEN", "Student does not belong to your batch", status_code=403)
        
        data = request.json or {}
        update_data = {}
        
        if "name" in data:
            update_data["username"] = data["name"] # Mapped to username
        if "username" in data:
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
    except Exception as e:
        return error_response("UPDATE_ERROR", str(e), status_code=500)


@batch_bp.route("/students/<student_id>/status", methods=["PUT"])
@require_auth(allowed_roles=["batch"])
def update_student_status(student_id):
    """Update student active/inactive status."""
    batch_id = request.user.get("batch_id")
    
    try:
        student = StudentModel().get(student_id)
        if not student:
            return error_response("NOT_FOUND", "Student not found", status_code=404)
        
        if student.get("batch_id") != batch_id:
            return error_response("FORBIDDEN", "Student does not belong to your batch", status_code=403)
        
        data = request.json or {}
        is_active = data.get("is_active", True)
        
        StudentModel().update(student_id, {"is_active": is_active})
        
        # Update Firebase user status
        try:
            firebase_uid = student.get("firebase_uid")
            if is_active:
                enable_user_firebase(firebase_uid)
            else:
                disable_user_firebase(firebase_uid)
        except Exception:
            pass
        
        audit_log(request.user.get("uid"), "update_student_status", "student", student_id, {"is_active": is_active})
        
        return success_response(None, "Student status updated")
    except Exception as e:
        return error_response("UPDATE_ERROR", str(e), status_code=500)


@batch_bp.route("/students/<student_id>", methods=["DELETE"])
@require_auth(allowed_roles=["batch"])
def delete_student(student_id):
    """Delete a student and all their related records."""
    batch_id = request.user.get("batch_id")
    
    try:
        student = StudentModel().get(student_id)
        if not student:
            return error_response("NOT_FOUND", "Student not found", status_code=404)
        
        if student.get("batch_id") != batch_id:
            return error_response("FORBIDDEN", "Student does not belong to your batch", status_code=403)
        
        # Use cascade delete to remove student and all their related records
        success, message, deleted_count = CascadeService.delete_student_cascade(student_id, request.user.get("uid"))
        
        if not success:
            return error_response("DELETE_ERROR", message, status_code=400)

        return success_response({"deleted_count": deleted_count}, f"Student and {sum(deleted_count.values())-1} related records deleted successfully")
    except Exception as e:
        return error_response("DELETE_ERROR", str(e), status_code=500)


@batch_bp.route("/students/bulk", methods=["POST"])
@require_auth(allowed_roles=["batch"])
def bulk_create_students():
    """Create multiple students from CSV data."""
    batch_id = request.user.get("batch_id")
    if not batch_id:
        return error_response("NO_BATCH", "Batch ID not found in token", status_code=400)
    
    # CRITICAL: Get batch details to retrieve college_id and department_id
    batch = BatchModel().get(batch_id)
    if not batch:
        return error_response("BATCH_NOT_FOUND", f"Batch {batch_id} not found", status_code=404)
    
    college_id = batch.get("college_id")
    department_id = batch.get("department_id")
    
    # CRITICAL: Validate hierarchy is complete at batch level
    if not college_id:
        return error_response("INCOMPLETE_BATCH", 
            "Batch is missing college_id. Contact administrator.", status_code=400)
    if not department_id:
        return error_response("INCOMPLETE_BATCH", 
            "Batch is missing department_id. Contact administrator.", status_code=400)
    
    data = request.json or {}
    students_data = data.get("students", [])
    
    if not students_data:
        return error_response("INVALID_INPUT", "No students provided")
    
    try:
        batch_name = request.user.get("name", "Unknown Batch")
        total_students = len(students_data)
        created_count = 0
        errors = []
        
        logger.info(f"[BATCH UPLOAD] Starting bulk upload for batch: {batch_name} ({batch_id})")
        logger.info(f"[BATCH UPLOAD] Batch hierarchy - College: {college_id}, Dept: {department_id}")
        logger.info(f"[BATCH UPLOAD] Total students to create: {total_students}")
        
        for index, student_data in enumerate(students_data, 1):
            try:
                logger.info(f"[BATCH UPLOAD] Processing student {index}/{total_students}: {student_data.get('name', 'Unknown')}")
                
                if not student_data.get("name") or not student_data.get("email") or not student_data.get("password"):
                    error_msg = f"Missing required fields for student {student_data.get('name', 'Unknown')}"
                    logger.warning(f"[BATCH UPLOAD] {error_msg}")
                    errors.append(error_msg)
                    continue
                
                if not validate_email(student_data["email"]):
                    error_msg = f"Invalid email format: {student_data['email']}"
                    logger.warning(f"[BATCH UPLOAD] {error_msg}")
                    errors.append(error_msg)
                    continue
                
                # Check if student already exists
                existing = StudentModel().query(email=student_data["email"])
                if existing:
                    error_msg = f"Student with email {student_data['email']} already exists"
                    logger.warning(f"[BATCH UPLOAD] {error_msg}")
                    errors.append(error_msg)
                    continue
                
                # Register Firebase user
                logger.info(f"[BATCH UPLOAD] Creating Firebase user for {student_data['email']}")
                firebase_uid = register_user_firebase(
                    student_data["email"],
                    student_data["password"],
                    name=student_data.get("name"),
                    role="student"
                )
                
                if not firebase_uid:
                    error_msg = f"Failed to create Firebase user for {student_data['email']}"
                    logger.error(f"[BATCH UPLOAD] {error_msg}")
                    errors.append(error_msg)
                    continue
                
                # Create student record WITH HIERARCHY FIELDS (CRITICAL FIX)
                # Use 'username' field for consistency with admin/department APIs
                create_data = {
                    "username": student_data["username"],
                    "email": student_data["email"],
                    "firebase_uid": firebase_uid,
                    "batch_id": batch_id,
                    "college_id": college_id,  # ← CRITICAL: Now included from batch
                    "department_id": department_id,  # ← CRITICAL: Now included from batch
                    "is_active": True
                }
                
                logger.info(f"[BATCH UPLOAD] Creating student record for {student_data['email']}")
                student_id = StudentModel().create(create_data)
                
                # Update Firebase user profile with FULL HIERARCHY
                try:
                    from firebase_init import db
                    db.collection("User").document(firebase_uid).update({
                        "batch_id": batch_id,
                        "college_id": college_id,  # ← CRITICAL: Now included
                        "department_id": department_id,  # ← CRITICAL: Now included
                        "role": "student"
                    })
                    logger.info(f"[BATCH UPLOAD] Updated Firebase profile for {student_data['email']} with full hierarchy")
                except Exception as e:
                    logger.warning(f"[BATCH UPLOAD] Failed to update Firebase profile: {str(e)}")
                
                created_count += 1
                audit_log(request.user.get("uid"), "create_student", "student", student_id, 
                    {"name": student_data["name"], "batch_id": batch_id, "college_id": college_id, "department_id": department_id})
                
                progress_pct = round((index / total_students) * 100)
                logger.info(f"[BATCH UPLOAD] Progress: {created_count}/{index} created ({progress_pct}%)")
            
            except Exception as e:
                error_msg = f"Error creating student {student_data.get('name', 'Unknown')}: {str(e)}"
                logger.error(f"[BATCH UPLOAD] {error_msg}")
                errors.append(error_msg)
        
        logger.info(f"[BATCH UPLOAD] Completed! Created {created_count}/{total_students} students")
        if errors:
            logger.warning(f"[BATCH UPLOAD] Encountered {len(errors)} errors during upload")
        
        response_data = {
            "count": created_count,
            "total": len(students_data)
        }
        
        if errors:
            response_data["errors"] = errors
        
        return success_response(response_data, f"Created {created_count} students", status_code=201)
    
    except Exception as e:
        logger.error(f"[BATCH UPLOAD] Bulk create failed: {str(e)}")
        return error_response("BULK_CREATE_ERROR", str(e), status_code=500)


# ============================================================================
# QUESTION ENDPOINTS
# ============================================================================

@batch_bp.route("/questions", methods=["POST", "OPTIONS"])
@require_auth(allowed_roles=["batch"])
def create_question():
    """Create a question as Batch Admin (questions are batch-scoped)."""
    if request.method == "OPTIONS":
        return "", 200
    
    data = request.json or {}
    return QuestionService.create_question_by_batch(request.user, data)


@batch_bp.route("/questions", methods=["GET", "OPTIONS"])
@require_auth(allowed_roles=["batch"])
def get_questions():
    """Get all questions for this batch."""
    if request.method == "OPTIONS":
        return "", 200
    
    batch_id = request.user.get("batch_id")
    if not batch_id:
        return error_response("NO_BATCH", "Batch ID not found in token", status_code=400)
    
    try:
        questions = QuestionModel().query(batch_id=batch_id)
        return success_response({"questions": questions})
    except Exception as e:
        return error_response("QUERY_ERROR", str(e), status_code=500)


@batch_bp.route("/questions/<question_id>", methods=["GET"])
@require_auth(allowed_roles=["batch"])
def get_question_detail(question_id):
    """Get question details."""
    batch_id = request.user.get("batch_id")
    question = QuestionModel().get(question_id)
    
    if not question or question.get("batch_id") != batch_id:
        return error_response("NOT_FOUND", "Question not found in your batch", status_code=404)
    
    return success_response({"question": question})


@batch_bp.route("/questions/<question_id>", methods=["PUT"])
@require_auth(allowed_roles=["batch"])
def update_question(question_id):
    """Update a question."""
    data = request.json or {}
    response, status_code = QuestionService.update_question(request.user, question_id, data)
    return response, status_code


@batch_bp.route("/questions/<question_id>", methods=["DELETE"])
@require_auth(allowed_roles=["batch"])
def delete_question(question_id):
    """Delete a question."""
    response, status_code = QuestionService.delete_question(request.user, question_id)
    return response, status_code


# ============================================================================
# TOPIC ENDPOINTS
# ============================================================================

@batch_bp.route("/topics", methods=["POST", "OPTIONS"])
@require_auth(allowed_roles=["batch"])
def create_topic():
    """Create a topic as Batch Admin (topics are batch-scoped)."""
    if request.method == "OPTIONS":
        return "", 200
    
    data = request.json or {}
    response, status_code = TopicService.create_topic_by_batch(request.user, data)
    return response, status_code


@batch_bp.route("/topics", methods=["GET", "OPTIONS"])
@require_auth(allowed_roles=["batch"])
def get_topics():
    """Get all topics for this batch."""
    if request.method == "OPTIONS":
        return "", 200
    
    batch_id = request.user.get("batch_id")
    if not batch_id:
        return error_response("NO_BATCH", "Batch ID not found in token", status_code=400)
    
    try:
        result = TopicService.get_topics_for_batch(batch_id)
        return result
    except Exception as e:
        return error_response("QUERY_ERROR", str(e), status_code=500)


@batch_bp.route("/topics/<topic_id>", methods=["GET"])
@require_auth(allowed_roles=["batch"])
def get_topic_detail(topic_id):
    """Get topic details."""
    response, status_code = TopicService.get_topic(request.user, topic_id)
    return response, status_code


@batch_bp.route("/topics/<topic_id>", methods=["PUT"])
@require_auth(allowed_roles=["batch"])
def update_topic(topic_id):
    """Update a topic."""
    data = request.json or {}
    response, status_code = TopicService.update_topic(request.user, topic_id, data)
    return response, status_code


@batch_bp.route("/topics/<topic_id>", methods=["DELETE"])
@require_auth(allowed_roles=["batch"])
def delete_topic(topic_id):
    """Delete a topic."""
    response, status_code = TopicService.delete_topic(request.user, topic_id)
    return response, status_code


# ============================================================================
# NOTE ENDPOINTS
# ============================================================================

@batch_bp.route("/notes", methods=["POST", "OPTIONS"])
@require_auth(allowed_roles=["batch"])
def create_note():
    """Create a note as Batch Admin (notes are batch-scoped)."""
    if request.method == "OPTIONS":
        return "", 200
    
    data = request.json or {}
    response, status_code = NoteService.create_note_by_batch(request.user, data)
    return response, status_code


@batch_bp.route("/notes", methods=["GET", "OPTIONS"])
@require_auth(allowed_roles=["batch"])
def get_notes():
    """Get all notes for this batch."""
    if request.method == "OPTIONS":
        return "", 200
    
    batch_id = request.user.get("batch_id")
    if not batch_id:
        return error_response("NO_BATCH", "Batch ID not found in token", status_code=400)
    
    try:
        result = NoteService.get_notes_for_batch(batch_id)
        return result
    except Exception as e:
        return error_response("QUERY_ERROR", str(e), status_code=500)


@batch_bp.route("/notes/<note_id>", methods=["GET"])
@require_auth(allowed_roles=["batch"])
def get_note_detail(note_id):
    """Get note details."""
    response, status_code = NoteService.get_note(request.user, note_id)
    return response, status_code


@batch_bp.route("/notes/<note_id>", methods=["PUT"])
@require_auth(allowed_roles=["batch"])
def update_note(note_id):
    """Update a note."""
    data = request.json or {}
    response, status_code = NoteService.update_note(request.user, note_id, data)
    return response, status_code


@batch_bp.route("/notes/<note_id>", methods=["DELETE"])
@require_auth(allowed_roles=["batch"])
def delete_note(note_id):
    """Delete a note."""
    response, status_code = NoteService.delete_note(request.user, note_id)
    return response, status_code


# ============================================================================
# TEST CASE GENERATION (AI Agent)
# ============================================================================

@batch_bp.route("/generate-testcases", methods=["POST", "OPTIONS"])
@require_auth(allowed_roles=["batch"])
def generate_testcases():
    """Generate hidden test cases for a question using AI agent."""
    if request.method == "OPTIONS":
        return "", 200
    
    batch_id = request.user.get("batch_id")
    if not batch_id:
        return error_response("NO_BATCH", "Batch ID not found in token", status_code=400)
    
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
        # Verify question belongs to this batch
        question = QuestionModel().get(question_id)
        if not question or question.get("batch_id") != batch_id:
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
        logger.error(f"Test case generation error: {str(e)}", exc_info=True)
# ============================================================================
# PERFORMANCE ENDPOINTS
# ============================================================================

@batch_bp.route("/performance", methods=["GET"])
@require_auth(allowed_roles=["batch"])
def get_performance():
    """Get performance data for students in this batch."""
    batch_id = request.user.get("batch_id")
    student_id = request.args.get("student_id")
    
    filters = {"batch_id": batch_id}
    
    performance = []
    
    if student_id:
        # 1. Verify student belongs to this batch
        student = StudentModel().get(student_id)
        if not student or student.get("batch_id") != batch_id:
             # If student doesn't belong to batch, return empty or error? 
             # For performance stats, empty is safer/standard.
             return success_response({"performance": []})
             
        # 2. Try querying by the provided student_id (UUID)
        filters["student_id"] = student_id
        performance = PerformanceModel().query(**filters)
        
        # 3. Fallback: If no results found, check if records use Firebase UID
        if not performance:
             if student.get("firebase_uid"):
                filters["student_id"] = student.get("firebase_uid")
                performance = PerformanceModel().query(**filters)
    else:
        # List all performance for batch
        performance = PerformanceModel().query(**filters)
        
    # Enrich performance data with Question and Topic details
    if performance:
        # 1. Collect Question IDs
        question_ids = list(set([p.get("question_id") for p in performance if p.get("question_id")]))
        
        # 2. Fetch Questions
        questions_map = {}
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
