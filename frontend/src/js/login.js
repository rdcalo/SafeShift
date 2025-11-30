// ==========================================
// LOGIN PAGE JAVASCRIPT
// ==========================================
// Add to login.html: <script src="app.js"></script>
// Add to login.html: <script src="login.js"></script>


(function() {
  let selectedRole = 'employee'; // Default role

  // Wait for DOM and app to be ready
  document.addEventListener('DOMContentLoaded', async function() {
    console.log('Login page loaded');

    // Check if already logged in
    const currentUser = await window.SafeShift.Auth.init();
    if (currentUser) {
      redirectToDashboard(currentUser.role);
      return;
    }

    initializeRoleButtons();
    initializeLoginForm();
  });

  function initializeRoleButtons() {
    const roleButtons = document.querySelectorAll('.role-btn');
    
    roleButtons.forEach(button => {
      button.addEventListener('click', function() {
        // Remove active state from all buttons
        roleButtons.forEach(btn => {
          btn.style.backgroundColor = 'white';
          btn.style.color = '#555';
          btn.style.borderColor = '#f0f0f0';
        });

        // Add active state to clicked button
        this.style.backgroundColor = '#5ba1fc';
        this.style.color = 'white';
        this.style.borderColor = '#5ba1fc';

        // Determine selected role based on button text
        const buttonText = this.textContent.trim();
        selectedRole = buttonText.toLowerCase().includes('admin') ? 'admin' : 'employee';
        
        console.log('Selected role:', selectedRole);
      });
    });

    // Set employee as default active
    if (roleButtons.length > 0) {
      roleButtons[0].click();
    }
  }

  function initializeLoginForm() {
    const form = document.querySelector('form');
    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');
    const rememberCheckbox = document.querySelector('.remember-me input[type="checkbox"]');

    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      // Validation
      if (!email || !password) {
        showError('Please enter both email and password');
        return;
      }

      if (!isValidEmail(email)) {
        showError('Please enter a valid email address');
        return;
      }

      // Show loading state
      const submitBtn = form.querySelector('.submit-btn');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Signing in...';
      submitBtn.disabled = true;

      try {
        // Attempt login
        const user = await window.SafeShift.Auth.login(email, password, selectedRole);

        // Store "remember me" preference
        if (rememberCheckbox.checked) {
          localStorage.setItem('rememberedEmail', email);
        } else {
          localStorage.removeItem('rememberedEmail');
        }

        // Success message
        showSuccess('Login successful! Redirecting...');

        // Redirect to appropriate dashboard
        setTimeout(() => {
          redirectToDashboard(user.role);
        }, 1000);

      } catch (error) {
        console.error('Login error:', error);
        showError(error.message || 'Login failed. Please check your credentials.');
        
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });

    // Load remembered email if exists
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      emailInput.value = rememberedEmail;
      rememberCheckbox.checked = true;
    }
  }

  function redirectToDashboard(role) {
    if (role === 'admin') {
      window.location.href = 'admin_dashboard.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function showError(message) {
    // Create or update error message element
    let errorDiv = document.querySelector('.login-error');
    
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'login-error';
      errorDiv.style.cssText = `
        background-color: #ffebee;
        color: #c62828;
        padding: 12px 20px;
        border-radius: 8px;
        margin-bottom: 20px;
        font-weight: 600;
        font-size: 0.9rem;
        text-align: center;
        border: 1px solid #ef5350;
      `;
      
      const form = document.querySelector('form');
      form.insertBefore(errorDiv, form.firstChild);
    }

    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }

  function showSuccess(message) {
    let successDiv = document.querySelector('.login-success');
    
    if (!successDiv) {
      successDiv = document.createElement('div');
      successDiv.className = 'login-success';
      successDiv.style.cssText = `
        background-color: #e8f5e9;
        color: #2e7d32;
        padding: 12px 20px;
        border-radius: 8px;
        margin-bottom: 20px;
        font-weight: 600;
        font-size: 0.9rem;
        text-align: center;
        border: 1px solid #66bb6a;
      `;
      
      const form = document.querySelector('form');
      form.insertBefore(successDiv, form.firstChild);
    }

    successDiv.textContent = message;
    successDiv.style.display = 'block';
  }

  // Handle "Forgot Password" link
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('forgot-pass')) {
      e.preventDefault();
      alert('Password reset feature coming soon!\n\nFor demo purposes, use:\n\nEmployee:\nemail: employee@safeshift.com\npassword: emp123\n\nAdmin:\nemail: admin@safeshift.com\npassword: admin123');
    }
  });

})();

// ==========================================
// DEMO CREDENTIALS HELPER
// ==========================================
// This can be removed in production
console.log('%c=== DEMO CREDENTIALS ===', 'color: #5ba1fc; font-size: 16px; font-weight: bold;');
console.log('%cEmployee Login:', 'color: #00cd78; font-weight: bold;');
console.log('Email: employee@safeshift.com');
console.log('Password: emp123');
console.log('%cAdmin Login:', 'color: #00cd78; font-weight: bold;');
console.log('Email: admin@safeshift.com');
console.log('Password: admin123');