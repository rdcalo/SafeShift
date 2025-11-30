<?php
require_once __DIR__ . '/config.php';

// ==========================================
// ENABLE ERROR LOGGING FOR REPORTS
// ==========================================
error_log("=== REPORTS.PHP REQUEST START ===");
error_log("Method: " . $_SERVER['REQUEST_METHOD']);
error_log("Time: " . date('Y-m-d H:i:s'));

try {
    $conn = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];
    
    $input = file_get_contents('php://input');
    error_log("Raw input: " . $input);
    
    $data = json_decode($input, true);
    error_log("Decoded data: " . print_r($data, true));
    
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
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
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
    
    if (isset($_GET['id'])) {
        getSingleReport($conn, $_GET['id']);
        return;
    }
    
    $sql = "SELECT 
                r.*,
                u.full_name as reporter_name
            FROM reports r
            LEFT JOIN users u ON r.reporter_id = u.id
            WHERE 1=1";
    
    $params = [];
    $types = "";
    
    if (isset($_GET['department']) && $_GET['department'] !== 'All') {
        $sql .= " AND r.department = ?";
        $params[] = $_GET['department'];
        $types .= "s";
    }
    
    if (isset($_GET['status'])) {
        $sql .= " AND r.status = ?";
        $params[] = $_GET['status'];
        $types .= "s";
    }
    
    if (isset($_GET['severity'])) {
        $sql .= " AND r.severity = ?";
        $params[] = $_GET['severity'];
        $types .= "s";
    }
    
    $sql .= " ORDER BY r.created_at DESC";
    
    error_log("SQL query: " . $sql);
    
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
// POST - Create Report (WITH AUTO-FLAGGING)
// ==========================================
function handleCreateReport($conn, $data) {
    error_log("=== CREATE REPORT FUNCTION START ===");
    
    // 1. CHECK AUTHENTICATION
    if (!isset($_SESSION['user_id'])) {
        error_log("ERROR: User not authenticated");
        throw new Exception('User not authenticated. Please log in again.');
    }
    
    $userId = $_SESSION['user_id'];
    $userName = $_SESSION['name'] ?? 'Unknown User';
    
    error_log("User authenticated: ID=$userId, Name=$userName");
    
    // 2. VALIDATE INPUT DATA
    if (!$data || !is_array($data)) {
        error_log("ERROR: Invalid data format");
        throw new Exception('Invalid data format');
    }
    
    // 3. CHECK REQUIRED FIELDS
    $required = ['title', 'type', 'severity', 'department', 'description', 'location', 'incidentDate'];
    $missing = [];
    
    foreach ($required as $field) {
        if (!isset($data[$field]) || trim($data[$field]) === '') {
            $missing[] = $field;
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
    $isAnonymous = isset($data['isAnonymous']) ? (int)$data['isAnonymous'] : 0;
    $hasAttachments = isset($data['hasAttachments']) ? (int)$data['hasAttachments'] : 0;
    $attachmentCount = isset($data['attachmentCount']) ? (int)$data['attachmentCount'] : 0;
    
    // 5. GENERATE REPORT ID
    $reportId = 'REP-' . time();
    error_log("Generated report ID: $reportId");
    
    // 6. PREPARE INSERT STATEMENT
    $sql = "INSERT INTO reports (
        report_id, title, description, severity, status, department, 
        location, reporter_id, reporter_name, is_anonymous,
        has_attachments, attachment_count, type,
        created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'New', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())";
    
    error_log("Preparing SQL insert...");
    
    $stmt = $conn->prepare($sql);
    
    if (!$stmt) {
        error_log("ERROR: Failed to prepare statement: " . $conn->error);
        throw new Exception('Database error: ' . $conn->error);
    }
    
    // 7. BIND PARAMETERS
    $stmt->bind_param(
         "ssssssisiiss",
        $reportId,
        $title,
        $description,
        $severity,
        $department,
        $location,
        $userId,
        $userName,
        $isAnonymous,
        $hasAttachments,
        $attachmentCount,
        $type
    );
    
    error_log("Parameters bound successfully");
    
    if (!$stmt->execute()) {
        error_log("ERROR: Failed to execute insert: " . $stmt->error);
        throw new Exception('Failed to create report: ' . $stmt->error);
    }

    // COMMIT THE REPORT IMMEDIATELY
    $conn->commit();

    error_log("SUCCESS: Report inserted");
    
    // ==========================================
    // 9. RUN AUTO-FLAGGING ALGORITHM
    // ==========================================
    $reportData = [
        'title' => $title,
        'description' => $description,
        'severity' => $severity,
        'department' => $department,
        'type' => $type,
        'hasAttachments' => $hasAttachments
    ];
    
    $flagResult = autoFlagReport($conn, $reportData, $reportId);
    
    error_log("Auto-flagging result: " . print_r($flagResult, true));
    
    // 10. LOG ACTIVITY
    // 10. LOG ACTIVITY - DISABLED FOR NOW
    // Activity logging skipped to avoid foreign key issues
    error_log("Activity logging skipped");
        
    // 11. RETURN SUCCESS WITH FLAG INFO
    error_log("=== CREATE REPORT SUCCESS ===");
    
    echo json_encode([
        'success' => true,
        'message' => 'Report created successfully',
        'reportId' => $reportId,
        'autoFlagged' => $flagResult['autoFlagged'],
        'flagReason' => $flagResult['flagReason'],
        'flagScore' => $flagResult['flagScore']
    ]);
}

// ==========================================
// AUTO-FLAGGING ALGORITHM
// ==========================================
function autoFlagReport($conn, $reportData, $reportId) {
    error_log("=== AUTO-FLAGGING ALGORITHM START ===");
    
    $autoFlagged = 0;
    $flagReasons = [];
    $flagScore = 0;
    
    // 1. KEYWORD DETECTION SYSTEM
    $flagKeywords = [
        'critical' => ['harassment', 'assault', 'threat', 'violence', 'fraud', 'discrimination'],
        'high' => ['unsafe', 'retaliation', 'abuse', 'hostile', 'danger', 'weapon'],
        'medium' => ['inappropriate', 'concern', 'uncomfortable', 'unfair', 'bullying']
    ];
    
    $descLower = strtolower($reportData['description']);
    $titleLower = strtolower($reportData['title']);
    $typeLower = strtolower($reportData['type']);
    
    // Check for critical keywords
    foreach ($flagKeywords['critical'] as $keyword) {
        if (strpos($descLower, $keyword) !== false || 
            strpos($titleLower, $keyword) !== false || 
            strpos($typeLower, $keyword) !== false) {
            $flagScore += 30;
            $flagReasons[] = "Critical keyword detected: '$keyword'";
            error_log("FLAG: Critical keyword '$keyword' detected");
            break;
        }
    }
    
    // Check for high keywords
    if ($flagScore < 30) {
        foreach ($flagKeywords['high'] as $keyword) {
            if (strpos($descLower, $keyword) !== false || 
                strpos($titleLower, $keyword) !== false) {
                $flagScore += 20;
                $flagReasons[] = "High-risk keyword detected: '$keyword'";
                error_log("FLAG: High-risk keyword '$keyword' detected");
                break;
            }
        }
    }
    
    // 2. SEVERITY AUTO-ESCALATION
    if ($reportData['severity'] === 'Critical') {
        $flagScore += 25;
        $flagReasons[] = "Critical severity level";
        error_log("FLAG: Critical severity");
        
        assignToSeniorAdmin($conn, $reportId);
    } elseif ($reportData['severity'] === 'High') {
        $flagScore += 15;
        $flagReasons[] = "High severity level";
        error_log("FLAG: High severity");
    }
    
    // 3. PATTERN DETECTION
    $sevenDaysAgo = date('Y-m-d H:i:s', strtotime('-7 days'));
    $checkSql = "SELECT COUNT(*) as count 
                 FROM reports 
                 WHERE department = ? 
                 AND created_at >= ? 
                 AND report_id != ?";
    $stmt = $conn->prepare($checkSql);
    $stmt->bind_param("sss", $reportData['department'], $sevenDaysAgo, $reportId);
    $stmt->execute();
    $patternResult = $stmt->get_result()->fetch_assoc();
    
    if ($patternResult['count'] >= 3) {
        $flagScore += 20;
        $flagReasons[] = "Multiple reports from {$reportData['department']} in past 7 days (Total: {$patternResult['count']})";
        error_log("FLAG: Multiple reports from department");
    }
    
    // 4. MISSING DOCUMENTATION
    $hasAttachments = isset($reportData['hasAttachments']) && $reportData['hasAttachments'];
    
    if (($reportData['severity'] === 'Critical' || $reportData['severity'] === 'High') && !$hasAttachments) {
        $flagScore += 15;
        $flagReasons[] = "High/Critical severity report without attachments";
        error_log("FLAG: No attachments for high severity");
    }
    
    // 5. VAGUE DESCRIPTION
    $descLength = strlen($reportData['description']);
    if ($descLength < 100 && ($reportData['severity'] === 'High' || $reportData['severity'] === 'Critical')) {
        $flagScore += 10;
        $flagReasons[] = "Vague description (under 100 characters) for high-severity report";
        error_log("FLAG: Vague description");
    }
    
    // FINAL DECISION
    if ($flagScore >= 30) {
        $autoFlagged = 1;
        error_log("RESULT: Report FLAGGED with score $flagScore");
    } else {
        error_log("RESULT: Report NOT flagged (score $flagScore)");
    }
    
    // UPDATE DATABASE
    if ($autoFlagged) {
        $flagReason = implode(' | ', $flagReasons);
        $updateSql = "UPDATE reports 
                    SET auto_flagged = 1, 
                        flag_reason = ?,
                        flag_score = ?
                    WHERE report_id = ?";
        $stmt = $conn->prepare($updateSql);
        $stmt->bind_param("sis", $flagReason, $flagScore, $reportId);
        $stmt->execute();
        
        error_log("Flag info saved to database");
        
        // Log flagging event - COMMENTED OUT
        // logActivity($conn, 0, 'Report Flagged', 
        //     "Report $reportId auto-flagged: $flagReason", 'System');
    }
    
    error_log("=== AUTO-FLAGGING ALGORITHM END ===");
    
    return [
        'autoFlagged' => (bool)$autoFlagged,
        'flagReason' => $autoFlagged ? implode(' | ', $flagReasons) : null,
        'flagScore' => $flagScore
    ];
}

// ==========================================
// ASSIGN TO SENIOR ADMIN
// ==========================================
function assignToSeniorAdmin($conn, $reportId) {
    $sql = "SELECT id, full_name, email FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1";
    $result = $conn->query($sql);
    
    if ($result->num_rows > 0) {
        $admin = $result->fetch_assoc();
        
        $updateSql = "UPDATE reports SET assigned_to = ?, assigned_to_name = ? WHERE report_id = ?";
        $stmt = $conn->prepare($updateSql);
        $stmt->bind_param("iss", $admin['id'], $admin['full_name'], $reportId);
        $stmt->execute();
        
        error_log("Report $reportId auto-assigned to admin: {$admin['full_name']}");
    }
}

// ==========================================
// PUT - Update Report
// ==========================================
function handleUpdateReport($conn, $data) {
    error_log("Updating report: " . ($data['id'] ?? 'unknown'));
    
    if (empty($data['id'])) {
        throw new Exception('Report ID is required');
    }
    
    $checkSql = "SELECT * FROM reports WHERE report_id = ?";
    $stmt = $conn->prepare($checkSql);
    $stmt->bind_param("s", $data['id']);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('Report not found');
    }
    
    $oldReport = $result->fetch_assoc();
    
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
    
    if (empty($updates)) {
        throw new Exception('No fields to update');
    }
    
    $updates[] = "updated_at = NOW()";
    $params[] = $data['id'];
    $types .= "s";
    
    $sql = "UPDATE reports SET " . implode(", ", $updates) . " WHERE report_id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    
    if (!$stmt->execute()) {
        throw new Exception('Failed to update report: ' . $stmt->error);
    }
    
    error_log("Report updated successfully");
    
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
// HELPER FUNCTIONS
// ==========================================
function formatReportResponse($row) {
    return [
        'id' => $row['report_id'],
        'title' => $row['title'],
        'type' => $row['type'] ?? 'General',
        'description' => $row['description'],
        'severity' => $row['severity'],
        'status' => $row['status'],
        'department' => $row['department'],
        'location' => $row['location'],
        'submittedBy' => $row['reporter_id'],
        'submittedByName' => $row['reporter_name'] ?? 'Anonymous',
        'submittedAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
        'isAnonymous' => isset($row['is_anonymous']) ? (bool)$row['is_anonymous'] : false,
        'autoFlagged' => isset($row['auto_flagged']) ? (bool)$row['auto_flagged'] : false,
        'flagReason' => $row['flag_reason'] ?? null,
        'flagScore' => $row['flag_score'] ?? 0,
        'hasAttachments' => isset($row['has_attachments']) ? (bool)$row['has_attachments'] : false
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