/**
 * Admin Topics Management
 * Handles Topics CRUD operations for System Admins with multi-select hierarchy
 */

const AdminTopics = {
  apiEndpoint: `${Config.API_BASE}/admin/topics`,
  editingId: null,

  // Hierarchy data for name resolution
  colleges: [],
  departments: [],
  batches: [],

  /**
   * Find college name by ID
   */
  findCollegeName: function (collegeId) {
    if (!collegeId) return '-';
    const college = this.colleges.find(c => c.id === collegeId);
    return college ? (college.college_name || college.name) : collegeId;
  },

  /**
   * Find department name by ID
   */
  findDepartmentName: function (departmentId) {
    if (!departmentId) return '-';
    const dept = this.departments.find(d => d.id === departmentId);
    return dept ? (dept.department_name || dept.name) : departmentId;
  },

  /**
   * Find batch name by ID
   */
  findBatchName: function (batchId) {
    if (!batchId) return '-';
    const batch = this.batches.find(b => b.id === batchId);
    return batch ? (batch.batch_name || batch.name) : batchId;
  },

  /**
   * Load hierarchy data (colleges, departments, batches)
   */
  loadHierarchyData: async function () {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Load colleges
      const collegesRes = await fetch(`${Config.API_BASE}/admin/colleges`, { headers });
      if (collegesRes.ok) {
        const data = await collegesRes.json();
        this.colleges = data.colleges || data.data?.colleges || [];
      }

      // Load departments
      const deptsRes = await fetch(`${Config.API_BASE}/admin/departments`, { headers });
      if (deptsRes.ok) {
        const data = await deptsRes.json();
        this.departments = data.departments || data.data?.departments || [];
      }

      // Load batches
      const batchesRes = await fetch(`${Config.API_BASE}/admin/batches`, { headers });
      if (batchesRes.ok) {
        const data = await batchesRes.json();
        this.batches = data.batches || data.data?.batches || [];
      }
    } catch (error) {
      console.error('Error loading hierarchy data:', error);
    }
  },

  /**
   * Open modal for creating/editing topic
   */
  openModal: function (topicId = null) {
    this.editingId = topicId;
    const modal = document.querySelector('#adminTopicModal .modal-header h3');
    const submit = document.querySelector('#adminTopicModal [type=submit]');

    if (topicId) {
      // Edit mode - use single select (keep original behavior for editing)
      modal.textContent = 'Edit Topic';
      submit.textContent = 'Update Topic';
      submit.setAttribute('onclick', 'AdminTopics.save()');
      this.loadTopicForEdit(topicId);
    } else {
      // Create mode - use multi-select
      document.getElementById('adminTopicId').value = '';
      document.getElementById('adminTopicName').value = '';
      modal.textContent = 'Add Topic';
      submit.textContent = 'Create Topic(s)';
      submit.setAttribute('onclick', 'AdminTopics.saveMultiple()');

      // Initialize multi-select hierarchy
      this.initMultiSelect();
    }

    UI.openModal('adminTopicModal');
  },

  /**
   * Initialize multi-select hierarchy for creating topics
   */
  initMultiSelect: function () {
    MultiSelectHierarchy.init({
      collegesContainerId: 'adminTopicCollegesContainer',
      departmentsContainerId: 'adminTopicDepartmentsContainer',
      batchesContainerId: 'adminTopicBatchesContainer',
      showTopics: false,
      onSelectionChange: (selection) => {
        // Update counts in headers
        document.getElementById('adminTopicCollegeCount').textContent = selection.colleges.length;
        document.getElementById('adminTopicDepartmentCount').textContent = selection.departments.length;
        document.getElementById('adminTopicBatchCount').textContent = selection.batches.length;
      }
    });
  },

  /**
   * Save multiple topics (one for each selected batch)
   */
  saveMultiple: async function () {
    const topicName = document.getElementById('adminTopicName').value.trim();

    if (!topicName || topicName.length < 2) {
      Utils.showMessage('adminTopicsMessage', 'Topic name is required (min 2 chars)', 'error');
      return;
    }

    const selectedBatches = MultiSelectHierarchy.getSelectedBatchesWithInfo();

    if (selectedBatches.length === 0) {
      Utils.showMessage('adminTopicsMessage', 'Please select at least one batch', 'error');
      return;
    }

    // Show loading
    Utils.showMessage('adminTopicsMessage', `Creating topic in ${selectedBatches.length} batch(es)...`, 'info');

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Create topic in each selected batch
    for (const batch of selectedBatches) {
      try {
        const payload = {
          topic_name: topicName,
          college_id: batch.collegeId,
          department_id: batch.departmentId,
          batch_id: batch.batchId
        };

        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          successCount++;
        } else {
          const error = await response.json();
          errorCount++;
          errors.push(`${batch.batchName}: ${error.message || 'Failed'}`);
        }
      } catch (error) {
        errorCount++;
        errors.push(`${batch.batchName}: ${error.message}`);
      }
    }

    // Show result
    if (errorCount === 0) {
      Utils.showMessage('adminTopicsMessage', `Successfully created topic in ${successCount} batch(es)`, 'success');
      setTimeout(() => {
        UI.closeModal('adminTopicModal');
        this.loadTopics();
      }, 1500);
    } else {
      let msg = `Created in ${successCount} batch(es), failed in ${errorCount} batch(es).`;
      if (errors.length > 0) {
        msg += ' Errors: ' + errors.slice(0, 3).join(', ');
        if (errors.length > 3) msg += '...';
      }
      Utils.showMessage('adminTopicsMessage', msg, errorCount === selectedBatches.length ? 'error' : 'warning');
      this.loadTopics();
    }
  },

  /**
   * Load colleges for dropdown (for edit mode - backward compatibility)
   */
  loadColleges: async function () {
    try {
      const response = await fetch(`${Config.API_BASE}/admin/colleges`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        this.colleges = data.colleges || data.data?.colleges || [];
        this.populateCollegeSelect();
      }
    } catch (error) {
      console.error('Error loading colleges:', error);
    }
  },

  /**
   * Populate college select (for edit mode)
   */
  populateCollegeSelect: function () {
    const select = document.getElementById('adminTopicCollege');
    if (!select) return;
    select.innerHTML = '<option value="">Select College</option>';
    this.colleges.forEach(college => {
      if (!college.is_disabled) {
        const option = document.createElement('option');
        option.value = college.id;
        option.textContent = college.college_name || college.name;
        select.appendChild(option);
      }
    });
  },

  /**
   * Load departments for selected college (for edit mode)
   */
  loadDepartments: async function (collegeId) {
    if (!collegeId) {
      const deptSelect = document.getElementById('adminTopicDepartment');
      const batchSelect = document.getElementById('adminTopicBatch');
      if (deptSelect) {
        deptSelect.innerHTML = '<option value="">Select Department</option>';
        deptSelect.disabled = true;
      }
      if (batchSelect) {
        batchSelect.innerHTML = '<option value="">Select Batch</option>';
        batchSelect.disabled = true;
      }
      return;
    }

    const deptSelect = document.getElementById('adminTopicDepartment');
    const batchSelect = document.getElementById('adminTopicBatch');
    if (deptSelect) deptSelect.disabled = false;
    if (batchSelect) {
      batchSelect.innerHTML = '<option value="">Select Batch</option>';
      batchSelect.disabled = true;
    }

    try {
      const response = await fetch(`${Config.API_BASE}/admin/departments`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        const allDepts = data.departments || data.data?.departments || [];
        this.departments = allDepts.filter(d => d.college_id === collegeId && !d.is_disabled);
        this.populateDepartmentSelect();
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  },

  /**
   * Populate department select (for edit mode)
   */
  populateDepartmentSelect: function () {
    const select = document.getElementById('adminTopicDepartment');
    if (!select) return;
    select.innerHTML = '<option value="">Select Department</option>';
    this.departments.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept.id;
      option.textContent = dept.department_name || dept.name;
      select.appendChild(option);
    });
  },

  /**
   * Load batches for selected department (for edit mode)
   */
  loadBatches: async function (departmentId) {
    if (!departmentId) {
      const batchSelect = document.getElementById('adminTopicBatch');
      if (batchSelect) {
        batchSelect.innerHTML = '<option value="">Select Batch</option>';
        batchSelect.disabled = true;
      }
      return;
    }
    const batchSelect = document.getElementById('adminTopicBatch');
    if (batchSelect) batchSelect.disabled = false;

    try {
      const response = await fetch(`${Config.API_BASE}/admin/batches`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        const allBatches = data.batches || data.data?.batches || [];
        this.batches = allBatches.filter(b => b.department_id === departmentId && !b.is_disabled);
        this.populateBatchSelect();
      }
    } catch (error) {
      console.error('Error loading batches:', error);
    }
  },

  /**
   * Populate batch select (for edit mode)
   */
  populateBatchSelect: function () {
    const select = document.getElementById('adminTopicBatch');
    if (!select) return;
    select.innerHTML = '<option value="">Select Batch</option>';
    this.batches.forEach(batch => {
      const option = document.createElement('option');
      option.value = batch.id;
      option.textContent = batch.batch_name || batch.name;
      select.appendChild(option);
    });
  },

  /**
   * Load topic details for editing
   */
  loadTopicForEdit: async function (topicId) {
    try {
      const response = await fetch(`${this.apiEndpoint}/${topicId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        const topic = data.topic || data.data?.topic || {};
        document.getElementById('adminTopicId').value = topicId;
        document.getElementById('adminTopicName').value = topic.topic_name || '';

        // For edit mode, we'll need to show single-select dropdowns
        // For now, just load the topic data
        // TODO: Implement edit mode with single selects or pre-select in multi-select

      } else {
        Utils.showMessage('adminTopicsMessage', 'Error loading topic', 'error');
      }
    } catch (error) {
      console.error('Error loading topic:', error);
      Utils.showMessage('adminTopicsMessage', 'Error loading topic', 'error');
    }
  },

  /**
   * Save single topic (for edit mode - backward compatibility)
   */
  save: async function () {
    const topicId = document.getElementById('adminTopicId').value;
    const topicName = document.getElementById('adminTopicName').value.trim();

    if (!topicName || topicName.length < 2) {
      Utils.showMessage('adminTopicsMessage', 'Topic name is required (min 2 chars)', 'error');
      return;
    }

    // For editing, we need to get the existing topic's hierarchy
    // Since we're only updating the name, just send the update

    try {
      const response = await fetch(`${this.apiEndpoint}/${topicId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ topic_name: topicName })
      });

      if (response.ok) {
        Utils.showMessage('adminTopicsMessage', 'Topic updated successfully', 'success');
        UI.closeModal('adminTopicModal');
        this.loadTopics();
      } else {
        const error = await response.json();
        Utils.showMessage('adminTopicsMessage', error.message || 'Error saving topic', 'error');
      }
    } catch (error) {
      console.error('Error saving topic:', error);
      Utils.showMessage('adminTopicsMessage', 'Error saving topic', 'error');
    }
  },

  /**
   * Load all topics
   */
  loadTopics: async function () {
    try {
      // Load hierarchy data first for name resolution
      await this.loadHierarchyData();

      const response = await fetch(this.apiEndpoint, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        this.displayTopics(data.topics || data.data?.topics || []);
      } else {
        Utils.showMessage('adminMessage', 'Error loading topics', 'error');
      }
    } catch (error) {
      console.error('Error loading topics:', error);
      Utils.showMessage('adminMessage', 'Error loading topics', 'error');
    }
  },

  /**
   * Display topics in a table
   */
  displayTopics: function (topics) {
    const container = document.getElementById('adminTopicsList');

    if (!topics || topics.length === 0) {
      container.innerHTML = '<p style="color: #999; text-align: center;">No topics created yet</p>';
      return;
    }

    let html = '<div class="table-container"><table class="table">';
    html += '<thead><tr>';
    html += '<th>Topic Name</th>';
    html += '<th>Batch</th>';
    html += '<th>Department</th>';
    html += '<th>College</th>';
    html += '<th style="text-align: center; width: 150px;">Actions</th>';
    html += '</tr></thead><tbody>';

    topics.forEach(topic => {
      if (topic.is_disabled) return;

      // Resolve names from IDs using helper functions
      const batchName = topic.batch_name || this.findBatchName(topic.batch_id);
      const deptName = topic.department_name || this.findDepartmentName(topic.department_id);
      const collegeName = topic.college_name || this.findCollegeName(topic.college_id);

      html += `<tr>`;
      html += `<td>${this.escapeHtml(topic.topic_name)}</td>`;
      html += `<td>${this.escapeHtml(batchName)}</td>`;
      html += `<td>${this.escapeHtml(deptName)}</td>`;
      html += `<td>${this.escapeHtml(collegeName)}</td>`;
      html += `<td class="flex-gap" style="justify-content: center;">`;
      html += `<button class="btn btn-sm btn-info" onclick="AdminTopics.openModal('${topic.id}')">Edit</button>`;
      html += `<button class="btn btn-sm btn-danger" onclick="AdminTopics.deleteConfirm('${topic.id}')">Delete</button>`;
      html += `</td>`;
      html += `</tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  /**
   * Delete topic with confirmation
   */
  deleteConfirm: function (topicId) {
    if (confirm('Are you sure you want to delete this topic?')) {
      this.delete(topicId);
    }
  },

  /**
   * Delete a topic
   */
  delete: async function (topicId) {
    try {
      const response = await fetch(`${this.apiEndpoint}/${topicId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        Utils.showMessage('adminMessage', 'Topic deleted successfully', 'success');
        this.loadTopics();
      } else {
        const error = await response.json();
        Utils.showMessage('adminMessage', error.message || 'Error deleting topic', 'error');
      }
    } catch (error) {
      console.error('Error deleting topic:', error);
      Utils.showMessage('adminMessage', 'Error deleting topic', 'error');
    }
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
window.AdminTopics = AdminTopics;
