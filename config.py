"""Configuration for CODEPRAC 2.0 backend."""
import os
import logging
from datetime import timedelta

logger = logging.getLogger(__name__)

# Flask Configuration
DEBUG = os.getenv("DEBUG", "False") == "True"
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
JWT_SECRET = os.getenv("JWT_SECRET", "your-jwt-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION = timedelta(hours=24)

# Firebase Configuration
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")
FIREBASE_AUTH_DOMAIN = os.getenv("FIREBASE_AUTH_DOMAIN")
FIREBASE_STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET")
FIREBASE_MESSAGING_SENDER_ID = os.getenv("FIREBASE_MESSAGING_SENDER_ID")
FIREBASE_APP_ID = os.getenv("FIREBASE_APP_ID")
FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-key.json")

# Firestore Configuration
FIRESTORE_PROJECT_ID = os.getenv("FIRESTORE_PROJECT_ID")

# Groq Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_KEY_FALLBACK = os.getenv("GROQ_API_KEY_FALLBACK")

# CORS Configuration
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Auth Service (Backend B)
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:3002") # Default to local port 3002 if not set
SERVICE_SECRET = os.getenv("SERVICE_SECRET", "dev-secret")


# Rate Limiting
RATE_LIMIT_SUBMISSIONS_PER_HOUR = 100
RATE_LIMIT_API_CALLS_PER_HOUR = 1000
RATE_LIMIT_CSV_UPLOADS_PER_MINUTE = 1

# Constraints
MAX_CODE_SIZE_KB = 50
MAX_TESTCASE_SIZE_KB = 10
MAX_CSV_ROWS = 1000

# Collections
COLLECTION_COLLEGES = "colleges"
COLLECTION_DEPARTMENTS = "departments"
COLLECTION_BATCHES = "batches"
COLLECTION_STUDENTS = "students"
COLLECTION_TOPICS = "topics"
COLLECTION_QUESTIONS = "questions"
COLLECTION_NOTES = "notes"
COLLECTION_PERFORMANCE = "performance"
COLLECTION_AUDIT_LOGS = "audit_logs"


# ============================================================================
# CONFIGURATION VALIDATION
# ============================================================================

def validate_configuration():
    """Validate critical configuration on startup.
    
    Returns:
        (bool, list): (all_valid, list_of_warnings)
    """
    warnings = []
    
    # Critical for AI features
    if not GROQ_API_KEY and not GROQ_API_KEY_FALLBACK:
        warnings.append(
            "⚠️  GROQ_API_KEY not configured! AI features (code execution, evaluation) will not work."
        )
    
    # Critical for Firebase
    if not FIREBASE_CREDENTIALS_PATH or not os.path.exists(FIREBASE_CREDENTIALS_PATH):
        warnings.append(
            f"⚠️  Firebase credentials file not found: {FIREBASE_CREDENTIALS_PATH}"
        )
    
    # Critical for JWT
    if SECRET_KEY == "your-secret-key-change-in-production":
        warnings.append(
            "⚠️  SECRET_KEY is using default value! Change in production."
        )
    
    if JWT_SECRET == "your-jwt-secret-key-change-in-production":
        warnings.append(
            "⚠️  JWT_SECRET is using default value! Change in production."
        )
    
    # Warnings for Firebase config
    firebase_required = [
        ("FIREBASE_API_KEY", FIREBASE_API_KEY),
        ("FIREBASE_PROJECT_ID", FIREBASE_PROJECT_ID),
        ("FIREBASE_AUTH_DOMAIN", FIREBASE_AUTH_DOMAIN)
    ]
    
    for name, value in firebase_required:
        if not value:
            warnings.append(f"⚠️  {name} not set in environment")
    
    # Log warnings
    if warnings:
        logger.warning("Configuration warnings detected:")
        for warning in warnings:
            logger.warning(f"  {warning}")
    
    return len(warnings) == 0, warnings


# Run validation on module load
_config_valid, _config_warnings = validate_configuration()

if _config_warnings:
    logger.warning(f"Found {len(_config_warnings)} configuration issues - some features may not work")
