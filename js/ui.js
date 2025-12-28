/**
 * UI & Router - Manages page navigation and state
 */

const UI = {
    currentPage: null,
    currentUser: null,

    /**
     * Initialize the application
     */
    init() {
        this.setupEventListeners();
        this.checkAuthentication();
    },

    /**
     * Check authentication and route accordingly
     */
    checkAuthentication() {
        if (Auth.isAuthenticated()) {
            this.currentUser = Auth.getCurrentUser();
            this.showApp();
            this.navigateTo(Config.PAGES.DASHBOARD);
        } else {
            this.showAuth();
        }
    },

    /**
     * Show authentication page
     */
    showAuth() {
        document.getElementById('authPage').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    },

    /**
     * Show main app
     */
    showApp() {
        document.getElementById('authPage').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        this.setupNavigation();
    },

    /**
     * Setup navigation visibility based on role
     */
    setupNavigation() {
        const user = this.currentUser;
        const role = user?.role || 'student';

        // Hide all role-specific links
        document.getElementById('adminLink')?.classList.add('hidden');
        document.getElementById('collegeLink')?.classList.add('hidden');
        document.getElementById('deptLink')?.classList.add('hidden');
        document.getElementById('batchLink')?.classList.add('hidden');

        // Show only relevant links
        if (role === 'admin') {
            document.getElementById('adminLink')?.classList.remove('hidden');
        } else if (role === 'college') {
            document.getElementById('collegeLink')?.classList.remove('hidden');
        } else if (role === 'department') {
            document.getElementById('deptLink')?.classList.remove('hidden');
        } else if (role === 'batch') {
            document.getElementById('batchLink')?.classList.remove('hidden');
        }

        // Show student link and logout for all authenticated users
        document.getElementById('studentLink')?.classList.remove('hidden');
        document.getElementById('logoutBtn')?.classList.remove('hidden');
    },

    /**
     * Navigate to a page
     */
    navigateTo(page) {
        // Hide all pages
        document.querySelectorAll('[data-page]').forEach(el => {
            el.classList.add('hidden');
        });

        // Show selected page
        const pageEl = document.querySelector(`[data-page="${page}"]`);
        if (pageEl) {
            pageEl.classList.remove('hidden');
            this.currentPage = page;

            // Load page-specific data
            this.loadPageData(page);
        }
    },

    /**
     * Load data specific to each page
     */
    async loadPageData(page) {
        try {
            switch (page) {
                case Config.PAGES.DASHBOARD:
                    if (typeof Dashboard !== 'undefined') {
                        await Dashboard.load();
                    }
                    break;
                case Config.PAGES.ADMIN:
                    if (typeof Admin !== 'undefined') {
                        await Admin.load();
                    }
                    break;
                case Config.PAGES.COLLEGE:
                    if (typeof College !== 'undefined') {
                        await College.load();
                    }
                    break;
                case Config.PAGES.DEPARTMENT:
                    if (typeof Department !== 'undefined') {
                        await Department.load();
                    }
                    break;
                case 'batch':
                    if (typeof Batch !== 'undefined') {
                        await Batch.load();
                    }
                    break;
                case Config.PAGES.STUDENT:
                    if (typeof StudentPractice !== 'undefined') {
                        await StudentPractice.load();
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error loading page ${page}:`, error);
            Utils.showMessage('pageMessage', 'Failed to load page', 'error');
        }
    },

    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Login form
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.handleLogin());
        }

        // Register form
        const registerBtn = document.getElementById('registerBtn');
        if (registerBtn) {
            registerBtn.addEventListener('click', () => this.handleRegister());
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Navigation links
        document.querySelectorAll('[data-nav]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-nav');
                this.navigateTo(page);
            });
        });

        // Toggle auth form
        const toggleLink = document.getElementById('toggleAuthForm');
        if (toggleLink) {
            toggleLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAuthForm();
            });
        }

        // Modal close buttons
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const modalId = btn.closest('.modal').id;
                this.closeModal(modalId);
            });
        });

        // Close modal on background click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    },

    /**
     * Handle login
     */
    async handleLogin() {
        const email = document.getElementById('loginEmail')?.value || '';
        const password = document.getElementById('loginPassword')?.value || '';

        if (!email || !password) {
            Utils.showMessage('authMessage', 'Please fill all fields', 'error');
            return;
        }

        // 1. Show Loading Screen
        const loginForm = document.getElementById('loginForm');
        const loaderScreen = document.getElementById('loaderScreen');
        const loadingText = document.getElementById('loadingText');

        loginForm.classList.add('hidden');
        loaderScreen.classList.remove('hidden');

        // 2. Tech Phrases Cycling
        const phrases = [
            "Initializing Neural Networks...",
            "Connecting to Render Cloud...",
            "Warming up LLM Cores...",
            "Optimizing Algorithm Engines...",
            "Establishing Secure Uplink...",
            "Loading Competitive Modules...",
            "Decrypting Secure Handshake...",
            "Allocating Virtual Resources..."
        ];

        let phraseIndex = 0;
        loadingText.textContent = phrases[0];

        const messageInterval = setInterval(() => {
            phraseIndex = (phraseIndex + 1) % phrases.length;
            loadingText.textContent = phrases[phraseIndex];
        }, 2000); // Change phrase every 2 seconds

        try {
            // 3. Attempt Login
            this.currentUser = await Auth.login(email, password);

            // Success
            clearInterval(messageInterval);
            loadingText.textContent = "Access Granted";

            Utils.showMessage('authMessage', 'Login successful', 'success');

            setTimeout(() => {
                // Ensure loader is hidden when moving to app (though page change does it)
                loaderScreen.classList.add('hidden');
                loginForm.classList.remove('hidden'); // Reset for next time (logout)

                this.showApp();
                this.navigateTo(Config.PAGES.DASHBOARD);
            }, 500);
        } catch (error) {
            // Failure
            clearInterval(messageInterval);

            // Show form again
            loaderScreen.classList.add('hidden');
            loginForm.classList.remove('hidden');

            Utils.showMessage('authMessage', error.message || 'Login failed - Connection Timeout?', 'error');
        }
    },

    /**
     * Handle registration
     */
    async handleRegister() {
        const name = document.getElementById('registerName')?.value || '';
        const email = document.getElementById('registerEmail')?.value || '';
        const password = document.getElementById('registerPassword')?.value || '';
        const role = document.getElementById('registerRole')?.value || 'student';

        if (!name || !email || !password) {
            Utils.showMessage('authMessage', 'Please fill all fields', 'error');
            return;
        }

        try {
            this.currentUser = await Auth.register(name, email, password, role);
            Utils.showMessage('authMessage', 'Registration successful', 'success');

            setTimeout(() => {
                this.showApp();
                this.navigateTo(Config.PAGES.DASHBOARD);
            }, 500);
        } catch (error) {
            Utils.showMessage('authMessage', error.message || 'Registration failed', 'error');
        }
    },

    /**
     * Handle logout
     */
    handleLogout() {
        Auth.logout();
        this.showAuth();
        this.resetAuthForm();
    },

    /**
     * Toggle between login and register forms
     */
    toggleAuthForm() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm && registerForm) {
            loginForm.classList.toggle('hidden');
            registerForm.classList.toggle('hidden');
        }
    },

    /**
     * Reset auth form
     */
    resetAuthForm() {
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('registerName').value = '';
        document.getElementById('registerEmail').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerRole').value = 'student';

        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        if (loginForm && registerForm) {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        }
    },

    /**
     * Open modal
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    },

    /**
     * Close modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});
