// ==========================================
// EMPLOYEES PAGE JAVASCRIPT
// ==========================================
// Add to employees.html: <script src="app.js"></script>
// Add to employees.html: <script src="employees.js"></script>

(function() {
  let currentUser = null;
  let allEmployees = [];
  let filteredEmployees = [];
  let selectedDepartment = 'All Employees';

  document.addEventListener('DOMContentLoaded', async function() {
    currentUser = await window.SafeShift.Auth.init();
    if (!window.SafeShift.Auth.requireAuth('admin')) {
      return;
    }

    await initializeEmployeesPage();
    initializeFilters();
    initializeSearch();
    initializeSelection();
    initializeModals();
    initializeActionDropdowns();
    setupLogoutHandler();
  });

  async function initializeEmployeesPage() {
    updateUserInfo();
    await loadAllEmployees();
  }

  function updateUserInfo() {
    const sidebarName = document.querySelector('.user-profile-mini .user-info h4');
    const sidebarDept = document.querySelector('.user-profile-mini .user-info p');
    
    if (sidebarName) sidebarName.textContent = currentUser.name;
    if (sidebarDept) sidebarDept.textContent = currentUser.department;

    const topName = document.querySelector('.top-user-text h4');
    const topDept = document.querySelector('.top-user-text span');
    
    if (topName) topName.textContent = currentUser.name;
    if (topDept) topDept.textContent = currentUser.department;
  }

  async function loadAllEmployees(department = 'All Employees') {
    try {
      allEmployees = await window.SafeShift.Employees.getAll();
      
      if (department === 'All Employees') {
        filteredEmployees = allEmployees;
      } else {
        filteredEmployees = allEmployees.filter(e => e.department === department);
      }

      renderEmployees(filteredEmployees);
      updateDepartmentCounts();
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  }

  function renderEmployees(employees) {
    const tbody = document.querySelector('#employeesTable tbody');
    if (!tbody) return;

    const colors = ['#64a6ff', '#feca57', '#ff6b6b', '#00cd78', '#a29bfe'];

    tbody.innerHTML = employees.map((emp, index) => {
      const initials = window.SafeShift.Utils.getInitials(emp.name);
      const color = colors[index % colors.length];
      const statusClass = emp.status === 'Active' ? 'st-active' : 
                         emp.status === 'On Leave' ? 'st-leave' : 'st-inactive';

      return `
        <tr class="emp-row" data-id="${emp.id}">
          <td onclick="event.stopPropagation(); toggleSelect(this)">
            <div class="select-circle"></div>
          </td>
          <td>
            <div class="employee-cell">
              <div class="profile-pic" style="background-color: ${color};">${initials}</div>
              <div class="emp-details">
                <span class="emp-name">${emp.name}</span>
                <span class="emp-email">${emp.email}</span>
              </div>
            </div>
          </td>
          <td>${emp.department}</td>
          <td>${emp.role}</td>
          <td><span class="status-badge ${statusClass}">${emp.status}</span></td>
          <td>${window.SafeShift.Utils.formatDate(emp.lastActive)}</td>
          <td>
            <div class="action-wrapper">
              <i class="fa-regular fa-eye action-icon view-report-trigger" data-emp-id="${emp.id}"></i>
              <div class="action-container">
                <button class="action-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                <div class="action-dropdown">
                  <div class="dropdown-item" data-action="view" data-emp-id="${emp.id}">
                    <i class="fa-regular fa-user"></i> View Profile
                  </div>
                  <div class="dropdown-item" data-action="edit" data-emp-id="${emp.id}">
                    <i class="fa-solid fa-pen"></i> Edit Details
                  </div>
                  <div class="dropdown-item" data-action="reset" data-emp-id="${emp.id}">
                    <i class="fa-solid fa-lock"></i> Reset Password
                  </div>
                  <div class="dropdown-item danger" data-action="deactivate" data-emp-id="${emp.id}">
                    <i class="fa-solid fa-ban"></i> Deactivate
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Add eye icon handlers
    document.querySelectorAll('.view-report-trigger').forEach(icon => {
      icon.addEventListener('click', async (e) => {
        e.stopPropagation();
        const empId = icon.dataset.empId;
        await openReportDetailsModal(empId);
      });
    });
  }

  function updateDepartmentCounts() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
      const btnText = btn.textContent.trim();
      
      if (btnText === 'All Employees') {
        return;
      }

      const deptName = btnText.split('\n')[0].trim();
      const count = allEmployees.filter(e => e.department === deptName).length;
      
      const badge = btn.querySelector('.count-badge');
      if (badge) {
        badge.textContent = count;
      }
    });
  }

  // ==========================================
  // FILTERS
  // ==========================================
  function initializeFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
      btn.addEventListener('click', function() {
        filterButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const btnText = this.textContent.trim();
        const department = btnText === 'All Employees' ? 'All Employees' : btnText.split('\n')[0].trim();
        
        selectedDepartment = department;
        loadAllEmployees(department);
      });
    });
  }

  // ==========================================
  // SEARCH
  // ==========================================
  function initializeSearch() {
    const searchInput = document.querySelector('.search-input');
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query === '') {
          renderEmployees(filteredEmployees);
          return;
        }

        const searchResults = filteredEmployees.filter(emp => 
          emp.name.toLowerCase().includes(query) ||
          emp.email.toLowerCase().includes(query) ||
          emp.id.toLowerCase().includes(query) ||
          emp.role.toLowerCase().includes(query)
        );

        renderEmployees(searchResults);
      });
    }
  }

  // ==========================================
  // SELECTION & BULK ACTIONS
  // ==========================================
  function initializeSelection() {
    const bulkBar = document.getElementById('bulkActionBar');
    const selectedCountLabel = document.getElementById('selectedCount');
    const bulkCancelBtn = document.getElementById('bulkCancelBtn');
    const bulkApplyBtn = document.getElementById('bulkApplyBtn');
    const bulkSelect = document.querySelector('.bulk-select');

    if (bulkCancelBtn) {
      bulkCancelBtn.addEventListener('click', () => {
        document.querySelectorAll('.select-circle').forEach(c => c.classList.remove('selected'));
        document.querySelectorAll('.emp-row').forEach(r => r.classList.remove('selected'));
        updateBulkBar();
      });
    }

    if (bulkApplyBtn) {
      bulkApplyBtn.addEventListener('click', async () => {
        const action = bulkSelect.value;
        const selectedRows = document.querySelectorAll('.emp-row.selected');
        
        if (selectedRows.length === 0) {
          alert('No employees selected');
          return;
        }

        if (action === 'Actions') {
          alert('Please select an action first');
          return;
        }

        const empIds = Array.from(selectedRows).map(row => row.dataset.id);
        
        if (action === 'Delete') {
          if (confirm(`Are you sure you want to delete ${empIds.length} employee(s)?`)) {
            await bulkDeleteEmployees(empIds);
          }
        } else if (action === 'Deactivate') {
          await bulkUpdateStatus(empIds, 'Inactive');
        }

        bulkCancelBtn.click();
      });
    }

    window.toggleSelect = function(td) {
      const circle = td.querySelector('.select-circle');
      const row = td.closest('tr');
      
      circle.classList.toggle('selected');
      row.classList.toggle('selected');
      
      updateBulkBar();
    };

    function updateBulkBar() {
      const selected = document.querySelectorAll('.select-circle.selected').length;
      
      if (selected > 0) {
        bulkBar.classList.add('active');
        selectedCountLabel.innerText = `${selected} Selected`;
      } else {
        bulkBar.classList.remove('active');
      }
    }

    async function bulkDeleteEmployees(empIds) {
      try {
        for (const id of empIds) {
          await window.SafeShift.Employees.delete(id);
        }
        
        alert(`Successfully deleted ${empIds.length} employee(s)`);
        await loadAllEmployees(selectedDepartment);
        
      } catch (error) {
        console.error('Error deleting employees:', error);
        alert('Failed to delete employees. Please try again.');
      }
    }

    async function bulkUpdateStatus(empIds, newStatus) {
      try {
        for (const id of empIds) {
          await window.SafeShift.Employees.update(id, { status: newStatus });
        }
        
        alert(`Successfully updated ${empIds.length} employee(s) to "${newStatus}"`);
        await loadAllEmployees(selectedDepartment);
        
      } catch (error) {
        console.error('Error updating employees:', error);
        alert('Failed to update employees. Please try again.');
      }
    }
  }

  // ==========================================
  // ACTION DROPDOWNS
  // ==========================================
  function initializeActionDropdowns() {
    document.addEventListener('click', (e) => {
      const isActionBtn = e.target.closest('.action-btn');
      const currentDropdown = isActionBtn ? isActionBtn.nextElementSibling : null;

      document.querySelectorAll('.action-dropdown').forEach(d => {
        if (d !== currentDropdown) d.classList.remove('active');
      });

      if (currentDropdown) {
        currentDropdown.classList.toggle('active');
        e.stopPropagation();
      } else if (!e.target.closest('.action-dropdown')) {
        document.querySelectorAll('.action-dropdown').forEach(d => d.classList.remove('active'));
      }
    });

    // Handle dropdown actions
    document.addEventListener('click', async (e) => {
      const dropdownItem = e.target.closest('.dropdown-item');
      if (!dropdownItem) return;

      const action = dropdownItem.dataset.action;
      const empId = dropdownItem.dataset.empId;

      if (action === 'view') {
        await openReportDetailsModal(empId);
      } else if (action === 'edit') {
        alert('Edit functionality coming soon!');
      } else if (action === 'reset') {
        const newPassword = window.SafeShift.Employees.generateTempPassword();
        alert(`Password reset!\n\nNew temporary password: ${newPassword}\n\nAn email has been sent to the employee.`);
      } else if (action === 'deactivate') {
        if (confirm('Are you sure you want to deactivate this employee?')) {
          await window.SafeShift.Employees.update(empId, { status: 'Inactive' });
          await loadAllEmployees(selectedDepartment);
        }
      }

      document.querySelectorAll('.action-dropdown').forEach(d => d.classList.remove('active'));
    });
  }

  // ==========================================
  // MODALS
  // ==========================================
  function initializeModals() {
    initializeAddEmployeeModal();
    initializeReportDetailsModal();
  }

  function initializeAddEmployeeModal() {
    const addEmployeeBtn = document.getElementById('addEmployeeBtn');
    const modal = document.getElementById('addEmployeeModal');
    const closeButtons = modal.querySelectorAll('.close-modal-btn, .close-modal-btn-action');
    const form = modal.querySelector('form');
    const saveBtn = document.getElementById('saveEmployeeBtn');

    if (addEmployeeBtn) {
      addEmployeeBtn.addEventListener('click', () => {
        modal.classList.add('active');
      });
    }

    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modal.classList.remove('active');
        form.reset();
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        form.reset();
      }
    });

    if (saveBtn) {
      saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        const formData = {
          name: form.querySelector('input[type="text"]').value.trim(),
          email: form.querySelector('input[type="email"]').value.trim(),
          department: form.querySelector('select').value,
          role: form.querySelectorAll('input[type="text"]')[1].value.trim()
        };

        if (!formData.name || !formData.email || !formData.department || !formData.role) {
          alert('Please fill in all required fields');
          return;
        }

        try {
          const result = await window.SafeShift.Employees.create(formData);
          
          alert(`Employee created successfully!\n\nName: ${result.employee.name}\nEmail: ${result.employee.email}\nTemporary Password: ${result.tempPassword}\n\nAn email has been sent to the employee.`);
          
          modal.classList.remove('active');
          form.reset();
          
          await loadAllEmployees(selectedDepartment);
          
        } catch (error) {
          console.error('Error creating employee:', error);
          alert('Failed to create employee. Please try again.');
        }
      });
    }
  }

  async function openReportDetailsModal(empId) {
    const modal = document.getElementById('reportDetailsModal');
    const employee = await window.SafeShift.Employees.getById(empId);
    const reports = await window.SafeShift.Reports.getAll();
    const empReports = reports.filter(r => r.submittedBy === empId);
    
    if (!employee) {
      alert('Employee not found');
      return;
    }

    // Show most recent report from this employee
    const latestReport = empReports[0];
    
    if (!latestReport) {
      alert(`${employee.name} has not submitted any reports yet.`);
      return;
    }

    // Populate modal with latest report
    modal.querySelector('.modal-title').textContent = `Report ${latestReport.id}`;
    
    const detailBoxes = modal.querySelectorAll('.detail-box .detail-value');
    if (detailBoxes[0]) detailBoxes[0].textContent = latestReport.department;
    if (detailBoxes[2]) detailBoxes[2].textContent = latestReport.isAnonymous ? 'Anonymous' : employee.name;
    if (detailBoxes[3]) detailBoxes[3].textContent = window.SafeShift.Utils.formatDate(latestReport.submittedAt);
    
    const severityBadge = modal.querySelector('.detail-box .badge');
    if (severityBadge) {
      severityBadge.className = `badge ${window.SafeShift.Utils.getSeverityClass(latestReport.severity)}`;
      severityBadge.textContent = latestReport.severity;
    }

    const flagBanner = modal.querySelector('.auto-flag-banner');
    if (latestReport.autoFlagged && flagBanner) {
      flagBanner.style.display = 'flex';
      flagBanner.querySelector('div').textContent = latestReport.flagReason || 'Report auto-flagged for review';
    } else if (flagBanner) {
      flagBanner.style.display = 'none';
    }

    const descBox = modal.querySelector('.form-label + div');
    if (descBox) descBox.textContent = latestReport.description;

    const statusSelect = modal.querySelector('.form-select');
    if (statusSelect) statusSelect.value = latestReport.status;

    modal.classList.add('active');
    modal.dataset.currentReportId = latestReport.id;
  }

  function initializeReportDetailsModal() {
    const modal = document.getElementById('reportDetailsModal');
    const closeButtons = modal.querySelectorAll('.close-modal-btn, .close-modal-btn-action');
    const saveBtn = document.getElementById('saveReportBtn');

    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const reportId = modal.dataset.currentReportId;
        const newStatus = modal.querySelector('.form-select').value;

        try {
          await window.SafeShift.Reports.updateStatus(reportId, newStatus);
          
          alert('Report updated successfully!');
          modal.classList.remove('active');
          
        } catch (error) {
          console.error('Error updating report:', error);
          alert('Failed to update report. Please try again.');
        }
      });
    }
  }

  function setupLogoutHandler() {
    const logoutLink = document.querySelector('.logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to log out?')) {
          await window.SafeShift.Auth.logout();
        }
      });
    }
  }

})();