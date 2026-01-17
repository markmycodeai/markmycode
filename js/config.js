/**
 * Configuration - Central settings and constants
 */

const Config = {
    // Environment URLs
    // Default to deployed backend
    API_BASE: 'https://markmycode.onrender.com/api', // Production URL
    // API_BASE: 'http://localhost:5000/api', // Uncomment for local development

    // API_BASE_URL alias for backward compatibility with modules that use CONFIG.API_BASE_URL
    // API_BASE_URL: 'http://localhost:5000/api',

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
