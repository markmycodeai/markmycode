/**
 * Authentication Module
 */

const Auth = {
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return Utils.getToken() && Utils.getUser();
    },

    /**
     * Get current user
     */
    getCurrentUser() {
        return Utils.getUser();
    },

    /**
     * Check user role
     */
    hasRole(role) {
        const user = this.getCurrentUser();
        return user && user.role === role;
    },

    /**
     * Login with email and password
     */
    async login(email, password) {
        try {
            const response = await Utils.apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            const payload = response.data || response;
            if (payload.token && payload.user) {
                Utils.saveAuth(payload.token, payload.user);
                return payload.user;
            }

            throw new Error('Invalid response format');
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    },

    /**
     * Register new user
     */
    async register(name, email, password, role) {
        try {
            const response = await Utils.apiRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ name, email, password, role })
            });

            const payload = response.data || response;
            if (payload.token && payload.user) {
                Utils.saveAuth(payload.token, payload.user);
                return payload.user;
            }

            throw new Error('Invalid response format');
        } catch (error) {
            console.error('Registration failed:', error);
            throw error;
        }
    },

    /**
     * Logout
     */
    logout() {
        Utils.clearAuth();
    },

    /**
<<<<<<< HEAD
     * Request Password Reset
=======
     * Request password reset email
>>>>>>> b9ae754f9054eba0e968fb0e1f113a8862b8fb5d
     */
    async requestPasswordReset(email) {
        try {
            const response = await Utils.apiRequest('/auth/password-reset-request', {
                method: 'POST',
                body: JSON.stringify({ email })
            });
<<<<<<< HEAD
=======

>>>>>>> b9ae754f9054eba0e968fb0e1f113a8862b8fb5d
            return response;
        } catch (error) {
            console.error('Password reset request failed:', error);
            throw error;
        }
<<<<<<< HEAD
=======
    },

    /**
     * Verify password reset code (called from password-reset.html)
     * This is handled client-side in the password-reset.html page
     */
    async verifyResetCode(auth, actionCode) {
        // This is implemented in password-reset.html using Firebase SDK
        console.log('Reset code verification handled in password-reset.html');
    },

    /**
     * Confirm password reset (called from password-reset.html)
     * This is handled client-side in the password-reset.html page
     */
    async confirmPasswordReset(auth, actionCode, newPassword) {
        // This is implemented in password-reset.html using Firebase SDK
        console.log('Password reset confirmation handled in password-reset.html');
>>>>>>> b9ae754f9054eba0e968fb0e1f113a8862b8fb5d
    }
};
