// ==========================================
// PROFILE PAGE JAVASCRIPT - DATABASE INTEGRATION
// Add to profile.html: <script src="js/app.js"></script>
// Add to profile.html: <script src="js/profile.js"></script>
// ==========================================

(function() {
  let currentUser = null;

  document.addEventListener('DOMContentLoaded', async function() {
    currentUser = await window.SafeShift.Auth.init();
    if (!window.SafeShift.Auth.requireAuth('employee')) {
      return;
    }

    await initializeProfile();
    initializePasswordChange();
    initializeNotifications();
    loadActivityLog();
    setupLogoutHandler();
  });

  async function initializeProfile() {
    // Fetch full employee data from database
    const employee = await window.SafeShift.Employees.getById(currentUser.id);
    
    if (!employee) {
      console.error('Employee not found');
      return;
    }

    // Update all user info displays
    updateUserInfo(employee);
    populateProfileForm(employee);
  }

  function updateUserInfo(employee) {
    // Sidebar
    const sidebarName = document.querySelector('.user-profile-mini .user-info h4');
    const sidebarDept = document.querySelector('.user-profile-mini .user-info p');
    const sidebarAvatar = document.querySelector('.user-profile-mini .user-avatar-circle');
    
    if (sidebarName) sidebarName.textContent = employee.name;
    if (sidebarDept) sidebarDept.textContent = employee.department;
    if (sidebarAvatar) {
      sidebarAvatar.textContent = window.SafeShift.Utils.getInitials(employee.name);
    }

    // Header user area (top right)
    const headerName = document.querySelector('.header-user-info h3');
    const headerDept = document.querySelector('.header-user-info span');
    const headerAvatar = document.querySelector('.header-avatar');
    
    if (headerName) headerName.textContent = employee.name;
    if (headerDept) headerDept.textContent = employee.department;
    if (headerAvatar) {
      headerAvatar.textContent = window.SafeShift.Utils.getInitials(employee.name);
    }

    // Big profile avatar
    const bigAvatar = document.querySelector('.big-avatar');
    if (bigAvatar) {
      bigAvatar.textContent = window.SafeShift.Utils.getInitials(employee.name);
    }

    // Profile name section
    const profileName = document.querySelector('.profile-name h2');
    const profileTeam = document.querySelector('.profile-name p');
    
    if (profileName) profileName.textContent = employee.name;
    if (profileTeam) profileTeam.textContent = `${employee.department} Team`;
  }

  function populateProfileForm(employee) {
    // Personal Information Form
    const emailInput = document.querySelector('input[type="email"]');
    const employeeIdInput = document.querySelector('input[value="2410746"]');
    const departmentInput = document.querySelector('input[value="Engineering"]');
    const roleInput = document.querySelector('input[value="Employee"]');
    
    if (emailInput) emailInput.value = employee.email;
    if (employeeIdInput) employeeIdInput.value = employee.employeeId || employee.id;
    if (departmentInput) departmentInput.value = employee.department;
    if (roleInput) roleInput.value = employee.role;

    // Add save handler for profile updates
    const updateProfileBtn = document.querySelector('.profile-card .update-btn');
    if (updateProfileBtn) {
      updateProfileBtn.addEventListener('click', async () => {
        await updateProfile(employee.id);
      });
    }
  }

  async function updateProfile(employeeId) {
    const emailInput = document.querySelector('input[type="email"]');
    const departmentInput = document.querySelectorAll('.form-input')[2]; // Department is 3rd input
    
    const updates = {
      email: emailInput.value,
      department: departmentInput.value
    };

    try {
      await window.SafeShift.Employees.update(employeeId, updates);
      alert('Profile updated successfully!');
      
      // Reload profile
      await initializeProfile();
      
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  }

  // ==========================================
  // PASSWORD CHANGE
  // ==========================================
  function initializePasswordChange() {
    const passwordForm = document.querySelector('.profile-card:nth-child(2) form');
    const updatePasswordBtn = passwordForm.querySelector('.update-btn');
    
    updatePasswordBtn.addEventListener('click', async () => {
      const currentPassword = passwordForm.querySelector('input[type="password"]:nth-child(1)');
      const newPassword = passwordForm.querySelectorAll('input[type="password"]')[1];
      const confirmPassword = passwordForm.querySelectorAll('input[type="password"]')[2];
      
      // Validation
      if (!currentPassword.value) {
        alert('Please enter your current password');
        return;
      }
      
      if (!newPassword.value || newPassword.value.length < 8) {
        alert('New password must be at least 8 characters');
        return;
      }
      
      if (newPassword.value !== confirmPassword.value) {
        alert('Passwords do not match');
        return;
      }
      
      try {
        // In production, verify current password first
        await window.SafeShift.API.call('employees.php', 'PUT', {
          id: currentUser.id,
          password: newPassword.value
        });
        
        alert('Password updated successfully!');
        
        // Clear form
        passwordForm.reset();
        
      } catch (error) {
        console.error('Error updating password:', error);
        alert('Failed to update password. Please check your current password.');
      }
    });
  }

  // ==========================================
  // NOTIFICATION PREFERENCES
  // ==========================================
  function initializeNotifications() {
    const notificationToggles = document.querySelectorAll('.switch input[type="checkbox"]');
    
    // Load saved preferences
    const savedPreferences = JSON.parse(localStorage.getItem(`notif_prefs_${currentUser.id}`)) || {
      emailReports: true,
      emailTasks: true,
      pushNotifications: true,
      weeklyDigest: true
    };
    
    // Set initial states
    notificationToggles[0].checked = savedPreferences.emailReports;
    notificationToggles[1].checked = savedPreferences.emailTasks;
    notificationToggles[2].checked = savedPreferences.pushNotifications;
    notificationToggles[3].checked = savedPreferences.weeklyDigest;
    
    // Save on change
    notificationToggles.forEach((toggle, index) => {
      toggle.addEventListener('change', () => {
        const preferences = {
          emailReports: notificationToggles[0].checked,
          emailTasks: notificationToggles[1].checked,
          pushNotifications: notificationToggles[2].checked,
          weeklyDigest: notificationToggles[3].checked
        };
        
        localStorage.setItem(`notif_prefs_${currentUser.id}`, JSON.stringify(preferences));
        
        // Show confirmation
        const confirmMsg = document.createElement('div');
        confirmMsg.style.cssText = `
          position: fixed; top: 20px; right: 20px; background: var(--accent-green);
          color: white; padding: 15px 25px; border-radius: 12px; font-weight: 700;
          z-index: 9999; animation: fadeInOut 2s;
        `;
        confirmMsg.textContent = '✓ Preferences saved';
        document.body.appendChild(confirmMsg);
        
        setTimeout(() => confirmMsg.remove(), 2000);
      });
    });
  }

  // ==========================================
  // ACTIVITY LOG
  // ==========================================
  async function loadActivityLog() {
    try {
      // Fetch activity logs for current user
      const response = await window.SafeShift.API.call(`activity.php?userId=${currentUser.id}&limit=4`);
      
      if (!response.success) {
        console.error('Failed to load activity log');
        return;
      }
      
      const activities = response.data;
      const activityContainer = document.querySelector('.profile-card:last-child');
      
      // Clear existing activities
      const existingActivities = activityContainer.querySelectorAll('.activity-item');
      existingActivities.forEach(item => item.remove());
      
      // Render new activities
      activities.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        const formattedDate = window.SafeShift.Utils.formatDate(activity.timestamp);
        
        activityItem.innerHTML = `
          <div class="activity-details">
            <h5>${activity.type}</h5>
            <p>IP: ${maskIP(activity.ipAddress)}</p>
          </div>
          <div class="activity-time">${formattedDate}</div>
        `;
        
        activityContainer.appendChild(activityItem);
      });
      
    } catch (error) {
      console.error('Error loading activity log:', error);
    }
  }

  function maskIP(ip) {
    if (!ip || ip === '0.0.0.0') return '192.168.1.***';
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
  }

  // ==========================================
  // PROFILE PICTURE UPLOAD
  // ==========================================
  const cameraIcon = document.querySelector('.camera-icon');
  if (cameraIcon) {
    cameraIcon.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // In production, upload to server
        // For demo, just show confirmation
        alert(`Profile picture updated!\n\nFilename: ${file.name}\nSize: ${(file.size / 1024).toFixed(2)} KB`);
        
        // Log activity
        await window.SafeShift.API.call('activity.php', 'POST', {
          userId: currentUser.id,
          action: 'Profile Updated',
          description: 'Updated profile picture',
          type: 'Profile Updated'
        });
        
        // Reload activity log
        await loadActivityLog();
      });
      
      fileInput.click();
    });
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

// Add fadeInOut animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(-20px); }
    15% { opacity: 1; transform: translateY(0); }
    85% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-20px); }
  }
`;
document.head.appendChild(style);