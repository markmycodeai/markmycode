# CODEPRAC 2.0 - Frontend Developer Handoff Document

**Project Name:** CODEPRAC 2.0 - Competitive Programming Practice Platform  
**Version:** 2.0.0  
**Last Updated:** December 24, 2025  
**Target Audience:** Junior Frontend Designers & Frontend Developers

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [API Endpoints](#api-endpoints)
5. [Frontend File Structure & Descriptions](#frontend-file-structure--descriptions)
6. [Environment Setup](#environment-setup)
7. [Development Workflow](#development-workflow)
8. [Key Configuration Files](#key-configuration-files)
9. [Important Notes Before UI Enhancement](#important-notes-before-ui-enhancement)
10. [Deployment Information](#deployment-information)
11. [Common Tasks & Solutions](#common-tasks--solutions)

---

## Project Overview

### What is CODEPRAC 2.0?

CODEPRAC 2.0 is a **three-tier hierarchical educational platform** for competitive programming practice:

- **Admin Tier**: Manages colleges, departments, and student batches. Can enable/disable access at any level.
- **College Tier**: Views performance data for their students and manages departments.
- **Department Tier**: Views performance data for their batch students and manages course materials.
- **Student Tier**: Practices programming questions, submits code for AI evaluation, views performance metrics.

### Core Features

| Feature | Description |
|---------|-------------|
| **Question Practice** | Students attempt programming questions from their batch/department |
| **AI Code Evaluation** | Compiler Agent runs code, Evaluator Agent checks correctness, Efficiency Agent analyzes complexity |
| **Test Case Generation** | Batch admins can generate hidden test cases using AI |
| **Performance Tracking** | Track student progress with metrics and analytics |
| **Role-Based Access Control** | Different dashboards and capabilities per user role |
| **Cascading Disable** | Admins can disable access at college/department/batch level |
| **CSV Student Import** | College admins can bulk import students via CSV with email notifications |

---

## Technology Stack

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling (with custom stylesheet: `css/styles.css`)
- **JavaScript (ES6+)** - Interactivity and API calls
- **No Framework** - Vanilla JS for lightweight, direct DOM manipulation

### Backend
- **Python 3.9+** - Server runtime
- **Flask 2.3.3** - Web framework
- **Firebase Admin SDK** - Authentication & Firestore database
- **Gunicorn 21.2.0** - WSGI server (production)
- **Groq API** - AI agents for code evaluation

### Database
- **Google Firestore** - Real-time document database
- **Firebase Authentication** - User auth management

### Infrastructure
- **Render.com** - Backend hosting (production)
- **GitHub Pages** - Frontend hosting (production)

---

## Project Structure

```
CODEPRAC 2.0/
├── Frontend Files (Root Level)
│   ├── index.html                      # Main landing/dashboard page
│   ├── index-old.html                  # Backup (ignore for now)
│   ├── css/
│   │   └── styles.css                  # Global styles for entire app
│   └── js/
│       ├── config.js                   # Frontend API configuration
│       ├── ui.js                       # Shared UI utilities (modals, alerts)
│       ├── auth.js                     # Login/logout functionality
│       ├── utils.js                    # Helper functions (validation, formatting)
│       ├── frontend-validation.js      # Client-side form validation
│       │
│       ├── dashboard.js                # Admin/College/Dept dashboard
│       ├── student.js                  # Student code editor & submission
│       ├── questions.js                # Question listing & filtering
│       ├── questions-rbac.js           # Question CRUD for admins
│       │
│       ├── admin.js                    # Admin panel (colleges/departments)
│       ├── college.js                  # College panel (manage departments)
│       ├── department.js               # Department panel (manage batches)
│       ├── batch.js                    # Batch management
│       ├── students.js                 # Student listing & management
│       │
│       ├── batch-questions.js          # Batch admin: Create questions
│       ├── batch-topics.js             # Batch admin: Manage topics
│       ├── batch-notes.js              # Batch admin: Manage notes
│       ├── batch-testcase-generator.js # Batch admin: Generate test cases
│       ├── batch.js                    # Batch admin panel
│       │
│       └── admin-*.js                  # Legacy admin scripts (archive)
│
├── Backend Files (Python)
│   ├── app.py                          # Flask app initialization & routes
│   ├── config.py                       # Configuration & environment variables
│   ├── models.py                       # Firestore ORM/data models
│   ├── firebase_init.py                # Firebase initialization
│   ├── auth.py                         # Authentication logic
│   ├── cascade_service.py              # Cascading delete/disable logic
│   │
│   ├── *_service.py                    # Business logic services:
│   │   ├── question_service.py         # Question CRUD & filtering
│   │   ├── note_service.py             # Note management
│   │   ├── topic_service.py            # Topic management
│   │   └── utils.py                    # Common utilities
│   │
│   ├── routes/                         # API endpoint blueprints
│   │   ├── auth.py                     # POST /api/auth/* (login, signup, etc)
│   │   ├── admin.py                    # POST /api/admin/* (college/dept CRUD)
│   │   ├── college.py                  # POST /api/college/* (college operations)
│   │   ├── department.py               # POST /api/department/* (dept operations)
│   │   ├── batch.py                    # POST /api/batch/* (batch operations)
│   │   └── student.py                  # POST /api/student/* (code execution, etc)
│   │
│   ├── agents/                         # AI agent implementations
│   │   ├── compiler_agent.py           # Executes code on test input
│   │   ├── evaluator_agent.py          # Evaluates code correctness
│   │   ├── efficiency_agent.py         # Analyzes time/space complexity
│   │   ├── testcase_agent.py           # Generates test cases
│   │   ├── groq_client.py              # Groq API wrapper
│   │   ├── circuit_breaker.py          # Rate limiting/error handling
│   │   └── __init__.py
│   │
│   ├── requirements.txt                # Python dependencies
│   ├── gunicorn_config.py              # Production server config
│   ├── render.yaml                     # Render deployment config
│   ├── firebase-key.json               # Firebase credentials (DO NOT COMMIT)
│   ├── firebase-key-base64.txt         # Base64 credentials (DO NOT COMMIT)
│   ├── .env                            # Environment variables (DO NOT COMMIT)
│   └── .gitignore                      # Git ignore rules
│
├── Documentation
│   ├── MD_files/                       # Comprehensive documentation
│   │   ├── ARCHITECTURE.md             # System architecture
│   │   ├── API_DOCUMENTATION.md        # Detailed API specs
│   │   ├── CASCADE_DELETE_*.md         # Cascade feature docs
│   │   ├── CRUD_PARITY_*.md            # Feature docs
│   │   └── ... (50+ docs)
│   └── MDFiles/                        # Additional docs
│
└── Testing & Assets
    ├── tests/                          # Test files
    ├── sample_students.csv             # Sample CSV for import
    └── requirements.txt                # Dependencies
```

---

## API Endpoints

### Base URL Configuration

**Development (Local):**
```javascript
const API_BASE_URL = 'http://localhost:5000/api';
```

**Production (After Render Deployment):**
```javascript
const API_BASE_URL = 'https://your-service-name.onrender.com/api';
```

**Update Location:** [`js/config.js`](js/config.js)

### Authentication Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/auth/login` | User login | ❌ No |
| POST | `/api/auth/signup` | New user registration | ❌ No |
| POST | `/api/auth/logout` | User logout | ✅ Yes |
| POST | `/api/auth/verify-token` | Verify JWT token validity | ✅ Yes |
| POST | `/api/auth/reset-password` | Firebase password reset | ❌ No |

**Request/Response Examples:**

```javascript
// LOGIN
POST /api/auth/login
Body: {
  "email": "student@example.com",
  "password": "password123"
}
Response: {
  "success": true,
  "user_id": "user-123",
  "role": "student",
  "token": "eyJhbGc..."
}

// SIGNUP
POST /api/auth/signup
Body: {
  "email": "newstudent@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "student",
  "batch_id": "batch-001"
}
Response: {
  "success": true,
  "user_id": "user-456",
  "message": "Account created"
}
```

### Admin Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/admin/colleges` | List all colleges | ✅ Admin |
| POST | `/api/admin/colleges` | Create new college | ✅ Admin |
| PUT | `/api/admin/colleges/{id}` | Update college | ✅ Admin |
| DELETE | `/api/admin/colleges/{id}` | Delete college (cascade) | ✅ Admin |
| POST | `/api/admin/colleges/{id}/disable` | Disable college access | ✅ Admin |
| POST | `/api/admin/colleges/{id}/enable` | Enable college access | ✅ Admin |
| GET | `/api/admin/departments` | List departments | ✅ Admin |
| POST | `/api/admin/departments` | Create department | ✅ Admin |
| PUT | `/api/admin/departments/{id}` | Update department | ✅ Admin |
| DELETE | `/api/admin/departments/{id}` | Delete department (cascade) | ✅ Admin |

**Example:**

```javascript
// CREATE COLLEGE
POST /api/admin/colleges
Headers: {
  "Authorization": "Bearer {token}"
}
Body: {
  "name": "IIT Delhi",
  "code": "IITD",
  "location": "New Delhi"
}
Response: {
  "success": true,
  "college_id": "col-789",
  "created_at": "2025-12-24T10:00:00Z"
}
```

### Question Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/student/questions` | Get questions for user's batch | ✅ Student |
| GET | `/api/student/questions/{id}` | Get question details | ✅ Student |
| POST | `/api/student/run` | Run code on sample input | ✅ Student |
| POST | `/api/student/submit` | Submit & evaluate code | ✅ Student |
| GET | `/api/student/performance` | Get performance analytics | ✅ Student |
| POST | `/api/batch/questions` | Create new question | ✅ Batch Admin |
| PUT | `/api/batch/questions/{id}` | Update question | ✅ Batch Admin |
| DELETE | `/api/batch/questions/{id}` | Delete question | ✅ Batch Admin |

**Example:**

```javascript
// RUN CODE
POST /api/student/run
Headers: {
  "Authorization": "Bearer {token}"
}
Body: {
  "question_id": "q-001",
  "code": "n = int(input())\nprint(n * 2)",
  "language": "python",
  "test_input": "5"
}
Response: {
  "success": true,
  "output": "10",
  "execution_time": 0.234,
  "error": null
}

// SUBMIT CODE
POST /api/student/submit
Headers: {
  "Authorization": "Bearer {token}"
}
Body: {
  "question_id": "q-001",
  "code": "...",
  "language": "python"
}
Response: {
  "success": true,
  "test_results": [
    { "test_case": 1, "passed": true, "expected": "10", "got": "10" },
    { "test_case": 2, "passed": true, "expected": "20", "got": "20" }
  ],
  "score": 100,
  "time_complexity": "O(1)",
  "space_complexity": "O(1)"
}
```

### Notes Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/student/notes` | Get notes for batch | ✅ Student |
| GET | `/api/student/notes/{id}` | Get note details | ✅ Student |
| POST | `/api/batch/notes` | Upload new note | ✅ Batch Admin |
| DELETE | `/api/batch/notes/{id}` | Delete note | ✅ Batch Admin |

### Performance Analytics Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/dashboard/analytics` | Get dashboard metrics | ✅ Yes |
| GET | `/api/student/performance` | Individual performance | ✅ Student |
| GET | `/api/batch/performance` | Batch-wide performance | ✅ Batch Admin |
| GET | `/api/department/performance` | Department performance | ✅ Dept Admin |
| GET | `/api/college/performance` | College-wide performance | ✅ College Admin |

### Health Check

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/health` | Backend health status | ❌ No |

**Response:**
```json
{
  "status": "ok",
  "message": "CODEPRAC 2.0 backend is running"
}
```

---

## Frontend File Structure & Descriptions

### Root Level Files

#### `index.html`
- **Purpose:** Main entry point for the entire application
- **Content:**
  - Navigation bar with role-based menu
  - Dynamic content area (loaded via JS)
  - Footer with contact/help info
- **Dependencies:** All JS files in `js/` folder
- **Load Sequence:** 
  1. Check authentication (auth.js)
  2. Render appropriate dashboard (dashboard.js, student.js, etc.)
  3. Initialize event listeners

#### `index-old.html`
- **Purpose:** Backup/archive (ignore for development)
- **Action:** Can be deleted if not needed

---

### CSS Files (`css/`)

#### `styles.css`
- **Purpose:** Global stylesheet for entire application
- **Content:**
  - CSS variables for colors, spacing, typography
  - Responsive grid system
  - Component styles (buttons, forms, cards, modals)
  - Dark/light theme support
  - Animation classes
- **Important Classes:**
  - `.container` - Main wrapper
  - `.modal` - Dialog boxes
  - `.btn` - Button styles
  - `.form-group` - Form field wrapper
  - `.card` - Content container
  - `.alert` - Alert/notification styles
- **Customization Guide:**
  - Update CSS variables at the top of file for quick theme changes
  - Maintain BEM naming convention for new styles
  - Test all breakpoints (mobile, tablet, desktop)

---

### JavaScript Files (`js/`)

#### **Core Files** (Load First)

##### `config.js`
- **Purpose:** Configuration and constants
- **Contains:**
  ```javascript
  const API_BASE_URL = 'http://localhost:5000/api'; // UPDATE AFTER RENDER DEPLOYMENT
  const ROLES = {
    ADMIN: 'admin',
    COLLEGE_ADMIN: 'college_admin',
    DEPT_ADMIN: 'dept_admin',
    BATCH_ADMIN: 'batch_admin',
    STUDENT: 'student'
  };
  const ENDPOINTS = {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    // ... all endpoints
  };
  ```
- **Update Required:** Change `API_BASE_URL` after Render deployment

##### `utils.js`
- **Purpose:** Shared utility functions
- **Key Functions:**
  - `formatDate(date)` - Format dates consistently
  - `validateEmail(email)` - Email validation
  - `debounce(func, delay)` - Debounce function calls
  - `getFromLocalStorage(key)` - Safe localStorage access
  - `setInLocalStorage(key, value)` - Safe localStorage write
  - `showLoadingSpinner()` / `hideLoadingSpinner()` - Loading states
- **Usage:** Import and use in other files: `formatDate(new Date())`

##### `ui.js`
- **Purpose:** UI component utilities
- **Key Functions:**
  - `showModal(title, content, actions)` - Display modal dialogs
  - `showAlert(type, message)` - Show alerts (success, error, info, warning)
  - `showToast(message, duration)` - Toast notifications
  - `createButton(text, onClick, className)` - Create buttons dynamically
  - `createCard(data)` - Create card components
- **Usage:** `showAlert('success', 'Operation completed!')`

##### `frontend-validation.js`
- **Purpose:** Client-side form validation
- **Validates:**
  - Email format
  - Password strength
  - Required fields
  - Field length limits
  - Custom validators
- **Usage:** Attach to form submit handlers before API calls

#### **Authentication** (Load Second)

##### `auth.js`
- **Purpose:** Handle user authentication
- **Key Functions:**
  - `login(email, password)` - User login
  - `logout()` - User logout
  - `getCurrentUser()` - Get logged-in user data
  - `getToken()` - Get JWT token
  - `isAuthenticated()` - Check if user logged in
  - `hasRole(requiredRole)` - Check user permissions
- **Storage:** Uses `localStorage` for user data and tokens
- **Important:** 
  - Token stored as: `localStorage.getItem('auth_token')`
  - User data stored as: `localStorage.getItem('user_data')`
  - Always check authentication before rendering protected content

#### **Dashboard & Navigation**

##### `dashboard.js`
- **Purpose:** Main dashboard for all user roles
- **Features:**
  - Admin Dashboard (colleges, departments stats)
  - College Dashboard (departments, students, performance)
  - Department Dashboard (batches, students, performance)
  - Batch Admin Dashboard (questions, notes, test cases)
  - Student Dashboard (questions, submissions, performance)
- **Responsibilities:**
  - Fetch role-specific data
  - Render appropriate widgets/charts
  - Handle role-based navigation
- **Data Sources:**
  - GET `/api/dashboard/analytics`
  - GET `/api/{role}/performance`

#### **Student Features**

##### `student.js`
- **Purpose:** Student code editor & code submission
- **Features:**
  - Code editor with syntax highlighting
  - Run code on sample input
  - Submit code for evaluation
  - View test results
  - Performance metrics
- **Dependencies:** Requires code editor library (check HTML for CDN)
- **Key Endpoints:**
  - POST `/api/student/run` - Execute code
  - POST `/api/student/submit` - Submit for evaluation
  - GET `/api/student/questions` - Fetch questions
- **Important:** 
  - Save drafts to localStorage before submission
  - Show loading state during execution
  - Display error messages from backend

##### `questions.js`
- **Purpose:** Display and filter questions
- **Features:**
  - Question listing with filters
  - Search functionality
  - Difficulty/category filtering
  - Question detail view
  - Attempt history
- **Key Endpoints:**
  - GET `/api/student/questions`
  - GET `/api/student/questions/{id}`

##### `questions-rbac.js`
- **Purpose:** Question management for admins (RBAC)
- **Features:**
  - Create new questions
  - Edit existing questions
  - Delete questions
  - Preview question
  - Set difficulty/category
- **Key Endpoints:**
  - POST `/api/batch/questions`
  - PUT `/api/batch/questions/{id}`
  - DELETE `/api/batch/questions/{id}`
- **Access Control:** Only accessible to batch admins and above

#### **Admin & Management**

##### `admin.js`
- **Purpose:** Super admin panel
- **Features:**
  - Manage colleges (CRUD)
  - View all departments
  - Enable/disable colleges
  - Performance analytics
  - User management
- **Key Endpoints:**
  - GET/POST/PUT/DELETE `/api/admin/colleges`
  - GET/POST/PUT/DELETE `/api/admin/departments`
- **Important:** Only accessible to admin role

##### `college.js`
- **Purpose:** College admin panel
- **Features:**
  - Manage own departments
  - View students in college
  - Performance tracking
  - Bulk CSV import
  - Enable/disable departments
- **Key Endpoints:**
  - GET `/api/college/departments`
  - POST `/api/college/students/import` (CSV upload)
  - POST `/api/college/departments/{id}/disable`

##### `department.js`
- **Purpose:** Department admin panel
- **Features:**
  - Manage batches
  - View students in department
  - View/upload notes
  - Performance tracking
  - Enable/disable batches
- **Key Endpoints:**
  - GET `/api/department/batches`
  - POST `/api/department/notes` (upload)
  - POST `/api/department/batches/{id}/disable`

##### `batch.js`
- **Purpose:** Batch admin panel
- **Features:**
  - Manage questions
  - Manage topics
  - Upload notes
  - Generate test cases
  - Batch performance analytics
- **Key Endpoints:**
  - GET/POST/PUT/DELETE `/api/batch/questions`
  - GET/POST/PUT/DELETE `/api/batch/topics`
  - GET/POST `/api/batch/notes`
  - POST `/api/batch/testcases/generate`

##### `students.js`
- **Purpose:** Student management interface
- **Features:**
  - View all students (role-appropriate filtering)
  - Student details
  - Performance analytics per student
  - Filter by batch/department
  - Export student data
- **Key Endpoints:**
  - GET `/api/{role}/students`
  - GET `/api/student/{id}/performance`

#### **Batch Admin Features**

##### `batch-questions.js`
- **Purpose:** Create and manage questions
- **UI:**
  - Question form (title, description, constraints)
  - Test case management
  - Sample input/output
  - Difficulty selection
- **Key Endpoints:**
  - POST `/api/batch/questions` (create)
  - PUT `/api/batch/questions/{id}` (update)

##### `batch-topics.js`
- **Purpose:** Manage topics/categories
- **Features:**
  - Create topics
  - Assign questions to topics
  - View topic-wise questions
- **Key Endpoints:**
  - GET/POST/PUT/DELETE `/api/batch/topics`

##### `batch-notes.js`
- **Purpose:** Upload and manage study notes
- **Features:**
  - Upload PDF/image notes
  - Organize by topic
  - Preview notes
  - Delete notes
- **Key Endpoints:**
  - POST `/api/batch/notes` (upload)
  - GET `/api/student/notes` (download)
  - DELETE `/api/batch/notes/{id}`

##### `batch-testcase-generator.js`
- **Purpose:** AI-powered test case generation
- **Features:**
  - Input question details
  - Generate multiple test cases using AI
  - Preview generated cases
  - Save/edit test cases
- **Key Endpoints:**
  - POST `/api/batch/testcases/generate` (AI generation)
  - POST `/api/batch/testcases` (save)
- **Important:** Uses Groq AI backend

---

## Environment Setup

### Prerequisites
- Node.js (for local frontend server - optional)
- Python 3.9+ (for backend)
- Git
- Browser (Chrome/Firefox/Safari/Edge)

### Frontend Setup (Local Development)

#### Option 1: Simple HTTP Server (Recommended)
```bash
# Windows - Using Python
cd d:\PRJJ
python -m http.server 5500

# macOS/Linux
cd /path/to/PRJJ
python3 -m http.server 5500
```

Then open: `http://localhost:5500`

#### Option 2: Using Node.js
```bash
npm install -g http-server
http-server . -p 5500
```

### Backend Setup (Local Development)

```bash
# Navigate to backend directory
cd d:\PRJJ

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with necessary variables (copy from .env.example)
# Edit .env with your actual values

# Run development server
python app.py
```

Backend will be at: `http://localhost:5000`

### Environment Variables (.env)

Create a `.env` file in root directory:

```
# Server
DEBUG=False
PORT=5000
ENV=development

# Firebase
FIREBASE_API_KEY=<YOUR_FIREBASE_API_KEY>
FIREBASE_PROJECT_ID=codeprac-f07d6
FIREBASE_AUTH_DOMAIN=codeprac.firebaseapp.com
FIREBASE_STORAGE_BUCKET=codeprac-f07d6.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=85207785028
FIREBASE_APP_ID=1:85207785028:web:ece004f199c1a01fdf6611
FIREBASE_CREDENTIALS_PATH=./firebase-key.json

# Firestore
FIRESTORE_PROJECT_ID=codeprac-f07d6

# AI
GROQ_API_KEY=<YOUR_GROQ_API_KEY>

# Frontend
FRONTEND_URL=http://127.0.0.1:5500

# Security (Change in production!)
SECRET_KEY=<YOUR_SECRET_KEY>
JWT_SECRET=<YOUR_JWT_SECRET>
```

**Note:** `.env` is in `.gitignore` - never commit it!

---

## Development Workflow

### Local Development Loop

1. **Start Backend:**
   ```bash
   cd d:\PRJJ
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   python app.py
   ```
   Runs on: `http://localhost:5000`

2. **Start Frontend (New Terminal):**
   ```bash
   cd d:\PRJJ
   python -m http.server 5500
   ```
   Runs on: `http://localhost:5500`

3. **In `js/config.js`, ensure:**
   ```javascript
   const API_BASE_URL = 'http://localhost:5000/api';
   ```

4. **Open Browser:**
   - Navigate to `http://localhost:5500`
   - Use Dev Tools (F12) to debug
   - Check Console for JavaScript errors
   - Check Network tab for API calls

### Common Development Tasks

#### Adding a New Page
1. Create new HTML section in `index.html`
2. Create corresponding JS file: `js/page-name.js`
3. Add initialization call in main page load
4. Import and call functions from shared files (utils.js, ui.js, auth.js)

#### Adding a New API Endpoint
1. Backend: Create route in `routes/*.py`
2. Frontend: Add endpoint constant in `js/config.js`
3. Frontend: Create function to call endpoint
4. Test with Postman/cURL before frontend integration

#### Styling Updates
1. Modify `css/styles.css`
2. Use CSS variables for colors/spacing for consistency
3. Test responsiveness (Chrome DevTools → Toggle Device Toolbar)
4. Ensure accessibility (contrast ratio, keyboard navigation)

#### Debugging API Calls
1. Open Browser DevTools (F12)
2. Go to Network tab
3. Make API call from frontend
4. Click on request to see:
   - Headers (including Authorization token)
   - Request body
   - Response body
   - Status code
5. Check backend terminal for logs

---

## Key Configuration Files

### `js/config.js`
```javascript
// UPDATE THIS AFTER RENDER DEPLOYMENT
const API_BASE_URL = 'http://localhost:5000/api';

// User roles
const ROLES = {
  ADMIN: 'admin',
  COLLEGE_ADMIN: 'college_admin',
  DEPT_ADMIN: 'dept_admin',
  BATCH_ADMIN: 'batch_admin',
  STUDENT: 'student'
};

// All API endpoints
const ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  SIGNUP: '/api/auth/signup',
  
  // Admin
  COLLEGES: '/api/admin/colleges',
  DEPARTMENTS: '/api/admin/departments',
  
  // Student
  QUESTIONS: '/api/student/questions',
  RUN_CODE: '/api/student/run',
  SUBMIT_CODE: '/api/student/submit',
  
  // ... more endpoints
};
```

### `index.html`
- Main HTML structure
- Script loading order (important!)
- CSS links
- Meta tags for responsive design
- Global event listeners

### `.gitignore`
**DO NOT MODIFY** these patterns:
```
.env                    # Environment variables
firebase-key.json       # Firebase credentials
firebase-key-*.txt      # Base64 credentials
.venv/                  # Virtual environment
__pycache__/            # Python cache
```

---

## Important Notes Before UI Enhancement

### 🚫 DO NOT CHANGE

1. **HTML Structure in `index.html`:**
   - Don't remove hidden sections (used by JS)
   - Don't change element IDs (scripts depend on them)
   - Always keep `<div id="app">` as main content area

2. **API Endpoint Calls:**
   - Don't hardcode URLs (use `API_BASE_URL` from config.js)
   - Always include `Authorization` header with token
   - Handle both success and error responses

3. **Authentication Flow:**
   - Always check `auth.js` before rendering protected content
   - Don't expose JWT tokens in logs/console
   - Use `getToken()` and `isAuthenticated()` functions

4. **localStorage Usage:**
   - Only store non-sensitive data
   - Firebase handles user auth - don't replicate it
   - Use `utils.js` functions for safe access

### ✅ SAFE TO MODIFY

1. **CSS Styling** (`css/styles.css`)
   - Colors, fonts, spacing
   - Layout (grid/flexbox)
   - Animations
   - Responsive breakpoints
   - **Test on all screen sizes!**

2. **Page Layout** (in `index.html`)
   - Reorganize sections (keep IDs intact)
   - Add new visual components
   - Improve accessibility
   - Add loading states

3. **JavaScript UX Enhancements:**
   - Add form validation feedback
   - Improve error messages
   - Add loading spinners
   - Better state management
   - Accessibility improvements (ARIA labels, keyboard navigation)

### ⚠️ CRITICAL CONSTRAINTS

1. **Single Page Application (SPA):**
   - Only one `index.html` file
   - JS dynamically shows/hides content
   - Don't create new HTML files
   - Use `display: none/block` or class toggling

2. **No Build Tools:**
   - No webpack, babel, or bundler
   - Pure ES6 JavaScript
   - Import dependencies via CDN (check index.html)
   - Keep bundle small (no heavy libraries)

3. **CORS & Authentication:**
   - Backend handles CORS (no worries there)
   - Always send `Authorization: Bearer {token}` in requests
   - Handle 401 (unauthorized) errors by redirecting to login

4. **Responsive Design:**
   - Mobile-first approach
   - Test on: 320px, 768px, 1024px, 1920px widths
   - Touch-friendly buttons (min 44x44px)
   - Readable fonts (min 16px base size)

5. **Performance:**
   - Minimize API calls
   - Cache data when possible
   - Use `debounce()` for search/filter inputs
   - Lazy load images if used

6. **Accessibility:**
   - Semantic HTML (use `<button>`, `<nav>`, `<main>`, etc.)
   - ARIA labels for screen readers
   - Keyboard navigation support
   - Color contrast (WCAG AA minimum)
   - Alt text for images

---

## Deployment Information

### Current Status
- **Frontend:** Ready to deploy to GitHub Pages
- **Backend:** Deployed on Render.com
- **Database:** Firebase Firestore (production)

### Frontend Deployment to GitHub Pages

1. Create GitHub repository: `codeprac-frontend`
2. Push all files from `d:\PRJJ` (HTML, CSS, JS folders)
3. Go to repository → Settings → Pages
4. Select `main` branch, `/root` folder
5. Site will be live at: `https://username.github.io/codeprac-frontend`

### Update API URLs After Deployment

**File:** `js/config.js`

```javascript
// BEFORE (Development):
const API_BASE_URL = 'http://localhost:5000/api';

// AFTER (Production):
const API_BASE_URL = 'https://codeprac-backend.onrender.com/api';
```

### Backend URL
- **Development:** `http://localhost:5000`
- **Production:** `https://your-service-name.onrender.com` (ask your backend team for exact URL)

### Testing Before Production

1. Test all user flows locally
2. Test on different browsers (Chrome, Firefox, Safari, Edge)
3. Test on mobile devices (use Chrome DevTools device emulation)
4. Check all API endpoints work correctly
5. Verify error handling displays properly
6. Test authentication flow (login, logout, token refresh)

---

## Common Tasks & Solutions

### Task: Make the UI Dark/Light Theme

1. Open `css/styles.css`
2. Find CSS variables section (top of file)
3. Create dark theme variables:
   ```css
   :root {
     --color-primary: #007bff;
     --color-bg: #ffffff;
     --color-text: #000000;
   }
   
   [data-theme="dark"] {
     --color-bg: #1a1a1a;
     --color-text: #ffffff;
   }
   ```
4. In HTML: `<html data-theme="dark">`
5. Add JS toggle button to switch themes

### Task: Add Loading State

```javascript
// Show loading
showLoadingSpinner(); // from utils.js

// API call
fetch(`${API_BASE_URL}/endpoint`)
  .then(res => res.json())
  .then(data => {
    // Handle data
    hideLoadingSpinner();
  })
  .catch(err => {
    console.error(err);
    hideLoadingSpinner();
  });
```

### Task: Display Error from Backend

```javascript
// Backend returns error in 'message' field
fetch(`${API_BASE_URL}/endpoint`)
  .then(res => res.json())
  .then(data => {
    if (!data.success) {
      showAlert('error', data.message || 'Operation failed');
      return;
    }
    // Success handling
  });
```

### Task: Add New Form Field

1. Add HTML input to form
2. Add validation in `frontend-validation.js`
3. Include field in API request body
4. Handle response validation on backend

### Task: Fix CORS Error

**Don't panic!** CORS is handled by backend. If you see CORS error:
1. Backend might be down - check `http://localhost:5000/health`
2. Check that you're using `API_BASE_URL` from config.js
3. Verify Authorization header is being sent
4. Check browser console for exact error message

### Task: User Gets Logged Out Unexpectedly

1. Check token expiration time in backend
2. Implement token refresh mechanism
3. Add automatic logout when token expires
4. Show "Session expired" message to user

---

## Contact & Support

For questions about:
- **Frontend:** Reach out to UI/UX team
- **Backend:** Contact backend developer
- **Deployment:** Ask DevOps/Infrastructure team
- **Firebase:** Check Firebase documentation (https://firebase.google.com/docs)
- **API Specs:** Check `MD_files/API_DOCUMENTATION.md`

---

## Quick Reference: File Loading Order

When updating JavaScript files, remember the loading order in `index.html`:

```
1. config.js          (Configuration - MUST be first)
2. utils.js           (Utilities - used by all)
3. ui.js              (UI components - used by all)
4. auth.js            (Authentication)
5. frontend-validation.js
6. Specific page files (dashboard.js, student.js, etc.)
```

If a file uses functions from another file, make sure it's loaded AFTER that file in HTML.

---

## Document Control

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-12-24 | Initial handoff document | Senior Dev |

---

**Last Updated:** December 24, 2025  
**Status:** Ready for Junior Frontend Designer  
**Approval:** Pending

**Important:** All API keys and secrets referenced in this document should be stored in `.env` file (not committed). Use placeholders like `<YOUR_API_KEY>` in configuration examples.
