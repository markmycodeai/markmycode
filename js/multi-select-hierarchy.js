/**
 * Multi-Select Hierarchy Component
 * Provides a cascading multi-select for College > Department > Batch selection
 * Used by Admin when creating Topics, Questions, and Notes
 */

const MultiSelectHierarchy = {
    // Data stores
    allColleges: [],
    allDepartments: [],
    allBatches: [],
    allTopics: [],

    // Selected items
    selectedColleges: new Set(),
    selectedDepartments: new Set(),
    selectedBatches: new Set(),
    selectedTopics: new Set(),

    // Containers (set by init)
    containers: {
        colleges: null,
        departments: null,
        batches: null,
        topics: null
    },

    // Callback for when selection changes
    onSelectionChange: null,

    // Whether to show topics selection (for questions only)
    showTopics: false,

    /**
     * Initialize the multi-select hierarchy
     * @param {Object} config - Configuration object
     * @param {string} config.collegesContainerId - ID of colleges container
     * @param {string} config.departmentsContainerId - ID of departments container
     * @param {string} config.batchesContainerId - ID of batches container
     * @param {string} config.topicsContainerId - ID of topics container (optional)
     * @param {boolean} config.showTopics - Whether to show topics selection
     * @param {Function} config.onSelectionChange - Callback when selection changes
     */
    init: function (config) {
        this.containers.colleges = document.getElementById(config.collegesContainerId);
        this.containers.departments = document.getElementById(config.departmentsContainerId);
        this.containers.batches = document.getElementById(config.batchesContainerId);
        this.containers.topics = config.topicsContainerId ? document.getElementById(config.topicsContainerId) : null;
        this.showTopics = config.showTopics || false;
        this.onSelectionChange = config.onSelectionChange || null;

        // Reset selections
        this.selectedColleges.clear();
        this.selectedDepartments.clear();
        this.selectedBatches.clear();
        this.selectedTopics.clear();

        // Load initial data
        this.loadAllData();
    },

    /**
     * Load all colleges, departments, and batches
     */
    loadAllData: async function () {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };

            // Load colleges
            const collegesRes = await fetch(`${CONFIG.API_BASE_URL}/admin/colleges`, { headers });
            if (collegesRes.ok) {
                const data = await collegesRes.json();
                this.allColleges = (data.colleges || data.data?.colleges || []).filter(c => !c.is_disabled);
            }

            // Load departments
            const deptsRes = await fetch(`${CONFIG.API_BASE_URL}/admin/departments`, { headers });
            if (deptsRes.ok) {
                const data = await deptsRes.json();
                this.allDepartments = (data.departments || data.data?.departments || []).filter(d => !d.is_disabled);
            }

            // Load batches
            const batchesRes = await fetch(`${CONFIG.API_BASE_URL}/admin/batches`, { headers });
            if (batchesRes.ok) {
                const data = await batchesRes.json();
                this.allBatches = (data.batches || data.data?.batches || []).filter(b => !b.is_disabled);
            }

            // Load topics (if needed)
            if (this.showTopics) {
                const topicsRes = await fetch(`${CONFIG.API_BASE_URL}/admin/topics`, { headers });
                if (topicsRes.ok) {
                    const data = await topicsRes.json();
                    this.allTopics = (data.topics || data.data?.topics || []).filter(t => !t.is_disabled);
                }
            }

            // Render colleges
            this.renderColleges();

        } catch (error) {
            console.error('Error loading hierarchy data:', error);
        }
    },

    /**
     * Render colleges as checkboxes
     */
    renderColleges: function () {
        if (!this.containers.colleges) return;

        if (this.allColleges.length === 0) {
            this.containers.colleges.innerHTML = '<p class="text-muted">No colleges available</p>';
            return;
        }

        let html = '<div class="multi-select-list">';

        // Select All option
        html += `
      <label class="multi-select-item select-all">
        <input type="checkbox" id="selectAllColleges" onchange="MultiSelectHierarchy.toggleAllColleges(this.checked)">
        <span class="checkbox-label">Select All Colleges</span>
      </label>
    `;

        this.allColleges.forEach(college => {
            const collegeName = college.college_name || college.name;
            html += `
        <label class="multi-select-item">
          <input type="checkbox" 
                 value="${college.id}" 
                 data-name="${this.escapeHtml(collegeName)}"
                 onchange="MultiSelectHierarchy.onCollegeChange(this)">
          <span class="checkbox-label">${this.escapeHtml(collegeName)}</span>
        </label>
      `;
        });

        html += '</div>';
        this.containers.colleges.innerHTML = html;

        // Clear dependent containers
        this.renderDepartments();
    },

    /**
     * Toggle all colleges selection
     */
    toggleAllColleges: function (checked) {
        const checkboxes = this.containers.colleges.querySelectorAll('input[type="checkbox"]:not(#selectAllColleges)');
        checkboxes.forEach(cb => {
            cb.checked = checked;
            if (checked) {
                this.selectedColleges.add(cb.value);
            } else {
                this.selectedColleges.delete(cb.value);
            }
        });
        this.renderDepartments();
        this.triggerSelectionChange();
    },

    /**
     * Handle college checkbox change
     */
    onCollegeChange: function (checkbox) {
        if (checkbox.checked) {
            this.selectedColleges.add(checkbox.value);
        } else {
            this.selectedColleges.delete(checkbox.value);
            // Also remove any departments/batches from this college
            this.removeDescendantsOfCollege(checkbox.value);
        }

        // Update select all checkbox state
        this.updateSelectAllState('selectAllColleges', this.containers.colleges);

        this.renderDepartments();
        this.triggerSelectionChange();
    },

    /**
     * Remove departments and batches that belong to a college
     */
    removeDescendantsOfCollege: function (collegeId) {
        const depts = this.allDepartments.filter(d => d.college_id === collegeId);
        depts.forEach(dept => {
            this.selectedDepartments.delete(dept.id);
            this.removeDescendantsOfDepartment(dept.id);
        });
    },

    /**
     * Remove batches that belong to a department
     */
    removeDescendantsOfDepartment: function (departmentId) {
        const batches = this.allBatches.filter(b => b.department_id === departmentId);
        batches.forEach(batch => {
            this.selectedBatches.delete(batch.id);
            // Remove topics from this batch
            const topics = this.allTopics.filter(t => t.batch_id === batch.id);
            topics.forEach(topic => this.selectedTopics.delete(topic.id));
        });
    },

    /**
     * Render departments grouped by selected colleges
     */
    renderDepartments: function () {
        if (!this.containers.departments) return;

        if (this.selectedColleges.size === 0) {
            this.containers.departments.innerHTML = '<p class="text-muted">Select colleges first</p>';
            this.renderBatches();
            return;
        }

        // Get departments for selected colleges, grouped by college
        const grouped = {};
        this.selectedColleges.forEach(collegeId => {
            const college = this.allColleges.find(c => c.id === collegeId);
            const collegeName = college ? (college.college_name || college.name) : collegeId;
            const depts = this.allDepartments.filter(d => d.college_id === collegeId);
            if (depts.length > 0) {
                grouped[collegeId] = { name: collegeName, departments: depts };
            }
        });

        if (Object.keys(grouped).length === 0) {
            this.containers.departments.innerHTML = '<p class="text-muted">No departments found for selected colleges</p>';
            this.renderBatches();
            return;
        }

        let html = '<div class="multi-select-grouped">';

        // Select All option
        html += `
      <label class="multi-select-item select-all">
        <input type="checkbox" id="selectAllDepartments" onchange="MultiSelectHierarchy.toggleAllDepartments(this.checked)">
        <span class="checkbox-label">Select All Departments</span>
      </label>
    `;

        for (const collegeId in grouped) {
            const group = grouped[collegeId];
            html += `
        <div class="multi-select-group">
          <div class="multi-select-group-header">
            <span class="group-title">${this.escapeHtml(group.name)}</span>
          </div>
          <div class="multi-select-group-items">
      `;

            group.departments.forEach(dept => {
                const deptName = dept.department_name || dept.name;
                const isChecked = this.selectedDepartments.has(dept.id) ? 'checked' : '';
                html += `
          <label class="multi-select-item">
            <input type="checkbox" 
                   value="${dept.id}" 
                   data-college="${collegeId}"
                   data-name="${this.escapeHtml(deptName)}"
                   ${isChecked}
                   onchange="MultiSelectHierarchy.onDepartmentChange(this)">
            <span class="checkbox-label">${this.escapeHtml(deptName)}</span>
          </label>
        `;
            });

            html += '</div></div>';
        }

        html += '</div>';
        this.containers.departments.innerHTML = html;

        // Update select all state
        this.updateSelectAllState('selectAllDepartments', this.containers.departments);

        this.renderBatches();
    },

    /**
     * Toggle all departments selection
     */
    toggleAllDepartments: function (checked) {
        const checkboxes = this.containers.departments.querySelectorAll('input[type="checkbox"]:not(#selectAllDepartments)');
        checkboxes.forEach(cb => {
            cb.checked = checked;
            if (checked) {
                this.selectedDepartments.add(cb.value);
            } else {
                this.selectedDepartments.delete(cb.value);
            }
        });
        this.renderBatches();
        this.triggerSelectionChange();
    },

    /**
     * Handle department checkbox change
     */
    onDepartmentChange: function (checkbox) {
        if (checkbox.checked) {
            this.selectedDepartments.add(checkbox.value);
        } else {
            this.selectedDepartments.delete(checkbox.value);
            this.removeDescendantsOfDepartment(checkbox.value);
        }

        this.updateSelectAllState('selectAllDepartments', this.containers.departments);

        this.renderBatches();
        this.triggerSelectionChange();
    },

    /**
     * Render batches grouped by selected departments
     */
    renderBatches: function () {
        if (!this.containers.batches) return;

        if (this.selectedDepartments.size === 0) {
            this.containers.batches.innerHTML = '<p class="text-muted">Select departments first</p>';
            if (this.showTopics) this.renderTopics();
            return;
        }

        // Get batches for selected departments, grouped by department
        const grouped = {};
        this.selectedDepartments.forEach(deptId => {
            const dept = this.allDepartments.find(d => d.id === deptId);
            const deptName = dept ? (dept.department_name || dept.name) : deptId;
            const college = this.allColleges.find(c => c.id === dept?.college_id);
            const collegeName = college ? (college.college_name || college.name) : '';
            const batches = this.allBatches.filter(b => b.department_id === deptId);
            if (batches.length > 0) {
                grouped[deptId] = {
                    name: deptName,
                    collegeName: collegeName,
                    batches: batches
                };
            }
        });

        if (Object.keys(grouped).length === 0) {
            this.containers.batches.innerHTML = '<p class="text-muted">No batches found for selected departments</p>';
            if (this.showTopics) this.renderTopics();
            return;
        }

        let html = '<div class="multi-select-grouped">';

        // Select All option
        html += `
      <label class="multi-select-item select-all">
        <input type="checkbox" id="selectAllBatches" onchange="MultiSelectHierarchy.toggleAllBatches(this.checked)">
        <span class="checkbox-label">Select All Batches</span>
      </label>
    `;

        for (const deptId in grouped) {
            const group = grouped[deptId];
            html += `
        <div class="multi-select-group">
          <div class="multi-select-group-header">
            <span class="group-title">${this.escapeHtml(group.name)}</span>
            <span class="group-subtitle">(${this.escapeHtml(group.collegeName)})</span>
          </div>
          <div class="multi-select-group-items">
      `;

            group.batches.forEach(batch => {
                const batchName = batch.batch_name || batch.name;
                const isChecked = this.selectedBatches.has(batch.id) ? 'checked' : '';
                html += `
          <label class="multi-select-item">
            <input type="checkbox" 
                   value="${batch.id}" 
                   data-department="${deptId}"
                   data-name="${this.escapeHtml(batchName)}"
                   ${isChecked}
                   onchange="MultiSelectHierarchy.onBatchChange(this)">
            <span class="checkbox-label">${this.escapeHtml(batchName)}</span>
          </label>
        `;
            });

            html += '</div></div>';
        }

        html += '</div>';
        this.containers.batches.innerHTML = html;

        this.updateSelectAllState('selectAllBatches', this.containers.batches);

        if (this.showTopics) this.renderTopics();
    },

    /**
     * Toggle all batches selection
     */
    toggleAllBatches: function (checked) {
        const checkboxes = this.containers.batches.querySelectorAll('input[type="checkbox"]:not(#selectAllBatches)');
        checkboxes.forEach(cb => {
            cb.checked = checked;
            if (checked) {
                this.selectedBatches.add(cb.value);
            } else {
                this.selectedBatches.delete(cb.value);
            }
        });
        if (this.showTopics) this.renderTopics();
        this.triggerSelectionChange();
    },

    /**
     * Handle batch checkbox change
     */
    onBatchChange: function (checkbox) {
        if (checkbox.checked) {
            this.selectedBatches.add(checkbox.value);
        } else {
            this.selectedBatches.delete(checkbox.value);
            // Remove topics from this batch
            const topics = this.allTopics.filter(t => t.batch_id === checkbox.value);
            topics.forEach(topic => this.selectedTopics.delete(topic.id));
        }

        this.updateSelectAllState('selectAllBatches', this.containers.batches);

        if (this.showTopics) this.renderTopics();
        this.triggerSelectionChange();
    },

    /**
     * Render topics grouped by selected batches (for questions only)
     */
    renderTopics: function () {
        if (!this.containers.topics || !this.showTopics) return;

        if (this.selectedBatches.size === 0) {
            this.containers.topics.innerHTML = '<p class="text-muted">Select batches first</p>';
            return;
        }

        // Get topics for selected batches, grouped by batch
        const grouped = {};
        this.selectedBatches.forEach(batchId => {
            const batch = this.allBatches.find(b => b.id === batchId);
            const batchName = batch ? (batch.batch_name || batch.name) : batchId;
            const dept = this.allDepartments.find(d => d.id === batch?.department_id);
            const deptName = dept ? (dept.department_name || dept.name) : '';
            const topics = this.allTopics.filter(t => t.batch_id === batchId);
            if (topics.length > 0) {
                grouped[batchId] = {
                    name: batchName,
                    departmentName: deptName,
                    topics: topics
                };
            }
        });

        if (Object.keys(grouped).length === 0) {
            this.containers.topics.innerHTML = '<p class="text-muted">No topics found for selected batches</p>';
            return;
        }

        let html = '<div class="multi-select-grouped">';

        // Select All option
        html += `
      <label class="multi-select-item select-all">
        <input type="checkbox" id="selectAllTopics" onchange="MultiSelectHierarchy.toggleAllTopics(this.checked)">
        <span class="checkbox-label">Select All Topics</span>
      </label>
    `;

        for (const batchId in grouped) {
            const group = grouped[batchId];
            html += `
        <div class="multi-select-group">
          <div class="multi-select-group-header">
            <span class="group-title">${this.escapeHtml(group.name)}</span>
            <span class="group-subtitle">(${this.escapeHtml(group.departmentName)})</span>
          </div>
          <div class="multi-select-group-items">
      `;

            group.topics.forEach(topic => {
                const topicName = topic.topic_name || topic.name;
                const isChecked = this.selectedTopics.has(topic.id) ? 'checked' : '';
                html += `
          <label class="multi-select-item">
            <input type="checkbox" 
                   value="${topic.id}" 
                   data-batch="${batchId}"
                   data-name="${this.escapeHtml(topicName)}"
                   ${isChecked}
                   onchange="MultiSelectHierarchy.onTopicChange(this)">
            <span class="checkbox-label">${this.escapeHtml(topicName)}</span>
          </label>
        `;
            });

            html += '</div></div>';
        }

        html += '</div>';
        this.containers.topics.innerHTML = html;

        this.updateSelectAllState('selectAllTopics', this.containers.topics);
    },

    /**
     * Toggle all topics selection
     */
    toggleAllTopics: function (checked) {
        const checkboxes = this.containers.topics.querySelectorAll('input[type="checkbox"]:not(#selectAllTopics)');
        checkboxes.forEach(cb => {
            cb.checked = checked;
            if (checked) {
                this.selectedTopics.add(cb.value);
            } else {
                this.selectedTopics.delete(cb.value);
            }
        });
        this.triggerSelectionChange();
    },

    /**
     * Handle topic checkbox change
     */
    onTopicChange: function (checkbox) {
        if (checkbox.checked) {
            this.selectedTopics.add(checkbox.value);
        } else {
            this.selectedTopics.delete(checkbox.value);
        }

        this.updateSelectAllState('selectAllTopics', this.containers.topics);
        this.triggerSelectionChange();
    },

    /**
     * Update select all checkbox state based on individual selections
     */
    updateSelectAllState: function (selectAllId, container) {
        const selectAll = document.getElementById(selectAllId);
        if (!selectAll || !container) return;

        const checkboxes = container.querySelectorAll(`input[type="checkbox"]:not(#${selectAllId})`);
        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;

        if (checkedCount === 0) {
            selectAll.checked = false;
            selectAll.indeterminate = false;
        } else if (checkedCount === checkboxes.length) {
            selectAll.checked = true;
            selectAll.indeterminate = false;
        } else {
            selectAll.checked = false;
            selectAll.indeterminate = true;
        }
    },

    /**
     * Trigger selection change callback
     */
    triggerSelectionChange: function () {
        if (this.onSelectionChange) {
            this.onSelectionChange({
                colleges: Array.from(this.selectedColleges),
                departments: Array.from(this.selectedDepartments),
                batches: Array.from(this.selectedBatches),
                topics: Array.from(this.selectedTopics)
            });
        }
    },

    /**
     * Get all selected batches with their full hierarchy info
     * Returns array of { batchId, batchName, departmentId, departmentName, collegeId, collegeName }
     */
    getSelectedBatchesWithInfo: function () {
        const result = [];
        this.selectedBatches.forEach(batchId => {
            const batch = this.allBatches.find(b => b.id === batchId);
            if (!batch) return;

            const dept = this.allDepartments.find(d => d.id === batch.department_id);
            const college = dept ? this.allColleges.find(c => c.id === dept.college_id) : null;

            result.push({
                batchId: batch.id,
                batchName: batch.batch_name || batch.name,
                departmentId: dept?.id,
                departmentName: dept?.department_name || dept?.name,
                collegeId: college?.id,
                collegeName: college?.college_name || college?.name
            });
        });
        return result;
    },

    /**
     * Get all selected topics with their full hierarchy info
     */
    getSelectedTopicsWithInfo: function () {
        const result = [];
        this.selectedTopics.forEach(topicId => {
            const topic = this.allTopics.find(t => t.id === topicId);
            if (!topic) return;

            const batch = this.allBatches.find(b => b.id === topic.batch_id);
            const dept = batch ? this.allDepartments.find(d => d.id === batch.department_id) : null;
            const college = dept ? this.allColleges.find(c => c.id === dept.college_id) : null;

            result.push({
                topicId: topic.id,
                topicName: topic.topic_name || topic.name,
                batchId: batch?.id,
                batchName: batch?.batch_name || batch?.name,
                departmentId: dept?.id,
                departmentName: dept?.department_name || dept?.name,
                collegeId: college?.id,
                collegeName: college?.college_name || college?.name
            });
        });
        return result;
    },

    /**
     * Reset all selections
     */
    reset: function () {
        this.selectedColleges.clear();
        this.selectedDepartments.clear();
        this.selectedBatches.clear();
        this.selectedTopics.clear();

        if (this.containers.colleges) this.renderColleges();
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml: function (text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
};

// Export to global scope
window.MultiSelectHierarchy = MultiSelectHierarchy;
