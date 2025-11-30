// ==========================================
// ENHANCED EMPLOYEE DASHBOARD WITH WELLNESS ALGORITHM
// ==========================================

(function() {
  let currentUser = null;
  let userTasks = [];
  let userReports = [];

  document.addEventListener('DOMContentLoaded', async function() {
    currentUser = await window.SafeShift.Auth.init();
    if (!window.SafeShift.Auth.requireAuth('employee')) {
      return;
    }

    await initializeDashboard();
    initializeReportModal();
    setupLogoutHandler();
  });

  async function initializeDashboard() {
    updateUserInfo();
    await loadUserTasks();
    await loadDashboardStats();
    await loadRecentReports();
    calculateWellnessScore();
  }

  function updateUserInfo() {
    const sidebarName = document.querySelector('.user-profile-mini .user-info h4');
    const sidebarDept = document.querySelector('.user-profile-mini .user-info p');
    const sidebarAvatar = document.querySelector('.user-profile-mini .user-avatar-circle');

    if (sidebarName) sidebarName.textContent = currentUser.name;
    if (sidebarDept) sidebarDept.textContent = currentUser.department;
    if (sidebarAvatar) {
      sidebarAvatar.textContent = window.SafeShift.Utils.getInitials(currentUser.name);
    }

    const greeting = document.querySelector('.header-text h1');
    if (greeting) {
      const hour = new Date().getHours();
      const greetingText = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
      greeting.textContent = `${greetingText}, ${currentUser.name.split(' ')[0]}!`;
    }
  }

  // ==========================================
  // WELLNESS SCORE ALGORITHM
  // ==========================================
  async function calculateWellnessScore() {
    try {
      const employee = await window.SafeShift.Employees.getById(currentUser.id);
      
      // Get tasks and overtime data
      const totalTasks = userTasks.length;
      const completedTasks = userTasks.filter(t => t.completed).length;
      const pendingTasks = totalTasks - completedTasks;
      
      // Get overtime hours (from last 7 days)
      const overtimeHours = await getOvertimeHours();
      
      // WELLNESS ALGORITHM
      let workLifeBalance = 100;
      let activityLevel = 50;
      let stressLevel = 0;
      
      // 1. Work-Life Balance (based on tasks AND overtime)
      // Penalty for too many pending tasks
      if (pendingTasks > 10) workLifeBalance -= 40;
      else if (pendingTasks > 7) workLifeBalance -= 25;
      else if (pendingTasks > 5) workLifeBalance -= 15;
      
      // Penalty for excessive overtime
      if (overtimeHours > 15) workLifeBalance -= 30;
      else if (overtimeHours > 10) workLifeBalance -= 20;
      else if (overtimeHours > 5) workLifeBalance -= 10;
      
      workLifeBalance = Math.max(0, Math.min(100, workLifeBalance));
      
      // 2. Activity Level (based on overtime - inverse relationship)
      // More overtime = higher activity (but not good for wellness)
      if (overtimeHours > 15) activityLevel = 90;
      else if (overtimeHours > 10) activityLevel = 75;
      else if (overtimeHours > 5) activityLevel = 60;
      else if (overtimeHours > 2) activityLevel = 45;
      else activityLevel = 30;
      
      // 3. Stress Level (based on pending tasks)
      if (pendingTasks > 10) stressLevel = 80;
      else if (pendingTasks > 7) stressLevel = 60;
      else if (pendingTasks > 5) stressLevel = 40;
      else if (pendingTasks > 3) stressLevel = 25;
      else stressLevel = 10;
      
      // Overall Wellness Score (weighted average)
      const overallWellness = Math.round(
        (workLifeBalance * 0.5) + // 50% weight
        ((100 - stressLevel) * 0.3) + // 30% weight (inverted)
        ((100 - activityLevel) * 0.2)  // 20% weight (inverted - less overtime is better)
      );
      
      // Update UI
      updateWellnessUI(overallWellness, workLifeBalance, activityLevel, stressLevel);
      
      // Save to backend
      await window.SafeShift.Employees.update(currentUser.id, {
        wellnessScore: overallWellness
      });
      
    } catch (error) {
      console.error('Error calculating wellness score:', error);
    }
  }

  function updateWellnessUI(overall, workLife, activity, stress) {
    // Update donut chart
    const donutChart = document.querySelector('.donut-chart');
    if (donutChart) {
      donutChart.style.background = `conic-gradient(
        var(--accent-green) 0% ${overall}%, 
        #f0f0f0 ${overall}% 100%
      )`;
    }
    
    // Update wellness text
    const wellnessDetails = document.querySelector('.wellness-details h4');
    if (wellnessDetails) {
      if (overall >= 80) wellnessDetails.textContent = 'Excellent';
      else if (overall >= 60) wellnessDetails.textContent = 'Good';
      else if (overall >= 40) wellnessDetails.textContent = 'Fair';
      else wellnessDetails.textContent = 'Needs Attention';
    }
    
    // Update metric bars
    const metricBars = document.querySelectorAll('.metric-bar-fill');
    if (metricBars[0]) {
      metricBars[0].style.width = `${workLife}%`;
      metricBars[0].style.backgroundColor = workLife >= 70 ? 'var(--accent-green)' : 
                                            workLife >= 50 ? 'var(--warning-yellow)' : 
                                            'var(--alert-red)';
    }
    if (metricBars[1]) {
      metricBars[1].style.width = `${activity}%`;
      metricBars[1].style.backgroundColor = activity <= 60 ? 'var(--accent-green)' : 
                                            activity <= 80 ? 'var(--warning-yellow)' : 
                                            'var(--alert-red)';
    }
    if (metricBars[2]) {
      metricBars[2].style.width = `${stress}%`;
      metricBars[2].style.backgroundColor = stress <= 30 ? 'var(--accent-green)' : 
                                            stress <= 60 ? 'var(--warning-yellow)' : 
                                            'var(--alert-red)';
    }
  }

  async function getOvertimeHours() {
    // This would come from your time tracking system
    // For demo, generate based on current tasks
    const overtimeHours = Math.floor(Math.random() * 20);
    return overtimeHours;
  }

  // ==========================================
  // TASK MANAGEMENT & PERFORMANCE TRACKER
  // ==========================================
  async function loadUserTasks() {
    try {
      // Load tasks from storage or API
      userTasks = await window.SafeShift.Storage.get(`tasks_${currentUser.id}`) || [
        { id: 1, title: 'Quarterly report', completed: true, dueDate: new Date() },
        { id: 2, title: 'Team proposal', completed: true, dueDate: new Date() },
        { id: 3, title: 'Client meeting prep', completed: false, dueDate: new Date() },
        { id: 4, title: 'Code review', completed: false, dueDate: new Date() },
        { id: 5, title: 'Documentation update', completed: false, dueDate: new Date() }
      ];
      
      updateTaskUI();
      updatePerformanceTracker();
      
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }

  function updateTaskUI() {
    const totalTasks = userTasks.length;
    const completedTasks = userTasks.filter(t => t.completed).length;
    
    // Update task donut chart
    const taskDonut = document.querySelector('.wellness-content .donut-chart[style*="70px"]');
    if (taskDonut) {
      const percentage = totalTasks > 0 ? (completedTasks / totalTasks * 100) : 0;
      taskDonut.style.background = `conic-gradient(
        var(--accent-green) 0% ${percentage}%, 
        #eee ${percentage}% 100%
      )`;
    }
    
    // Update task count
    const taskCount = document.querySelector('.wellness-details h4[style*="color:var(--text-dark)"]');
    if (taskCount) {
      taskCount.textContent = `${completedTasks}/${totalTasks}`;
    }
  }

  function updatePerformanceTracker() {
    const today = new Date().toDateString();
    const todayTasks = userTasks.filter(t => new Date(t.dueDate).toDateString() === today);
    const todayCompleted = todayTasks.filter(t => t.completed).length;
    const todayTotal = todayTasks.length || 8; // Default 8 hour workday
    
    const percentage = Math.round((todayCompleted / todayTotal) * 100);
    
    // Update progress bar
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
    }
    
    // Update progress label
    const progressLabels = document.querySelectorAll('.progress-label span');
    if (progressLabels[1]) {
      progressLabels[1].innerHTML = `<span style="color: var(--accent-green);">${todayCompleted}/${todayTotal}</span>`;
    }
    if (progressLabels[3]) {
      progressLabels[3].textContent = `${percentage}%`;
    }
  }

  // ==========================================
  // RECENT REPORTS WITH CLICK HANDLER
  // ==========================================
  async function loadRecentReports() {
    try {
      const reports = await window.SafeShift.Reports.getAll();
      userReports = reports.filter(r => r.submittedBy === currentUser.id).slice(0, 3);

      const reportList = document.querySelector('.report-list');
      if (!reportList) return;

      reportList.innerHTML = userReports.map(report => `
        <li class="report-item" data-report-id="${report.id}" style="cursor: pointer;">
          <div class="report-info">
            <h5>${report.type}</h5>
            <span>${report.id} • ${window.SafeShift.Utils.getTimeAgo(report.submittedAt)}</span>
          </div>
          <span class="tag ${report.status === 'Resolved' ? 'resolved' : 'review'}">
            ${report.status}
          </span>
        </li>
      `).join('');
      
      // Add click handlers
      document.querySelectorAll('.report-item').forEach(item => {
        item.addEventListener('click', () => {
          const reportId = item.dataset.reportId;
          viewReportDetails(reportId);
        });
      });

    } catch (error) {
      console.error('Error loading reports:', error);
    }
  }

  async function viewReportDetails(reportId) {
    const report = await window.SafeShift.Reports.getById(reportId);
    if (!report) {
      alert('Report not found');
      return;
    }
    
    alert(`Report Details:\n\n` +
          `ID: ${report.id}\n` +
          `Type: ${report.type}\n` +
          `Status: ${report.status}\n` +
          `Severity: ${report.severity}\n` +
          `Submitted: ${window.SafeShift.Utils.formatDate(report.submittedAt)}\n\n` +
          `Description: ${report.description}`);
  }

  async function loadDashboardStats() {
    try {
      const reports = await window.SafeShift.Reports.getAll();
      const myReports = reports.filter(r => r.submittedBy === currentUser.id);
      
      const statsCards = document.querySelectorAll('.stat-card h3');
      if (statsCards[0]) statsCards[0].textContent = new Date().getDate();
      if (statsCards[1]) statsCards[1].textContent = myReports.length;
      if (statsCards[2]) statsCards[2].textContent = '2';

    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  // ==========================================
  // ENHANCED REPORT MODAL WITH FILE UPLOAD
  // ==========================================
  function initializeReportModal() {
    const modal = document.getElementById('reportModal');
    const openBtn = document.getElementById('openModalBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');

    let currentStep = 0;
    let uploadedFiles = [];
    
    const steps = [
      document.getElementById('step1'),
      document.getElementById('step2'),
      document.getElementById('step3'),
      document.getElementById('step4')
    ];

    openBtn.addEventListener('click', () => {
      modal.classList.add('active');
      currentStep = 0;
      uploadedFiles = [];
      updateModalStep();
      clearForm();
    });

    closeBtn.addEventListener('click', closeModal);
    finishBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    function closeModal() {
      modal.classList.remove('active');
      currentStep = 0;
      uploadedFiles = [];
      updateModalStep();
      clearForm();
    }

    // File upload handler
    const fileUploadBox = document.querySelector('.file-upload-box');
    if (fileUploadBox) {
      fileUploadBox.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf,.png,.jpg,.jpeg';
        fileInput.multiple = true;
        
        fileInput.addEventListener('change', (e) => {
          const files = Array.from(e.target.files);
          uploadedFiles = files;
          
          fileUploadBox.innerHTML = `
            <i class="fa-solid fa-check" style="color: var(--accent-green);"></i>
            <p style="font-weight:700; color:var(--text-dark);">${files.length} file(s) selected</p>
            <p style="font-size:0.8rem;">${files.map(f => f.name).join(', ')}</p>
          `;
        });
        
        fileInput.click();
      });
    }

    nextBtn.addEventListener('click', async () => {
      if (currentStep === 0) {
        if (!validateStep1()) return;
      }

      if (currentStep === 2) {
        await submitReport();
        currentStep++;
        updateModalStep();
      } else if (currentStep < 2) {
        currentStep++;
        if (currentStep === 2) populateReview();
        updateModalStep();
      }
    });

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

      steps.forEach(step => step.classList.remove('active'));
      steps[currentStep].classList.add('active');

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
      
      // Show uploaded files
      const filesReview = document.getElementById('reviewFiles');
      if (filesReview) {
        filesReview.textContent = uploadedFiles.length > 0 
          ? uploadedFiles.map(f => f.name).join(', ') 
          : 'No files attached';
      }
    }

      async function submitReport() {
        const reportData = {
          title: document.getElementById('inputTitle').value,
          type: document.getElementById('inputCategory').value,
          severity: document.getElementById('inputSeverity').value,
          department: currentUser.department,
          description: document.getElementById('inputDesc').value,
          location: document.getElementById('inputLocation').value || 'Not specified',
          incidentDate: document.getElementById('inputDate').value || new Date().toISOString().split('T')[0],
          isAnonymous: document.getElementById('inputAnon')?.checked || false,
          hasAttachments: uploadedFiles.length > 0,
          attachmentCount: uploadedFiles.length
        };

        try {
          const newReport = await window.SafeShift.Reports.create(reportData);
          console.log('Report created:', newReport);
          
          await loadRecentReports();
          await loadDashboardStats();
          await calculateWellnessScore();
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
      uploadedFiles = [];
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