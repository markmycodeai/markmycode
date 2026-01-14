require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getAuth, sendPasswordResetEmail } = require('firebase/auth');

// Production logging helper
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const logError = (msg, err) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, err);

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Configuration
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
};

// Initialize Firebase
// Note: initializeApp can be called multiple times in serverless, check if already initialized 
// but for simple Express app, this is fine.
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

// Middleware to check Shared Secret
const authenticateService = (req, res, next) => {
    const secretHeader = req.headers['x-service-secret'];
    if (!secretHeader || secretHeader !== process.env.SERVICE_SECRET) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing service secret' });
    }
    next();
};

/**
 * POST /api/trigger-reset
 * Secure endpoint to trigger Firebase's sendPasswordResetEmail
 */
app.post('/api/trigger-reset', authenticateService, async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Invalid Input', message: 'Email is required' });
    }

    try {
        // This uses the Client SDK to trigger the email
        await sendPasswordResetEmail(auth, email);
        log(`Password reset email sent to: ${email}`);
        return res.status(200).json({ status: 'sent', provider: 'firebase' });
    } catch (error) {
        logError('Error sending password reset email:', error);
        let statusCode = 500;
        let errorCode = 'INTERNAL_ERROR';

        // Map Firebase errors to HTTP status codes
        if (error.code === 'auth/user-not-found') {
            statusCode = 404;
            errorCode = 'USER_NOT_FOUND';
        } else if (error.code === 'auth/invalid-email') {
            statusCode = 400;
            errorCode = 'INVALID_EMAIL';
        } else if (error.code === 'auth/too-many-requests') {
            statusCode = 429;
            errorCode = 'TOO_MANY_REQUESTS';
        }

        return res.status(statusCode).json({ error: errorCode, details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    log(`Backend B (Auth Service) listening on port ${PORT}`);
});
