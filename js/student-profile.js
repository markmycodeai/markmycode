/**
 * Student Profile Viewer Module
 * Provides a unified view of student details for all admin roles
 */

const StudentProfileViewer = {
    // State
    currentStudentId: null,
    currentStudentData: null,

    // Modal Elements reference
    modal: null,

    /**
     * Initialize the module
     */
    init() {
        // Create modal if it doesn't exist
        if (!document.getElementById('studentProfileModal')) {
            this.createModal();
        }

        this.modal = document.getElementById('studentProfileModal');

        // Event listeners
        const closeBtn = this.modal.querySelector('.nexus-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Close on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Tab switching
        const tabs = this.modal.querySelectorAll('.profile-tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Deactivate all
                tabs.forEach(t => t.classList.remove('active'));
                this.modal.querySelectorAll('.profile-tab-content').forEach(c => c.style.display = 'none');

                // Activate clicked
                tab.classList.add('active');
                const targetId = tab.getAttribute('data-target');
                document.getElementById(targetId).style.display = 'block';
            });
        });
    },

    /**
     * Create the modal structure in the DOM
     */
    createModal() {
        const modalHtml = `
            <div id="studentProfileModal" class="nexus-modal hidden" style="z-index: 2000;">
                <div class="nexus-modal-content" style="max-width: 900px; max-height: 90vh; display: flex; flex-direction: column;">
                    <div class="nexus-modal-header">
                        <h2 class="nexus-modal-title">Student Profile</h2>
                        <button class="nexus-modal-close">&times;</button>
                    </div>
                    
                    <div class="profile-tabs" style="display: flex; border-bottom: 1px solid var(--border-subtle); padding: 0 1.5rem;">
                        <button class="profile-tab-btn active" data-target="tab-overview" style="background: none; border: none; color: var(--text-muted); padding: 1rem 1.5rem; cursor: pointer; border-bottom: 2px solid transparent; font-weight: 500;">Overview</button>
                        <button class="profile-tab-btn" data-target="tab-activity" style="background: none; border: none; color: var(--text-muted); padding: 1rem 1.5rem; cursor: pointer; border-bottom: 2px solid transparent; font-weight: 500;">Activity & Stats</button>
                    </div>
                    
                    <div class="nexus-modal-body" style="flex: 1; overflow-y: auto; padding: 1.5rem;">
                        <!-- Overview Tab -->
                        <div id="tab-overview" class="profile-tab-content">
                            <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                                <!-- Identity Card -->
                                <div style="flex: 1; min-width: 300px; background: var(--bg-surface); border-radius: 8px; padding: 1.5rem; border: 1px solid var(--border-subtle);">
                                    <div style="text-align: center; margin-bottom: 1.5rem;">
                                        <div style="width: 80px; height: 80px; background: linear-gradient(135deg, var(--primary-500), var(--primary-600)); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold; margin: 0 auto 1rem; color: #000;" id="sp-avatar">
                                            U
                                        </div>
                                        <h3 id="sp-name" style="margin: 0; color: var(--text-main);">Student Name</h3>
                                        <p id="sp-username" style="color: var(--text-muted); margin: 0.25rem 0;">@username</p>
                                        <div id="sp-status" style="margin-top: 0.5rem;"></div>
                                    </div>
                                    
                                    <div style="display: grid; gap: 1rem;">
                                        <div>
                                            <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Email</div>
                                            <div id="sp-email" style="color: var(--text-body);">-</div>
                                        </div>
                                        <!-- Removed Phone and URN as they are not in schema -->
                                    </div>
                                </div>
                                
                                <!-- Academic Info -->
                                <div style="flex: 1; min-width: 300px;">
                                    <h4 style="color: var(--text-main); border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem; margin-top: 0;">Academic Details</h4>
                                    <div style="display: grid; gap: 1rem;">
                                        <div style="background: var(--bg-elevated); padding: 1rem; border-radius: 6px; border: 1px solid var(--border-subtle);">
                                            <div style="font-size: 0.8rem; color: var(--text-muted);">College</div>
                                            <div id="sp-college" style="font-weight: 500; color: var(--text-main);">-</div>
                                        </div>
                                        <div style="background: var(--bg-elevated); padding: 1rem; border-radius: 6px; border: 1px solid var(--border-subtle);">
                                            <div style="font-size: 0.8rem; color: var(--text-muted);">Department</div>
                                            <div id="sp-dept" style="font-weight: 500; color: var(--text-main);">-</div>
                                        </div>
                                        <div style="background: var(--bg-elevated); padding: 1rem; border-radius: 6px; border: 1px solid var(--border-subtle);">
                                            <div style="font-size: 0.8rem; color: var(--text-muted);">Batch</div>
                                            <div id="sp-batch" style="font-weight: 500; color: var(--text-main);">-</div>
                                        </div>
                                        <div style="background: var(--bg-elevated); padding: 1rem; border-radius: 6px; border: 1px solid var(--border-subtle);">
                                            <div style="font-size: 0.8rem; color: var(--text-muted);">Registration Date</div>
                                            <div id="sp-date" style="font-weight: 500; color: var(--text-main);">-</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Activity Tab -->
                        <div id="tab-activity" class="profile-tab-content" style="display: none;">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                                <div class="stat-card" style="background: var(--bg-surface); border: 1px solid var(--primary-500); padding: 1.5rem; border-radius: 8px; text-align: center; box-shadow: var(--shadow-glow);">
                                    <div style="font-size: 2.5rem; font-weight: bold; color: var(--primary-500);" id="stat-total">0</div>
                                    <div style="color: var(--text-muted); font-size: 0.9rem;">Total Attempts</div>
                                </div>
                                <div class="stat-card" style="background: var(--bg-surface); border: 1px solid var(--success); padding: 1.5rem; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 2.5rem; font-weight: bold; color: var(--success);" id="stat-solved">0</div>
                                    <div style="color: var(--text-muted); font-size: 0.9rem;">Problems Solved</div>
                                </div>
                                <div class="stat-card" style="background: var(--bg-surface); border: 1px solid var(--accent-cyan); padding: 1.5rem; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 2.5rem; font-weight: bold; color: var(--accent-cyan);" id="stat-accuracy">0%</div>
                                    <div style="color: var(--text-muted); font-size: 0.9rem;">Accuracy</div>
                                </div>
                            </div>
                            
                            <h3 style="color: var(--text-main); font-size: 1.1rem; margin-bottom: 1rem;">Code Submissions</h3>
                            <div id="sp-submissions-list">
                                <div style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading submissions...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                .profile-tab-btn.active {
                    color: var(--text-main) !important;
                    border-bottom-color: var(--primary-500) !important;
                }
                
                /* Nexus Modal Styles - Self Contained */
                .nexus-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: var(--bg-glass);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                    opacity: 1;
                    transition: opacity 0.3s ease;
                }
                
                .nexus-modal.hidden {
                    display: none;
                    opacity: 0;
                    pointer-events: none;
                }
                
                .nexus-modal-content {
                    background: var(--bg-elevated);
                    color: var(--text-main);
                    border-radius: 12px;
                    box-shadow: var(--shadow-lg);
                    border: 1px solid var(--border-subtle);
                    width: 90%;
                    max-width: 900px;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: nexusModalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                
                .nexus-modal-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid var(--border-subtle);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: var(--bg-surface);
                }
                
                .nexus-modal-title {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--text-main);
                    letter-spacing: -0.025em;
                }
                
                .nexus-modal-close {
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    font-size: 1.5rem;
                    cursor: pointer;
                    line-height: 1;
                    padding: 0.5rem;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                
                .nexus-modal-close:hover {
                    color: var(--text-main);
                    background: var(--bg-surface);
                }
                
                .nexus-modal-body {
                    padding: 0; /* Reset generic padding if any */
                }
                
                @keyframes nexusModalSlideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            </style>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    /**
     * Open the student profile
     * @param {string} studentId 
     * @param {object} studentData (optional) Pre-loaded data
     */
    async open(studentId, studentData = null) {
        this.init();
        this.currentStudentId = studentId;
        this.modal.classList.remove('hidden');

        // Reset View
        this.resetView();

        // Load Data
        await this.loadProfile(studentId, studentData);
        await this.loadStats(studentId);
    },

    /**
     * Close the modal
     */
    close() {
        if (this.modal) {
            this.modal.classList.add('hidden');
        }
    },

    /**
     * Reset the view to loading state
     */
    resetView() {
        document.getElementById('sp-name').textContent = 'Loading...';
        document.getElementById('sp-username').textContent = '';
        document.getElementById('sp-email').textContent = '...';
        document.getElementById('sp-college').textContent = '...';
        document.getElementById('sp-dept').textContent = '...';
        document.getElementById('sp-batch').textContent = '...';
        document.getElementById('sp-avatar').textContent = '';
        document.getElementById('sp-avatar').textContent = '';
        document.getElementById('sp-submissions-list').innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading details...</div>';

        // Reset stats
        document.getElementById('stat-total').textContent = '0';
        document.getElementById('stat-solved').textContent = '0';
        document.getElementById('stat-accuracy').textContent = '0%';

        // Switch to first tab
        const firstTab = this.modal.querySelector('.profile-tab-btn');
        if (firstTab) firstTab.click();
    },

    /**
     * Load Basic Profile Data
     */
    async loadProfile(studentId, preloadedData = null) {
        try {
            if (preloadedData) {
                this.renderProfile(preloadedData);
                return;
            }

            // We shouldn't need this if data is passed, but as fallback:
            const baseUrl = this.getApiBaseUrl();
            let student = null;

            try {
                const response = await Utils.apiRequest(`${baseUrl}/students/${studentId}`);
                student = response.data?.student || response.student;
            } catch (e) {
                console.warn('Direct fetch failed', e);
            }

            if (student) {
                this.renderProfile(student);
            } else {
                document.getElementById('sp-name').textContent = 'Student Not Found';
            }

        } catch (error) {
            console.error('Profile load error:', error);
            document.getElementById('sp-name').textContent = 'Error loading profile';
        }
    },

    /**
     * Load Statistics and Activity
     */
    async loadStats(studentId) {
        // Show loading state
        document.getElementById('stat-total').textContent = '-';
        document.getElementById('stat-solved').textContent = '-';
        document.getElementById('stat-accuracy').textContent = '-';
        document.getElementById('sp-submissions-list').innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; gap: 1rem; color: var(--text-muted);">
                <div class="spinner"></div>
                <div style="font-size: 0.9rem;">Loading activity...</div>
            </div>
        `;

        try {
            const baseUrl = this.getApiBaseUrl();
            let endpoint = `${baseUrl}/students/${studentId}/performance`;

            const user = Auth.getCurrentUser();

            // Admin and hierarchical roles have specific filter endpoints
            if (['admin', 'college', 'department', 'batch'].includes(user.role)) {
                endpoint = `/${user.role}/performance?student_id=${studentId}`;
            }

            // NOTE: If this 404s, we handle gracefully
            const response = await Utils.apiRequest(endpoint, { silent: true });

            // The admin endpoint returns { performance: [...] }, while the hypothetical one returned { stats:..., submissions:... }
            // We need to normalize the data structure for renderStats
            let data = response.data || response;

            if (['admin', 'college', 'department', 'batch'].includes(user.role) && Array.isArray(data.performance)) {
                // We need to calculate stats manually if the endpoint returns raw list
                const submissions = data.performance;
                const total = submissions.length;
                const solved = submissions.filter(s => s.status === 'correct' || s.status === 'Accepted').length;
                data = {
                    stats: {
                        total_attempts: total,
                        problems_solved: solved
                    },
                    submissions: submissions
                };
            }

            this.renderStats(data);
        } catch (error) {
            // Silently handle 404 or other errors as "No Data" 
            // This prevents the console error spam the user complained about
            console.log('Stats not available (expected if no endpoint)');

            document.getElementById('sp-submissions-list').innerHTML =
                '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">Detailed activity stats are not currently available for this view.</div>';
        }
    },

    /**
     * Render the profile data
     */
    renderProfile(student) {
        // Basic Info
        document.getElementById('sp-name').textContent = student.name || student.username || 'Unknown';
        document.getElementById('sp-username').textContent = '@' + (student.username || '');
        document.getElementById('sp-email').textContent = student.email || 'N/A';
        // Removed Phone and URN display
        document.getElementById('sp-date').textContent = student.created_at ? new Date(student.created_at).toLocaleDateString() : 'N/A';

        // Avatar
        const initial = (student.name || student.username || 'U')[0].toUpperCase();
        document.getElementById('sp-avatar').textContent = initial;

        // Status
        const statusEl = document.getElementById('sp-status');
        if (student.is_disabled) {
            statusEl.innerHTML = '<span style="background: rgba(239,68,68,0.2); color: #f87171; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem;">Disabled</span>';
        } else {
            statusEl.innerHTML = '<span style="background: rgba(16,185,129,0.2); color: #34d399; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem;">Active</span>';
        }

        // Hierarchy Names
        const collegeName = this.resolveName('College', student.college_id);
        const deptName = this.resolveName('Department', student.department_id);
        const batchName = this.resolveName('Batch', student.batch_id);

        document.getElementById('sp-college').textContent = collegeName;
        document.getElementById('sp-dept').textContent = deptName;
        document.getElementById('sp-batch').textContent = batchName;
    },

    /**
     * Render Stats
     */
    renderStats(data) {
        const stats = data.stats || {};
        const submissions = data.submissions || [];

        document.getElementById('stat-total').textContent = stats.total_attempts || 0;
        document.getElementById('stat-solved').textContent = stats.problems_solved || 0;

        const accuracy = stats.total_attempts > 0
            ? Math.round((stats.problems_solved / stats.total_attempts) * 100)
            : 0;
        document.getElementById('stat-accuracy').textContent = accuracy + '%';

        // Render Submissions List
        const listContainer = document.getElementById('sp-submissions-list');
        if (submissions.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No submissions yet.</div>';
            return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
        submissions.forEach(sub => {
            const isSuccess = sub.status === 'correct' || sub.status === 'Accepted';
            const color = isSuccess ? 'var(--success)' : 'var(--error)';
            const date = new Date(sub.submitted_at).toLocaleDateString();

            html += `
                <div style="background: var(--bg-surface); padding: 1rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid ${color}; border: 1px solid var(--border-subtle); border-left-width: 3px; border-left-color: ${color};">
                    <div>
                        <div style="font-weight: 500; color: var(--text-main);">${Utils.escapeHtml(sub.question_title || 'Unknown Question')}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">
                            ${date} • ${Utils.escapeHtml(sub.topic_name || 'Unknown Topic')} • ${Utils.escapeHtml(sub.language)}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="color: ${color}; font-size: 0.9rem; font-weight: 500;">${Utils.escapeHtml(sub.status)}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        listContainer.innerHTML = html;
    },

    /**
     * Helper: Get API base URL for current user
     */
    getApiBaseUrl() {
        const user = Auth.getCurrentUser();
        if (user.role === 'admin') return '/admin';
        if (user.role === 'college') return '/college';
        if (user.role === 'department') return '/department';
        if (user.role === 'batch') return '/batch';
        return '';
    },

    /**
     * Helper: Resolve names using loaded modules if possible
     */
    resolveName(type, id) {
        if (!id) return 'N/A';

        // Priority 1: Check Dashboard Hierarchy (loaded for Admin Dashboard)
        if (window.Dashboard && window.Dashboard.hierarchy) {
            if (type === 'College') {
                const item = window.Dashboard.hierarchy.colleges.find(x => x.id === id);
                if (item) return item.college_name || item.name;
            }
            if (type === 'Department') {
                const item = window.Dashboard.hierarchy.departments.find(x => x.id === id);
                if (item) return item.department_name || item.name;
            }
            if (type === 'Batch') {
                const item = window.Dashboard.hierarchy.batches.find(x => x.id === id);
                if (item) return item.batch_name;
            }
        }

        // Priority 2: Check standard globals (legacy/other pages)
        try {
            if (type === 'College' && window.Admin && window.Admin.colleges) {
                const c = window.Admin.colleges.find(x => x.id === id);
                if (c) return c.college_name || c.name;
            }
            if (type === 'Department') {
                if (window.Admin && window.Admin.departments) {
                    const d = window.Admin.departments.find(x => x.id === id);
                    if (d) return d.department_name || d.name;
                }
                if (window.College && window.College.departments) {
                    const d = window.College.departments.find(x => x.id === id);
                    if (d) return d.department_name || d.name;
                }
            }
            if (type === 'Batch') {
                if (window.Admin && window.Admin.batches) {
                    const b = window.Admin.batches.find(x => x.id === id);
                    if (b) return b.batch_name;
                }
                if (window.College && window.College.batches) {
                    const b = window.College.batches.find(x => x.id === id);
                    if (b) return b.batch_name;
                }
                if (window.Department && window.Department.batches) {
                    const b = window.Department.batches.find(x => x.id === id);
                    if (b) return b.batch_name;
                }
            }
        } catch (e) {
            // Ignore access errors
        }

        return id; // Fallback to ID
    }
};
