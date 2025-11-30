// ==========================================
// SAFESHIFT CORE APPLICATION MODULE - PHP BACKEND VERSION
// ==========================================

// API Base URL - Update this to match your XAMPP setup
const API_BASE_URL = 'http://localhost/safeshift/backend/api';

// ==========================================
// 1. API UTILITIES
// ==========================================
const API = {
  async call(endpoint, method = 'GET', data = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // Include cookies for session
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/${endpoint}`, options);
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
};

// ==========================================
// 2. AUTHENTICATION SYSTEM
// ==========================================
const Auth = {
  currentUser: null,

  async init() {
    // Check if user session exists on server
    try {
      const result = await API.call('auth.php', 'POST', { action: 'check_session' });
      if (result.success) {
        this.currentUser = result.user;
        return this.currentUser;
      }
    } catch (error) {
      console.error('Session check failed:', error);
    }
    return null;
  },

  async login(email, password, role) {
    try {
      const result = await API.call('auth.php', 'POST', {
        email,
        password,
        role
      });

      if (result.success) {
        this.currentUser = result.user;
        
        // Also store in sessionStorage for quick access
        sessionStorage.setItem('currentUser', JSON.stringify(result.user));
        
        return result.user;
      } else {
        throw new Error(result.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  async logout() {
    try {
      await API.call('auth.php', 'POST', { action: 'logout' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    this.currentUser = null;
    sessionStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  },

  requireAuth(requiredRole = null) {
    if (!this.currentUser) {
      window.location.href = 'login.html';
      return false;
    }

    if (requiredRole && this.currentUser.role !== requiredRole) {
      alert('Access denied: Insufficient permissions');
      window.location.href = this.currentUser.role === 'admin' ? 'admin_dashboard.html' : 'dashboard.html';
      return false;
    }

    return true;
  }
};

// ==========================================
// 3. REPORTS MANAGEMENT
// ==========================================
const Reports = {
  async getAll() {
    try {
      const result = await API.call('reports.php');
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Error fetching reports:', error);
      return [];
    }
  },

  async getById(id) {
    try {
      const result = await API.call(`reports.php?id=${id}`);
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Error fetching report:', error);
      return null;
    }
  },

  async create(reportData) {
    try {
      const result = await API.call('reports.php', 'POST', reportData);
      
      if (result.success) {
        return {
          id: result.reportId,
          ...reportData
        };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error creating report:', error);
      throw error;
    }
  },

  async updateStatus(id, newStatus) {
    try {
      const result = await API.call('reports.php', 'PUT', {
        id,
        status: newStatus
      });
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return true;
    } catch (error) {
      console.error('Error updating report:', error);
      throw error;
    }
  },

  async filterByDepartment(department) {
    const allReports = await this.getAll();
    return department === 'All' 
      ? allReports 
      : allReports.filter(r => r.department === department);
  },

  async filterByStatus(status) {
    const allReports = await this.getAll();
    return allReports.filter(r => r.status === status);
  }
};

// ==========================================
// 4. EMPLOYEES MANAGEMENT
// ==========================================
const Employees = {
  async getAll() {
    try {
      const result = await API.call('employees.php');
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Error fetching employees:', error);
      return [];
    }
  },

  async getById(id) {
    try {
      const result = await API.call(`employees.php?id=${id}`);
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Error fetching employee:', error);
      return null;
    }
  },

  async create(employeeData) {
    try {
      const result = await API.call('employees.php', 'POST', employeeData);
      
      if (result.success) {
        return {
          employee: result.employee,
          tempPassword: result.tempPassword
        };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      throw error;
    }
  },

  async update(id, updates) {
    try {
      const result = await API.call('employees.php', 'PUT', {
        id,
        ...updates
      });
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return true;
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  },

  async delete(id) {
    try {
      const result = await API.call('employees.php', 'DELETE', { id });
      return result.success;
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  },

  async filterByDepartment(department) {
    const allEmployees = await this.getAll();
    return department === 'All' 
      ? allEmployees 
      : allEmployees.filter(e => e.department === department);
  }
};

// ==========================================
// 5. DEPARTMENTS MANAGEMENT
// ==========================================
const Departments = {
  async getAll() {
    try {
      const result = await API.call('departments.php');
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Error fetching departments:', error);
      return [];
    }
  },

  async getById(id) {
    try {
      const result = await API.call(`departments.php?id=${id}`);
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Error fetching department:', error);
      return null;
    }
  },

  async updateMetrics() {
    // Metrics are calculated server-side
    return await this.getAll();
  }
};

// ==========================================
// 6. UTILITY FUNCTIONS
// ==========================================
const Utils = {
  formatDate(dateString) {
    const date = new Date(dateString);
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('en-US', options);
  },

  getTimeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  },

  generateReportId() {
    return `REP-${Date.now()}`;
  },

  getInitials(name) {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  },

  getSeverityClass(severity) {
    const classes = {
      'Low': 'sev-low',
      'Medium': 'sev-med',
      'High': 'sev-high',
      'Critical': 'sev-crit'
    };
    return classes[severity] || 'sev-low';
  },

  getStatusClass(status) {
    const classes = {
      'New': 'st-new',
      'Under Review': 'st-review',
      'Resolved': 'st-resolved',
      'Escalated': 'st-esc'
    };
    return classes[status] || 'st-new';
  }
};

// ==========================================
// 7. INITIALIZE APPLICATION
// ==========================================
async function initApp() {
  console.log('Initializing SafeShift Application...');
  
  try {
    // Initialize authentication
    await Auth.init();
    
    console.log('SafeShift Application Ready!');
  } catch (error) {
    console.error('Error initializing app:', error);
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ==========================================
// 8. EXPORT FOR GLOBAL ACCESS
// ==========================================
window.SafeShift = {
  Auth,
  API,
  Reports,
  Employees,
  Departments,
  Utils
};