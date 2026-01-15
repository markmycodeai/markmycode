/**
 * Dashboard Module
 */

const Dashboard = {
    // State
    students: [],
    filteredStudents: [],
    hierarchy: {
        colleges: [],
        departments: [],
        batches: []
    },
    filters: {
        search: '',
        college: '',
        department: '',
        batch: ''
    },

    /**
     * Load dashboard data
     */
    async load() {
        try {
            const user = Auth.getCurrentUser();

            // Custom Welcome Message
            const title = document.querySelector('#dashboardPage h1');
            if (title) {
                const displayName = user.name || user.username || (user.email ? user.email.split('@')[0] : 'User');
                title.textContent = `Welcome ${displayName}!`;
            }

            // Clear previous content
            const content = document.getElementById('dashboardContent');
            if (content) content.innerHTML = '<div class="nexus-loader" style="position:static; margin: 2rem auto;"><div class="nexus-spinner-container"><div class="nexus-spinner-ring"></div></div></div>';

            document.getElementById('activitySection').innerHTML = '';

            if (user.role === 'student') {
                await this.loadStudentDashboard();
            } else {
                await this.loadAdminDashboard(user.role);
            }
        } catch (error) {
            console.error('Dashboard load error:', error);
            Utils.showMessage('dashboardMessage', 'Failed to load dashboard', 'error');
        }
    },

    /**
     * Load student dashboard
     */
    async loadStudentDashboard() {
        // Show loading state
        const content = document.getElementById('dashboardContent');
        if (content) Utils.showLoading('dashboardContent', 'Loading your stats...');

        try {
            const response = await Utils.apiRequest('/student/performance');
            const performance = response.data?.performance || response.performance || [];

            // Calculate stats from performance data
            const totalSubmissions = performance.length;
            const correctSubmissions = performance.filter(p => p.status === 'correct').length;
            const uniqueQuestions = new Set(performance.map(p => p.question_id)).size;
            const successRate = totalSubmissions > 0 ? Math.round((correctSubmissions / totalSubmissions) * 100) : 0;

            // Build dashboard HTML
            if (content) {
                content.innerHTML = `
                    <div class="dashboard-grid">
                        <div class="stat-card">
                            <h3>Total Submissions</h3>
                            <div class="value">${totalSubmissions}</div>
                        </div>
                        <div class="stat-card">
                            <h3>Questions Solved</h3>
                            <div class="value" style="color: var(--success);">${correctSubmissions}</div>
                        </div>
                        <div class="stat-card">
                            <h3>Unique Questions</h3>
                            <div class="value" style="color: var(--warning);">${uniqueQuestions}</div>
                        </div>
                        <div class="stat-card">
                            <h3>Success Rate</h3>
                            <div class="value" style="color: var(--info);">${successRate}%</div>
                        </div>
                    </div>
                    <div id="activitySection"></div>
                `;
            }

            // Load recent activity
            await this.loadRecentActivity(performance);
        } catch (error) {
            console.error('Student dashboard error:', error);
            Utils.showError('dashboardContent', 'Failed to load dashboard stats. ' + error.message, () => this.load());
            Utils.showMessage('dashboardMessage', 'Failed to load dashboard stats', 'error');
        }
    },

    /**
     * Load Admin/College/Dept/Batch Dashboard
     */
    async loadAdminDashboard(role) {
        // Show Loading
        Utils.showLoading('dashboardContent', 'Loading dashboard data...');

        try {
            // 1. Fetch Students
            let endpoint = '/admin/students';
            if (role === 'college') endpoint = '/college/students';
            else if (role === 'department') endpoint = '/department/students';
            else if (role === 'batch') endpoint = '/batch/students';

            const response = await Utils.apiRequest(endpoint);
            this.students = response.data?.students || response.students || [];
            this.filteredStudents = [...this.students];

            // 2. Fetch Hierarchy for Filters (if applicable)
            await this.loadHierarchyAPI(role);

            // 3. Render Controls & List
            this.renderAdminDashboard();

        } catch (error) {
            console.error('Admin dashboard error:', error);
            Utils.showError('dashboardContent', 'Failed to load dashboard data. ' + error.message, () => this.load());
            Utils.showMessage('dashboardMessage', 'Failed to load dashboard data', 'error');
        }
    },

    /**
     * Helper to load hierarchy data for filters
     */
    async loadHierarchyAPI(role) {
        // Only load what is necessary/accessible based on role
        try {
            if (role === 'admin') {
                const [c, d, b] = await Promise.all([
                    Utils.apiRequest('/admin/colleges'),
                    Utils.apiRequest('/admin/departments'),
                    Utils.apiRequest('/admin/batches')
                ]);
                this.hierarchy.colleges = c.data?.colleges || c.colleges || [];
                this.hierarchy.departments = d.data?.departments || d.departments || [];
                this.hierarchy.batches = b.data?.batches || b.batches || [];
            } else if (role === 'college') {
                const [d, b] = await Promise.all([
                    Utils.apiRequest('/college/departments'),
                    Utils.apiRequest('/college/batches')
                ]);
                this.hierarchy.departments = d.data?.departments || d.departments || [];
                this.hierarchy.batches = b.data?.batches || b.batches || [];
            } else if (role === 'department') {
                const b = await Utils.apiRequest('/department/batches');
                this.hierarchy.batches = b.data?.batches || b.batches || [];
            }
        } catch (e) {
            console.warn('Failed to load hierarchy for filters', e);
        }
    },

    /**
     * Render the Admin Dashboard UI
     */
    renderAdminDashboard() {
        const dashboardContent = document.getElementById('dashboardContent');
        if (!dashboardContent) return;

        const user = Auth.getCurrentUser();
        const role = user.role;

        let html = `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
                <h2 style="margin-top:0; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1rem; margin-bottom: 1.5rem; color: var(--text-main);">Student Overview</h2>
                
                <!-- Filters -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                    <div>
                        <input type="text" id="dashSearch" placeholder="Search students..." 
                            style="width: 100%; padding: 0.75rem; background: var(--bg-app); border: 1px solid var(--border-subtle); color: var(--text-main); border-radius: 4px;">
                    </div>
        `;

        // Role-based filters
        if (role === 'admin') {
            html += `
                <div>
                    <select id="dashFilterCollege" style="width: 100%; padding: 0.75rem; background: var(--bg-app); border: 1px solid var(--border-subtle); color: var(--text-main); border-radius: 4px;">
                        <option value="">All Colleges</option>
                        ${this.hierarchy.colleges.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.college_name || c.name)}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        if (['admin', 'college'].includes(role)) {
            html += `
                <div>
                    <select id="dashFilterDept" style="width: 100%; padding: 0.75rem; background: var(--bg-app); border: 1px solid var(--border-subtle); color: var(--text-main); border-radius: 4px;">
                        <option value="">All Departments</option>
                        ${this.hierarchy.departments.map(d => `<option value="${d.id}">${Utils.escapeHtml(d.department_name || d.name)}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        if (['admin', 'college', 'department'].includes(role)) {
            html += `
                <div>
                    <select id="dashFilterBatch" style="width: 100%; padding: 0.75rem; background: var(--bg-app); border: 1px solid var(--border-subtle); color: var(--text-main); border-radius: 4px;">
                        <option value="">All Batches</option>
                        ${this.hierarchy.batches.map(b => `<option value="${b.id}">${Utils.escapeHtml(b.batch_name)}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        html += `
                </div>
                
                <!-- Stats Row inside card -->
                <div style="display: flex; gap: 2rem; margin-bottom: 1.5rem; color: var(--text-muted); font-size: 0.9rem;">
                    <div>Total Students: <strong style="color: var(--text-main);" id="dashTotalCount">${this.filteredStudents.length}</strong></div>
                    <div>Active: <strong style="color: var(--success);" id="dashActiveCount">${this.filteredStudents.filter(s => !s.is_disabled).length}</strong></div>
                </div>

                <!-- Table -->
                <div class="table-container" style="max-height: 500px; overflow-y: auto;">
                    <table class="table" style="width: 100%;">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                ${role === 'admin' ? '<th>College</th>' : ''}
                                ${['admin', 'college'].includes(role) ? '<th>Department</th>' : ''}
                                <th>Batch</th>
                                <th>Status</th>
                                <th style="text-align: right;">Action</th>
                            </tr>
                        </thead>
                        <tbody id="dashStudentsBody">
                            <!-- Populated by JS -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        dashboardContent.innerHTML = html;

        // Initial Render of rows
        this.renderStudentRows();

        // Attach Event Listeners
        document.getElementById('dashSearch').addEventListener('input', (e) => this.handleFilterChange('search', e.target.value));

        if (document.getElementById('dashFilterCollege'))
            document.getElementById('dashFilterCollege').addEventListener('change', (e) => this.handleFilterChange('college', e.target.value));

        if (document.getElementById('dashFilterDept'))
            document.getElementById('dashFilterDept').addEventListener('change', (e) => this.handleFilterChange('department', e.target.value));

        if (document.getElementById('dashFilterBatch'))
            document.getElementById('dashFilterBatch').addEventListener('change', (e) => this.handleFilterChange('batch', e.target.value));
    },

    /**
     * Handle Filter Changes
     */
    handleFilterChange(key, value) {
        this.filters[key] = value.toLowerCase();

        this.filteredStudents = this.students.filter(student => {
            // Search Text
            const matchSearch = !this.filters.search ||
                (student.username && student.username.toLowerCase().includes(this.filters.search)) ||
                (student.name && student.name.toLowerCase().includes(this.filters.search)) ||
                (student.email && student.email.toLowerCase().includes(this.filters.search));

            // Filters
            const matchCollege = !this.filters.college || student.college_id === this.filters.college;
            const matchDept = !this.filters.department || student.department_id === this.filters.department;
            const matchBatch = !this.filters.batch || student.batch_id === this.filters.batch;

            return matchSearch && matchCollege && matchDept && matchBatch;
        });

        // Update Counts
        document.getElementById('dashTotalCount').textContent = this.filteredStudents.length;
        document.getElementById('dashActiveCount').textContent = this.filteredStudents.filter(s => !s.is_disabled).length;

        this.renderStudentRows();
    },

    /**
     * Render just the table rows
     */
    renderStudentRows() {
        const tbody = document.getElementById('dashStudentsBody');
        if (!tbody) return;

        if (this.filteredStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No students found matching your criteria.</td></tr>';
            return;
        }

        const user = Auth.getCurrentUser();
        const role = user.role;

        tbody.innerHTML = this.filteredStudents.map(s => {
            // Validate names using hierarchy or fallback to ID
            const collegeName = role === 'admin' ? this.getName(s.college_id, 'colleges') : '';
            const deptName = ['admin', 'college'].includes(role) ? this.getName(s.department_id, 'departments') : '';
            const batchName = this.getName(s.batch_id, 'batches');

            let html = `
                <tr style="cursor: pointer; transition: background 0.1s;" onclick="StudentProfileViewer.open('${s.id}', ${JSON.stringify(s).replace(/"/g, '&quot;')})" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background='transparent'">
                    <td>
                        <div style="font-weight: 500; color: var(--text-main);">${Utils.escapeHtml(s.username || s.name || 'Unknown')}</div>
                    </td>
                    <td style="color: var(--text-muted);">${Utils.escapeHtml(s.email)}</td>
            `;

            if (role === 'admin') html += `<td style="color: var(--text-muted); font-size: 0.9rem;">${Utils.escapeHtml(collegeName)}</td>`;
            if (['admin', 'college'].includes(role)) html += `<td style="color: var(--text-muted); font-size: 0.9rem;">${Utils.escapeHtml(deptName)}</td>`;

            html += `
                    <td style="color: var(--text-muted); font-size: 0.9rem;">${Utils.escapeHtml(batchName)}</td>
                    <td>
                        ${!s.is_disabled
                    ? '<span class="badge badge-success">Active</span>'
                    : '<span class="badge badge-secondary">Disabled</span>'}
                    </td>
                    <td style="text-align: right;">
                        <button class="btn btn-sm btn-secondary" style="font-size: 0.8rem;">View Profile</button>
                    </td>
                </tr>
            `;
            return html;
        }).join('');
    },

    /**
     * Helper to get name from hierarchy
     */
    getName(id, type) {
        if (!id) return '-';
        const list = this.hierarchy[type] || [];
        const item = list.find(x => x.id === id);

        if (item) {
            return item.college_name || item.department_name || item.batch_name || item.name || id;
        }
        return id.substring(0, 8) + '...'; // Fallback if not loaded
    },

    /**
     * Load recent activity (kept from original)
     */
    async loadRecentActivity(performance) {
        try {
            const activitySection = document.getElementById('activitySection');
            if (!activitySection) return;

            if (!performance || performance.length === 0) {
                activitySection.innerHTML = `
                    <div class="card">
                        <h2>Recent Activity</h2>
                        <p class="text-secondary">No submissions yet. Start practicing!</p>
                    </div>
                `;
                return;
            }

            // Show 5 most recent submissions
            const recentSubmissions = performance.slice(0, 5);

            activitySection.innerHTML = `
                <div class="card">
                    <div class="card-header">Recent Activity</div>
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Question</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${recentSubmissions.map(submission => `
                                    <tr>
                                        <td>${Utils.escapeHtml(submission.question_title || submission.question_id || 'Unknown')}</td>
                                        <td>
                                            <span class="badge ${submission.status === 'correct' ? 'badge-success' : submission.status === 'execution_error' ? 'badge-danger' : 'badge-warning'}">
                                                ${submission.status || 'pending'}
                                            </span>
                                        </td>
                                        <td>${Utils.formatDate(submission.submitted_at || new Date().toISOString())}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Load activity error:', error);
        }
    }
};
