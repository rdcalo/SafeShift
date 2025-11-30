<?php
require_once __DIR__ . '/config.php';

// ==========================================
// ENABLE DETAILED ERROR LOGGING
// ==========================================
error_log("=== REPORTS.PHP REQUEST START ===");
error_log("Method: " . $_SERVER['REQUEST_METHOD']);
error_log("Time: " . date('Y-m-d H:i:s'));
error_log("Session ID: " . session_id());
error_log("User ID in session: " . (isset($_SESSION['user_id']) ? $_SESSION['user_id'] : 'NOT SET'));
error_log("User name in session: " . (isset($_SESSION['name']) ? $_SESSION['name'] : 'NOT SET'));
error_log("User role in session: " . (isset($_SESSION['role']) ? $_SESSION['role'] : 'NOT SET'));

try {
    $conn = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Get raw input for POST/PUT requests
    $input = file_get_contents('php://input');
    error_log("Raw input: " . $input);
    
    $data = json_decode($input, true);
    error_log("Decoded data: " . print_r($data, true));
    
    // Check for JSON decode errors
    if ($input && $data === null) {
        error_log("JSON decode error: " . json_last_error_msg());
        throw new Exception('Invalid JSON data: ' . json_last_error_msg());
    }
    
    switch ($method) {
        case 'GET':
            handleGetReports($conn);
            break;
            
        case 'POST':
            handleCreateReport($conn, $data);
            break;
            
        case 'PUT':
            handleUpdateReport($conn, $data);
            break;
            
        case 'DELETE':
            handleDeleteReport($conn, $data);
            break;
            
        default:
            throw new Exception('Method not allowed: ' . $method);
    }
    
} catch (Exception $e) {
    error_log("=== ERROR IN REPORTS.PHP ===");
    error_log("Error message: " . $e->getMessage());
    error_log("Error file: " . $e->getFile());
    error_log("Error line: " . $e->getLine());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'debug' => [
            'file' => basename($e->getFile()),
            'line' => $e->getLine(),
            'session_user' => isset($_SESSION['user_id']) ? 'Set' : 'Not Set'
        ]
    ]);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
    error_log("=== REPORTS.PHP REQUEST END ===\n");
}

// ==========================================
// GET - Fetch Reports
// ==========================================
function handleGetReports($conn) {
    error_log("Handling GET request for reports");
    
    // Check if requesting single report by ID
    if (isset($_GET['id'])) {
        getSingleReport($conn, $_GET['id']);
        return;
    }
    
    // Build query with optional filters
    $sql = "SELECT 
                r.*,
                u.full_name as reporter_name
            FROM reports r
            LEFT JOIN users u ON r.reporter_id = u.id
            WHERE 1=1";
    
    $params = [];
    $types = "";
    
    // Filter by department
    if (isset($_GET['department']) && $_GET['department'] !== 'All') {
        $sql .= " AND r.department = ?";
        $params[] = $_GET['department'];
        $types .= "s";
    }
    
    // Filter by status
    if (isset($_GET['status'])) {
        $sql .= " AND r.status = ?";
        $params[] = $_GET['status'];
        $types .= "s";
    }
    
    // Filter by severity
    if (isset($_GET['severity'])) {
        $sql .= " AND r.severity = ?";
        $params[] = $_GET['severity'];
        $types .= "s";
    }
    
    // Order by creation date (newest first)
    $sql .= " ORDER BY r.created_at DESC";
    
    error_log("SQL query: " . $sql);
    
    // Prepare and execute
    $stmt = $conn->prepare($sql);
    
    if (!$stmt) {
        error_log("Failed to prepare statement: " . $conn->error);
        throw new Exception('Database error: ' . $conn->error);
    }
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $reports = [];
    while ($row = $result->fetch_assoc()) {
        $reports[] = formatReportResponse($row);
    }
    
    error_log("Found " . count($reports) . " reports");
    
    echo json_encode([
        'success' => true,
        'data' => $reports
    ]);
}

// ==========================================
// GET Single Report
// ==========================================
function getSingleReport($conn, $reportId) {
    error_log("Fetching single report: " . $reportId);
    
    $sql = "SELECT 
                r.*,
                u.full_name as reporter_name
            FROM reports r
            LEFT JOIN users u ON r.reporter_id = u.id
            WHERE r.report_id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $reportId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        error_log("Report not found: " . $reportId);
        throw new Exception('Report not found');
    }
    
    $report = $result->fetch_assoc();
    
    echo json_encode([
        'success' => true,
        'data' => formatReportResponse($report)
    ]);
}

// ==========================================
// POST - Create Report (ENHANCED)
// ==========================================
function handleCreateReport($conn, $data) {
    error_log("=== CREATE REPORT FUNCTION START ===");
    
    // 1. CHECK AUTHENTICATION
    if (!isset($_SESSION['user_id'])) {
        error_log("ERROR: User not authenticated - session user_id not set");
        error_log("Session contents: " . print_r($_SESSION, true));
        throw new Exception('User not authenticated. Please log in again.');
    }
    
    $userId = $_SESSION['user_id'];
    $userName = $_SESSION['name'] ?? 'Unknown User';
    $userDept = $_SESSION['department'] ?? 'Unknown Department';
    
    error_log("User authenticated: ID=$userId, Name=$userName, Dept=$userDept");
    
    // 2. VALIDATE INPUT DATA
    if (!$data || !is_array($data)) {
        error_log("ERROR: Invalid data format - not an array");
        throw new Exception('Invalid data format');
    }
    
    error_log("Received data fields: " . implode(', ', array_keys($data)));
    
    // 3. CHECK REQUIRED FIELDS
    $required = ['title', 'type', 'severity', 'department', 'description', 'location', 'incidentDate'];
    $missing = [];
    
    foreach ($required as $field) {
        if (!isset($data[$field]) || trim($data[$field]) === '') {
            $missing[] = $field;
            error_log("Missing field: $field");
        }
    }
    
    if (!empty($missing)) {
        $missingFields = implode(', ', $missing);
        error_log("ERROR: Missing required fields: $missingFields");
        throw new Exception("Missing required fields: $missingFields");
    }
    
    // 4. SANITIZE INPUT
    $title = trim($data['title']);
    $description = trim($data['description']);
    $severity = $data['severity'];
    $department = $data['department'];
    $location = trim($data['location']);
    $type = $data['type'];
    
    error_log("Sanitized - Title: $title, Type: $type, Severity: $severity, Dept: $department");
    
    // 5. GENERATE REPORT ID
    $reportId = 'REP-' . time();
    error_log("Generated report ID: $reportId");
    
    // 6. AUTO-FLAGGING LOGIC
    $autoFlagged = 0;
    $flagReason = null;
    
    $flagKeywords = ['harassment', 'discrimination', 'unsafe', 'threat', 'assault', 'abuse', 'violent'];
    $descLower = strtolower($description);
    $typeLower = strtolower($type);
    
    foreach ($flagKeywords as $keyword) {
        if (strpos($descLower, $keyword) !== false || strpos($typeLower, $keyword) !== false) {
            $autoFlagged = 1;
            $flagReason = "Contains flagged keyword: $keyword";
            error_log("Auto-flagged: $flagReason");
            break;
        }
    }
    
    // Auto-flag critical severity
    if ($severity === 'Critical') {
        $autoFlagged = 1;
        $flagReason = $flagReason ? $flagReason . ' | Critical severity' : 'Critical severity level';
        error_log("Auto-flagged: Critical severity");
    }
    
    // Check for multiple reports from same department in 7 days
    $sevenDaysAgo = date('Y-m-d H:i:s', strtotime('-7 days'));
    $checkSql = "SELECT COUNT(*) as count FROM reports 
                 WHERE department = ? AND created_at >= ?";
    $stmt = $conn->prepare($checkSql);
    $stmt->bind_param("ss", $department, $sevenDaysAgo);
    $stmt->execute();
    $countResult = $stmt->get_result()->fetch_assoc();
    
    if ($countResult['count'] >= 3) {
        $autoFlagged = 1;
        $flagReason = $flagReason ? $flagReason . ' | Multiple reports from department' : 
                      'Multiple similar reports from this department in past 7 days';
        error_log("Auto-flagged: Multiple reports from department");
    }
    
    // 7. PREPARE INSERT STATEMENT
    $sql = "INSERT INTO reports (
                report_id, title, description, severity, status, department, 
                location, reporter_id, reporter_name, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'New', ?, ?, ?, ?, NOW(), NOW())";
    
    error_log("Preparing SQL insert...");
    
    $stmt = $conn->prepare($sql);
    
    if (!$stmt) {
        error_log("ERROR: Failed to prepare statement: " . $conn->error);
        throw new Exception('Database error: Failed to prepare statement - ' . $conn->error);
    }
    
    // 8. BIND PARAMETERS
    $stmt->bind_param(
        "sssissis", // FIXED: Changed to match actual parameter types
        $reportId,
        $title,
        $description,
        $severity,
        $department,
        $location,
        $userId,
        $userName
    );
    
    error_log("Parameters bound successfully");
    
    // 9. EXECUTE INSERT
    if (!$stmt->execute()) {
        error_log("ERROR: Failed to execute insert: " . $stmt->error);
        throw new Exception('Failed to create report: ' . $stmt->error);
    }
    
    $insertedRows = $stmt->affected_rows;
    error_log("SUCCESS: Report inserted. Affected rows: $insertedRows");
    
    // 10. LOG ACTIVITY
    try {
        logActivity($conn, $userId, 'Report Submitted', 
            "New $type report submitted - Department: $department", $userName);
        error_log("Activity logged successfully");
    } catch (Exception $e) {
        error_log("WARNING: Failed to log activity: " . $e->getMessage());
        // Don't fail the report creation if logging fails
    }
    
    // 11. RETURN SUCCESS
    error_log("=== CREATE REPORT SUCCESS ===");
    
    echo json_encode([
        'success' => true,
        'message' => 'Report created successfully',
        'reportId' => $reportId,
        'autoFlagged' => (bool)$autoFlagged,
        'flagReason' => $flagReason
    ]);
}

// ==========================================
// PUT - Update Report
// ==========================================
function handleUpdateReport($conn, $data) {
    error_log("Updating report: " . ($data['id'] ?? 'unknown'));
    
    if (empty($data['id'])) {
        throw new Exception('Report ID is required');
    }
    
    // Check if report exists
    $checkSql = "SELECT * FROM reports WHERE report_id = ?";
    $stmt = $conn->prepare($checkSql);
    $stmt->bind_param("s", $data['id']);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('Report not found');
    }
    
    $oldReport = $result->fetch_assoc();
    
    // Build update query dynamically
    $updates = [];
    $params = [];
    $types = "";
    
    if (isset($data['status'])) {
        $updates[] = "status = ?";
        $params[] = $data['status'];
        $types .= "s";
    }
    
    if (isset($data['severity'])) {
        $updates[] = "severity = ?";
        $params[] = $data['severity'];
        $types .= "s";
    }
    
    if (isset($data['title'])) {
        $updates[] = "title = ?";
        $params[] = $data['title'];
        $types .= "s";
    }
    
    if (isset($data['description'])) {
        $updates[] = "description = ?";
        $params[] = $data['description'];
        $types .= "s";
    }
    
    if (empty($updates)) {
        throw new Exception('No fields to update');
    }
    
    // Add updated_at timestamp
    $updates[] = "updated_at = NOW()";
    
    // Add report_id parameter
    $params[] = $data['id'];
    $types .= "s";
    
    $sql = "UPDATE reports SET " . implode(", ", $updates) . " WHERE report_id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    
    if (!$stmt->execute()) {
        throw new Exception('Failed to update report: ' . $stmt->error);
    }
    
    error_log("Report updated successfully");
    
    // Log activity
    if (isset($_SESSION['user_id']) && isset($data['status'])) {
        $userName = $_SESSION['name'] ?? 'System';
        logActivity($conn, $_SESSION['user_id'], 'Status Changed', 
            "Changed report {$data['id']} status from {$oldReport['status']} to {$data['status']}", $userName);
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Report updated successfully'
    ]);
}

// ==========================================
// DELETE - Delete Report
// ==========================================
function handleDeleteReport($conn, $data) {
    error_log("Deleting report: " . ($data['id'] ?? 'unknown'));
    
    if (empty($data['id'])) {
        throw new Exception('Report ID is required');
    }
    
    // Check if user is admin
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        throw new Exception('Unauthorized: Admin access required');
    }
    
    $sql = "DELETE FROM reports WHERE report_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $data['id']);
    
    if (!$stmt->execute()) {
        throw new Exception('Failed to delete report: ' . $stmt->error);
    }
    
    if ($stmt->affected_rows === 0) {
        throw new Exception('Report not found');
    }
    
    error_log("Report deleted successfully");
    
    echo json_encode([
        'success' => true,
        'message' => 'Report deleted successfully'
    ]);
}

// ==========================================
// Helper Functions
// ==========================================
function formatReportResponse($row) {
    return [
        'id' => $row['report_id'],
        'title' => $row['title'],
        'type' => $row['report_type'] ?? 'General',
        'description' => $row['description'],
        'severity' => $row['severity'],
        'status' => $row['status'],
        'department' => $row['department'],
        'location' => $row['location'],
        'submittedBy' => $row['reporter_id'],
        'submittedByName' => $row['reporter_name'],
        'submittedAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
        'isAnonymous' => isset($row['is_anonymous']) ? (bool)$row['is_anonymous'] : false,
        'autoFlagged' => isset($row['auto_flagged']) ? (bool)$row['auto_flagged'] : false,
        'flagReason' => $row['flag_reason'] ?? null
    ];
}

function logActivity($conn, $userId, $type, $description, $userName) {
    $sql = "INSERT INTO activity_log (user_id, action, description, ip_address, created_at) 
            VALUES (?, ?, ?, ?, NOW())";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Failed to prepare activity log: ' . $conn->error);
    }
    
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $stmt->bind_param("isss", $userId, $type, $description, $ipAddress);
    
    if (!$stmt->execute()) {
        throw new Exception('Failed to log activity: ' . $stmt->error);
    }
}
?>