// ==========================================
// ADMIN DASHBOARD JAVASCRIPT (UPDATED)
// ==========================================

(function () {
  let currentUser = null;

  document.addEventListener("DOMContentLoaded", async function () {
    currentUser = await window.SafeShift.Auth.init();

    if (!window.SafeShift.Auth.requireAuth("admin")) {
      return;
    }

    await initializeAdminDashboard();
    initializeModals();
    setupLogoutHandler();
  });

  // ==========================================
  // INITIALIZATION
  // ==========================================
  async function initializeAdminDashboard() {
    updateUserInfo();
    await loadDashboardStats();
    await loadDepartments();
    await loadRecentReports();
  }

  function updateUserInfo() {
    const sidebarName = document.querySelector(
      ".user-profile-mini .user-info h4"
    );
    const sidebarDept = document.querySelector(
      ".user-profile-mini .user-info p"
    );

    const topName = document.querySelector(".top-user-text h4");
    const topDept = document.querySelector(".top-user-text span");

    if (sidebarName) sidebarName.textContent = currentUser.name;
    if (sidebarDept) sidebarDept.textContent = currentUser.department;
    if (topName) topName.textContent = currentUser.name;
    if (topDept) topDept.textContent = currentUser.department;
  }

  // ==========================================
  // DASHBOARD STATS
  // ==========================================
  async function loadDashboardStats() {
    try {
      const employees = await window.SafeShift.Employees.getAll();
      const reports = await window.SafeShift.Reports.getAll();

      const activeReports = reports.filter((r) => r.status !== "Resolved");
      const flaggedReports = reports.filter((r) => r.autoFlagged);

      const avgWellness = Math.round(
        employees.reduce((sum, e) => sum + (e.wellnessScore || 50), 0) /
          employees.length
      );

      const statBoxes = document.querySelectorAll(".stat-box h2");
      if (statBoxes[0]) statBoxes[0].textContent = employees.length;
      if (statBoxes[1]) statBoxes[1].textContent = activeReports.length;
      if (statBoxes[2]) statBoxes[2].textContent = flaggedReports.length;
      if (statBoxes[3]) statBoxes[3].textContent = `${avgWellness}%`;
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }

  // ==========================================
  // DEPARTMENTS GRID
  // ==========================================
  async function loadDepartments() {
    try {
      const departments = await window.SafeShift.Departments.updateMetrics();
      const deptGrid = document.querySelector(".dept-grid");

      if (!deptGrid) return;

      deptGrid.innerHTML = departments
        .map((dept) => {
          const isAlert =
            dept.activeReports > 3 || dept.wellnessScore < 50;

          const wellnessColor =
            dept.wellnessScore >= 70
              ? "var(--accent-green)"
              : dept.wellnessScore >= 50
              ? "#f39c12"
              : "var(--alert-red)";

          return `
            <div class="dept-card" data-dept-id="${dept.id}">
              ${isAlert ? '<div class="alert-dot"></div>' : ""}
              <div class="dept-icon"><i class="fa-solid fa-gears"></i></div>
              <h3>${dept.name}</h3>

              <span class="status-tag ${
                dept.wellnessScore >= 70
                  ? "healthy"
                  : dept.wellnessScore >= 50
                  ? "fair"
                  : "at-risk"
              }">
                <i class="fa-solid fa-chart-line"></i> ${
                  dept.wellnessScore >= 70
                    ? "Healthy"
                    : dept.wellnessScore >= 50
                    ? "Fair"
                    : "At Risk"
                }
              </span>

              <div class="dept-metrics">
                <div class="metric-item">
                  <span class="metric-val">${dept.employeeCount}</span>
                  <span class="metric-label">Employees</span>
                </div>

                <div class="metric-item" style="color: ${
                  dept.activeReports > 3 ? "var(--alert-red)" : "inherit"
                }">
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
        })
        .join("");

      document.querySelectorAll(".dept-card").forEach((card) => {
        card.addEventListener("click", () => {
          console.log("Clicked department:", card.dataset.deptId);
        });
      });
    } catch (error) {
      console.error("Error loading departments:", error);
    }
  }

  // ==========================================
  // RECENT REPORTS
  // ==========================================
  async function loadRecentReports() {
    try {
      const reports = await window.SafeShift.Reports.getAll();
      const tbody = document.querySelector("#reportsTable tbody");

      if (!tbody) return;

      const recentReports = reports.slice(0, 5);

      tbody.innerHTML = recentReports
        .map((report) => {
          return `
            <tr class="report-row" data-report-id="${report.id}">
              <td>${report.id}</td>
              <td>${report.type}</td>
              <td>${report.department}</td>
              <td><span class="badge ${
                window.SafeShift.Utils.getSeverityClass(report.severity)
              }">${report.severity}</span></td>
              <td><span class="status-badge ${
                window.SafeShift.Utils.getStatusClass(report.status)
              }">${report.status}</span></td>
              <td>${window.SafeShift.Utils.formatDate(
                report.submittedAt
              )}</td>
              <td><i class="fa-regular fa-eye action-icon"></i></td>
            </tr>
          `;
        })
        .join("");

      document.querySelectorAll(".report-row").forEach((row) => {
        row.addEventListener("click", () => {
          openReportDetailsModal(row.dataset.reportId);
        });
      });
    } catch (error) {
      console.error("Error loading reports:", error);
    }
  }

  // ==========================================
  // MODAL SYSTEM
  // ==========================================
  function initializeModals() {
    initializeAddEmployeeModal();
    initializeReportDetailsModal();
  }

  // ADD EMPLOYEE MODAL
  function initializeAddEmployeeModal() {
    const btn = document.getElementById("addEmployeeBtn");
    const modal = document.getElementById("addEmployeeModal");
    const close = modal.querySelectorAll(".close-modal-btn");
    const form = modal.querySelector("form");

    btn.addEventListener("click", () => modal.classList.add("active"));

    close.forEach((c) =>
      c.addEventListener("click", () => {
        modal.classList.remove("active");
        form.reset();
      })
    );

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
        form.reset();
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const data = {
        name: form.querySelector(".name-input").value.trim(),
        email: form.querySelector(".email-input").value.trim(),
        department: form.querySelector(".department-select").value,
        role: form.querySelector(".role-input").value.trim(),
      };

      if (!data.name || !data.email || !data.department || !data.role) {
        alert("Please fill in all fields.");
        return;
      }

      try {
        await window.SafeShift.Employees.create(data);

        modal.classList.remove("active");
        form.reset();

        await loadDashboardStats();
        await loadDepartments();
      } catch (err) {
        console.error("Error creating employee:", err);
        alert("Failed to create employee.");
      }
    });
  }

  // REPORT DETAILS MODAL
  function initializeReportDetailsModal() {
    const modal = document.getElementById("reportDetailsModal");
    const closeBtns = modal.querySelectorAll(".close-modal-btn");
    const saveBtn = modal.querySelector("#saveChangesBtn");

    closeBtns.forEach((btn) => {
      btn.addEventListener("click", () => modal.classList.remove("active"));
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("active");
    });

    saveBtn.addEventListener("click", async () => {
      const reportId = modal.dataset.currentReportId;
      const newStatus = modal.querySelector(".status-select").value;
      const notes = modal.querySelector(".notes-textarea").value.trim();

      try {
        await window.SafeShift.Reports.updateStatus(reportId, newStatus);

        alert("Report updated successfully.");
        modal.classList.remove("active");

        await loadRecentReports();
      } catch (error) {
        console.error("Update error:", error);
        alert("Failed to update report.");
      }
    });
  }

  // OPEN REPORT MODAL
  async function openReportDetailsModal(reportId) {
    const modal = document.getElementById("reportDetailsModal");
    const report = await window.SafeShift.Reports.getById(reportId);

    if (!report) return alert("Report not found.");

    modal.dataset.currentReportId = reportId;

    modal.querySelector(".modal-title").textContent = `Report #${report.id}`;
    modal.querySelector(".department-value").textContent = report.department;
    modal.querySelector(".severity-badge").className =
      "severity-badge " +
      window.SafeShift.Utils.getSeverityClass(report.severity);
    modal.querySelector(".severity-badge").textContent = report.severity;
    modal.querySelector(".submitted-value").textContent =
      window.SafeShift.Utils.formatDate(report.submittedAt);
    modal.querySelector(".anonymous-value").textContent = report.isAnonymous
      ? "Yes (Anonymous)"
      : report.employeeName || "Employee";

    modal.querySelector(".description-text").textContent = report.description;
    modal.querySelector(".status-select").value = report.status;

    const flagBanner = modal.querySelector(".auto-flag-banner");
    if (report.autoFlagged) {
      flagBanner.style.display = "flex";
      flagBanner.querySelector("span").textContent =
        report.flagReason || "Auto-flagged for review.";
    } else {
      flagBanner.style.display = "none";
    }

    modal.classList.add("active");
  }

  // ==========================================
  // LOGOUT
  // ==========================================
  function setupLogoutHandler() {
    const logoutLink = document.querySelector(".logout-link");

    if (!logoutLink) return;

    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      if (confirm("Log out?")) await window.SafeShift.Auth.logout();
    });
  }
})();
