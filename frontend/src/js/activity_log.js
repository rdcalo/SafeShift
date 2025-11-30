// ==========================================
// ACTIVITY LOG PAGE JAVASCRIPT
// ==========================================
// Add to activity_log.html: <script src="app.js"></script>
// Add to activity_log.html: <script src="activity_log.js"></script>

(function() {
  let currentUser = null;
  let allLogs = [];
  let filteredLogs = [];

  document.addEventListener('DOMContentLoaded', async function() {
    currentUser = await window.SafeShift.Auth.init();
    if (!window.SafeShift.Auth.requireAuth('admin')) {
      return;
    }

    await initializeActivityLog();
    initializeSearch();
    initializeExportButton();
    setupLogoutHandler();
  });

  async function initializeActivityLog() {
    updateUserInfo();
    await loadActivityLogs();
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

  async function loadActivityLogs() {
    try {
      allLogs = await window.SafeShift.Storage.get('activityLogs') || [];
      filteredLogs = allLogs;
      renderLogs(filteredLogs);
    } catch (error) {
      console.error('Error loading activity logs:', error);
    }
  }

  function renderLogs(logs) {
    const feedContainer = document.querySelector('.feed-container');
    if (!feedContainer) return;

    // Clear existing content except first few static examples
    feedContainer.innerHTML = '';

    const colors = ['#64a6ff', '#bdc3c7', '#9b59b6', '#e74c3c', '#2ecc71'];

    logs.forEach((log, index) => {
      const initials = window.SafeShift.Utils.getInitials(log.performedByName || 'System');
      const color = colors[index % colors.length];
      const timeAgo = window.SafeShift.Utils.getTimeAgo(log.timestamp);
      const formattedTime = new Date(log.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });

      const actionBadgeClass = getActionBadgeClass(log.type);
      const icon = getActionIcon(log.type);

      const logEntry = document.createElement('div');
      logEntry.className = 'log-entry';
      logEntry.innerHTML = `
        <div class="log-icon-circle"><i class="${icon}"></i></div>
        <div class="log-content">
          <div class="log-header">
            <div class="badges-row">
              <span class="action-badge ${actionBadgeClass}">${log.type}</span>
              <span class="role-badge">${log.performedBy === 'admin' || log.performedBy.startsWith('admin') ? 'Admin' : log.performedBy === 'anonymous' ? 'Anonymous' : 'Employee'}</span>
            </div>
            <span class="log-time">${formattedTime}</span>
          </div>
          <div class="log-title">${log.action}</div>
          <div class="log-meta">
            <div class="meta-item">
              ${log.performedBy === 'anonymous' 
                ? `<div class="meta-avatar" style="background-color: #bdc3c7;"><i class="fa-solid fa-user" style="font-size:0.6rem;"></i></div>`
                : `<div class="meta-avatar" style="background-color: ${color};">${initials}</div>`
              }
              ${log.performedByName}
            </div>
            <div class="meta-item">
              <i class="fa-regular fa-clock meta-icon"></i> ${timeAgo}
            </div>
          </div>
        </div>
      `;

      feedContainer.appendChild(logEntry);
    });
  }

  function getActionBadgeClass(type) {
    const badgeClasses = {
      'Status Changed': 'ab-status',
      'Report Submitted': 'ab-report',
      'Log In': 'ab-login',
      'Log Out': 'ab-login',
      'Account Created': 'ab-create',
      'Account Deleted': 'ab-create',
      'Role Updated': 'ab-role',
      'Report Updated': 'ab-status'
    };
    return badgeClasses[type] || 'ab-status';
  }

  function getActionIcon(type) {
    const icons = {
      'Status Changed': 'fa-solid fa-pen-to-square',
      'Report Submitted': 'fa-solid fa-file-arrow-up',
      'Log In': 'fa-solid fa-right-to-bracket',
      'Log Out': 'fa-solid fa-right-from-bracket',
      'Account Created': 'fa-solid fa-user-plus',
      'Account Deleted': 'fa-solid fa-user-minus',
      'Role Updated': 'fa-solid fa-shield-halved',
      'Report Updated': 'fa-solid fa-pen-to-square'
    };
    return icons[type] || 'fa-solid fa-circle-info';
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
          filteredLogs = allLogs;
          renderLogs(filteredLogs);
          return;
        }

        filteredLogs = allLogs.filter(log => 
          log.action.toLowerCase().includes(query) ||
          log.performedByName.toLowerCase().includes(query) ||
          log.type.toLowerCase().includes(query)
        );

        renderLogs(filteredLogs);
      });
    }

    // Filter button (placeholder for now)
    const filterBtn = document.querySelector('.filter-btn');
    if (filterBtn) {
      filterBtn.addEventListener('click', () => {
        alert('Filter options:\n\n• By Date Range\n• By Action Type\n• By User\n\nComing soon!');
      });
    }
  }

  // ==========================================
  // EXPORT
  // ==========================================
  function initializeExportButton() {
    const exportBtn = document.querySelector('.btn-outline');
    
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportLogsToCSV();
      });
    }
  }

  function exportLogsToCSV() {
    if (filteredLogs.length === 0) {
      alert('No logs to export');
      return;
    }

    // Create CSV content
    const headers = ['Timestamp', 'Type', 'Action', 'Performed By', 'User ID'];
    const csvRows = [headers.join(',')];

    filteredLogs.forEach(log => {
      const row = [
        `"${new Date(log.timestamp).toLocaleString()}"`,
        `"${log.type}"`,
        `"${log.action.replace(/"/g, '""')}"`, // Escape quotes
        `"${log.performedByName}"`,
        `"${log.performedBy}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(`Successfully exported ${filteredLogs.length} activity logs!`);
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