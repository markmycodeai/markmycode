/**
 * Admin Module - Admin panel with colleges, departments, batches, students
 */

const Admin = {
    colleges: [],
    departments: [],
    batches: [],
    students: [],

    activeTab: 'colleges',
    editingCollegeId: null,
    editingDepartmentId: null,
    editingBatchId: null,
    editingStudentId: null,

    /**
     * Helper: Find college name by ID
     * Returns the college name or empty string if not found
     */
    findCollegeNameById(collegeId) {
        if (!collegeId) return '';
        const college = this.colleges.find(c => c.id === collegeId);
        return college ? college.name : '';
    },

    /**
     * Helper: Find department name by ID
     * Returns the department name or empty string if not found
     */
    findDepartmentNameById(departmentId) {
        if (!departmentId) return '';
        const department = this.departments.find(d => d.id === departmentId);
        return department ? department.name : '';
    },

    /**
     * Helper: Find batch name by ID
     * Returns the batch name or empty string if not found
     */
    findBatchNameById(batchId) {
        if (!batchId) return '';
        const batch = this.batches.find(b => b.id === batchId);
        return batch ? batch.batch_name : '';
    },

    /**
     * Load admin dashboard
     */
    async load() {
        try {
            this.activeTab = 'colleges';
            await this.loadColleges();
            this.setupTabHandlers();
        } catch (error) {
            console.error('Admin load error:', error);
            Utils.showMessage('adminMessage', 'Failed to load admin panel', 'error');
        }
    },

    /**
     * Setup tab click handlers
     */
    setupTabHandlers() {
        const tabs = document.querySelectorAll('[data-admin-tab]');
        tabs.forEach(tab => {
            tab.addEventListener('click', async (e) => {
                e.preventDefault();
                const tabName = tab.getAttribute('data-admin-tab');
                await this.switchTab(tabName);
            });
        });
    },

    /**
     * Switch between tabs
     */
    async switchTab(tabName) {
        // Hide all content
        document.querySelectorAll('[data-admin-content]').forEach(el => {
            el.style.display = 'none';
        });

        // Deactivate all tabs
        document.querySelectorAll('[data-admin-tab]').forEach(el => {
            el.classList.remove('active');
        });

        // Show selected content
        const content = document.querySelector(`[data-admin-content="${tabName}"]`);
        if (content) {
            content.style.display = 'block';
        }

        // Activate selected tab
        const tab = document.querySelector(`[data-admin-tab="${tabName}"]`);
        if (tab) {
            tab.classList.add('active');
        }

        this.activeTab = tabName;

        // Load data for tab
        switch (tabName) {
            case 'colleges':
                await this.loadColleges();
                break;
            case 'departments':
                // Load colleges first to resolve names
                await this.loadColleges();
                await this.loadDepartments();
                break;
            case 'batches':
                await this.loadColleges();
                await this.loadDepartments();
                await this.loadBatches();
                break;
            case 'students':
                await this.loadColleges();
                await this.loadDepartments();
                await this.loadBatches();
                await this.loadStudents();
                break;
            case 'topics':
                AdminTopics.loadTopics();
                break;
            case 'questions':
                if (Questions.configure) Questions.configure('admin');
                Questions.load();
                break;
            case 'notes':
                AdminNotes.loadNotes();
                break;
        }
    },

    /**
     * Load colleges
     */
    async loadColleges() {
        Utils.showLoading('collegesList');
        try {
            const response = await Utils.apiRequest('/admin/colleges');
            this.colleges = response.data?.colleges || response.colleges || [];
            this.renderColleges();
        } catch (error) {
            console.error('Failed to load colleges:', error);
            Utils.showError('collegesList', 'Failed to load colleges. ' + error.message, () => this.loadColleges());
            Utils.showMessage('adminMessage', 'Failed to load colleges', 'error');
        }
    },

    /**
     * Render colleges
     */
    renderColleges() {
        const container = document.getElementById('collegesList');
        if (!container) return;

        if (!this.colleges || this.colleges.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No colleges found</div>';
            return;
        }

        container.innerHTML = `
            <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.colleges.map(c => `
                        <tr>
                            <td>${Utils.escapeHtml(c.name)}</td>
                            <td>${Utils.escapeHtml(c.email)}</td>
                            <td>
                                ${!c.is_disabled ?
                '<span class="badge badge-success">Enabled</span>' :
                '<span class="badge badge-secondary">Disabled</span>'
            }
                            </td>
                            <td class="flex-gap">
                                <button class="btn btn-sm btn-secondary" onclick="Admin.editCollege('${c.id}')">Edit</button>
                                ${!c.is_disabled ?
                `<button class="btn btn-sm btn-warning" onclick="Admin.disableCollege('${c.id}')">Disable</button>` :
                `<button class="btn btn-sm btn-success" onclick="Admin.enableCollege('${c.id}')">Enable</button>`
            }
                                <button class="btn btn-sm btn-danger" onclick="Admin.deleteCollege('${c.id}')">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        `;
    },

    /**
     * Edit college
     */
    async editCollege(id) {
        try {
            const response = await Utils.apiRequest(`/admin/colleges/${id}`);
            const college = response.data?.college || response.college || {};

            document.getElementById('collegeName').value = college.name || '';
            document.getElementById('collegeEmail').value = college.email || '';
            document.getElementById('collegePassword').value = college.password || '';

            this.editingCollegeId = id;
            document.querySelector('#collegeModal .modal-header h3').textContent = 'Edit College';
            document.querySelector('#collegeModal [type="submit"]').textContent = 'Update College';
            UI.openModal('collegeModal');
        } catch (error) {
            Utils.alert('Failed to load college: ' + error.message);
        }
    },

    /**
     * Delete college
     */
    async deleteCollege(id) {
        if (!Utils.confirm('Delete this college permanently?')) return;

        try {
            await Utils.apiRequest(`/admin/colleges/${id}`, { method: 'DELETE' });
            this.loadColleges();
            Utils.showMessage('adminMessage', 'College deleted', 'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Delete failed: ' + error.message, 'error');
        }
    },

    /**
     * Save college
     */
    async saveCollege() {
        const name = document.getElementById('collegeName').value.trim();
        const email = document.getElementById('collegeEmail').value.trim();
        const password = document.getElementById('collegePassword').value.trim();

        if (!Utils.isValidString(name, 2)) {
            Utils.alert('College name must be at least 2 characters');
            return;
        }

        if (!Utils.isValidEmail(email)) {
            Utils.alert('Please enter a valid email address');
            return;
        }

        if (!Utils.isValidPassword(password)) {
            Utils.alert('Password must be at least 8 characters with letters and numbers');
            return;
        }

        try {
            const payload = { name, email, password };
            const url = this.editingCollegeId
                ? `/admin/colleges/${this.editingCollegeId}`
                : '/admin/colleges';

            const method = this.editingCollegeId ? 'PUT' : 'POST';

            await Utils.apiRequest(url, {
                method,
                body: JSON.stringify(payload)
            });

            this.loadColleges();
            UI.closeModal('collegeModal');
            Utils.showMessage('adminMessage',
                this.editingCollegeId ? 'College updated' : 'College created',
                'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Save failed: ' + error.message, 'error');
        }
    },

    /**
     * Open Add Department Modal (for inline onclick handler)
     */
    openAddDepartmentModal() {
        document.getElementById('departmentName').value = '';
        document.getElementById('departmentCollege').value = '';
        document.getElementById('departmentEmail').value = '';
        document.getElementById('departmentPassword').value = '';
        this.editingDepartmentId = null;
        document.querySelector('#departmentModal .modal-header h3').textContent = 'Add Department';
        document.querySelector('#departmentModal [type="submit"]').textContent = 'Create Department';
        this.populateCollegeSelect('departmentCollege');
        UI.openModal('departmentModal');
    },

    /**
     * Open Add Batch Modal (for inline onclick handler)
     */
    openAddBatchModal() {
        document.getElementById('batchCollege').value = '';
        document.getElementById('batchDepartment').value = '';
        document.getElementById('batchDepartment').disabled = true;
        document.getElementById('batchName').value = '';
        document.getElementById('batchEmail').value = '';
        document.getElementById('batchPassword').value = '';
        this.editingBatchId = null;
        document.querySelector('#batchModal .modal-header h3').textContent = 'Add Batch';
        document.querySelector('#batchModal [type="submit"]').textContent = 'Create Batch';
        this.populateCollegeSelect('batchCollege');
        UI.openModal('batchModal');
    },

    /**
     * Open Add Student Modal (for inline onclick handler)
     */
    openAddStudentModal() {
        document.getElementById('studentCollege').value = '';
        document.getElementById('studentDepartment').value = '';
        document.getElementById('studentDepartment').disabled = true;
        document.getElementById('studentBatch').value = '';
        document.getElementById('studentBatch').disabled = true;
        document.getElementById('studentUsername').value = '';
        document.getElementById('studentEmail').value = '';
        document.getElementById('studentPasswordInput').value = '';
        this.editingStudentId = null;
        document.querySelector('#studentModal .modal-header h3').textContent = 'Add Student';
        document.querySelector('#studentModal [type="submit"]').textContent = 'Create Student';
        this.populateCollegeSelect('studentCollege');
        UI.openModal('studentModal');
    },

    /**
     * Load departments
     */
    async loadDepartments() {
        Utils.showLoading('departmentsList');
        try {
            const response = await Utils.apiRequest('/admin/departments');
            this.departments = response.data?.departments || response.departments || [];
            this.renderDepartments();
        } catch (error) {
            console.error('Failed to load departments:', error);
            Utils.showError('departmentsList', 'Failed to load departments. ' + error.message, () => this.loadDepartments());
            Utils.showMessage('adminMessage', 'Failed to load departments', 'error');
        }
    },

    /**
     * Render departments
     */
    renderDepartments() {
        const container = document.getElementById('departmentsList');
        if (!container) return;

        if (!this.departments || this.departments.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No departments found</div>';
            return;
        }

        container.innerHTML = `
            <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>College</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.departments.map(d => `
                        <tr>
                            <td>${Utils.escapeHtml(d.name)}</td>
                            <td>${Utils.escapeHtml(this.findCollegeNameById(d.college_id) || 'N/A')}</td>
                            <td>${Utils.escapeHtml(d.email || 'N/A')}</td>
                            <td>
                                ${!d.is_disabled ?
                '<span class="badge badge-success">Enabled</span>' :
                '<span class="badge badge-secondary">Disabled</span>'
            }
                            </td>
                            <td class="flex-gap">
                                <button class="btn btn-sm btn-secondary" onclick="Admin.editDepartment('${d.id}')">Edit</button>
                                ${!d.is_disabled ?
                `<button class="btn btn-sm btn-warning" onclick="Admin.disableDepartment('${d.id}')">Disable</button>` :
                `<button class="btn btn-sm btn-success" onclick="Admin.enableDepartment('${d.id}')">Enable</button>`
            }
                                <button class="btn btn-sm btn-danger" onclick="Admin.deleteDepartment('${d.id}')">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        `;
    },

    /**
     * Edit department
     */
    async editDepartment(id) {
        try {
            const response = await Utils.apiRequest(`/admin/departments/${id}`);
            const dept = response.data?.department || response.department || {};

            // Populate colleges first
            await this.loadColleges();
            this.populateCollegeSelect('departmentCollege');

            document.getElementById('departmentName').value = dept.name || '';
            document.getElementById('departmentCollege').value = dept.college_id || '';
            document.getElementById('departmentEmail').value = dept.email || '';
            document.getElementById('departmentPassword').value = dept.password || '';

            this.editingDepartmentId = id;
            document.querySelector('#departmentModal .modal-header h3').textContent = 'Edit Department';
            document.querySelector('#departmentModal [type="submit"]').textContent = 'Update Department';
            UI.openModal('departmentModal');
        } catch (error) {
            Utils.alert('Failed to load department: ' + error.message);
        }
    },

    /**
     * Delete department
     */
    async deleteDepartment(id) {
        if (!Utils.confirm('Delete this department permanently?')) return;

        try {
            await Utils.apiRequest(`/admin/departments/${id}`, { method: 'DELETE' });
            this.loadDepartments();
            Utils.showMessage('adminMessage', 'Department deleted', 'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Delete failed: ' + error.message, 'error');
        }
    },

    /**
     * Save department
     */
    async saveDepartment() {
        const name = document.getElementById('departmentName').value.trim();
        const collegeId = document.getElementById('departmentCollege').value.trim();
        const email = document.getElementById('departmentEmail').value.trim();
        const password = document.getElementById('departmentPassword').value.trim();

        if (!Utils.isValidString(name, 2)) {
            Utils.alert('Department name must be at least 2 characters');
            return;
        }

        if (!collegeId) {
            Utils.alert('Please select a college');
            return;
        }

        if (!Utils.isValidEmail(email)) {
            Utils.alert('Please enter a valid email address');
            return;
        }

        if (!Utils.isValidPassword(password)) {
            Utils.alert('Password must be at least 8 characters with letters and numbers');
            return;
        }

        try {
            const payload = { name, college_id: collegeId, email, password };
            const url = this.editingDepartmentId
                ? `/admin/departments/${this.editingDepartmentId}`
                : '/admin/departments';

            const method = this.editingDepartmentId ? 'PUT' : 'POST';

            await Utils.apiRequest(url, {
                method,
                body: JSON.stringify(payload)
            });

            this.loadDepartments();
            UI.closeModal('departmentModal');
            Utils.showMessage('adminMessage',
                this.editingDepartmentId ? 'Department updated' : 'Department created',
                'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Save failed: ' + error.message, 'error');
        }
    },

    /**
     * Load batches
     */
    async loadBatches() {
        Utils.showLoading('batchesList');
        try {
            const response = await Utils.apiRequest('/admin/batches');
            this.batches = response.data?.batches || response.batches || [];
            this.renderBatches();
        } catch (error) {
            console.error('Failed to load batches:', error);
            Utils.showError('batchesList', 'Failed to load batches. ' + error.message, () => this.loadBatches());
            Utils.showMessage('adminMessage', 'Failed to load batches', 'error');
        }
    },

    /**
     * Render batches
     */
    renderBatches() {
        const container = document.getElementById('batchesList');
        if (!container) return;

        if (!this.batches || this.batches.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No batches found</div>';
            return;
        }

        container.innerHTML = `
            <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Batch Name</th>
                        <th>College</th>
                        <th>Department</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.batches.map(b => `
                        <tr>
                            <td>${Utils.escapeHtml(b.batch_name || 'N/A')}</td>
                            <td>${Utils.escapeHtml(this.findCollegeNameById(b.college_id) || 'N/A')}</td>
                            <td>${Utils.escapeHtml(this.findDepartmentNameById(b.department_id) || 'N/A')}</td>
                            <td>${Utils.escapeHtml(b.email || 'N/A')}</td>
                            <td>
                                ${!b.is_disabled ?
                '<span class="badge badge-success">Enabled</span>' :
                '<span class="badge badge-secondary">Disabled</span>'
            }
                            </td>
                            <td class="flex-gap">
                                <button class="btn btn-sm btn-secondary" onclick="Admin.editBatch('${b.id}')">Edit</button>
                                ${!b.is_disabled ?
                `<button class="btn btn-sm btn-warning" onclick="Admin.disableBatch('${b.id}')">Disable</button>` :
                `<button class="btn btn-sm btn-success" onclick="Admin.enableBatch('${b.id}')">Enable</button>`
            }
                                <button class="btn btn-sm btn-danger" onclick="Admin.deleteBatch('${b.id}')">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        `;
    },

    /**
     * Edit batch
     */
    async editBatch(id) {
        try {
            const response = await Utils.apiRequest(`/admin/batches/${id}`);
            const batch = response.data?.batch || response.batch || {};

            // Populate colleges and departments
            this.populateCollegeSelect('batchCollege');
            await this.loadDepartments();

            // Set college value and trigger department filter
            document.getElementById('batchCollege').value = batch.college_id || '';
            this.onBatchCollegeChange();

            // Now set department value
            setTimeout(() => {
                document.getElementById('batchDepartment').value = batch.department_id || '';
            }, 10);

            document.getElementById('batchName').value = batch.batch_name || '';
            document.getElementById('batchEmail').value = batch.email || '';
            document.getElementById('batchPassword').value = batch.password || '';

            this.editingBatchId = id;
            document.querySelector('#batchModal .modal-header h3').textContent = 'Edit Batch';
            document.querySelector('#batchModal [type="submit"]').textContent = 'Update Batch';
            UI.openModal('batchModal');
        } catch (error) {
            Utils.alert('Failed to load batch: ' + error.message);
        }
    },

    /**
     * Delete batch
     */
    async deleteBatch(id) {
        if (!Utils.confirm('Delete this batch permanently?')) return;

        try {
            await Utils.apiRequest(`/admin/batches/${id}`, { method: 'DELETE' });
            this.loadBatches();
            Utils.showMessage('adminMessage', 'Batch deleted', 'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Delete failed: ' + error.message, 'error');
        }
    },

    /**
     * Save batch
     */
    async saveBatch() {
        const collegeId = document.getElementById('batchCollege').value;
        const departmentId = document.getElementById('batchDepartment').value;
        const name = document.getElementById('batchName').value.trim();
        const email = document.getElementById('batchEmail').value.trim();
        const password = document.getElementById('batchPassword').value.trim();

        if (!collegeId) {
            Utils.alert('Please select a college');
            return;
        }

        if (!departmentId) {
            Utils.alert('Please select a department');
            return;
        }

        if (!Utils.isValidString(name, 2)) {
            Utils.alert('Batch name must be at least 2 characters');
            return;
        }

        if (!Utils.isValidEmail(email)) {
            Utils.alert('Please enter a valid email address');
            return;
        }

        if (!Utils.isValidPassword(password)) {
            Utils.alert('Password must be at least 8 characters with letters and numbers');
            return;
        }

        // Get department to extract college_id
        const department = this.departments.find(d => d.id === departmentId);
        if (!department || !department.college_id) {
            Utils.alert('Invalid department selected');
            return;
        }

        try {
            const payload = {
                batch_name: name,
                department_id: departmentId,
                college_id: department.college_id,
                email,
                password
            };
            const url = this.editingBatchId
                ? `/admin/batches/${this.editingBatchId}`
                : '/admin/batches';

            const method = this.editingBatchId ? 'PUT' : 'POST';

            await Utils.apiRequest(url, {
                method,
                body: JSON.stringify(payload)
            });

            this.loadBatches();
            UI.closeModal('batchModal');
            Utils.showMessage('adminMessage',
                this.editingBatchId ? 'Batch updated' : 'Batch created',
                'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Save failed: ' + error.message, 'error');
        }
    },

    /**
     * Load students
     */
    async loadStudents() {
        Utils.showLoading('adminStudentsList');
        try {
            const response = await Utils.apiRequest('/admin/students');
            this.students = response.data?.students || response.students || [];
            this.renderStudents();
        } catch (error) {
            console.error('Failed to load students:', error);
            Utils.showError('adminStudentsList', 'Failed to load students. ' + error.message, () => this.loadStudents());
            Utils.showMessage('adminMessage', 'Failed to load students', 'error');
        }
    },

    /**
     * Render students
     */
    renderStudents() {
        const container = document.getElementById('adminStudentsList');
        if (!container) return;

        if (!this.students || this.students.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No students found</div>';
            return;
        }

        container.innerHTML = `
            <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>College</th>
                        <th>Department</th>
                        <th>Batch</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.students.map(s => `
                        <tr>
                            <td><a href="#" onclick="StudentProfileViewer.open('${s.id}'); return false;" style="color: var(--primary-500); text-decoration: none; font-weight: 500;">${Utils.escapeHtml(s.username || s.name || 'N/A')}</a></td>
                            <td>${Utils.escapeHtml(s.email || 'N/A')}</td>
                            <td>${Utils.escapeHtml(this.findCollegeNameById(s.college_id) || 'N/A')}</td>
                            <td>${Utils.escapeHtml(this.findDepartmentNameById(s.department_id) || 'N/A')}</td>
                            <td>${Utils.escapeHtml(this.findBatchNameById(s.batch_id) || 'N/A')}</td>
                            <td>
                                ${!s.is_disabled ?
                '<span class="badge badge-success">Enabled</span>' :
                '<span class="badge badge-secondary">Disabled</span>'
            }
                            </td>
                            <td class="flex-gap">
                                <button class="btn btn-sm btn-secondary" onclick="Admin.editStudent('${s.id}')">Edit</button>
                                ${!s.is_disabled ?
                '<button class="btn btn-sm btn-warning" onclick="Admin.disableStudent(\'' + s.id + '\')">Disable</button>' :
                '<button class="btn btn-sm btn-success" onclick="Admin.enableStudent(\'' + s.id + '\')">Enable</button>'
            }
                                <button class="btn btn-sm btn-danger" onclick="Admin.deleteStudent('${s.id}')">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        `;
    },

    /**
     * Edit student
     */
    async editStudent(id) {
        try {
            const response = await Utils.apiRequest(`/admin/students/${id}`);
            const student = response.data?.student || response.student || {};

            // Load all necessary data
            this.populateCollegeSelect('studentCollege');
            await this.loadDepartments();
            await this.loadBatches();

            // Set college value and trigger department filter
            document.getElementById('studentCollege').value = student.college_id || '';
            this.onStudentCollegeChange();

            // Set department value and trigger batch filter
            setTimeout(() => {
                document.getElementById('studentDepartment').value = student.department_id || '';
                this.onStudentDepartmentChange();

                // Now set batch value
                setTimeout(() => {
                    document.getElementById('studentBatch').value = student.batch_id || '';
                }, 10);
            }, 10);

            document.getElementById('studentId').value = student.id || '';
            document.getElementById('studentUsername').value = student.username || '';
            document.getElementById('studentEmail').value = student.email || '';
            document.getElementById('studentPasswordInput').value = '';

            this.editingStudentId = id;
            document.querySelector('#studentModal .modal-header h3').textContent = 'Edit Student';
            document.querySelector('#studentModal [type="submit"]').textContent = 'Update Student';
            UI.openModal('studentModal');
        } catch (error) {
            Utils.alert('Failed to load student: ' + error.message);
        }
    },

    /**
     * Delete student
     */
    async deleteStudent(id) {
        if (!Utils.confirm('Delete this student permanently? This action cannot be undone.')) return;

        try {
            await Utils.apiRequest(`/admin/students/${id}`, { method: 'DELETE' });
            this.loadStudents();
            Utils.showMessage('adminMessage', 'Student deleted permanently', 'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Delete failed: ' + error.message, 'error');
        }
    },

    /**
     * Disable student
     */
    async disableStudent(id) {
        if (!Utils.confirm('Disable this student? They will not be able to log in.')) return;

        try {
            await Utils.apiRequest(`/admin/students/${id}/disable`, { method: 'POST' });
            this.loadStudents();
            Utils.showMessage('adminMessage', 'Student disabled', 'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Disable failed: ' + error.message, 'error');
        }
    },

    /**
     * Enable student
     */
    async enableStudent(id) {
        try {
            await Utils.apiRequest(`/admin/students/${id}/enable`, { method: 'POST' });
            this.loadStudents();
            Utils.showMessage('adminMessage', 'Student enabled', 'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Enable failed: ' + error.message, 'error');
        }
    },

    /**
     * Save student
     */
    async saveStudent() {
        const username = document.getElementById('studentUsername').value.trim();
        const email = document.getElementById('studentEmail').value.trim();
        const collegeId = document.getElementById('studentCollege').value;
        const departmentId = document.getElementById('studentDepartment').value;
        const batchId = document.getElementById('studentBatch').value;
        const password = document.getElementById('studentPasswordInput').value.trim();

        if (!Utils.isValidString(username, 2)) {
            Utils.alert('Username must be at least 2 characters');
            return;
        }

        if (!Utils.isValidEmail(email)) {
            Utils.alert('Please enter a valid email address');
            return;
        }

        if (!collegeId) {
            Utils.alert('Please select a college');
            return;
        }

        if (!departmentId) {
            Utils.alert('Please select a department');
            return;
        }

        if (!batchId) {
            Utils.alert('Please select a batch');
            return;
        }

        // Validate college exists
        const college = this.colleges.find(c => c.id === collegeId);
        if (!college || college.is_disabled) {
            Utils.alert('Invalid college selected');
            return;
        }

        // Validate department exists and belongs to college
        const department = this.departments.find(d => d.id === departmentId && d.college_id === collegeId);
        if (!department || department.is_disabled) {
            Utils.alert('Invalid department selected');
            return;
        }

        // Validate batch exists and belongs to department
        const batch = this.batches.find(b => b.id === batchId && b.department_id === departmentId);
        if (!batch || batch.is_disabled) {
            Utils.alert('Invalid batch selected');
            return;
        }

        try {
            const payload = {
                username,
                email,
                batch_id: batchId,
                department_id: departmentId,
                college_id: collegeId
            };
            if (password) {
                payload.password = password;
            }

            const url = this.editingStudentId
                ? `/admin/students/${this.editingStudentId}`
                : '/admin/students';

            const method = this.editingStudentId ? 'PUT' : 'POST';

            const response = await Utils.apiRequest(url, {
                method,
                body: JSON.stringify(payload)
            });

            // Show generated password for new students
            if (!this.editingStudentId && response.data?.password) {
                Utils.alert(`Student created successfully! Generated password: ${response.data.password}`);
            }

            this.loadStudents();
            UI.closeModal('studentModal');
            Utils.showMessage('adminMessage',
                this.editingStudentId ? 'Student updated' : 'Student created',
                'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Save failed: ' + error.message, 'error');
        }
    },

    /**
     * Populate batch select dropdown
     */
    /**
     * Populate College dropdown (for Department creation/edit)
     */
    populateCollegeSelect(selectElementId = 'departmentCollege') {
        const select = document.getElementById(selectElementId);
        if (!select) return;

        select.innerHTML = '<option value="">Select College</option>';

        if (!this.colleges || this.colleges.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No colleges available';
            option.disabled = true;
            select.appendChild(option);
            return;
        }

        this.colleges.forEach(college => {
            if (!college.is_disabled) {
                const option = document.createElement('option');
                option.value = college.id;
                option.textContent = Utils.escapeHtml(college.name);
                select.appendChild(option);
            }
        });
    },

    /**
     * Populate Department dropdown (for Batch creation/edit)
     */
    populateDepartmentSelect(selectElementId = 'batchDepartment') {
        const select = document.getElementById(selectElementId);
        if (!select) return;

        select.innerHTML = '<option value="">Select Department</option>';

        if (!this.departments || this.departments.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No departments available';
            option.disabled = true;
            select.appendChild(option);
            return;
        }

        this.departments.forEach(dept => {
            if (!dept.is_disabled) {
                const option = document.createElement('option');
                option.value = dept.id;
                option.textContent = Utils.escapeHtml(dept.name);
                select.appendChild(option);
            }
        });
    },

    /**
     * Handle college change in batch modal - filter departments by college
     */
    onBatchCollegeChange() {
        const collegeId = document.getElementById('batchCollege').value;
        const departmentSelect = document.getElementById('batchDepartment');

        if (!collegeId) {
            departmentSelect.innerHTML = '<option value="">Select College First</option>';
            departmentSelect.disabled = true;
            return;
        }

        departmentSelect.disabled = false;
        departmentSelect.innerHTML = '<option value="">Select Department</option>';

        const filteredDepts = this.departments.filter(d =>
            d.college_id === collegeId && !d.is_disabled
        );

        if (filteredDepts.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No departments for this college';
            option.disabled = true;
            departmentSelect.appendChild(option);
            return;
        }

        filteredDepts.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = Utils.escapeHtml(dept.name);
            departmentSelect.appendChild(option);
        });
    },

    /**
     * Handle college change in student modal - filter departments by college
     */
    onStudentCollegeChange() {
        const collegeId = document.getElementById('studentCollege').value;
        const departmentSelect = document.getElementById('studentDepartment');
        const batchSelect = document.getElementById('studentBatch');

        if (!collegeId) {
            departmentSelect.innerHTML = '<option value="">Select College First</option>';
            departmentSelect.disabled = true;
            batchSelect.innerHTML = '<option value="">Select Department First</option>';
            batchSelect.disabled = true;
            return;
        }

        departmentSelect.disabled = false;
        departmentSelect.innerHTML = '<option value="">Select Department</option>';
        batchSelect.innerHTML = '<option value="">Select Department First</option>';
        batchSelect.disabled = true;

        const filteredDepts = this.departments.filter(d =>
            d.college_id === collegeId && !d.is_disabled
        );

        if (filteredDepts.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No departments for this college';
            option.disabled = true;
            departmentSelect.appendChild(option);
            return;
        }

        filteredDepts.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = Utils.escapeHtml(dept.name);
            departmentSelect.appendChild(option);
        });
    },

    /**
     * Handle department change in student modal - filter batches by department
     */
    onStudentDepartmentChange() {
        const departmentId = document.getElementById('studentDepartment').value;
        const batchSelect = document.getElementById('studentBatch');

        if (!departmentId) {
            batchSelect.innerHTML = '<option value="">Select Department First</option>';
            batchSelect.disabled = true;
            return;
        }

        batchSelect.disabled = false;
        batchSelect.innerHTML = '<option value="">Select Batch</option>';

        const filteredBatches = this.batches.filter(b =>
            b.department_id === departmentId && !b.is_disabled
        );

        if (filteredBatches.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No batches for this department';
            option.disabled = true;
            batchSelect.appendChild(option);
            return;
        }

        filteredBatches.forEach(batch => {
            const option = document.createElement('option');
            option.value = batch.id;
            option.textContent = Utils.escapeHtml(batch.batch_name);
            batchSelect.appendChild(option);
        });
    },

    /**
     * Populate Batch dropdown (for Student creation/edit)
     */
    populateStudentBatchSelect() {
        const select = document.getElementById('studentBatch');
        if (!select) return;

        select.innerHTML = '<option value="">Select Batch</option>';

        if (!this.batches || this.batches.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No batches available';
            option.disabled = true;
            select.appendChild(option);
            return;
        }

        this.batches.forEach(batch => {
            if (!batch.is_disabled) {
                const option = document.createElement('option');
                option.value = batch.id;
                option.textContent = `${Utils.escapeHtml(batch.batch_name)} (${Utils.escapeHtml(batch.department_name)})`;
                select.appendChild(option);
            }
        });
    },

    // ============================================================================
    // CASCADING DISABLE/ENABLE METHODS
    // ============================================================================

    /**
     * Disable college (cascades to all departments, batches, students)
     */
    async disableCollege(id) {
        const msg = 'Disable this college? All departments, batches, and students will be disabled and cannot login.';
        if (!Utils.confirm(msg)) return;

        try {
            await Utils.apiRequest(`/admin/colleges/${id}/disable`, { method: 'POST' });
            this.loadColleges();
            Utils.showMessage('adminMessage', 'College and all related entities disabled', 'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Disable failed: ' + error.message, 'error');
        }
    },

    /**
     * Enable college (cascades to all departments, batches, students)
     */
    async enableCollege(id) {
        if (!Utils.confirm('Enable this college? All departments, batches, and students will be enabled.')) return;

        try {
            await Utils.apiRequest(`/admin/colleges/${id}/enable`, { method: 'POST' });
            this.loadColleges();
            Utils.showMessage('adminMessage', 'College and all related entities enabled', 'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Enable failed: ' + error.message, 'error');
        }
    },

    /**
     * Disable department (cascades to all batches and students)
     */
    async disableDepartment(id) {
        const msg = 'Disable this department? All batches and students will be disabled and cannot login.';
        if (!Utils.confirm(msg)) return;

        try {
            await Utils.apiRequest(`/admin/departments/${id}/disable`, { method: 'POST' });
            this.loadDepartments();
            Utils.showMessage('adminMessage', 'Department and all related entities disabled', 'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Disable failed: ' + error.message, 'error');
        }
    },

    /**
     * Enable department (cascades to all batches and students)
     */
    async enableDepartment(id) {
        if (!Utils.confirm('Enable this department? All batches and students will be enabled.')) return;

        try {
            await Utils.apiRequest(`/admin/departments/${id}/enable`, { method: 'POST' });
            this.loadDepartments();
            Utils.showMessage('adminMessage', 'Department and all related entities enabled', 'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Enable failed: ' + error.message, 'error');
        }
    },

    /**
     * Disable batch (cascades to all students)
     */
    async disableBatch(id) {
        const msg = 'Disable this batch? All students in this batch will be disabled and cannot login.';
        if (!Utils.confirm(msg)) return;

        try {
            await Utils.apiRequest(`/admin/batches/${id}/disable`, { method: 'POST' });
            this.loadBatches();
            Utils.showMessage('adminMessage', 'Batch and all students disabled', 'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Disable failed: ' + error.message, 'error');
        }
    },

    /**
     * Enable batch (cascades to all students)
     */
    async enableBatch(id) {
        if (!Utils.confirm('Enable this batch? All students in this batch will be enabled.')) return;

        try {
            await Utils.apiRequest(`/admin/batches/${id}/enable`, { method: 'POST' });
            this.loadBatches();
            Utils.showMessage('adminMessage', 'Batch and all students enabled', 'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Enable failed: ' + error.message, 'error');
        }
    }
};
