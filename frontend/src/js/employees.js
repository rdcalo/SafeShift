// ==========================================
// EMPLOYEES PAGE JAVASCRIPT
// ==========================================
// Add to employees.html: <script src="js/app.js"></script>
// Add to employees.html: <script src="js/employees.js"></script>

(function() {
  let currentUser = null;
  let allEmployees = [];
  let filteredEmployees = [];
  let selectedDepartment = 'All Employees';

  document.addEventListener('DOMContentLoaded', async function() {
    if (window.SafeShift && window.SafeShift.Auth) {
        currentUser = await window.SafeShift.Auth.init();
        if (!window.SafeShift.Auth.requireAuth('admin')) {
          return;
        }
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
    if(currentUser) updateUserInfo();
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
            <div class="action-container">
                <button class="action-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                <div class="action-dropdown">
                    <div class="dropdown-item" data-action="view" data-emp-id="${emp.id}"><i class="fa-regular fa-user"></i> View Profile</div>
                    <div class="dropdown-item" data-action="edit" data-emp-id="${emp.id}"><i class="fa-solid fa-pen"></i> Edit Details</div>
                    <div class="dropdown-item" data-action="reset" data-emp-id="${emp.id}"><i class="fa-solid fa-lock"></i> Reset Password</div>
                    <div class="dropdown-item danger" data-action="deactivate" data-emp-id="${emp.id}"><i class="fa-solid fa-ban"></i> Deactivate</div>
                </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function updateDepartmentCounts() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
      const btnText = btn.textContent.trim();
      if (btnText.includes('All Employees')) return;

      const deptName = btn.childNodes[0].nodeValue.trim(); 
      const count = allEmployees.filter(e => e.department === deptName).length;
      
      const badge = btn.querySelector('.count-badge');
      if (badge) badge.textContent = count;
    });
  }

  // ==========================================
  // CUSTOM ALERT SYSTEM (Shared)
  // ==========================================
  function showCustomAlert(title, message, type = 'success') {
      const modal = document.getElementById('customAlertModal');
      const iconContainer = document.getElementById('alertIconContainer');
      const icon = document.getElementById('alertIcon');
      const titleEl = document.getElementById('alertTitle');
      const msgEl = document.getElementById('alertMessage');
      const okBtn = document.getElementById('alertOkBtn');

      iconContainer.classList.remove('alert-icon-success', 'alert-icon-error');
      icon.classList.remove('fa-check', 'fa-xmark');

      titleEl.textContent = title;
      msgEl.innerHTML = message;

      if (type === 'success') {
          iconContainer.classList.add('alert-icon-success');
          icon.classList.add('fa-check');
      } else if (type === 'error') {
          iconContainer.classList.add('alert-icon-error');
          icon.classList.add('fa-xmark');
      }

      modal.classList.add('active');

      const closeAlert = () => {
          modal.classList.remove('active');
          okBtn.removeEventListener('click', closeAlert);
      };
      okBtn.addEventListener('click', closeAlert);
      modal.onclick = (e) => { if (e.target === modal) closeAlert(); };
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
        
        let btnText = this.textContent.trim();
        if(this.querySelector('.count-badge')) {
             btnText = this.childNodes[0].nodeValue.trim();
        }
        const department = btnText === 'All Employees' ? 'All Employees' : btnText;
        
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
          showCustomAlert('Warning', 'No employees selected', 'error');
          return;
        }

        if (action === 'Actions') {
          showCustomAlert('Warning', 'Please select an action first', 'error');
          return;
        }

        const empIds = Array.from(selectedRows).map(row => row.dataset.id);
        
        if (action === 'Delete') {
            // Simple mock deletion
            await bulkDeleteEmployees(empIds);
        } else if (action === 'Deactivate') {
            await bulkUpdateStatus(empIds, 'Inactive');
        } else if (action === 'Change Department') {
             showCustomAlert('Info', 'Change Department dialog placeholder', 'success');
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
        showCustomAlert('Success', `Successfully deleted ${empIds.length} employee(s)`, 'success');
        await loadAllEmployees(selectedDepartment);
      } catch (error) {
        console.error('Error deleting employees:', error);
        showCustomAlert('Error', 'Failed to delete employees.', 'error');
      }
    }

    async function bulkUpdateStatus(empIds, newStatus) {
      try {
        for (const id of empIds) {
          await window.SafeShift.Employees.update(id, { status: newStatus });
        }
        showCustomAlert('Success', `Updated status for ${empIds.length} employee(s)`, 'success');
        await loadAllEmployees(selectedDepartment);
      } catch (error) {
        console.error('Error updating employees:', error);
        showCustomAlert('Error', 'Failed to update status.', 'error');
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
          // Mock view profile
          showCustomAlert('Profile', `Viewing profile for Employee #${empId}`, 'success');
      } else if (action === 'edit') {
          showCustomAlert('Info', 'Edit functionality coming soon!', 'success');
      } else if (action === 'reset') {
          const newPassword = window.SafeShift.Employees.generateTempPassword();
          showCustomAlert('Reset Successful', `New temp password: <b>${newPassword}</b><br>Email sent to user.`, 'success');
      } else if (action === 'deactivate') {
          // Direct deactivate without browser confirm, or implement customConfirm here
          await window.SafeShift.Employees.update(empId, { status: 'Inactive' });
          await loadAllEmployees(selectedDepartment);
          showCustomAlert('Deactivated', 'Employee has been deactivated.', 'success');
      }

      document.querySelectorAll('.action-dropdown').forEach(d => d.classList.remove('active'));
    });
  }

  // ==========================================
  // MODALS
  // ==========================================
  function initializeModals() {
    initializeAddEmployeeModal();
  }

  function initializeAddEmployeeModal() {
    const addEmployeeBtn = document.getElementById('addEmployeeBtn');
    const modal = document.getElementById('addEmployeeModal');
    const closeButtons = document.querySelectorAll('.close-modal-btn, .close-modal-btn-action');
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
          name: form.querySelector('input[placeholder="Enter full name"]').value.trim(),
          email: form.querySelector('input[type="email"]').value.trim(),
          department: form.querySelector('select').value,
          role: form.querySelector('input[placeholder="Enter role/position"]').value.trim()
        };

        if (!formData.name || !formData.email || !formData.department || !formData.role) {
          showCustomAlert('Error', 'Please fill in all required fields', 'error');
          return;
        }

        try {
          const result = await window.SafeShift.Employees.create(formData);
          
          modal.classList.remove('active');
          form.reset();
          
          showCustomAlert(
            'Employee Created', 
            `Name: <strong>${result.employee.name}</strong><br>
             Email: ${result.employee.email}<br>
             <span style="font-size:0.8rem; color:#666;">(Temp Password sent to email)</span>`, 
            'success'
          );
          
          await loadAllEmployees(selectedDepartment);
          
        } catch (error) {
          console.error('Error creating employee:', error);
          showCustomAlert('Error', 'Failed to create employee. Please try again.', 'error');
        }
      });
    }
  }

  function setupLogoutHandler() {
    const logoutLink = document.querySelector('.logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        // Mock logout alert
        showCustomAlert('Logging Out', 'You are being logged out...', 'success');
        setTimeout(() => {
             if (window.SafeShift && window.SafeShift.Auth) {
                 window.SafeShift.Auth.logout();
             }
        }, 1000);
      });
    }
  }

})();