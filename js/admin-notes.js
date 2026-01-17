/**
 * Admin Notes Management
 * Handles Notes CRUD operations for System Admins with multi-select hierarchy
 */

const AdminNotes = {
  apiEndpoint: `${CONFIG.API_BASE_URL}/admin/notes`,
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
      const collegesRes = await fetch(`${CONFIG.API_BASE_URL}/admin/colleges`, { headers });
      if (collegesRes.ok) {
        const data = await collegesRes.json();
        this.colleges = data.colleges || data.data?.colleges || [];
      }

      // Load departments
      const deptsRes = await fetch(`${CONFIG.API_BASE_URL}/admin/departments`, { headers });
      if (deptsRes.ok) {
        const data = await deptsRes.json();
        this.departments = data.departments || data.data?.departments || [];
      }

      // Load batches
      const batchesRes = await fetch(`${CONFIG.API_BASE_URL}/admin/batches`, { headers });
      if (batchesRes.ok) {
        const data = await batchesRes.json();
        this.batches = data.batches || data.data?.batches || [];
      }
    } catch (error) {
      console.error('Error loading hierarchy data:', error);
    }
  },

  /**
   * Open modal for creating/editing note
   */
  openModal: function (noteId = null) {
    this.editingId = noteId;
    const modal = document.querySelector('#adminNoteModal .modal-header h3');
    const submit = document.querySelector('#adminNoteModal [type=submit]');

    if (noteId) {
      // Edit mode - use single select (keep original behavior for editing)
      modal.textContent = 'Edit Note';
      submit.textContent = 'Update Note';
      submit.setAttribute('onclick', 'AdminNotes.save()');
      this.loadNoteForEdit(noteId);
    } else {
      // Create mode - use multi-select
      document.getElementById('adminNoteId').value = '';
      document.getElementById('adminNoteTitle').value = '';
      document.getElementById('adminNoteLink').value = '';
      modal.textContent = 'Add Note';
      submit.textContent = 'Create Note(s)';
      submit.setAttribute('onclick', 'AdminNotes.saveMultiple()');

      // Initialize multi-select hierarchy
      this.initMultiSelect();
    }

    UI.openModal('adminNoteModal');
  },

  /**
   * Initialize multi-select hierarchy for creating notes
   */
  initMultiSelect: function () {
    MultiSelectHierarchy.init({
      collegesContainerId: 'adminNoteCollegesContainer',
      departmentsContainerId: 'adminNoteDepartmentsContainer',
      batchesContainerId: 'adminNoteBatchesContainer',
      showTopics: false,
      onSelectionChange: (selection) => {
        // Update counts in headers
        document.getElementById('adminNoteCollegeCount').textContent = selection.colleges.length;
        document.getElementById('adminNoteDepartmentCount').textContent = selection.departments.length;
        document.getElementById('adminNoteBatchCount').textContent = selection.batches.length;
      }
    });
  },

  /**
   * Save multiple notes (one for each selected batch)
   */
  saveMultiple: async function () {
    const title = document.getElementById('adminNoteTitle').value.trim();
    const driveLink = document.getElementById('adminNoteLink').value.trim();

    if (!title || title.length < 2) {
      Utils.showMessage('adminNotesMessage', 'Title is required (min 2 chars)', 'error');
      return;
    }

    if (!driveLink || !this.isValidUrl(driveLink)) {
      Utils.showMessage('adminNotesMessage', 'Valid Google Drive link is required', 'error');
      return;
    }

    const selectedBatches = MultiSelectHierarchy.getSelectedBatchesWithInfo();

    if (selectedBatches.length === 0) {
      Utils.showMessage('adminNotesMessage', 'Please select at least one batch', 'error');
      return;
    }

    // Show loading
    Utils.showMessage('adminNotesMessage', `Creating note in ${selectedBatches.length} batch(es)...`, 'info');

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Create note in each selected batch
    for (const batch of selectedBatches) {
      try {
        const payload = {
          title: title,
          drive_link: driveLink,
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
      Utils.showMessage('adminNotesMessage', `Successfully created note in ${successCount} batch(es)`, 'success');
      setTimeout(() => {
        UI.closeModal('adminNoteModal');
        this.loadNotes();
      }, 1500);
    } else {
      let msg = `Created in ${successCount} batch(es), failed in ${errorCount} batch(es).`;
      if (errors.length > 0) {
        msg += ' Errors: ' + errors.slice(0, 3).join(', ');
        if (errors.length > 3) msg += '...';
      }
      Utils.showMessage('adminNotesMessage', msg, errorCount === selectedBatches.length ? 'error' : 'warning');
      this.loadNotes();
    }
  },

  /**
   * Load colleges for dropdown (for edit mode - backward compatibility)
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
   * Populate college select (for edit mode)
   */
  populateCollegeSelect: function () {
    const select = document.getElementById('adminNoteCollege');
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
      const deptSelect = document.getElementById('adminNoteDepartment');
      const batchSelect = document.getElementById('adminNoteBatch');
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

    const deptSelect = document.getElementById('adminNoteDepartment');
    const batchSelect = document.getElementById('adminNoteBatch');
    if (deptSelect) deptSelect.disabled = false;
    if (batchSelect) {
      batchSelect.innerHTML = '<option value="">Select Batch</option>';
      batchSelect.disabled = true;
    }

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
   * Populate department select (for edit mode)
   */
  populateDepartmentSelect: function () {
    const select = document.getElementById('adminNoteDepartment');
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
      const batchSelect = document.getElementById('adminNoteBatch');
      if (batchSelect) {
        batchSelect.innerHTML = '<option value="">Select Batch</option>';
        batchSelect.disabled = true;
      }
      return;
    }
    const batchSelect = document.getElementById('adminNoteBatch');
    if (batchSelect) batchSelect.disabled = false;

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
   * Populate batch select (for edit mode)
   */
  populateBatchSelect: function () {
    const select = document.getElementById('adminNoteBatch');
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
   * Load note details for editing
   */
  loadNoteForEdit: async function (noteId) {
    try {
      const response = await fetch(`${this.apiEndpoint}/${noteId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        const note = data.note || data.data?.note || {};
        document.getElementById('adminNoteId').value = noteId;
        document.getElementById('adminNoteTitle').value = note.title || '';
        document.getElementById('adminNoteLink').value = note.drive_link || '';

        // For edit mode, just update the note
        // TODO: Implement edit mode UI

      } else {
        Utils.showMessage('adminNotesMessage', 'Error loading note', 'error');
      }
    } catch (error) {
      console.error('Error loading note:', error);
      Utils.showMessage('adminNotesMessage', 'Error loading note', 'error');
    }
  },

  /**
   * Save single note (for edit mode - backward compatibility)
   */
  save: async function () {
    const noteId = document.getElementById('adminNoteId').value;
    const title = document.getElementById('adminNoteTitle').value.trim();
    const driveLink = document.getElementById('adminNoteLink').value.trim();

    if (!title || title.length < 2) {
      Utils.showMessage('adminNotesMessage', 'Title is required (min 2 chars)', 'error');
      return;
    }

    if (!driveLink || !this.isValidUrl(driveLink)) {
      Utils.showMessage('adminNotesMessage', 'Valid Google Drive link is required', 'error');
      return;
    }

    try {
      const response = await fetch(`${this.apiEndpoint}/${noteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ title, drive_link: driveLink })
      });

      if (response.ok) {
        Utils.showMessage('adminNotesMessage', 'Note updated successfully', 'success');
        UI.closeModal('adminNoteModal');
        this.loadNotes();
      } else {
        const error = await response.json();
        Utils.showMessage('adminNotesMessage', error.message || 'Error saving note', 'error');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      Utils.showMessage('adminNotesMessage', 'Error saving note', 'error');
    }
  },

  /**
   * Load all notes
   */
  loadNotes: async function () {
    try {
      // Load hierarchy data first for name resolution
      await this.loadHierarchyData();

      const response = await fetch(this.apiEndpoint, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        this.displayNotes(data.notes || data.data?.notes || []);
      } else {
        Utils.showMessage('adminMessage', 'Error loading notes', 'error');
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      Utils.showMessage('adminMessage', 'Error loading notes', 'error');
    }
  },

  /**
   * Display notes in a table
   */
  displayNotes: function (notes) {
    const container = document.getElementById('adminNotesList');

    if (!notes || notes.length === 0) {
      container.innerHTML = '<p style="color: #999; text-align: center;">No notes created yet</p>';
      return;
    }

    let html = '<div class="table-container"><table class="table">';
    html += '<thead><tr>';
    html += '<th>Title</th>';
    html += '<th>Drive Link</th>';
    html += '<th>Batch</th>';
    html += '<th>Department</th>';
    html += '<th>College</th>';
    html += '<th style="text-align: center; width: 150px;">Actions</th>';
    html += '</tr></thead><tbody>';

    notes.forEach(note => {
      if (note.is_disabled) return;

      // Resolve names from IDs using helper functions
      const batchName = note.batch_name || this.findBatchName(note.batch_id);
      const deptName = note.department_name || this.findDepartmentName(note.department_id);
      const collegeName = note.college_name || this.findCollegeName(note.college_id);

      const linkDisplay = note.drive_link ? (note.drive_link.substring(0, 30) + (note.drive_link.length > 30 ? '...' : '')) : '';
      html += `<tr>`;
      html += `<td>${this.escapeHtml(note.title)}</td>`;
      html += `<td><a href="${this.escapeHtml(note.drive_link)}" target="_blank" style="color: var(--primary-500); text-decoration: none;">${linkDisplay}</a></td>`;
      html += `<td>${this.escapeHtml(batchName)}</td>`;
      html += `<td>${this.escapeHtml(deptName)}</td>`;
      html += `<td>${this.escapeHtml(collegeName)}</td>`;
      html += `<td class="flex-gap" style="justify-content: center;">`;
      html += `<button class="btn btn-sm btn-info" onclick="AdminNotes.openModal('${note.id}')">Edit</button>`;
      html += `<button class="btn btn-sm btn-danger" onclick="AdminNotes.deleteConfirm('${note.id}')">Delete</button>`;
      html += `</td>`;
      html += `</tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  /**
   * Delete note with confirmation
   */
  deleteConfirm: function (noteId) {
    if (confirm('Are you sure you want to delete this note?')) {
      this.delete(noteId);
    }
  },

  /**
   * Delete a note
   */
  delete: async function (noteId) {
    try {
      const response = await fetch(`${this.apiEndpoint}/${noteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        Utils.showMessage('adminMessage', 'Note deleted successfully', 'success');
        this.loadNotes();
      } else {
        const error = await response.json();
        Utils.showMessage('adminMessage', error.message || 'Error deleting note', 'error');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      Utils.showMessage('adminMessage', 'Error deleting note', 'error');
    }
  },

  /**
   * Validate URL format
   */
  isValidUrl: function (url) {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:' ||
        url.includes('drive.google.com');
    } catch (e) {
      return false;
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
window.AdminNotes = AdminNotes;
