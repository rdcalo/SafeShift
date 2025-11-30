// ==========================================
// ADMIN DASHBOARD JAVASCRIPT
// ==========================================
// Add to admin_dashboard.html: <script src="app.js"></script>
// Add to admin_dashboard.html: <script src="admin_dashboard.js"></script>

(function() {
  let currentUser = null;

  document.addEventListener('DOMContentLoaded', async function() {
    // Require admin authentication
    currentUser = await window.SafeShift.Auth.init();
    if (!window.SafeShift.Auth.requireAuth('admin')) {
      return;
    }

    console.log('Admin Dashboard loaded for:', currentUser.name);

    await initializeAdminDashboard();
    initializeModals();
    setupLogoutHandler();
  });

  async function initializeAdminDashboard() {
    updateUserInfo();
    await loadDashboardStats();
    await loadDepartments();
    await loadRecentReports();
  }

  function updateUserInfo() {
    // Update sidebar
    const sidebarName = document.querySelector('.user-profile-mini .user-info h4');
    const sidebarDept = document.querySelector('.user-profile-mini .user-info p');
    
    if (sidebarName) sidebarName.textContent = currentUser.name;
    if (sidebarDept) sidebarDept.textContent = currentUser.department;

    // Update top user area
    const topName = document.querySelector('.top-user-text h4');
    const topDept = document.querySelector('.top-user-text span');
    
    if (topName) topName.textContent = currentUser.name;
    if (topDept) topDept.textContent = currentUser.department;
  }

  async function loadDashboardStats() {
    try {
      const employees = await window.SafeShift.Employees.getAll();
      const reports = await window.SafeShift.Reports.getAll();
      const activeReports = reports.filter(r => r.status !== 'Resolved');
      const flaggedReports = reports.filter(r => r.autoFlagged);
      
      // Calculate average wellness
      const avgWellness = Math.round(
        employees.reduce((sum, e) => sum + (e.wellnessScore || 50), 0) / employees.length
      );

      // Update stat boxes
      const statBoxes = document.querySelectorAll('.stat-box h2');
      if (statBoxes[0]) statBoxes[0].textContent = employees.length;
      if (statBoxes[1]) statBoxes[1].textContent = activeReports.length;
      if (statBoxes[2]) statBoxes[2].textContent = flaggedReports.length;
      if (statBoxes[3]) statBoxes[3].textContent = `${avgWellness}%`;

    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  async function loadDepartments() {
    try {
      const departments = await window.SafeShift.Departments.updateMetrics();
      const deptGrid = document.querySelector('.dept-grid');
      
      if (!deptGrid) return;

      deptGrid.innerHTML = departments.map(dept => {
        const isAlert = dept.activeReports > 3 || dept.wellnessScore < 50;
        const wellnessColor = dept.wellnessScore >= 70 ? 'var(--accent-green)' : 
                             dept.wellnessScore >= 50 ? '#f39c12' : 
                             'var(--alert-red)';
        
        return `
          <div class="dept-card" data-dept-id="${dept.id}">
            ${isAlert ? '<div class="alert-dot"></div>' : ''}
            <div class="dept-icon"><i class="fa-solid fa-gears"></i></div>
            <h3>${dept.name}</h3>
            <span class="status-tag healthy">
              <i class="fa-solid fa-chart-line"></i> ${dept.wellnessScore >= 70 ? 'Healthy' : dept.wellnessScore >= 50 ? 'Fair' : 'At Risk'}
            </span>
            <div class="dept-metrics">
              <div class="metric-item">
                <span class="metric-val">${dept.employeeCount}</span>
                <span class="metric-label">Employees</span>
              </div>
              <div class="metric-item" style="color: ${dept.activeReports > 3 ? 'var(--alert-red)' : 'inherit'}">
                <span class="metric-val">${dept.activeReports}</span>
                <span class="metric-label">Active Reports</span>
              </div>
              <div class="metric-item" style="color: ${wellnessColor}">
                <span class="metric-val">${dept.wellnessScore}</span>
                <span class="metric-label">Wellness</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Add click handlers for department cards
      document.querySelectorAll('.dept-card').forEach(card => {
        card.addEventListener('click', () => {
          const deptId = card.dataset.deptId;
          // Navigate to department view (you can implement this later)
          console.log('Clicked department:', deptId);
        });
      });

    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  async function loadRecentReports() {
    try {
      const reports = await window.SafeShift.Reports.getAll();
      const recentReports = reports.slice(0, 5);
      
      const tbody = document.querySelector('#reportsTable tbody');
      if (!tbody) return;

      tbody.innerHTML = recentReports.map(report => `
        <tr class="report-row" data-report-id="${report.id}">
          <td>${report.id}</td>
          <td>${report.type}</td>
          <td>${report.department}</td>
          <td><span class="badge ${window.SafeShift.Utils.getSeverityClass(report.severity)}">${report.severity}</span></td>
          <td><span class="status-badge ${window.SafeShift.Utils.getStatusClass(report.status)}">${report.status}</span></td>
          <td>${window.SafeShift.Utils.formatDate(report.submittedAt)}</td>
          <td><i class="fa-regular fa-eye action-icon"></i></td>
        </tr>
      `).join('');

      // Add click handlers
      document.querySelectorAll('.report-row').forEach(row => {
        row.addEventListener('click', () => {
          const reportId = row.dataset.reportId;
          openReportDetailsModal(reportId);
        });
      });

    } catch (error) {
      console.error('Error loading reports:', error);
    }
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

    addEmployeeBtn.addEventListener('click', () => {
      modal.classList.add('active');
    });

    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modal.classList.remove('active');
        form.reset();
      });
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        form.reset();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = {
        name: form.querySelector('input[type="text"]').value.trim(),
        email: form.querySelector('input[type="email"]').value.trim(),
        department: form.querySelector('select').value,
        role: form.querySelectorAll('input[type="text"]')[1].value.trim()
      };

      // Validation
      if (!formData.name || !formData.email || !formData.department || !formData.role) {
        alert('Please fill in all required fields');
        return;
      }

      try {
        const result = await window.SafeShift.Employees.create(formData);
        
        modal.classList.remove('active');
        form.reset();
        
        // Reload dashboard
        await loadDashboardStats();
        await loadDepartments();
        
      } catch (error) {
        console.error('Error creating employee:', error);
        alert('Failed to create employee. Please try again.');
      }
    });
  }

  async function openReportDetailsModal(reportId) {
    const modal = document.getElementById('reportDetailsModal');
    const report = await window.SafeShift.Reports.getById(reportId);
    
    if (!report) {
      alert('Report not found');
      return;
    }

    // Populate modal with report details
    modal.querySelector('.modal-title').textContent = `Report ${report.id}`;
    
    const detailBoxes = modal.querySelectorAll('.detail-box .detail-value');
    if (detailBoxes[0]) detailBoxes[0].textContent = report.department;
    if (detailBoxes[2]) detailBoxes[2].textContent = report.isAnonymous ? 'Anonymous' : 'Named';
    if (detailBoxes[3]) detailBoxes[3].textContent = window.SafeShift.Utils.formatDate(report.submittedAt);
    
    // Update severity badge
    const severityBadge = modal.querySelector('.detail-box .badge');
    if (severityBadge) {
      severityBadge.className = `badge ${window.SafeShift.Utils.getSeverityClass(report.severity)}`;
      severityBadge.textContent = report.severity;
    }

    // Show/hide auto-flag banner
    const flagBanner = modal.querySelector('.auto-flag-banner');
    if (report.autoFlagged && flagBanner) {
      flagBanner.style.display = 'flex';
      flagBanner.querySelector('div').textContent = report.flagReason || 'Report auto-flagged for review';
    } else if (flagBanner) {
      flagBanner.style.display = 'none';
    }

    // Description
    const descBox = modal.querySelector('.form-label + div');
    if (descBox) descBox.textContent = report.description;

    // Status select
    const statusSelect = modal.querySelector('.form-select');
    if (statusSelect) statusSelect.value = report.status;

    modal.classList.add('active');

    // Store current report ID for save
    modal.dataset.currentReportId = reportId;
  }

  function initializeReportDetailsModal() {
    const modal = document.getElementById('reportDetailsModal');
    const closeButtons = modal.querySelectorAll('.close-modal-btn, .close-modal-btn-action');
    const saveBtn = modal.querySelector('#saveChangesBtn') || modal.querySelector('.btn-primary:last-child');

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
        const notes = modal.querySelector('.form-textarea').value;

        try {
          await window.SafeShift.Reports.updateStatus(reportId, newStatus);
          
          alert('Report updated successfully!');
          modal.classList.remove('active');
          
          // Reload reports
          await loadRecentReports();
          
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