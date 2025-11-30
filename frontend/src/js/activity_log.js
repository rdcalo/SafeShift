// ==========================================
// ACTIVITY LOG PAGE JAVASCRIPT - FIXED VERSION
// ==========================================

(function() {
  let currentUser = null;
  let allLogs = [];
  let filteredLogs = [];

  document.addEventListener('DOMContentLoaded', async function() {
    currentUser = await window.SafeShift.Auth.init();
    if (!window.SafeShift.Auth.requireAuth('admin')) {
      return;
    }

    console.log('Activity Log page loaded for:', currentUser.name);

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
      console.log('Loading activity logs from API...');
      
      // Fetch activity logs from backend
      const result = await window.SafeShift.API.call('activity.php?limit=50');
      
      if (result.success) {
        allLogs = result.data;
        filteredLogs = allLogs;
        
        console.log('Loaded', allLogs.length, 'activity logs');
        renderLogs(filteredLogs);
      } else {
        console.error('Failed to load activity logs:', result.message);
        showEmptyState('Failed to load activity logs');
      }
    } catch (error) {
      console.error('Error loading activity logs:', error);
      showEmptyState('Error loading activity logs');
    }
  }

  function renderLogs(logs) {
    const feedContainer = document.querySelector('.feed-container');
    if (!feedContainer) return;

    if (logs.length === 0) {
      showEmptyState('No activity logs found');
      return;
    }

    // Clear existing content
    feedContainer.innerHTML = '';

    const colors = ['#64a6ff', '#bdc3c7', '#9b59b6', '#e74c3c', '#2ecc71'];

    logs.forEach((log, index) => {
      const initials = getInitials(log.userName || 'System');
      const color = colors[index % colors.length];
      const timeAgo = window.SafeShift.Utils.getTimeAgo(log.timestamp);
      const formattedTime = new Date(log.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });

      const actionBadgeClass = getActionBadgeClass(log.type);
      const icon = getActionIcon(log.type);
      const roleBadge = getRoleBadge(log.userRole);

      const logEntry = document.createElement('div');
      logEntry.className = 'log-entry';
      logEntry.innerHTML = `
        <div class="log-icon-circle"><i class="${icon}"></i></div>
        <div class="log-content">
          <div class="log-header">
            <div class="badges-row">
              <span class="action-badge ${actionBadgeClass}">${log.type}</span>
              <span class="role-badge">${roleBadge}</span>
            </div>
            <span class="log-time">${formattedTime}</span>
          </div>
          <div class="log-title">${log.description}</div>
          <div class="log-meta">
            <div class="meta-item">
              ${log.userName === 'Anonymous' 
                ? `<div class="meta-avatar" style="background-color: #bdc3c7;"><i class="fa-solid fa-user" style="font-size:0.6rem;"></i></div>`
                : `<div class="meta-avatar" style="background-color: ${color};">${initials}</div>`
              }
              ${log.userName}
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

  function showEmptyState(message) {
    const feedContainer = document.querySelector('.feed-container');
    if (!feedContainer) return;

    feedContainer.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--text-grey);">
        <i class="fa-solid fa-clock-rotate-left" style="font-size: 4rem; opacity: 0.3; margin-bottom: 20px;"></i>
        <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 10px;">No Activity Logs</h3>
        <p style="font-size: 0.95rem;">${message}</p>
      </div>
    `;
  }

  function getInitials(name) {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function getActionBadgeClass(type) {
    const badgeClasses = {
      'Status Changed': 'ab-status',
      'Report Submitted': 'ab-report',
      'Log In': 'ab-login',
      'LOGIN': 'ab-login',
      'LOGOUT': 'ab-login',
      'Account Created': 'ab-create',
      'Account Deleted': 'ab-create',
      'Role Updated': 'ab-role',
      'Employee Updated': 'ab-role',
      'Report Updated': 'ab-status'
    };
    return badgeClasses[type] || 'ab-status';
  }

  function getActionIcon(type) {
    const icons = {
      'Status Changed': 'fa-solid fa-pen-to-square',
      'Report Submitted': 'fa-solid fa-file-arrow-up',
      'Log In': 'fa-solid fa-right-to-bracket',
      'LOGIN': 'fa-solid fa-right-to-bracket',
      'LOGOUT': 'fa-solid fa-right-from-bracket',
      'Log Out': 'fa-solid fa-right-from-bracket',
      'Account Created': 'fa-solid fa-user-plus',
      'Account Deleted': 'fa-solid fa-user-minus',
      'Role Updated': 'fa-solid fa-shield-halved',
      'Employee Updated': 'fa-solid fa-shield-halved',
      'Report Updated': 'fa-solid fa-pen-to-square'
    };
    return icons[type] || 'fa-solid fa-circle-info';
  }

  function getRoleBadge(userRole) {
    if (userRole === 'admin') return 'Admin';
    if (userRole === 'employee') return 'Employee';
    return 'System';
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
          log.description.toLowerCase().includes(query) ||
          log.userName.toLowerCase().includes(query) ||
          log.type.toLowerCase().includes(query)
        );

        renderLogs(filteredLogs);
      });
    }

    // Filter button
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

    const headers = ['Timestamp', 'Type', 'Description', 'User', 'Role', 'IP Address'];
    const csvRows = [headers.join(',')];

    filteredLogs.forEach(log => {
      const row = [
        `"${new Date(log.timestamp).toLocaleString()}"`,
        `"${log.type}"`,
        `"${log.description.replace(/"/g, '""')}"`,
        `"${log.userName}"`,
        `"${log.userRole}"`,
        `"${log.ipAddress}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
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

console.log('Activity Log JS loaded - Fixed version');