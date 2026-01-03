/**
 * Admin Notes Management
 * Handles Notes CRUD operations for System Admins with hierarchy selection
 */

const AdminNotes = {
  apiEndpoint: `${CONFIG.API_BASE_URL}/admin/notes`,
  editingId: null,
  colleges: [],
  departments: [],
  batches: [],

  /**
   * Open modal for creating/editing note
   */
  openModal: function (noteId = null) {
    this.editingId = noteId;
    const modal = document.querySelector('#adminNoteModal .modal-header h3');
    const submit = document.querySelector('#adminNoteModal [type=submit]');

    if (noteId) {
      modal.textContent = 'Edit Note';
      submit.textContent = 'Update Note';
      this.loadNoteForEdit(noteId);
    } else {
      document.getElementById('adminNoteId').value = '';
      document.getElementById('adminNoteTitle').value = '';
      document.getElementById('adminNoteLink').value = '';
      document.getElementById('adminNoteCollege').value = '';
      document.getElementById('adminNoteDepartment').value = '';
      document.getElementById('adminNoteBatch').value = '';
      modal.textContent = 'Add Note';
      submit.textContent = 'Create Note';
      this.loadColleges();
    }

    UI.openModal('adminNoteModal');
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
    const select = document.getElementById('adminNoteCollege');
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
      document.getElementById('adminNoteDepartment').innerHTML = '<option value="">Select Department</option>';
      document.getElementById('adminNoteDepartment').disabled = true;
      document.getElementById('adminNoteBatch').innerHTML = '<option value="">Select Batch</option>';
      document.getElementById('adminNoteBatch').disabled = true;
      return;
    }

    // Enable department select
    document.getElementById('adminNoteDepartment').disabled = false;
    // Clear and disable batch select until department is selected
    document.getElementById('adminNoteBatch').innerHTML = '<option value="">Select Batch</option>';
    document.getElementById('adminNoteBatch').disabled = true;

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
    const select = document.getElementById('adminNoteDepartment');
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
      document.getElementById('adminNoteBatch').innerHTML = '<option value="">Select Batch</option>';
      document.getElementById('adminNoteBatch').disabled = true;
      return;
    }
    document.getElementById('adminNoteBatch').disabled = false;

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
    const select = document.getElementById('adminNoteBatch');
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
        document.getElementById('adminNoteCollege').value = note.college_id || '';
        document.getElementById('adminNoteDepartment').value = note.department_id || '';
        document.getElementById('adminNoteBatch').value = note.batch_id || '';

        // Load dropdowns in sequence
        await this.loadColleges();
        if (note.college_id) {
          await this.loadDepartments(note.college_id);
        }
        if (note.department_id) {
          await this.loadBatches(note.department_id);
        }
      } else {
        UI.showMessage('adminNotesMessage', 'Error loading note', 'error');
      }
    } catch (error) {
      console.error('Error loading note:', error);
      UI.showMessage('adminNotesMessage', 'Error loading note', 'error');
    }
  },

  /**
   * Save note (create or update)
   */
  save: async function () {
    const noteId = document.getElementById('adminNoteId').value;
    const title = document.getElementById('adminNoteTitle').value.trim();
    const driveLink = document.getElementById('adminNoteLink').value.trim();
    const collegeId = document.getElementById('adminNoteCollege').value;
    const departmentId = document.getElementById('adminNoteDepartment').value;
    const batchId = document.getElementById('adminNoteBatch').value;

    if (!title || title.length < 2) {
      UI.showMessage('adminNotesMessage', 'Title is required (min 2 chars)', 'error');
      return;
    }

    if (!driveLink || !this.isValidUrl(driveLink)) {
      UI.showMessage('adminNotesMessage', 'Valid Google Drive link is required', 'error');
      return;
    }

    if (!collegeId || !departmentId || !batchId) {
      UI.showMessage('adminNotesMessage', 'College, Department, and Batch are required', 'error');
      return;
    }

    const payload = {
      title: title,
      drive_link: driveLink,
      college_id: collegeId,
      department_id: departmentId,
      batch_id: batchId
    };

    try {
      let response;
      if (noteId) {
        response = await fetch(`${this.apiEndpoint}/${noteId}`, {
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
        UI.showMessage('adminNotesMessage', noteId ? 'Note updated successfully' : 'Note created successfully', 'success');
        UI.closeModal('adminNoteModal');
        this.loadNotes();
      } else {
        const error = await response.json();
        UI.showMessage('adminNotesMessage', error.message || 'Error saving note', 'error');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      UI.showMessage('adminNotesMessage', 'Error saving note', 'error');
    }
  },

  /**
   * Load all notes
   */
  loadNotes: async function () {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        this.displayNotes(data.notes || data.data?.notes || []);
      } else {
        UI.showMessage('adminMessage', 'Error loading notes', 'error');
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      UI.showMessage('adminMessage', 'Error loading notes', 'error');
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
    html += '<th style="text-align: center; width: 150px;">Actions</th>';
    html += '</tr></thead><tbody>';

    notes.forEach(note => {
      if (note.is_disabled) return;

      const linkDisplay = note.drive_link.substring(0, 40) + (note.drive_link.length > 40 ? '...' : '');
      html += `<tr>`;
      html += `<td>${this.escapeHtml(note.title)}</td>`;
      html += `<td><a href="${this.escapeHtml(note.drive_link)}" target="_blank" style="color: var(--primary); text-decoration: none;">${linkDisplay}</a></td>`;
      html += `<td>${this.escapeHtml(note.batch_name || note.batch_id)}</td>`;
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
        UI.showMessage('adminMessage', 'Note deleted successfully', 'success');
        this.loadNotes();
      } else {
        const error = await response.json();
        UI.showMessage('adminMessage', error.message || 'Error deleting note', 'error');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      UI.showMessage('adminMessage', 'Error deleting note', 'error');
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
window.AdminNotes = AdminNotes;
