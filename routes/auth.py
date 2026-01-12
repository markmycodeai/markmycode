"""Authentication routes (login, password reset, etc)."""
from flask import Blueprint, request, jsonify
from auth import create_jwt_token, verify_firebase_token, send_password_reset_email
from firebase_init import get_auth
from models import can_student_access
import firebase_admin
from firebase_admin import auth as firebase_auth

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/login", methods=["POST", "OPTIONS"])
def login():
    """Authenticate user with email and password via Firebase REST API."""
    if request.method == "OPTIONS":
        return "", 200
    
    data = request.json or {}
    
    if not data.get("email") or not data.get("password"):
        return jsonify({"error": True, "code": "INVALID_INPUT", "message": "email and password are required"}), 400
    
    try:
        # Verify email/password via Firebase REST API (signInWithPassword)
        import requests
        from config import FIREBASE_API_KEY

        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        resp = requests.post(url, json={"email": data["email"], "password": data["password"], "returnSecureToken": True}, timeout=10)
        if resp.status_code != 200:
            # Invalid credentials or other auth error
            return jsonify({"error": True, "code": "INVALID_CREDENTIALS", "message": "Invalid email or password"}), 401

        token_info = resp.json()
        uid = token_info.get("localId")

        # Get user document from Firestore
        from firebase_init import db
        user_doc_ref = db.collection("User").document(uid)
        user_doc = user_doc_ref.get()

        if not user_doc.exists:
            # Create a minimal user profile as fallback
            user_profile = {
                "uid": uid,
                "email": data["email"],
                "name": token_info.get("displayName") or data.get("email"),
                "role": "student",
                "is_disabled": False
            }
            user_doc_ref.set(user_profile)
            user_data = user_profile
        else:
            user_data = user_doc.to_dict()

        if user_data.get("is_disabled"):
            return jsonify({"error": True, "code": "ACCOUNT_DISABLED", "message": "Your account has been disabled"}), 403

        # Create JWT token with all user data
        jwt_token = create_jwt_token({
            "firebase_uid": uid,
            "uid": uid,
            "email": data["email"],
            "role": user_data.get("role"),
            "name": user_data.get("name"),
            "student_id": user_data.get("student_id") or uid,
            "batch_id": user_data.get("batch_id"),
            "department_id": user_data.get("department_id"),
            "college_id": user_data.get("college_id")
        })

        return jsonify({
            "error": False,
            "message": "Login successful",
            "data": {
                "token": jwt_token,
                "user": {
                    "uid": uid,
                    "email": data["email"],
                    "name": user_data.get("name"),
                    "role": user_data.get("role"),
                    "student_id": user_data.get("student_id"),
                    "batch_id": user_data.get("batch_id"),
                    "department_id": user_data.get("department_id"),
                    "college_id": user_data.get("college_id")
                }
            }
        }), 200

    except Exception as e:
        print(f"Login error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": True, "code": "AUTH_ERROR", "message": "Authentication failed"}), 500


@auth_bp.route("/register", methods=["POST", "OPTIONS"])
def register():
    """Register a new user."""
    if request.method == "OPTIONS":
        return "", 200
    
    data = request.json or {}
    
    required = ["email", "password", "name"]
    if not all(data.get(field) for field in required):
        return jsonify({"error": True, "code": "INVALID_INPUT", "message": f"Required fields: {', '.join(required)}"}), 400
    
    try:
        # Create Firebase user
        user = firebase_auth.create_user(
            email=data["email"],
            password=data["password"],
            display_name=data["name"],
            disabled=False
        )
        
        # Create user document in Firestore
        from firebase_init import db
        from datetime import datetime
        
        user_doc = {
            "uid": user.uid,
            "email": user.email,
            "name": data["name"],
            "role": data.get("role", "student"),
            "is_disabled": False,
            "created_at": datetime.utcnow()
        }
        
        db.collection("User").document(user.uid).set(user_doc)
        
        # Create JWT token with all user data
        jwt_token = create_jwt_token({
            "firebase_uid": user.uid,
            "uid": user.uid,
            "email": user.email,
            "role": data.get("role", "student"),
            "name": data["name"],
            "student_id": user.uid,  # Use UID as student_id for now
            "batch_id": data.get("batch_id"),
            "department_id": data.get("department_id"),
            "college_id": data.get("college_id")
        })
        
        return jsonify({
            "error": False,
            "message": "Registration successful",
            "data": {
                "token": jwt_token,
                "user": {
                    "uid": user.uid,
                    "email": user.email,
                    "name": data["name"],
                    "role": data.get("role", "student")
                }
            }
        }), 201
    
    except firebase_auth.EmailAlreadyExistsError:
        return jsonify({"error": True, "code": "EMAIL_EXISTS", "message": "Email already registered"}), 409
    except Exception as e:
        print(f"Registration error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": True, "code": "REGISTRATION_ERROR", "message": "Registration failed"}), 500


@auth_bp.route("/password-reset-request", methods=["POST", "OPTIONS"])
def request_password_reset():
    """Request password reset email."""
    if request.method == "OPTIONS":
        return "", 200
    
    data = request.json or {}
    
    if not data.get("email"):
        return jsonify({"error": True, "code": "INVALID_INPUT", "message": "email is required"}), 400
    
    try:
        # Send reset email via Backend B (Auth Service)
        import requests
        from config import AUTH_SERVICE_URL, SERVICE_SECRET

        # Backend B is responsible for using the Client SDK to trigger the actual email
        url = f"{AUTH_SERVICE_URL}/api/trigger-reset"
        headers = {
            "Content-Type": "application/json",
            "X-Service-Secret": SERVICE_SECRET
        }
        
        resp = requests.post(url, json={"email": data["email"]}, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            return jsonify({
                "error": False,
                "message": "Password reset email sent",
                "data": {"message": "Check your email for password reset link"}
            }), 200
        else:
            # Handle errors from Backend B
            try:
                error_data = resp.json()
            except:
                error_data = {}
            
            error_code = error_data.get("error", "EMAIL_ERROR")
            
            if resp.status_code == 404:
                return jsonify({"error": True, "code": "EMAIL_NOT_FOUND", "message": "Email not registered"}), 404
                
            return jsonify({
                "error": True, 
                "code": error_code, 
                "message": "Failed to send password reset email"
            }), resp.status_code
    except firebase_auth.UserNotFoundError:
        return jsonify({"error": True, "code": "EMAIL_NOT_FOUND", "message": "Email not registered"}), 404
    except Exception as e:
        print(f"Password reset error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": True, "code": "EMAIL_ERROR", "message": "Failed to send password reset email"}), 500


@auth_bp.route("/verify-token", methods=["POST", "OPTIONS"])
def verify_token():
    """Verify JWT token."""
    if request.method == "OPTIONS":
        return "", 200
    
    data = request.json or {}
    
    if not data.get("token"):
        return jsonify({"error": True, "code": "INVALID_INPUT", "message": "token is required"}), 400
    
    from auth import decode_jwt_token
    payload = decode_jwt_token(data["token"])
    
    if not payload:
        return jsonify({"error": True, "code": "INVALID_TOKEN", "message": "Invalid or expired token"}), 401
    
    return jsonify({
        "error": False,
        "message": "Token valid",
        "data": {"payload": payload}
    }), 200
    
    return success_response({"payload": payload})
