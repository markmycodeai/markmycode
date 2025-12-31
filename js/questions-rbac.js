/**
 * Questions Module - Role-based Question Management
 * Handles question CRUD operations with role-aware hierarchical selection
 */

const Questions = {
    questions: [],
    editingId: null,
    currentRole: null,
    colleges: [],
    departments: [],
    batches: [],
    topics: [],
    pendingTestCases: null,
    activeAdminPanel: 'list',

    // Configuration for dynamic DOM targeting (admin vs batch)
    config: {
        prefix: 'admin' // default
    },

    /**
     * Configure module context
     */
    configure(prefix) {
        this.config.prefix = prefix;
    },

    /**
     * Initialize questions module
     */
    async init() {
        this.currentRole = Auth.getCurrentUser()?.role || 'student';
    },

    /**
     * Helper: Find college name by ID
     */
    findCollegeNameById(collegeId) {
        if (!collegeId) return 'N/A';
        const college = this.colleges.find(c => c.id === collegeId);
        return college ? (college.college_name || college.name) : 'N/A';
    },

    /**
     * Helper: Find department name by ID
     */
    findDepartmentNameById(departmentId) {
        if (!departmentId) return 'N/A';
        const department = this.departments.find(d => d.id === departmentId);
        return department ? (department.department_name || department.name) : 'N/A';
    },

    /**
     * Helper: Find batch name by ID
     */
    findBatchNameById(batchId) {
        if (!batchId) return 'N/A';
        const batch = this.batches.find(b => b.id === batchId);
        return batch ? (batch.batch_name || batch.name || 'N/A') : 'N/A';
    },

    /**
     * Helper: Find topic name by ID
     */
    findTopicNameById(topicId) {
        if (!topicId) return null;
        const topic = this.topics.find(t => t.id === topicId);
        return topic ? (topic.topic_name || topic.name) : null;
    },

    /**
     * Load questions based on user role
     */
    async load() {
        try {
            await this.init();
            await this.loadQuestions();
        } catch (error) {
            console.error('Questions load error:', error);
            Utils.showMessage('questionsMessage', 'Failed to load questions', 'error');
        }
    },

    /**
     * Load questions from appropriate endpoint
     */
    async loadQuestions() {
        try {
            let url = '/student/questions';
            const user = Auth.getCurrentUser();

            if (user.role === 'admin') {
                url = '/admin/questions';
                await this.loadHierarchyData();
            } else if (user.role === 'college') {
                url = '/college/questions';
            } else if (user.role === 'department') {
                url = '/department/questions';
            } else if (user.role === 'batch') {
                url = '/batch/questions';
                await this.loadHierarchyData();
            }

            const response = await Utils.apiRequest(url);
            this.questions = response.data?.questions || response.questions || [];
            this.render();
        } catch (error) {
            console.error('Load questions error:', error);
            Utils.showMessage('questionsMessage', 'Failed to load questions', 'error');
        }
    },

    /**
     * Load all hierarchy data
     */
    async loadHierarchyData() {
        const user = Auth.getCurrentUser();
        try {
            if (user.role === 'admin') {
                const [collegesRes, deptsRes, batchesRes, topicsRes] = await Promise.all([
                    Utils.apiRequest('/admin/colleges'),
                    Utils.apiRequest('/admin/departments'),
                    Utils.apiRequest('/admin/batches'),
                    Utils.apiRequest('/admin/topics')
                ]);

                this.colleges = collegesRes.data?.colleges || collegesRes.colleges || [];
                this.departments = deptsRes.data?.departments || deptsRes.departments || [];
                this.batches = batchesRes.data?.batches || batchesRes.batches || [];
                this.topics = topicsRes.data?.topics || topicsRes.topics || [];
            } else if (user.role === 'batch') {
                // For batch admin, we only really need topics for the mapping?
                // Or maybe the question itself has the topic_name which is handled in renderAdminList
                const topicsRes = await Utils.apiRequest('/batch/topics');
                this.topics = topicsRes.data?.topics || topicsRes.topics || [];
                // Other fields are not typically needed for batch admin view as they are pre-filtered
                this.colleges = [];
                this.departments = [];
                this.batches = [];
            }
        } catch (error) {
            console.error('Load hierarchy data error:', error);
        }
    },

    /**
     * Render questions table or list
     */
    render() {
        const editPanelId = (this.config.prefix || 'admin') + 'QEditPanel';
        // Also check for legacy ID if prefix is admin
        const legacyId = 'adminQuestionFormPanel';

        const is3Pane = !!document.getElementById(editPanelId) || (this.config.prefix === 'admin' && !!document.getElementById(legacyId));

        if (is3Pane) {
            this.renderAdminList();
        } else {
            this.renderTable();
        }
    },

    /**
     * Render questions as clickable list for admin panel
     */
    renderAdminList() {
        const prefix = this.config.prefix || 'admin';
        const listId = prefix + 'QuestionsList';
        const container = document.getElementById(listId);

        if (!container) return;

        if (!this.questions || this.questions.length === 0) {
            container.innerHTML = '<div style="color: #999; text-align: center; padding: 1rem;">No questions found</div>';
            return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';

        const self = this;
        this.questions.forEach(q => {
            const collegeNm = self.findCollegeNameById(q.college_id);
            const deptName = self.findDepartmentNameById(q.department_id);
            const isSelected = self.editingId === q.id;
            const bgColor = isSelected ? 'background-color: var(--bg-elevated); border-left: 3px solid var(--primary-500);' : 'border-left: 3px solid transparent; background: var(--bg-surface);';
            const hoverStyle = "this.style.background='var(--bg-elevated)'";

            html += '<div style="padding: 0.75rem; border: 1px solid var(--border-subtle); border-radius: 4px; cursor: pointer; ' + bgColor + '" data-qid="' + q.id + '" class="qitem">';
            html += '<div style="font-weight: bold; margin-bottom: 0.25rem; color: var(--text-main);">' + Utils.escapeHtml(q.title) + '</div>';

            // Show topic below title (Requested for batch admin, but good for all)
            const topicName = self.findTopicNameById(q.topic_id) || q.topic_name || 'No Topic';
            html += '<div style="font-size: 0.8rem; color: var(--primary-500); margin-bottom: 0.25rem; font-weight: 500;">' + Utils.escapeHtml(topicName) + '</div>';

            if (collegeNm !== 'N/A' && deptName !== 'N/A') {
                html += '<div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">' + Utils.escapeHtml(collegeNm) + ' > ' + Utils.escapeHtml(deptName) + '</div>';
            }
            html += '<div style="font-size: 0.75rem; color: var(--text-muted);">' + Utils.escapeHtml(q.difficulty || 'Medium') + '</div>';
            html += '</div>';
        });

        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('.qitem').forEach(item => {
            item.addEventListener('click', function () {
                const qid = this.getAttribute('data-qid');
                self.selectForEdit(qid);
            });
        });
    },

    /**
     * Render questions as table
     */
    renderTable() {
        const container = document.getElementById('adminQuestionsList') || document.getElementById('questionsList');
        if (!container) return;

        if (!this.questions || this.questions.length === 0) {
            container.innerHTML = '<div class="text-center text-secondary">No questions found</div>';
            return;
        }

        const user = Auth.getCurrentUser();
        const canManage = ['admin', 'college', 'department', 'batch'].includes(user.role);

        let html = '<div class="table-container"><table class="table"><thead><tr>';
        html += '<th>Title</th><th>College</th><th>Department</th><th>Batch</th><th>Topic</th><th>Difficulty</th>';
        if (canManage) html += '<th>Actions</th>';
        html += '</tr></thead><tbody>';

        const self = this;
        this.questions.forEach(q => {
            html += '<tr>';
            html += '<td>' + Utils.escapeHtml(q.title) + '</td>';
            html += '<td>' + Utils.escapeHtml(self.findCollegeNameById(q.college_id)) + '</td>';
            html += '<td>' + Utils.escapeHtml(self.findDepartmentNameById(q.department_id)) + '</td>';
            html += '<td>' + Utils.escapeHtml(self.findBatchNameById(q.batch_id)) + '</td>';
            html += '<td>' + Utils.escapeHtml(self.findTopicNameById(q.topic_id) || q.topic_name || 'N/A') + '</td>';
            html += '<td><span class="badge badge-info">' + Utils.escapeHtml(q.difficulty || 'Medium') + '</span></td>';
            if (canManage) {
                html += '<td class="flex-gap">';
                html += '<button class="btn btn-sm btn-secondary ebtn" data-qid="' + q.id + '">Edit</button>';
                html += '<button class="btn btn-sm btn-danger dbtn" data-qid="' + q.id + '">Delete</button>';
                html += '</td>';
            }
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        if (canManage) {
            container.querySelectorAll('.ebtn').forEach(btn => {
                btn.addEventListener('click', function () {
                    const qid = this.getAttribute('data-qid');
                    self.edit(qid);
                });
            });

            container.querySelectorAll('.dbtn').forEach(btn => {
                btn.addEventListener('click', function () {
                    const qid = this.getAttribute('data-qid');
                    self.delete(qid);
                });
            });
        }
    },

    /**
     * Select question for editing
     */
    selectForEdit(questionId) {
        const question = this.questions.find(q => q.id === questionId);
        if (!question) return;

        this.editingId = questionId;
        this.renderAdminList();

        // Mobile UX: Switch to Detail View ("Page")
        const grid = document.querySelector('.admin-questions-grid');
        if (grid) {
            grid.classList.add('mobile-details-active');
            // Scroll to top to ensure visibility of the new "page"
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        this.showEditForm(question);
        this.showQuestionDetails(question);
    },

    /**
     * Mobile UX: Go back to list
     */
    backToMobileList() {
        const grid = document.querySelector('.admin-questions-grid');
        if (grid) {
            grid.classList.remove('mobile-details-active');
        }
        this.editingId = null; // Optional: deselect to clear highlight
        this.renderAdminList();
    },

    /**
     * Show edit form
     */
    showEditForm(question) {
        const prefix = this.config.prefix || 'admin';
        const panelId = prefix + 'QEditPanel';
        const container = document.getElementById(panelId) || (prefix === 'admin' ? document.getElementById('adminQuestionFormPanel') : null);

        if (!container) return;

        const user = Auth.getCurrentUser();
        const isAdmin = user.role === 'admin';
        const self = this;
        const formContentId = prefix + 'QEditForm';
        const contentDiv = document.getElementById(formContentId);
        const targetContainer = contentDiv || container;

        let html = '<div class="form-compact" style="background: var(--bg-surface); padding: 1.25rem; border: 1px solid var(--border-subtle); border-radius: 4px;">';

        // Mobile Back Button
        html += '<button type="button" class="btn btn-sm btn-secondary hidden-desktop" style="margin-bottom: 1rem; width: 100%; justify-content: flex-start; text-align: left;" id="' + prefix + 'QMobileBack">← Back to Question List</button>';

        html += '<input type="hidden" id="' + prefix + 'QEditId" value="' + question.id + '" />';

        if (isAdmin) {
            html += '<div class="form-grid-4">';
            html += '<div class="form-group"><label>College:</label>';
            html += '<select id="' + prefix + 'QEditCollege" style="width: 100%; border: 1px solid var(--border-subtle); border-radius: 4px; background: var(--bg-app); color: var(--text-main);">';
            html += '<option value="">-- Select --</option>';
            this.colleges.forEach(c => {
                const sel = c.id === question.college_id ? ' selected' : '';
                html += '<option value="' + c.id + '"' + sel + '>' + Utils.escapeHtml(c.college_name || c.name) + '</option>';
            });
            html += '</select></div>';

            html += '<div class="form-group"><label>Department:</label>';
            html += '<select id="' + prefix + 'QEditDept" style="width: 100%; border: 1px solid var(--border-subtle); border-radius: 4px; background: var(--bg-app); color: var(--text-main);">';
            html += '<option value="">-- Select --</option>';
            this.departments.filter(d => d.college_id === question.college_id).forEach(d => {
                const sel = d.id === question.department_id ? ' selected' : '';
                html += '<option value="' + d.id + '"' + sel + '>' + Utils.escapeHtml(d.department_name || d.name) + '</option>';
            });
            html += '</select></div>';

            html += '<div class="form-group"><label>Batch:</label>';
            html += '<select id="' + prefix + 'QEditBatch" style="width: 100%; border: 1px solid var(--border-subtle); border-radius: 4px; background: var(--bg-app); color: var(--text-main);">';
            html += '<option value="">-- Select --</option>';
            this.batches.filter(b => b.department_id === question.department_id).forEach(b => {
                const sel = b.id === question.batch_id ? ' selected' : '';
                html += '<option value="' + b.id + '"' + sel + '>' + Utils.escapeHtml(b.batch_name) + '</option>';
            });
            html += '</select></div>';

            html += '<div class="form-group"><label>Topic:</label>';
            html += '<select id="' + prefix + 'QEditTopic" style="width: 100%; border: 1px solid var(--border-subtle); border-radius: 4px; background: var(--bg-app); color: var(--text-main);">';
            html += '<option value="">-- Select --</option>';
            this.topics.forEach(t => {
                const sel = t.id === question.topic_id ? ' selected' : '';
                html += '<option value="' + t.id + '"' + sel + '>' + Utils.escapeHtml(t.topic_name || t.name) + '</option>';
            });
            html += '</select></div>';
            html += '</div>'; // End grid
        } else {
            // For non-admin, just topic
            html += '<div class="form-group"><label>Topic:</label>';
            html += '<select id="' + prefix + 'QEditTopic" style="width: 100%; border: 1px solid var(--border-subtle); border-radius: 4px; background: var(--bg-app); color: var(--text-main);">';
            html += '<option value="">-- Select --</option>';
            this.topics.forEach(t => {
                const sel = t.id === question.topic_id ? ' selected' : '';
                html += '<option value="' + t.id + '"' + sel + '>' + Utils.escapeHtml(t.topic_name || t.name) + '</option>';
            });
            html += '</select></div>';
        }


        html += '<div class="form-group"><label>Title:</label>';
        html += '<input type="text" id="' + prefix + 'QEditTitle" value="' + Utils.escapeHtml(question.title) + '" style="width: 100%; border: 1px solid var(--border-subtle); border-radius: 4px; box-sizing: border-box; background: var(--bg-app); color: var(--text-main);" /></div>';

        html += '<div class="form-group"><label>Description:</label>';
        html += '<textarea id="' + prefix + 'QEditDesc" style="width: 100%; border: 1px solid var(--border-subtle); border-radius: 4px; box-sizing: border-box; min-height: 80px; background: var(--bg-app); color: var(--text-main);">' + Utils.escapeHtml(question.description) + '</textarea></div>';

        html += '<div class="form-grid-2">';
        html += '<div class="form-group"><label>Sample Input:</label>';
        html += '<textarea id="' + prefix + 'QEditInput" class="code-textarea" style="width: 100%; border: 1px solid var(--border-subtle); border-radius: 4px; box-sizing: border-box; min-height: 80px;">' + Utils.escapeHtml(question.sample_input) + '</textarea></div>';

        html += '<div class="form-group"><label>Sample Output:</label>';
        html += '<textarea id="' + prefix + 'QEditOutput" class="code-textarea" style="width: 100%; border: 1px solid var(--border-subtle); border-radius: 4px; box-sizing: border-box; min-height: 80px;">' + Utils.escapeHtml(question.sample_output) + '</textarea></div>';
        html += '</div>';

        html += '<div class="form-group"><label>Difficulty:</label>';
        html += '<select id="' + prefix + 'QEditDiff" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-subtle); border-radius: 4px; background: var(--bg-app); color: var(--text-main);">';
        html += '<option value="Easy"' + (question.difficulty === 'Easy' ? ' selected' : '') + '>Easy</option>';
        html += '<option value="Medium"' + (question.difficulty === 'Medium' ? ' selected' : '') + '>Medium</option>';
        html += '<option value="Hard"' + (question.difficulty === 'Hard' ? ' selected' : '') + '>Hard</option>';
        html += '</select></div>';

        html += '<div id="' + prefix + 'QEditMessage" style="margin-bottom: 0.75rem;"></div>';
        html += '<div style="display: flex; gap: 0.5rem; margin-top: 1rem;"><button class="btn btn-primary" id="' + prefix + 'QSave" style="flex: 2;">Save Changes</button>';
        html += '<button class="btn btn-danger btn-icon" id="' + prefix + 'QDel" style="flex: 1;">Delete</button></div></div>';

        targetContainer.innerHTML = html;

        document.getElementById(prefix + 'QSave').addEventListener('click', function () { self.saveAdminQuestionInline(); });
        document.getElementById(prefix + 'QDel').addEventListener('click', function () { self.deleteConfirmAdminPanel(); });

        // Mobile Back Button Listener
        const backBtn = document.getElementById(prefix + 'QMobileBack');
        if (backBtn) {
            backBtn.addEventListener('click', function () { self.backToMobileList(); });
        }

        if (isAdmin) {
            document.getElementById(prefix + 'QEditCollege').addEventListener('change', function () { self.onAdminQEditCollegeChange(); });
            document.getElementById(prefix + 'QEditDept').addEventListener('change', function () { self.onAdminQEditDeptChange(); });
        }
    },

    /**
     * Show question details
     */
    showQuestionDetails(question) {
        const prefix = this.config.prefix || 'admin';
        const panelId = prefix + 'QDetailsPanel';
        // Fallback
        const container = document.getElementById(panelId) || (prefix === 'admin' ? document.getElementById('adminQuestionDetailPanel') : null);

        if (!container) return;

        // Find content container if exists
        const contentId = prefix + 'QDetailsContent';
        const targetContainer = document.getElementById(contentId) || container;

        const topicName = this.findTopicNameById(question.topic_id);
        const hiddenTestcases = question.hidden_testcases || [];
        const self = this;

        let html = '<div style="padding: 0; background: var(--bg-surface); border-radius: 4px; max-height: 600px; overflow-y: auto;">';

        // Header
        html += '<div style="padding: 1rem;"><h4 style="margin: 0 0 0.75rem 0; color: var(--text-main);">' + Utils.escapeHtml(question.title) + '</h4>';
        html += '<div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">';
        html += '<span style="background: rgba(99, 102, 241, 0.1); color: var(--primary-500); padding: 0.35rem 0.75rem; border-radius: 20px; font-size: 0.85rem;">' + Utils.escapeHtml(topicName) + '</span>';
        html += '<span style="background: rgba(245, 158, 11, 0.1); color: var(--warning); padding: 0.35rem 0.75rem; border-radius: 20px; font-size: 0.85rem;">' + Utils.escapeHtml(question.difficulty || 'Medium') + '</span>';
        html += '</div></div>';

        // Open Test Cases (Sample Input/Output)
        html += '<div style="border-top: 1px solid var(--border-subtle); padding: 1rem;"><h5 style="margin: 0 0 0.75rem 0; color: var(--text-muted); font-size: 0.9rem;">Open Test Case (Sample):</h5>';
        html += '<div class="generated-test-case-box" style="padding: 0.75rem; border-radius: 4px; font-size: 0.85rem;">';
        html += '<div style="margin-bottom: 0.5rem;"><strong>Input:</strong><br>' + Utils.escapeHtml(question.sample_input) + '</div>';
        html += '<div><strong>Output:</strong><br>' + Utils.escapeHtml(question.sample_output) + '</div></div></div>';

        // Hidden Test Cases
        html += '<div style="border-top: 1px solid var(--border-subtle); padding: 1rem;">';
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">';
        html += '<h5 style="margin: 0; color: var(--success); font-size: 0.9rem;">Hidden Test Cases (' + hiddenTestcases.length + ')</h5>';
        html += '<button id="' + prefix + 'QAddTest" class="btn btn-sm btn-primary" style="font-size: 0.85rem;">+ Add</button>';
        html += '</div>';

        if (hiddenTestcases && hiddenTestcases.length > 0) {
            html += '<div style="display: grid; gap: 0.75rem; max-height: 400px; overflow-y: auto;">';
            hiddenTestcases.forEach((tc, idx) => {
                html += '<div class="test-case-hidden">';
                html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">';
                html += '<div style="font-weight: 500; color: var(--primary-500); font-size: 0.85rem;">Test ' + (idx + 1) + '</div>';
                html += '<div style="display: flex; gap: 0.25rem;">';
                html += '<button class="qtcedit btn btn-sm btn-secondary btn-icon" data-tcidx="' + idx + '">Edit</button>';
                html += '<button class="qtcdel btn btn-sm btn-danger btn-icon" data-tcidx="' + idx + '">Del</button>';
                html += '</div></div>';
                html += '<div>';
                html += '<div style="margin-bottom: 0.5rem;"><strong style="color:var(--text-muted); font-size:0.75rem;">Input:</strong><div class="code-block-scroll">' + Utils.escapeHtml(tc.input || '') + '</div></div>';
                html += '<div><strong style="color:var(--text-muted); font-size:0.75rem;">Output:</strong><div class="code-block-scroll">' + Utils.escapeHtml(tc.expected_output || '') + '</div></div></div></div>';
            });
            html += '</div>';
        } else {
            html += '<div style="color: var(--text-muted); font-style: italic;">No hidden test cases yet</div>';
        }
        html += '</div>';

        // Generate AI Test Cases Button
        html += '<div style="border-top: 1px solid var(--border-subtle); padding: 1rem;">';
        html += '<button id="' + prefix + 'QTestGen" class="btn btn-success" style="width: 100%; margin-bottom: 1rem;">Generate with AI</button>';
        html += '</div>';

        html += '<div id="' + prefix + 'QTestCaseContainer" style="display: none; padding: 1rem; border-top: 1px solid var(--border-subtle);"></div>';
        html += '<div id="' + prefix + 'QEditTestCasePanel" style="display: none; padding: 1rem; border-top: 1px solid var(--border-subtle);"></div>';
        html += '</div>';

        targetContainer.innerHTML = html;

        // Event listeners
        document.getElementById(prefix + 'QTestGen').addEventListener('click', function () {
            self.generateTestCasesForAdmin(question.id);
        });

        document.getElementById(prefix + 'QAddTest').addEventListener('click', function () {
            self.showAddTestCaseForm(question.id, hiddenTestcases.length);
        });

        targetContainer.querySelectorAll('.qtcedit').forEach(btn => {
            btn.addEventListener('click', function () {
                const idx = parseInt(this.getAttribute('data-tcidx'));
                self.showEditTestCaseForm(question.id, idx, hiddenTestcases[idx]);
            });
        });

        targetContainer.querySelectorAll('.qtcdel').forEach(btn => {
            btn.addEventListener('click', function () {
                const idx = parseInt(this.getAttribute('data-tcidx'));
                self.deleteTestCase(question.id, idx);
            });
        });
    },

    /**
     * Show form to add new test case
     */
    showAddTestCaseForm(questionId, testCaseNum) {
        const prefix = this.config.prefix || 'admin';
        const panelId = prefix + 'QEditTestCasePanel';
        const panel = document.getElementById(panelId);
        if (!panel) return;

        const self = this;
        let html = '<div style="background: var(--bg-elevated); border: 1px solid var(--success); border-radius: 4px; padding: 1rem;">';
        html += '<h5 style="margin: 0 0 0.75rem 0; color: var(--success);">Add New Test Case</h5>';
        html += '<div style="margin-bottom: 0.75rem;"><label style="font-size: 0.85rem; font-weight: bold; color: var(--text-main);">Input:</label>';
        html += '<textarea id="' + prefix + 'QNewtcInput" class="code-textarea" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-subtle); border-radius: 3px; font-family: var(--font-code); font-size: 0.8rem; min-height: 60px; box-sizing: border-box;"></textarea></div>';
        html += '<div style="margin-bottom: 0.75rem;"><label style="font-size: 0.85rem; font-weight: bold; color: var(--text-main);">Expected Output:</label>';
        html += '<textarea id="' + prefix + 'QNewtcOutput" class="code-textarea" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-subtle); border-radius: 3px; font-family: var(--font-code); font-size: 0.8rem; min-height: 60px; box-sizing: border-box;"></textarea></div>';
        html += '<div style="display: flex; gap: 0.5rem;">';
        html += '<button id="' + prefix + 'QSaveNewtc" class="btn btn-success" style="padding: 0.5rem 1rem; flex: 1; font-size: 0.85rem;">Add Test Case</button>';
        html += '<button id="' + prefix + 'QCancNewtc" class="btn btn-secondary" style="padding: 0.5rem 1rem; flex: 1; font-size: 0.85rem;">Cancel</button>';
        html += '</div></div>';

        panel.innerHTML = html;
        panel.style.display = 'block';

        document.getElementById(prefix + 'QSaveNewtc').addEventListener('click', function () {
            self.saveNewTestCase(questionId);
        });

        document.getElementById(prefix + 'QCancNewtc').addEventListener('click', function () {
            panel.style.display = 'none';
        });
    },

    /**
     * Show form to edit test case
     */
    showEditTestCaseForm(questionId, tcIdx, testcase) {
        const prefix = this.config.prefix || 'admin';
        const panelId = prefix + 'QEditTestCasePanel';
        const panel = document.getElementById(panelId);
        if (!panel) return;

        const self = this;
        let html = '<div style="background: var(--bg-elevated); border: 1px solid var(--warning); border-radius: 4px; padding: 1rem;">';
        html += '<h5 style="margin: 0 0 0.75rem 0; color: var(--warning);">Edit Test Case ' + (tcIdx + 1) + '</h5>';
        html += '<div style="margin-bottom: 0.75rem;"><label style="font-size: 0.85rem; font-weight: bold; color: var(--text-main);">Input:</label>';
        html += '<textarea id="' + prefix + 'QEditTcInput" class="code-textarea" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-subtle); border-radius: 3px; font-family: var(--font-code); font-size: 0.8rem; min-height: 60px; box-sizing: border-box;">' + Utils.escapeHtml(testcase.input || '') + '</textarea></div>';
        html += '<div style="margin-bottom: 0.75rem;"><label style="font-size: 0.85rem; font-weight: bold; color: var(--text-main);">Expected Output:</label>';
        html += '<textarea id="' + prefix + 'QEditTcOutput" class="code-textarea" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-subtle); border-radius: 3px; font-family: var(--font-code); font-size: 0.8rem; min-height: 60px; box-sizing: border-box;">' + Utils.escapeHtml(testcase.expected_output || '') + '</textarea></div>';
        html += '<div style="display: flex; gap: 0.5rem;">';
        html += '<button id="' + prefix + 'QSaveEditTc" class="btn btn-warning" style="padding: 0.5rem 1rem; flex: 1; font-size: 0.85rem; color: black;">Update Test Case</button>';
        html += '<button id="' + prefix + 'QCancEditTc" class="btn btn-secondary" style="padding: 0.5rem 1rem; flex: 1; font-size: 0.85rem;">Cancel</button>';
        html += '</div></div>';

        panel.innerHTML = html;
        panel.style.display = 'block';

        document.getElementById(prefix + 'QSaveEditTc').addEventListener('click', function () {
            self.saveEditTestCase(questionId, tcIdx);
        });

        document.getElementById(prefix + 'QCancEditTc').addEventListener('click', function () {
            panel.style.display = 'none';
        });
    },

    /**
     * Save new test case
     */
    async saveNewTestCase(questionId) {
        const prefix = this.config.prefix || 'admin';
        const input = document.getElementById(prefix + 'QNewtcInput').value.trim();
        const output = document.getElementById(prefix + 'QNewtcOutput').value.trim();

        if (!input || !output) {
            alert('Please fill in both input and output');
            return;
        }

        const question = this.questions.find(q => q.id === questionId);
        if (!question) return;

        const testcases = question.hidden_testcases || [];
        testcases.push({ input, expected_output: output });

        try {
            const user = Auth.getCurrentUser();
            const endpoint = user.role === 'admin' ? '/admin/questions/' : '/batch/questions/';

            const response = await fetch(CONFIG.API_BASE_URL + endpoint + questionId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                body: JSON.stringify({ hidden_testcases: testcases })
            });

            if (!response.ok) throw new Error('Save failed');

            Utils.showMessage('adminMessage', 'Test case added', 'success');
            document.getElementById(prefix + 'QEditTestCasePanel').style.display = 'none';
            await this.loadQuestions();
        } catch (error) {
            alert('Failed to add test case: ' + error.message);
        }
    },

    /**
     * Save edited test case
     */
    async saveEditTestCase(questionId, tcIdx) {
        const prefix = this.config.prefix || 'admin';
        const input = document.getElementById(prefix + 'QEditTcInput').value.trim();
        const output = document.getElementById(prefix + 'QEditTcOutput').value.trim();

        if (!input || !output) {
            alert('Please fill in both input and output');
            return;
        }

        const question = this.questions.find(q => q.id === questionId);
        if (!question) return;

        const testcases = question.hidden_testcases || [];
        if (tcIdx >= 0 && tcIdx < testcases.length) {
            testcases[tcIdx] = { input, expected_output: output };
        }

        try {
            const user = Auth.getCurrentUser();
            const endpoint = user.role === 'admin' ? '/admin/questions/' : '/batch/questions/';

            const response = await fetch(CONFIG.API_BASE_URL + endpoint + questionId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                body: JSON.stringify({ hidden_testcases: testcases })
            });

            if (!response.ok) throw new Error('Save failed');

            Utils.showMessage('adminMessage', 'Test case updated', 'success');
            document.getElementById(prefix + 'QEditTestCasePanel').style.display = 'none';
            await this.loadQuestions();
        } catch (error) {
            alert('Failed to update test case: ' + error.message);
        }
    },

    /**
     * Delete test case
     */
    async deleteTestCase(questionId, tcIdx) {
        if (!confirm('Delete this test case?')) return;

        const question = this.questions.find(q => q.id === questionId);
        if (!question) return;

        const testcases = question.hidden_testcases || [];
        testcases.splice(tcIdx, 1);

        try {
            const user = Auth.getCurrentUser();
            const endpoint = user.role === 'admin' ? '/admin/questions/' : '/batch/questions/';

            const response = await fetch(CONFIG.API_BASE_URL + endpoint + questionId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                body: JSON.stringify({ hidden_testcases: testcases })
            });

            if (!response.ok) throw new Error('Save failed');

            Utils.showMessage('adminMessage', 'Test case deleted', 'success');
            await this.loadQuestions();
        } catch (error) {
            alert('Failed to delete test case: ' + error.message);
        }
    },

    /**
     * Prepare Create Form
     */
    prepareCreate() {
        const createObj = {
            id: '',
            title: '',
            description: '',
            sample_input: '',
            sample_output: '',
            difficulty: 'Medium',
            topic_id: ''
        };
        this.editingId = null;
        this.showEditForm(createObj);

        // Update header of edit form if possible?
        // showEditForm regenerates the HTML.
    },

    /**
     * Save question inline
     */
    async saveAdminQuestionInline() {
        const prefix = this.config.prefix || 'admin';
        const questionId = document.getElementById(prefix + 'QEditId').value;
        const user = Auth.getCurrentUser();
        const isNew = !questionId;

        const payload = {
            title: document.getElementById(prefix + 'QEditTitle').value.trim(),
            description: document.getElementById(prefix + 'QEditDesc').value.trim(),
            sample_input: document.getElementById(prefix + 'QEditInput').value.trim(),
            sample_output: document.getElementById(prefix + 'QEditOutput').value.trim(),
            difficulty: document.getElementById(prefix + 'QEditDiff').value
        };

        if (user.role === 'admin') {
            payload.college_id = document.getElementById(prefix + 'QEditCollege').value;
            payload.department_id = document.getElementById(prefix + 'QEditDept').value;
            payload.batch_id = document.getElementById(prefix + 'QEditBatch').value;
            payload.topic_id = document.getElementById(prefix + 'QEditTopic').value;
        } else {
            payload.topic_id = document.getElementById(prefix + 'QEditTopic').value;
        }

        try {
            let url = user.role === 'admin' ? '/admin/questions' : '/batch/questions';
            if (!isNew) {
                url += '/' + questionId;
            }

            const method = isNew ? 'POST' : 'PUT';

            await Utils.apiRequest(url, { method: method, body: JSON.stringify(payload) });
            Utils.showMessage('adminMessage', isNew ? 'Question created successfully' : 'Question updated successfully', 'success');
            await this.loadQuestions();

            // If new, clear form or select the new question?
            // Reloading questions refreshes the list. User can select again.
        } catch (error) {
            const msgEl = document.getElementById(prefix + 'QEditMessage');
            if (msgEl) msgEl.textContent = (isNew ? 'Create' : 'Update') + ' failed: ' + error.message;
        }
    },

    /**
     * Delete confirm
     */
    async deleteConfirmAdminPanel() {
        if (!confirm('Delete this question permanently?')) return;
        const prefix = this.config.prefix || 'admin';
        const questionId = document.getElementById(prefix + 'QEditId').value;
        this.delete(questionId);
    },

    /**
     * Generate test cases
     */
    async generateTestCasesForAdmin(questionId) {
        const question = this.questions.find(q => q.id === questionId);
        if (!question) return;

        const prefix = this.config.prefix || 'admin';
        const btnId = prefix + 'QTestGen';

        try {
            const btn = document.getElementById(btnId);
            if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }

            const user = Auth.getCurrentUser();
            const endpoint = user.role === 'admin' ? '/admin/generate-testcases' : '/batch/generate-testcases';

            const response = await fetch(CONFIG.API_BASE_URL + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                body: JSON.stringify({ question_id: questionId, description: question.description, sample_input: question.sample_input, sample_output: question.sample_output })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Generation failed');

            const testcases = data.data?.testcases || [];
            this.displayGeneratedTestCasesAdmin(questionId, testcases);
            Utils.showMessage('adminMessage', 'Generated ' + testcases.length + ' test cases', 'success');
        } catch (error) {
            Utils.showMessage('adminMessage', 'Failed to generate: ' + error.message, 'error');
        } finally {
            const btn = document.getElementById(btnId);
            if (btn) { btn.disabled = false; btn.textContent = 'Generate Hidden Test Cases'; }
        }
    },

    /**
     * Display generated test cases
     */
    displayGeneratedTestCasesAdmin(questionId, testcases) {
        const prefix = this.config.prefix || 'admin';
        const container = document.getElementById(prefix + 'QTestCaseContainer');
        if (!container || !testcases.length) return;

        const self = this;
        let html = '<div style="padding: 1rem; background: var(--bg-elevated); border-radius: 4px; border-left: 4px solid var(--success);">';
        html += '<h5 style="margin: 0 0 1rem 0; color: var(--success);">Generated Test Cases (' + testcases.length + ')</h5>';
        html += '<div style="display: grid; gap: 0.75rem; max-height: 250px; overflow-y: auto; margin-bottom: 1rem;">';

        testcases.forEach((tc, idx) => {
            html += '<div style="padding: 0.75rem; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 4px;"><div style="font-weight: 500; margin-bottom: 0.5rem; color: var(--text-main);">Test ' + (idx + 1) + '</div>';
            html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem;">';
            html += '<div><span style="color: var(--text-muted); font-size: 0.8rem;">Input:</span><div class="generated-test-case-box" style="padding: 0.5rem; border-radius: 3px; word-break: break-all;">' + Utils.escapeHtml((tc.input || '').substring(0, 60)) + '</div></div>';
            html += '<div><span style="color: var(--text-muted); font-size: 0.8rem;">Output:</span><div class="generated-test-case-box" style="padding: 0.5rem; border-radius: 3px; word-break: break-all;">' + Utils.escapeHtml((tc.expected_output || '').substring(0, 60)) + '</div></div>';
            html += '</div></div>';
        });

        html += '</div><button id="' + prefix + 'QSavTest" class="btn btn-success" style="padding: 0.75rem 1rem; width: 100%;">Save Test Cases</button></div>';

        container.innerHTML = html;
        container.style.display = 'block';
        this.pendingTestCases = { questionId, testcases };

        document.getElementById(prefix + 'QSavTest').addEventListener('click', function () {
            self.saveTestCasesAdmin(questionId);
        });
    },

    /**
     * Save test cases
     */
    async saveTestCasesAdmin(questionId) {
        if (!this.pendingTestCases) return;

        try {
            const user = Auth.getCurrentUser();
            const endpoint = user.role === 'admin' ? '/admin/questions/' : '/batch/questions/';

            const response = await fetch(CONFIG.API_BASE_URL + endpoint + questionId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                body: JSON.stringify({ hidden_testcases: this.pendingTestCases.testcases })
            });

            if (!response.ok) throw new Error('Save failed');

            Utils.showMessage('adminMessage', 'Test cases saved', 'success');
            this.pendingTestCases = null;
            const prefix = this.config.prefix || 'admin';
            const container = document.getElementById(prefix + 'QTestCaseContainer');
            if (container) container.style.display = 'none';
            await this.loadQuestions();
        } catch (error) {
            Utils.showMessage('adminMessage', 'Save failed: ' + error.message, 'error');
        }
    },

    /**
     * College change handler
     */
    onAdminQEditCollegeChange() {
        const collegeId = document.getElementById('adminQEditCollege').value;
        const deptSelect = document.getElementById('adminQEditDept');
        const batchSelect = document.getElementById('adminQEditBatch');

        if (!deptSelect) return;

        // Reset Department
        deptSelect.innerHTML = '<option value="">-- Select --</option>';
        deptSelect.disabled = !collegeId;

        // Reset Batch
        if (batchSelect) {
            batchSelect.innerHTML = '<option value="">-- Select --</option>';
            batchSelect.disabled = true;
        }

        if (!collegeId) return;

        this.departments.filter(d => d.college_id === collegeId).forEach(d => {
            const option = document.createElement('option');
            option.value = d.id;
            option.textContent = d.department_name || d.name;
            deptSelect.appendChild(option);
        });
    },

    /**
     * Department change handler
     */
    onAdminQEditDeptChange() {
        const deptId = document.getElementById('adminQEditDept').value;
        const batchSelect = document.getElementById('adminQEditBatch');
        if (!batchSelect) return;

        batchSelect.innerHTML = '<option value="">-- Select --</option>';
        this.batches.filter(b => b.department_id === deptId).forEach(b => {
            const option = document.createElement('option');
            option.value = b.id;
            option.textContent = b.batch_name;
            batchSelect.appendChild(option);
        });
    },

    /**
     * Edit question
     */
    async edit(id) {
        try {
            let url = '/student/questions/' + id;
            const user = Auth.getCurrentUser();

            if (user.role === 'admin') {
                url = '/admin/questions/' + id;
            } else if (user.role === 'college') {
                url = '/college/questions/' + id;
            } else if (user.role === 'department') {
                url = '/department/questions/' + id;
            } else if (user.role === 'batch') {
                url = '/batch/questions/' + id;
            }

            const response = await Utils.apiRequest(url);
            const question = response.data?.question || response.question || {};

            document.getElementById('questionTitle').value = question.title || '';
            document.getElementById('questionDescription').value = question.description || '';
            document.getElementById('questionSampleInput').value = question.sample_input || '';
            document.getElementById('questionSampleOutput').value = question.sample_output || '';
            document.getElementById('questionDifficulty').value = question.difficulty || 'Medium';
            document.getElementById('questionTopic').value = question.topic_id || '';

            this.editingId = id;

            const headerEl = document.querySelector('#questionModal .modal-header h3');
            if (headerEl) headerEl.textContent = 'Edit Question';
            const submitBtn = document.querySelector('#questionModal [type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Update Question';

            UI.openModal('questionModal');
        } catch (error) {
            Utils.alert('Failed to load question: ' + error.message);
        }
    },

    /**
     * Delete question
     */
    async delete(id) {
        if (!confirm('Delete this question permanently?')) return;

        try {
            let url = '/student/questions/' + id;
            const user = Auth.getCurrentUser();

            if (user.role === 'admin') {
                url = '/admin/questions/' + id;
            } else if (user.role === 'college') {
                url = '/college/questions/' + id;
            } else if (user.role === 'department') {
                url = '/department/questions/' + id;
            } else if (user.role === 'batch') {
                url = '/batch/questions/' + id;
            }

            await Utils.apiRequest(url, { method: 'DELETE' });
            this.loadQuestions();
            Utils.showMessage('questionsMessage', 'Question deleted', 'success');
        } catch (error) {
            Utils.showMessage('questionsMessage', 'Delete failed: ' + error.message, 'error');
        }
    },

    /**
     * Open Modal for adding a new question
     */
    async openModal() {
        this.editingId = null;
        document.getElementById('questionId').value = '';

        // Reset Inputs
        const inputs = ['questionTitle', 'questionDescription', 'questionSampleInput', 'questionSampleOutput'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        const diffEl = document.getElementById('questionDifficulty');
        if (diffEl) diffEl.value = 'Medium';

        // Reset Headers/Buttons
        const headerEl = document.querySelector('#questionModal .modal-header h3');
        if (headerEl) headerEl.textContent = 'Add Question';

        const saveBtn = document.querySelector('#questionModal button[onclick="Questions.save()"]');
        if (saveBtn) saveBtn.textContent = 'Create Question';

        // hierarchy Logic
        const user = Auth.getCurrentUser();
        const hierarchyStep = document.getElementById('questionHierarchyStep');
        const detailsStep = document.getElementById('questionDetailsStep');

        if (user.role === 'admin') {
            if (hierarchyStep) hierarchyStep.style.display = 'block';
            if (detailsStep) detailsStep.style.display = 'none';

            // Ensure data is loaded
            await this.loadHierarchyData();

            this.populateColleges();
            this.resetSelect('questionDepartment', 'Department');
            this.resetSelect('questionBatch', 'Batch');
            this.resetSelect('questionTopic', 'Topic');
        } else {
            // For non-admins, strict hierarchy might not apply or is pre-filled, 
            // but for now let's show details directly as commonly desired
            if (hierarchyStep) hierarchyStep.style.display = 'none';
            if (detailsStep) detailsStep.style.display = 'block';

            // If they need to select a topic, ensure it's loaded
            // (Assuming non-admins have a simpler topic selection if needed)
            // For now, simpler flow:
            this.loadTopicsForRole();
        }

        UI.openModal('questionModal');
    },

    resetSelect(id, label) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<option value="">-- Select ${label} --</option>`;
    },

    populateColleges() {
        const select = document.getElementById('questionCollege');
        if (!select) return;
        this.resetSelect('questionCollege', 'College');
        this.colleges.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.college_name || c.name;
            select.appendChild(option);
        });
    },

    loadDepartments(collegeId) {
        const select = document.getElementById('questionDepartment');
        if (!select) return;
        this.resetSelect('questionDepartment', 'Department');
        this.resetSelect('questionBatch', 'Batch');
        this.resetSelect('questionTopic', 'Topic');

        if (!collegeId) return;

        this.departments.filter(d => d.college_id === collegeId).forEach(d => {
            const option = document.createElement('option');
            option.value = d.id;
            option.textContent = d.department_name || d.name;
            select.appendChild(option);
        });
    },

    loadBatches(deptId) {
        const select = document.getElementById('questionBatch');
        if (!select) return;
        this.resetSelect('questionBatch', 'Batch');
        this.resetSelect('questionTopic', 'Topic');

        if (!deptId) return;

        this.batches.filter(b => b.department_id === deptId).forEach(b => {
            const option = document.createElement('option');
            option.value = b.id;
            option.textContent = b.batch_name;
            select.appendChild(option);
        });
    },

    loadTopics(batchId) {
        const select = document.getElementById('questionTopic');
        if (!select) return;
        this.resetSelect('questionTopic', 'Topic');

        if (!batchId) return;

        // Topics might be global or departmental? 
        // Based on other files, topics seem to be filtered by batch or department?
        // Let's check Utils or just filter generic.
        // Looking at 'admin-topics.js', topics have batch_id.

        this.topics.filter(t => t.batch_id === batchId).forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.topic_name || t.name;
            select.appendChild(option);
        });
    },

    loadTopicsForRole() {
        const select = document.getElementById('questionTopic');
        if (!select) return;
        // Just load all available topics for the current user's scope
        this.resetSelect('questionTopic', 'Topic');
        this.topics.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.topic_name || t.name;
            select.appendChild(option);
        });
    },

    proceedToQuestionDetails() {
        const college = document.getElementById('questionCollege').value;
        const dept = document.getElementById('questionDepartment').value;
        const batch = document.getElementById('questionBatch').value;
        const topic = document.getElementById('questionTopic').value;

        if (!college || !dept || !batch || !topic) {
            alert('Please select all hierarchy fields.');
            return;
        }

        document.getElementById('questionHierarchyStep').style.display = 'none';
        document.getElementById('questionDetailsStep').style.display = 'block';
    },

    backToHierarchy() {
        document.getElementById('questionHierarchyStep').style.display = 'block';
        document.getElementById('questionDetailsStep').style.display = 'none';
    },

    /**
     * Save question
     */
    async save() {
        try {
            const title = document.getElementById('questionTitle').value.trim();
            const description = document.getElementById('questionDescription').value.trim();
            const sampleInput = document.getElementById('questionSampleInput').value.trim();
            const sampleOutput = document.getElementById('questionSampleOutput').value.trim();
            const difficulty = document.getElementById('questionDifficulty').value || 'Medium';

            if (!title || !description || !sampleInput || !sampleOutput) {
                Utils.showMessage('questionsMessage', 'Please fill all required fields', 'error');
                return;
            }

            if (title.length < 3) {
                Utils.showMessage('questionsMessage', 'Title must be at least 3 characters', 'error');
                return;
            }

            if (description.length < 10) {
                Utils.showMessage('questionsMessage', 'Description must be at least 10 characters', 'error');
                return;
            }

            const user = Auth.getCurrentUser();
            const payload = {
                title,
                description,
                sample_input: sampleInput,
                sample_output: sampleOutput,
                difficulty
            };

            let url = '/admin/questions';
            if (user.role === 'admin') {
                const collegeId = document.getElementById('questionCollege').value.trim();
                const departmentId = document.getElementById('questionDepartment').value.trim();
                const batchId = document.getElementById('questionBatch').value.trim();
                const topicId = document.getElementById('questionTopic').value.trim();

                if (!collegeId || !departmentId || !batchId || !topicId) {
                    Utils.showMessage('questionsMessage', 'Please select College, Department, Batch, and Topic', 'error');
                    return;
                }

                payload.college_id = collegeId;
                payload.department_id = departmentId;
                payload.batch_id = batchId;
                payload.topic_id = topicId;
            } else if (user.role === 'college') {
                url = '/college/questions';
            } else if (user.role === 'department') {
                url = '/department/questions';
            } else if (user.role === 'batch') {
                url = '/batch/questions';
                const topicId = document.getElementById('questionTopic').value.trim();
                if (topicId) {
                    payload.topic_id = topicId;
                }
            }

            const method = this.editingId ? 'PUT' : 'POST';
            if (this.editingId) {
                url += '/' + this.editingId;
            }

            await Utils.apiRequest(url, {
                method,
                body: JSON.stringify(payload)
            });

            this.loadQuestions();
            UI.closeModal('questionModal');
            Utils.showMessage('questionsMessage',
                this.editingId ? 'Question updated' : 'Question created',
                'success');
        } catch (error) {
            Utils.showMessage('questionsMessage', 'Save failed: ' + error.message, 'error');
        }
    }
};
