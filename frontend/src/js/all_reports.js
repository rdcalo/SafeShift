// ==========================================
// ALL REPORTS PAGE JAVASCRIPT
// ==========================================
// Add to all_reports.html: <script src="app.js"></script>
// Add to all_reports.html: <script src="all_reports.js"></script>

(function() {
  let currentUser = null;
  let allReports = [];
  let filteredReports = [];
  let selectedDepartment = 'All';

  document.addEventListener('DOMContentLoaded', async function() {
    currentUser = await window.SafeShift.Auth.init();
    if (!window.SafeShift.Auth.requireAuth('admin')) {
      return;
    }

    await initializeReportsPage();
    initializeFilters();
    initializeSearch();
    initializeSelection();
    initializeModal();
    setupLogoutHandler();
  });

  async function initializeReportsPage() {
    updateUserInfo();
    await loadAllReports();
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

  async function loadAllReports(department = 'All') {
    try {
      allReports = await window.SafeShift.Reports.getAll();
      
      if (department === 'All') {
        filteredReports = allReports;
      } else {
        filteredReports = allReports.filter(r => r.department === department);
      }

      renderReports(filteredReports);
      updateDepartmentCounts();
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  }

  function renderReports(reports) {
    const tbody = document.querySelector('#reportsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = reports.map(report => `
      <tr class="report-row" data-id="${report.id}">
        <td onclick="event.stopPropagation(); toggleSelect(this)">
          <div class="select-circle"></div>
        </td>
        <td>${report.id}</td>
        <td>${report.type}</td>
        <td>${report.department}</td>
        <td><span class="badge ${window.SafeShift.Utils.getSeverityClass(report.severity)}">${report.severity}</span></td>
        <td><span class="status-badge ${window.SafeShift.Utils.getStatusClass(report.status)}">${report.status}</span></td>
        <td>${window.SafeShift.Utils.formatDate(report.submittedAt)}</td>
        <td><i class="fa-regular fa-eye action-icon" onclick="event.stopPropagation(); openModal('${report.id}')"></i></td>
      </tr>
    `).join('');

    // Add row click handlers
    document.querySelectorAll('.report-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (!e.target.closest('.select-circle') && !e.target.closest('.action-icon')) {
          const reportId = row.dataset.id;
          openModal(reportId);
        }
      });
    });
  }

  function updateDepartmentCounts() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
      const btnText = btn.textContent.trim();
      
      if (btnText === 'All') {
        btn.textContent = 'All';
        return;
      }

      // Extract department name (remove count badge)
      const deptName = btnText.split('\n')[0].trim();
      const count = allReports.filter(r => r.department === deptName).length;
      
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
        // Remove active from all
        filterButtons.forEach(b => b.classList.remove('active'));
        
        // Add active to clicked
        this.classList.add('active');
        
        // Get department name
        const btnText = this.textContent.trim();
        const department = btnText === 'All' ? 'All' : btnText.split('\n')[0].trim();
        
        selectedDepartment = department;
        loadAllReports(department);
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
          renderReports(filteredReports);
          return;
        }

        const searchResults = filteredReports.filter(report => 
          report.id.toLowerCase().includes(query) ||
          report.type.toLowerCase().includes(query) ||
          report.description.toLowerCase().includes(query) ||
          report.department.toLowerCase().includes(query)
        );

        renderReports(searchResults);
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
        document.querySelectorAll('.report-row').forEach(r => r.classList.remove('selected'));
        updateBulkBar();
      });
    }

    if (bulkApplyBtn) {
      bulkApplyBtn.addEventListener('click', async () => {
        const action = bulkSelect.value;
        const selectedRows = document.querySelectorAll('.report-row.selected');
        
        if (selectedRows.length === 0) {
          alert('No reports selected');
          return;
        }

        if (action === 'Change Status') {
          alert('Please select an action first');
          return;
        }

        const reportIds = Array.from(selectedRows).map(row => row.dataset.id);
        
        // Apply action based on selection
        if (action === 'Mark Resolved') {
          await bulkUpdateStatus(reportIds, 'Resolved');
        } else if (action === 'Mark Under Review') {
          await bulkUpdateStatus(reportIds, 'Under Review');
        } else if (action === 'Escalate') {
          await bulkUpdateStatus(reportIds, 'Escalated');
        }

        // Reset selection
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

    async function bulkUpdateStatus(reportIds, newStatus) {
      try {
        for (const id of reportIds) {
          await window.SafeShift.Reports.updateStatus(id, newStatus);
        }
        
        alert(`Successfully updated ${reportIds.length} report(s) to "${newStatus}"`);
        await loadAllReports(selectedDepartment);
        
      } catch (error) {
        console.error('Error updating reports:', error);
        alert('Failed to update reports. Please try again.');
      }
    }
  }

  // ==========================================
  // REPORT DETAILS MODAL
  // ==========================================
  function initializeModal() {
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
        const notes = modal.querySelector('.form-textarea').value;

        try {
          await window.SafeShift.Reports.updateStatus(reportId, newStatus);
          
          alert('Report updated successfully!');
          modal.classList.remove('active');
          
          await loadAllReports(selectedDepartment);
          
        } catch (error) {
          console.error('Error updating report:', error);
          alert('Failed to update report. Please try again.');
        }
      });
    }
  }

  window.openModal = async function(reportId) {
    const modal = document.getElementById('reportDetailsModal');
    const report = await window.SafeShift.Reports.getById(reportId);
    
    if (!report) {
      alert('Report not found');
      return;
    }

    // Populate modal
    modal.querySelector('.modal-title').textContent = `Report ${report.id}`;
    
    const detailBoxes = modal.querySelectorAll('.detail-box .detail-value');
    if (detailBoxes[0]) detailBoxes[0].textContent = report.department;
    if (detailBoxes[2]) detailBoxes[2].textContent = report.isAnonymous ? 'Anonymous' : 'Named';
    if (detailBoxes[3]) detailBoxes[3].textContent = window.SafeShift.Utils.formatDate(report.submittedAt);
    
    const severityBadge = modal.querySelector('.detail-box .badge');
    if (severityBadge) {
      severityBadge.className = `badge ${window.SafeShift.Utils.getSeverityClass(report.severity)}`;
      severityBadge.textContent = report.severity;
    }

    const flagBanner = modal.querySelector('.auto-flag-banner');
    if (report.autoFlagged && flagBanner) {
      flagBanner.style.display = 'flex';
      flagBanner.querySelector('div').textContent = report.flagReason || 'Report auto-flagged for review';
    } else if (flagBanner) {
      flagBanner.style.display = 'none';
    }

    const descBox = modal.querySelector('.form-label + div');
    if (descBox) descBox.textContent = report.description;

    const statusSelect = modal.querySelector('.form-select');
    if (statusSelect) statusSelect.value = report.status;

    modal.classList.add('active');
    modal.dataset.currentReportId = reportId;
  };

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