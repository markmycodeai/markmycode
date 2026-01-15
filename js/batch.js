/**
 * Batch Module - Batch admin functionality for managing students
 */

const Batch = {
    students: [],
    questions: [],
    activeTab: 'students',
    editingStudentId: null,

    /**
     * Load batch dashboard
     */
    async load() {
        try {
            this.activeTab = 'students';
            this.setupTabHandlers();
            this.loadStudents();
        } catch (error) {
            console.error('Batch load error:', error);
            Utils.showMessage('batchMessage', 'Failed to load batch panel', 'error');
        }
    },

    /**
     * Setup tab click handlers
     */
    setupTabHandlers() {
        const tabs = document.querySelectorAll('[data-batch-tab]');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = tab.getAttribute('data-batch-tab');
                this.switchTab(tabName);
            });
        });
    },

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        // Hide all content
        document.querySelectorAll('[data-batch-content]').forEach(el => {
            el.style.display = 'none';
        });

        // Deactivate all tabs
        document.querySelectorAll('[data-batch-tab]').forEach(el => {
            el.classList.remove('active');
        });

        // Show selected content
        const content = document.querySelector(`[data-batch-content="${tabName}"]`);
        if (content) {
            content.style.display = 'block';
        }

        // Activate selected tab
        const tab = document.querySelector(`[data-batch-tab="${tabName}"]`);
        if (tab) {
            tab.classList.add('active');
        }

        this.activeTab = tabName;

        // Load data for tab
        if (tabName === 'students') {
            this.loadStudents();
        } else if (tabName === 'questions') {
            if (Questions.configure) Questions.configure('batch');
            Questions.load();
        }
    },

    /**
     * Load students for this batch
     */
    async loadStudents() {
        Utils.showLoading('batchStudentsList');
        try {
            const response = await Utils.apiRequest('/batch/students');
            this.students = response.data?.students || response.students || [];
            this.renderStudents();
        } catch (error) {
            console.error('Load students error:', error);
            Utils.showError('batchStudentsList', 'Failed to load students. ' + error.message, () => this.loadStudents());
            Utils.showMessage('batchMessage', 'Failed to load students', 'error');
        }
    },

    /**
     * Load questions for this batch
     */
    async loadQuestions() {
        Utils.showLoading('batchQuestionsList');
        try {
            const response = await Utils.apiRequest('/batch/questions');
            this.questions = response.data?.questions || response.questions || [];
            this.renderQuestions();
        } catch (error) {
            console.error('Load questions error:', error);
            Utils.showError('batchQuestionsList', 'Failed to load questions. ' + error.message, () => this.loadQuestions());
            Utils.showMessage('batchMessage', 'Failed to load questions', 'error');
        }
    },

    /**
     * Render students table
     */
    renderStudents() {
        const container = document.getElementById('batchStudentsList');
        if (!container) return;

        if (!this.students || this.students.length === 0) {
            container.innerHTML = '<div class="text-center text-secondary">No students found</div>';
            return;
        }

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.students.map(s => `
                        <tr>
                            <td><a href="#" onclick="StudentProfileViewer.open('${s.id}'); return false;" style="color: #3b82f6; text-decoration: none; font-weight: 500;">${Utils.escapeHtml(s.username || s.name || 'N/A')}</a></td>
                            <td>${Utils.escapeHtml(s.email)}</td>
                            <td>
                                ${s.is_active ?
                '<span class="badge badge-success">Active</span>' :
                '<span class="badge badge-secondary">Inactive</span>'
            }
                            </td>
                            <td class="flex-gap">
                                <button class="btn btn-sm btn-secondary" onclick="Batch.editStudent('${s.id}')">Edit</button>
                                <button class="btn btn-sm btn-${s.is_active ? 'warning' : 'success'}" 
                                    onclick="Batch.toggleStudent('${s.id}')">
                                    ${s.is_active ? 'Disable' : 'Enable'}
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="Batch.deleteStudent('${s.id}')">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    /**
     * Render questions table
     */
    renderQuestions() {
        const container = document.getElementById('batchQuestionsList');
        if (!container) return;

        if (!this.questions || this.questions.length === 0) {
            container.innerHTML = '<div class="text-center text-secondary">No questions found</div>';
            return;
        }

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Topic</th>
                        <th>Difficulty</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.questions.map(q => `
                        <tr>
                            <td>${Utils.escapeHtml(q.title)}</td>
                            <td>${Utils.escapeHtml(q.topic || 'N/A')}</td>
                            <td><span class="badge badge-info">${Utils.escapeHtml(q.difficulty)}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    /**
     * Open add student modal
     */
    openAddStudentModal() {
        this.editingStudentId = null;
        this.resetStudentForm();
        document.querySelector('#batchStudentModal .modal-header h3').textContent = 'Add Student';
        document.querySelector('#batchStudentModal [type="submit"]').textContent = 'Create Student';
        document.getElementById('batchStudentPassword').style.display = 'block';
        document.getElementById('batchStudentPassword').required = true;
        UI.openModal('batchStudentModal');
    },

    /**
     * Edit student
     */
    async editStudent(id) {
        try {
            const response = await Utils.apiRequest(`/batch/students/${id}`);
            const student = response.data?.student || response.student || {};

            document.getElementById('batchStudentName').value = student.name || student.username || '';
            document.getElementById('batchStudentEmail').value = student.email || '';

            // Allow password update
            const pwInput = document.getElementById('batchStudentPassword');
            pwInput.style.display = 'block';
            pwInput.required = false;
            pwInput.value = '';
            pwInput.placeholder = 'Enter new password to change (optional)';

            this.editingStudentId = id;
            document.querySelector('#batchStudentModal .modal-header h3').textContent = 'Edit Student';
            document.querySelector('#batchStudentModal [type="submit"]').textContent = 'Update Student';
            UI.openModal('batchStudentModal');
        } catch (error) {
            Utils.alert('Failed to load student: ' + error.message);
        }
    },

    /**
     * Save student (create or update)
     */
    async saveStudent() {
        try {
            const username = document.getElementById('batchStudentName').value.trim();
            const email = document.getElementById('batchStudentEmail').value.trim();
            const password = document.getElementById('batchStudentPassword').value.trim();

            if (!username || !email) {
                Utils.showMessage('batchStudentsMessage', 'Username and email are required', 'error');
                return;
            }

            let url = '/batch/students';
            let method = 'POST';
            let body = { username, email };

            if (this.editingStudentId) {
                url += `/${this.editingStudentId}`;
                method = 'PUT';
                if (password) {
                    body.password = password;
                }
            } else {
                if (!password) {
                    Utils.showMessage('batchStudentsMessage', 'Password is required for new students', 'error');
                    return;
                }
                body.password = password;
            }

            await Utils.apiRequest(url, {
                method,
                body: JSON.stringify(body)
            });

            UI.closeModal('batchStudentModal');
            this.loadStudents();
            Utils.showMessage('batchMessage',
                this.editingStudentId ? 'Student updated successfully' : 'Student created successfully',
                'success');
        } catch (error) {
            Utils.showMessage('batchStudentsMessage', 'Save failed: ' + error.message, 'error');
        }
    },

    /**
     * Toggle student active/inactive
     */
    async toggleStudent(id) {
        try {
            const student = this.students.find(s => s.id === id);
            const newStatus = !student.is_active;

            await Utils.apiRequest(`/batch/students/${id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ is_active: newStatus })
            });

            this.loadStudents();
            Utils.showMessage('batchMessage',
                newStatus ? 'Student enabled' : 'Student disabled',
                'success');
        } catch (error) {
            Utils.showMessage('batchMessage', 'Toggle failed: ' + error.message, 'error');
        }
    },

    /**
     * Delete student
     */
    async deleteStudent(id) {
        if (!confirm('Are you sure you want to delete this student?')) {
            return;
        }

        try {
            await Utils.apiRequest(`/batch/students/${id}`, {
                method: 'DELETE'
            });

            this.loadStudents();
            Utils.showMessage('batchMessage', 'Student deleted', 'success');
        } catch (error) {
            Utils.showMessage('batchMessage', 'Delete failed: ' + error.message, 'error');
        }
    },

    /**
     * Reset student form
     */
    resetStudentForm() {
        document.getElementById('batchStudentId').value = '';
        document.getElementById('batchStudentName').value = '';
        document.getElementById('batchStudentEmail').value = '';
        document.getElementById('batchStudentPassword').value = '';
        document.getElementById('batchStudentsMessage').innerHTML = '';
    },

    /**
     * Open CSV upload modal
     */
    openCSVModal() {
        document.getElementById('csvFile').value = '';
        document.getElementById('csvMessage').innerHTML = '';
        UI.openModal('csvModal');
    },

    /**
     * Upload students from CSV
     */
    async uploadCSV() {
        try {
            const fileInput = document.getElementById('csvFile');
            const file = fileInput.files[0];

            if (!file) {
                Utils.showMessage('csvMessage', 'Please select a CSV file', 'error');
                return;
            }

            // Read CSV file
            const text = await file.text();
            const lines = text.trim().split('\n');

            if (lines.length < 2) {
                Utils.showMessage('csvMessage', 'CSV must contain header and at least one student', 'error');
                return;
            }

            // Parse CSV
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const nameIndex = headers.indexOf('name');
            const emailIndex = headers.indexOf('email');
            const passwordIndex = headers.indexOf('password');

            if (nameIndex === -1 || emailIndex === -1 || passwordIndex === -1) {
                Utils.showMessage('csvMessage', 'CSV must contain Name, Email, and Password columns', 'error');
                return;
            }

            const students = [];
            for (let i = 1; i < lines.length; i++) {
                const cells = lines[i].split(',').map(c => c.trim());
                if (cells.length > Math.max(nameIndex, emailIndex, passwordIndex)) {
                    students.push({
                        name: cells[nameIndex],
                        email: cells[emailIndex],
                        password: cells[passwordIndex]
                    });
                }
            }

            if (students.length === 0) {
                Utils.showMessage('csvMessage', 'No valid students found in CSV', 'error');
                return;
            }

            // Show progress bar
            this.showUploadProgress(students.length);

            // Upload students
            const response = await Utils.apiRequest('/batch/students/bulk', {
                method: 'POST',
                body: JSON.stringify({ students })
            });

            // Hide progress bar
            this.hideUploadProgress();

            UI.closeModal('csvModal');
            this.loadStudents();
            Utils.showMessage('batchMessage',
                `Successfully added ${response.data?.count || students.length} students from CSV`,
                'success');
        } catch (error) {
            this.hideUploadProgress();
            Utils.showMessage('csvMessage', 'Upload failed: ' + error.message, 'error');
        }
    },

    /**
     * Show upload progress bar
     */
    showUploadProgress(total) {
        const csvMessage = document.getElementById('csvMessage');
        csvMessage.innerHTML = `
            <div style="margin-top: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Uploading students...</span>
                    <span id="progressPercent">0%</span>
                </div>
                <div style="width: 100%; height: 24px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
                    <div id="progressBar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #4CAF50, #45a049); transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">
                        0%
                    </div>
                </div>
                <div style="margin-top: 0.5rem; font-size: 0.9rem; color: #666;">
                    <span id="progressCount">0</span> / <span id="progressTotal">${total}</span> students
                </div>
            </div>
        `;
        this.totalStudents = total;
        this.uploadedStudents = 0;
    },

    /**
     * Hide upload progress bar
     */
    hideUploadProgress() {
        const csvMessage = document.getElementById('csvMessage');
        csvMessage.innerHTML = '';
    },

    /**
     * Update upload progress (called by backend)
     */
    updateUploadProgress(count) {
        this.uploadedStudents = count;
        const percentage = Math.round((count / this.totalStudents) * 100);

        const progressBar = document.getElementById('progressBar');
        const progressPercent = document.getElementById('progressPercent');
        const progressCount = document.getElementById('progressCount');

        if (progressBar) {
            progressBar.style.width = percentage + '%';
            progressBar.textContent = percentage + '%';
        }
        if (progressPercent) {
            progressPercent.textContent = percentage + '%';
        }
        if (progressCount) {
            progressCount.textContent = count;
        }
    }
};
