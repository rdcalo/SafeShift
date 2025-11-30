<?php
require_once __DIR__ . '/config.php';

try {
    $conn = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Get raw input for POST/PUT requests
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
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
            throw new Exception('Method not allowed');
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}

// ==========================================
// GET - Fetch Reports
// ==========================================
function handleGetReports($conn) {
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
    
    // Prepare and execute
    $stmt = $conn->prepare($sql);
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $reports = [];
    while ($row = $result->fetch_assoc()) {
        $reports[] = formatReportResponse($row);
    }
    
    echo json_encode([
        'success' => true,
        'data' => $reports
    ]);
}

// ==========================================
// GET Single Report
// ==========================================
function getSingleReport($conn, $reportId) {
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
        throw new Exception('Report not found');
    }
    
    $report = $result->fetch_assoc();
    
    echo json_encode([
        'success' => true,
        'data' => formatReportResponse($report)
    ]);
}

// ==========================================
// POST - Create Report
// ==========================================
function handleCreateReport($conn, $data) {
    // Validate required fields
    $required = ['title', 'type', 'severity', 'department', 'description', 'location', 'incidentDate'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            throw new Exception("Missing required field: $field");
        }
    }
    
    // Generate unique report ID
    $reportId = 'REP-' . time();
    
    // Get current user from session
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('User not authenticated');
    }
    
    $userId = $_SESSION['user_id'];
    $userName = $_SESSION['name'];
    
    // Auto-flagging logic
    $autoFlagged = 0;
    $flagReason = null;
    
    // Check for flagged keywords
    $flagKeywords = ['harassment', 'discrimination', 'unsafe', 'threat', 'assault', 'abuse', 'violent'];
    $description = strtolower($data['description']);
    $type = strtolower($data['type']);
    
    foreach ($flagKeywords as $keyword) {
        if (strpos($description, $keyword) !== false || strpos($type, $keyword) !== false) {
            $autoFlagged = 1;
            $flagReason = "Contains flagged keyword: $keyword";
            break;
        }
    }
    
    // Auto-flag critical severity
    if ($data['severity'] === 'Critical') {
        $autoFlagged = 1;
        $flagReason = $flagReason ? $flagReason . ' | Critical severity' : 'Critical severity level';
    }
    
    // Check for multiple reports from same department in 7 days
    $sevenDaysAgo = date('Y-m-d H:i:s', strtotime('-7 days'));
    $checkSql = "SELECT COUNT(*) as count FROM reports 
                 WHERE department = ? AND created_at >= ?";
    $stmt = $conn->prepare($checkSql);
    $stmt->bind_param("ss", $data['department'], $sevenDaysAgo);
    $stmt->execute();
    $countResult = $stmt->get_result()->fetch_assoc();
    
    if ($countResult['count'] >= 3) {
        $autoFlagged = 1;
        $flagReason = $flagReason ? $flagReason . ' | Multiple reports from department' : 
                      'Multiple similar reports from this department in past 7 days';
    }
    
    // Prepare insert statement
    $sql = "INSERT INTO reports (
                report_id, title, description, severity, status, department, 
                location, reporter_id, reporter_name, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'New', ?, ?, ?, ?, NOW(), NOW())";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param(
        "ssssssss",
        $reportId,
        $data['title'],
        $data['description'],
        $data['severity'],
        $data['department'],
        $data['location'],
        $userId,
        $userName
    );
    
    if (!$stmt->execute()) {
        throw new Exception('Failed to create report: ' . $stmt->error);
    }
    
    // Log activity
    logActivity($conn, $userId, 'Report Submitted', 
        "New {$data['type']} report submitted - Department: {$data['department']}", $userName);
    
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
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $stmt->bind_param("isss", $userId, $type, $description, $ipAddress);
    $stmt->execute();
}
?>