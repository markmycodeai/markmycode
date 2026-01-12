/**
 * Configuration - Central settings and constants
 */

const Config = {
    // Environment URLs
    // Default to deployed backend
<<<<<<< HEAD
    // API_BASE: 'https://codeprac2.onrender.com/api',
=======
    API_BASE: 'https://codeprac2.onrender.com/api',
    // PASSWORD_RESET_URL: 'https://mohammed-aswath.github.io/CodePrac2/password-reset.html',
>>>>>>> b9ae754f9054eba0e968fb0e1f113a8862b8fb5d
    API_BASE: 'http://localhost:5000/api', // Uncomment for local development

    API_BASE_URL: 'https://codeprac2.onrender.com/api', // Alias for compatibility

    ROLES: {
        ADMIN: 'admin',
        COLLEGE: 'college',
        DEPARTMENT: 'department',
        BATCH: 'batch',
        STUDENT: 'student'
    },

    STORAGE_KEYS: {
        TOKEN: 'token',
        USER: 'user'
    },

    BATCH_REGEX: /^\d{4}-\d{4}$/,

    PAGES: {
        AUTH: 'auth',
        DASHBOARD: 'dashboard',
        ADMIN: 'admin',
        COLLEGE: 'college',
        DEPARTMENT: 'department',
        BATCH: 'batch',
        STUDENT: 'student'
    }
};

// Export to global scope for all modules
window.CONFIG = Config;
window.Config = Config;

Object.freeze(Config);
