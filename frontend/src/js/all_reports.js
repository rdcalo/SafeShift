// ==========================================
// ALL REPORTS PAGE JAVASCRIPT - FIXED STATUS UPDATE
// ==========================================
// Replace the existing all_reports.js with this version

(function() {
  let currentUser = null;
  let allReports = [];
  let filteredReports = [];
  let selectedDepartment = 'All';
  let currentSearchQuery = '';

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
      console.log('Loading reports for department:', department);
      
      let queryParams = '';
      if (department !== 'All') {
        queryParams = `?department=${encodeURIComponent(department)}`;
      }
      
      const result = await window.SafeShift.API.call(`reports.php${queryParams}`);
      
      if (result.success) {
        allReports = result.data;
        console.log('Loaded reports:', allReports.length);
        
        if (currentSearchQuery) {
          applySearch(currentSearchQuery);
        } else {
          filteredReports = allReports;
          renderReports(filteredReports);
        }
        
        updateDepartmentCounts();
      } else {
        console.error('Failed to load reports:', result.message);
        allReports = [];
        filteredReports = [];
        renderReports([]);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      allReports = [];
      filteredReports = [];
      renderReports([]);
    }
  }

  function renderReports(reports) {
    const tbody = document.querySelector('#reportsTable tbody');
    if (!tbody) return;

    if (reports.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-grey);">
            <i class="fa-solid fa-folder-open" style="font-size: 3rem; margin-bottom: 10px; opacity: 0.3;"></i>
            <p style="font-weight: 700;">No reports found</p>
            <p style="font-size: 0.85rem; margin-top: 5px;">Try adjusting your filters or search query</p>
          </td>
        </tr>
      `;
      return;
    }

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

    document.querySelectorAll('.report-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (!e.target.closest('.select-circle') && !e.target.closest('.action-icon')) {
          const reportId = row.dataset.id;
          openModal(reportId);
        }
      });
    });
  }

  async function updateDepartmentCounts() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    const allReportsResult = await window.SafeShift.API.call('reports.php');
    const allReportsData = allReportsResult.success ? allReportsResult.data : [];
    
    filterButtons.forEach(btn => {
      const btnText = btn.textContent.trim();
      
      if (btnText === 'All') {
        return;
      }

      const deptMatch = btnText.match(/^([A-Za-z\s]+)/);
      if (!deptMatch) return;
      
      const deptName = deptMatch[1].trim();
      const count = allReportsData.filter(r => r.department === deptName).length;
      
      const badge = btn.querySelector('.count-badge');
      if (badge) {
        badge.textContent = count;
      } else {
        const textNode = Array.from(btn.childNodes).find(node => node.nodeType === 3);
        if (textNode) {
          textNode.textContent = deptName + ' ';
          const newBadge = document.createElement('span');
          newBadge.className = 'count-badge';
          newBadge.textContent = count;
          btn.appendChild(newBadge);
        }
      }
    });
  }

  // ==========================================
  // FILTERS
  // ==========================================
  function initializeFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
      btn.addEventListener('click', async function() {
        console.log('Filter button clicked:', this.textContent);
        
        filterButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const btnText = this.textContent.trim();
        let department;
        
        if (btnText === 'All') {
          department = 'All';
        } else {
          const deptMatch = btnText.match(/^([A-Za-z\s]+)/);
          department = deptMatch ? deptMatch[1].trim() : btnText;
        }
        
        console.log('Selected department:', department);
        
        selectedDepartment = department;
        await loadAllReports(department);
      });
    });
  }

  // ==========================================
  // SEARCH
  // ==========================================
  function initializeSearch() {
    const searchInput = document.querySelector('.search-input');
    
    if (searchInput) {
      let searchTimeout;
      
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        
        searchTimeout = setTimeout(async () => {
          const query = e.target.value.toLowerCase().trim();
          currentSearchQuery = query;
          
          console.log('Searching for:', query);
          
          if (query === '') {
            filteredReports = allReports;
            renderReports(filteredReports);
            return;
          }

          applySearch(query);
        }, 300);
      });
    }
  }

  async function applySearch(query) {
    if (!query) {
      filteredReports = allReports;
      renderReports(filteredReports);
      return;
    }

    try {
      let queryParams = `?search=${encodeURIComponent(query)}`;
      
      if (selectedDepartment !== 'All') {
        queryParams += `&department=${encodeURIComponent(selectedDepartment)}`;
      }
      
      const result = await window.SafeShift.API.call(`reports.php${queryParams}`);
      
      if (result.success) {
        filteredReports = result.data;
        console.log('Search found:', filteredReports.length, 'reports');
        renderReports(filteredReports);
      }
    } catch (error) {
      console.error('Search error:', error);
      
      filteredReports = allReports.filter(report => 
        report.id.toLowerCase().includes(query) ||
        report.type.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query) ||
        report.department.toLowerCase().includes(query) ||
        report.title?.toLowerCase().includes(query)
      );
      
      renderReports(filteredReports);
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
        
        if (action === 'Mark Resolved') {
          await bulkUpdateStatus(reportIds, 'Resolved');
        } else if (action === 'Mark Under Review') {
          await bulkUpdateStatus(reportIds, 'Under Review');
        } else if (action === 'Escalate') {
          await bulkUpdateStatus(reportIds, 'Escalated');
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
  // REPORT DETAILS MODAL - FIXED VERSION
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
        
        console.log('=== SAVE BUTTON CLICKED ===');
        console.log('Report ID:', reportId);
        console.log('New Status:', newStatus);

        if (!reportId) {
          console.error('No report ID found');
          alert('Error: No report selected');
          return;
        }

        if (!newStatus) {
          console.error('No status selected');
          alert('Please select a status');
          return;
        }

        try {
          console.log('Calling updateStatus API...');
          
          // FIXED: Direct API call with proper logging
          const result = await window.SafeShift.API.call('reports.php', 'PUT', {
            id: reportId,
            status: newStatus
          });
          
          console.log('API Response:', result);
          
          if (result.success) {
            alert('Report updated successfully!');
            modal.classList.remove('active');
            
            // Reload reports to show updated status
            await loadAllReports(selectedDepartment);
          } else {
            console.error('Update failed:', result.message);
            alert(`Failed to update report: ${result.message}`);
          }
          
        } catch (error) {
          console.error('Error updating report:', error);
          alert(`Error: ${error.message || 'Failed to update report'}`);
        }
      });
    }
  }

  window.openModal = async function(reportId) {
    console.log('=== OPENING MODAL ===');
    console.log('Report ID:', reportId);
    
    const modal = document.getElementById('reportDetailsModal');
    const report = await window.SafeShift.Reports.getById(reportId);
    
    console.log('Fetched report:', report);
    
    if (!report) {
      alert('Report not found');
      return;
    }

    // Populate modal
    modal.querySelector('.modal-title').textContent = `Report ${report.id}`;
    
    const detailBoxes = modal.querySelectorAll('.detail-box .detail-value');
    if (detailBoxes[0]) detailBoxes[0].textContent = report.department;
    if (detailBoxes[2]) {
      detailBoxes[2].textContent = report.isAnonymous ? 'Anonymous' : report.submittedByName;
    }
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
    if (statusSelect) {
      statusSelect.value = report.status;
      console.log('Current status set to:', report.status);
    }

    modal.classList.add('active');
    
    // FIXED: Store the report ID properly
    modal.dataset.currentReportId = reportId;
    console.log('Stored report ID in modal:', reportId);
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

console.log('Fixed all_reports.js loaded - Status updates should work now');