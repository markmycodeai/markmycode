/**
 * Admin Topics Management
 * Handles Topics CRUD operations for System Admins with hierarchy selection
 */

const AdminTopics = {
  apiEndpoint: `${CONFIG.API_BASE_URL}/admin/topics`,
  editingId: null,
  colleges: [],
  departments: [],
  batches: [],

  /**
   * Open modal for creating/editing topic
   */
  openModal: function (topicId = null) {
    this.editingId = topicId;
    const modal = document.querySelector('#adminTopicModal .modal-header h3');
    const submit = document.querySelector('#adminTopicModal [type=submit]');

    if (topicId) {
      modal.textContent = 'Edit Topic';
      submit.textContent = 'Update Topic';
      this.loadTopicForEdit(topicId);
    } else {
      document.getElementById('adminTopicId').value = '';
      document.getElementById('adminTopicName').value = '';
      document.getElementById('adminTopicCollege').value = '';
      document.getElementById('adminTopicDepartment').value = '';
      document.getElementById('adminTopicBatch').value = '';
      modal.textContent = 'Add Topic';
      submit.textContent = 'Create Topic';
      this.loadColleges();
    }

    UI.openModal('adminTopicModal');
  },

  /**
   * Load colleges for dropdown
   */
  loadColleges: async function () {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/admin/colleges`, {
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
   * Populate college select
   */
  populateCollegeSelect: function () {
    const select = document.getElementById('adminTopicCollege');
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
   * Load departments for selected college
   */
  loadDepartments: async function (collegeId) {
    if (!collegeId) {
      document.getElementById('adminTopicDepartment').innerHTML = '<option value="">Select Department</option>';
      document.getElementById('adminTopicDepartment').disabled = true;
      document.getElementById('adminTopicBatch').innerHTML = '<option value="">Select Batch</option>';
      document.getElementById('adminTopicBatch').disabled = true;
      return;
    }

    // Enable department select
    document.getElementById('adminTopicDepartment').disabled = false;
    // Clear and disable batch select until department is selected
    document.getElementById('adminTopicBatch').innerHTML = '<option value="">Select Batch</option>';
    document.getElementById('adminTopicBatch').disabled = true;

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/admin/departments`, {
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
   * Populate department select
   */
  populateDepartmentSelect: function () {
    const select = document.getElementById('adminTopicDepartment');
    select.innerHTML = '<option value="">Select Department</option>';
    this.departments.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept.id;
      option.textContent = dept.department_name || dept.name;
      select.appendChild(option);
    });
  },

  /**
   * Load batches for selected department
   */
  loadBatches: async function (departmentId) {
    if (!departmentId) {
      document.getElementById('adminTopicBatch').innerHTML = '<option value="">Select Batch</option>';
      document.getElementById('adminTopicBatch').disabled = true;
      return;
    }
    document.getElementById('adminTopicBatch').disabled = false;

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/admin/batches`, {
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
   * Populate batch select
   */
  populateBatchSelect: function () {
    const select = document.getElementById('adminTopicBatch');
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
        document.getElementById('adminTopicCollege').value = topic.college_id || '';
        document.getElementById('adminTopicDepartment').value = topic.department_id || '';
        document.getElementById('adminTopicBatch').value = topic.batch_id || '';

        // Load dropdowns in sequence
        await this.loadColleges();
        if (topic.college_id) {
          await this.loadDepartments(topic.college_id);
        }
        if (topic.department_id) {
          await this.loadBatches(topic.department_id);
        }
      } else {
        UI.showMessage('adminTopicsMessage', 'Error loading topic', 'error');
      }
    } catch (error) {
      console.error('Error loading topic:', error);
      UI.showMessage('adminTopicsMessage', 'Error loading topic', 'error');
    }
  },

  /**
   * Save topic (create or update)
   */
  save: async function () {
    const topicId = document.getElementById('adminTopicId').value;
    const topicName = document.getElementById('adminTopicName').value.trim();
    const collegeId = document.getElementById('adminTopicCollege').value;
    const departmentId = document.getElementById('adminTopicDepartment').value;
    const batchId = document.getElementById('adminTopicBatch').value;

    if (!topicName || topicName.length < 2) {
      UI.showMessage('adminTopicsMessage', 'Topic name is required (min 2 chars)', 'error');
      return;
    }

    if (!collegeId || !departmentId || !batchId) {
      UI.showMessage('adminTopicsMessage', 'College, Department, and Batch are required', 'error');
      return;
    }

    const payload = {
      topic_name: topicName,
      college_id: collegeId,
      department_id: departmentId,
      batch_id: batchId
    };

    try {
      let response;
      if (topicId) {
        response = await fetch(`${this.apiEndpoint}/${topicId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(payload)
        });
      }

      if (response.ok) {
        UI.showMessage('adminTopicsMessage', topicId ? 'Topic updated successfully' : 'Topic created successfully', 'success');
        UI.closeModal('adminTopicModal');
        this.loadTopics();
      } else {
        const error = await response.json();
        UI.showMessage('adminTopicsMessage', error.message || 'Error saving topic', 'error');
      }
    } catch (error) {
      console.error('Error saving topic:', error);
      UI.showMessage('adminTopicsMessage', 'Error saving topic', 'error');
    }
  },

  /**
   * Load all topics
   */
  loadTopics: async function () {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        this.displayTopics(data.topics || data.data?.topics || []);
      } else {
        UI.showMessage('adminMessage', 'Error loading topics', 'error');
      }
    } catch (error) {
      console.error('Error loading topics:', error);
      UI.showMessage('adminMessage', 'Error loading topics', 'error');
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
    html += '<th style="text-align: center; width: 150px;">Actions</th>';
    html += '</tr></thead><tbody>';

    topics.forEach(topic => {
      if (topic.is_disabled) return;

      html += `<tr>`;
      html += `<td>${this.escapeHtml(topic.topic_name)}</td>`;
      html += `<td>${this.escapeHtml(topic.batch_name || topic.batch_id)}</td>`;
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
        UI.showMessage('adminMessage', 'Topic deleted successfully', 'success');
        this.loadTopics();
      } else {
        const error = await response.json();
        UI.showMessage('adminMessage', error.message || 'Error deleting topic', 'error');
      }
    } catch (error) {
      console.error('Error deleting topic:', error);
      UI.showMessage('adminMessage', 'Error deleting topic', 'error');
    }
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml: function (text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
};

// Export to global scope
window.AdminTopics = AdminTopics;
