// ==========================================
// EMPLOYEE DASHBOARD JAVASCRIPT
// ==========================================
// Add to dashboard.html: <script src="app.js"></script>
// Add to dashboard.html: <script src="dashboard.js"></script>

(function() {
  let currentUser = null;

  document.addEventListener('DOMContentLoaded', async function() {
    // Require authentication
    currentUser = await window.SafeShift.Auth.init();
    if (!window.SafeShift.Auth.requireAuth('employee')) {
      return;
    }

    console.log('Dashboard loaded for:', currentUser.name);

    initializeDashboard();
    initializeReportModal();
    setupLogoutHandler();
  });

  async function initializeDashboard() {
    // Update user info in sidebar and header
    updateUserInfo();
    
    // Load dashboard stats
    await loadDashboardStats();
    
    // Load recent reports
    await loadRecentReports();
  }

  function updateUserInfo() {
    // Update sidebar user info
    const sidebarName = document.querySelector('.user-profile-mini .user-info h4');
    const sidebarDept = document.querySelector('.user-profile-mini .user-info p');
    const sidebarAvatar = document.querySelector('.user-profile-mini .user-avatar-circle');

    if (sidebarName) sidebarName.textContent = currentUser.name;
    if (sidebarDept) sidebarDept.textContent = currentUser.department;
    if (sidebarAvatar) {
      sidebarAvatar.textContent = window.SafeShift.Utils.getInitials(currentUser.name);
    }

    // Update header greeting
    const greeting = document.querySelector('.header-text h1');
    if (greeting) {
      greeting.textContent = `Good Morning, ${currentUser.name.split(' ')[0]}!`;
    }
  }

  async function loadDashboardStats() {
    try {
      const reports = await window.SafeShift.Reports.getAll();
      const myReports = reports.filter(r => r.submittedBy === currentUser.id);
      
      // Update stats
      const statsCards = document.querySelectorAll('.stat-card h3');
      if (statsCards[0]) statsCards[0].textContent = '12'; // Days this month (static for now)
      if (statsCards[1]) statsCards[1].textContent = myReports.length;
      if (statsCards[2]) statsCards[2].textContent = '2'; // Messages (static for now)

      // Update wellness score
      const employee = await window.SafeShift.Employees.getById(currentUser.id);
      if (employee && employee.wellnessScore) {
        const wellnessPercent = employee.wellnessScore;
        updateWellnessScore(wellnessPercent);
      }

    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  function updateWellnessScore(score) {
    // Update donut chart
    const donutChart = document.querySelector('.donut-chart');
    if (donutChart) {
      const percentage = score;
      donutChart.style.background = `conic-gradient(
        var(--accent-green) 0% ${percentage}%, 
        #f0f0f0 ${percentage}% 100%
      )`;
    }

    // Update wellness text
    const wellnessDetails = document.querySelector('.wellness-details h4');
    if (wellnessDetails) {
      if (score >= 80) wellnessDetails.textContent = 'Excellent';
      else if (score >= 60) wellnessDetails.textContent = 'Good';
      else if (score >= 40) wellnessDetails.textContent = 'Fair';
      else wellnessDetails.textContent = 'Needs Attention';
    }
  }

  async function loadRecentReports() {
    try {
      const reports = await window.SafeShift.Reports.getAll();
      const myReports = reports
        .filter(r => r.submittedBy === currentUser.id)
        .slice(0, 3);

      const reportList = document.querySelector('.report-list');
      if (!reportList) return;

      reportList.innerHTML = myReports.map(report => `
        <li class="report-item">
          <div class="report-info">
            <h5>${report.type}</h5>
            <span>${report.id} • ${window.SafeShift.Utils.getTimeAgo(report.submittedAt)}</span>
          </div>
          <span class="tag ${report.status === 'Resolved' ? 'resolved' : 'review'}">
            ${report.status}
          </span>
        </li>
      `).join('');

    } catch (error) {
      console.error('Error loading reports:', error);
    }
  }

  // ==========================================
  // REPORT SUBMISSION MODAL
  // ==========================================
  function initializeReportModal() {
    const modal = document.getElementById('reportModal');
    const openBtn = document.getElementById('openModalBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');

    let currentStep = 0;
    const steps = [
      document.getElementById('step1'),
      document.getElementById('step2'),
      document.getElementById('step3'),
      document.getElementById('step4')
    ];

    // Open modal
    openBtn.addEventListener('click', () => {
      modal.classList.add('active');
      currentStep = 0;
      updateModalStep();
      clearForm();
    });

    // Close modal
    closeBtn.addEventListener('click', closeModal);
    finishBtn.addEventListener('click', closeModal);

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    function closeModal() {
      modal.classList.remove('active');
      currentStep = 0;
      updateModalStep();
      clearForm();
    }

    // Next button
    nextBtn.addEventListener('click', async () => {
      if (currentStep === 0) {
        // Validate step 1
        if (!validateStep1()) {
          return;
        }
      }

      if (currentStep === 2) {
        // Submit report
        await submitReport();
        currentStep++;
        updateModalStep();
      } else if (currentStep < 2) {
        currentStep++;
        if (currentStep === 2) populateReview();
        updateModalStep();
      }
    });

    // Back button
    backBtn.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        updateModalStep();
      }
    });

    function updateModalStep() {
      const modalFooter = document.getElementById('modalFooter');
      const modalTitle = document.getElementById('modalTitleStep');
      const modalSub = document.getElementById('modalSubTitle');

      // Hide all steps
      steps.forEach(step => step.classList.remove('active'));
      steps[currentStep].classList.add('active');

      // Update UI based on current step
      if (currentStep === 0) {
        backBtn.style.display = 'none';
        nextBtn.innerText = 'Next';
        modalFooter.style.display = 'flex';
        modalTitle.innerText = 'Submit a Report';
        modalSub.innerText = 'Please fill out the details below';
      } else if (currentStep === 1) {
        backBtn.style.display = 'block';
        nextBtn.innerText = 'Review';
        modalTitle.innerText = 'Add Attachments';
        modalSub.innerText = 'Optional: Add supporting files';
      } else if (currentStep === 2) {
        backBtn.style.display = 'block';
        nextBtn.innerText = 'Submit Report';
        modalTitle.innerText = 'Review & Submit';
        modalSub.innerText = 'Please review your information';
      } else if (currentStep === 3) {
        modalFooter.style.display = 'none';
        modalTitle.innerText = 'Success';
        modalSub.innerText = '';
      }
    }

    function validateStep1() {
      const title = document.getElementById('inputTitle').value.trim();
      const category = document.getElementById('inputCategory').value;
      const description = document.getElementById('inputDesc').value.trim();

      if (!title) {
        alert('Please enter a report title');
        return false;
      }

      if (category === 'Select type') {
        alert('Please select a report type');
        return false;
      }

      if (!description || description.length < 20) {
        alert('Please provide a detailed description (minimum 20 characters)');
        return false;
      }

      return true;
    }

    function populateReview() {
      document.getElementById('reviewTitle').innerText = 
        document.getElementById('inputTitle').value || 'Untitled Report';
      
      document.getElementById('reviewCategory').innerText = 
        document.getElementById('inputCategory').value || 'Uncategorized';
      
      document.getElementById('reviewSeverity').innerText = 
        document.getElementById('inputSeverity').value || 'Low';
      
      const dateVal = document.getElementById('inputDate').value;
      document.getElementById('reviewDate').innerText = dateVal 
        ? new Date(dateVal).toLocaleDateString() 
        : 'Date not set';
      
      document.getElementById('reviewLocation').innerText = 
        document.getElementById('inputLocation').value || 'No location';
      
      document.getElementById('reviewDesc').innerText = 
        document.getElementById('inputDesc').value || 'No description provided.';
    }

    async function submitReport() {
      const reportData = {
        title: document.getElementById('inputTitle').value,
        type: document.getElementById('inputCategory').value,
        severity: document.getElementById('inputSeverity').value,
        department: currentUser.department,
        description: document.getElementById('inputDesc').value,
        location: document.getElementById('inputLocation').value,
        incidentDate: document.getElementById('inputDate').value,
        isAnonymous: document.getElementById('inputAnon').checked
      };

      try {
        const newReport = await window.SafeShift.Reports.create(reportData);
        console.log('Report created:', newReport);
        
        // Reload recent reports
        await loadRecentReports();
        await loadDashboardStats();
      } catch (error) {
        console.error('Error creating report:', error);
        alert('Failed to submit report. Please try again.');
      }
    }

    function clearForm() {
      document.getElementById('inputTitle').value = '';
      document.getElementById('inputCategory').value = 'Select type';
      document.getElementById('inputSeverity').value = 'Low';
      document.getElementById('inputDesc').value = '';
      document.getElementById('inputLocation').value = '';
      document.getElementById('inputDate').value = '';
      document.getElementById('inputAnon').checked = false;
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