<?php
function handleReports($conn, $method, $action, $data) {
    switch ($method) {
        case 'GET':
            if (isset($_GET['id'])) {
                getReportById($conn, $_GET['id']);
            } else {
                getAllReports($conn);
            }
            break;
        
        case 'POST':
            createReport($conn, $data);
            break;
        
        case 'PUT':
            updateReport($conn, $data);
            break;
        
        default:
            echo json_encode(['success' => false, 'message' => 'Invalid method']);
            break;
    }
}

function getAllReports($conn) {
    $sql = "SELECT r.*, e.name as reporter_name, e.department 
            FROM reports r
            LEFT JOIN employees e ON r.submitted_by = e.employee_id
            ORDER BY r.submitted_at DESC";
    
    $result = $conn->query($sql);
    $reports = [];
    
    if ($result && $result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $reports[] = [
                'id' => $row['report_id'],
                'title' => $row['title'],
                'type' => $row['report_type'],
                'department' => $row['department'],
                'severity' => $row['severity'],
                'status' => $row['status'],
                'description' => $row['description'],
                'location' => $row['location'],
                'incident_date' => $row['incident_date'],
                'isAnonymous' => (bool)$row['is_anonymous'],
                'submittedBy' => $row['submitted_by'],
                'submittedAt' => $row['submitted_at'],
                'autoFlagged' => (bool)$row['auto_flagged'],
                'flagReason' => $row['flag_reason']
            ];
        }
    }
    
    echo json_encode(['success' => true, 'data' => $reports]);
}

function getReportById($conn, $id) {
    $id = $conn->real_escape_string($id);
    $sql = "SELECT r.*, e.name as reporter_name, e.department 
            FROM reports r
            LEFT JOIN employees e ON r.submitted_by = e.employee_id
            WHERE r.report_id = '$id'";
    
    $result = $conn->query($sql);
    
    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $report = [
            'id' => $row['report_id'],
            'title' => $row['title'],
            'type' => $row['report_type'],
            'department' => $row['department'],
            'severity' => $row['severity'],
            'status' => $row['status'],
            'description' => $row['description'],
            'location' => $row['location'],
            'incident_date' => $row['incident_date'],
            'isAnonymous' => (bool)$row['is_anonymous'],
            'submittedBy' => $row['submitted_by'],
            'submittedAt' => $row['submitted_at'],
            'autoFlagged' => (bool)$row['auto_flagged'],
            'flagReason' => $row['flag_reason']
        ];
        echo json_encode(['success' => true, 'data' => $report]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Report not found']);
    }
}

function createReport($conn, $data) {
    // Generate report ID
    $reportId = 'REP-' . time();
    
    $title = $conn->real_escape_string($data['title']);
    $type = $conn->real_escape_string($data['type']);
    $department = $conn->real_escape_string($data['department']);
    $severity = $conn->real_escape_string($data['severity']);
    $description = $conn->real_escape_string($data['description']);
    $location = $conn->real_escape_string($data['location']);
    $incidentDate = $conn->real_escape_string($data['incidentDate']);
    $isAnonymous = isset($data['isAnonymous']) && $data['isAnonymous'] ? 1 : 0;
    $submittedBy = $conn->real_escape_string($data['submittedBy']);
    
    // Auto-flag logic
    $flagKeywords = ['harassment', 'discrimination', 'unsafe', 'threat', 'assault'];
    $autoFlagged = 0;
    $flagReason = null;
    
    foreach ($flagKeywords as $keyword) {
        if (stripos($description, $keyword) !== false || stripos($type, $keyword) !== false) {
            $autoFlagged = 1;
            $flagReason = 'Contains flagged keyword: ' . $keyword;
            break;
        }
    }
    
    if ($severity === 'Critical') {
        $autoFlagged = 1;
        $flagReason = 'Critical severity level';
    }
    
    $sql = "INSERT INTO reports (report_id, title, report_type, department, severity, description, 
            location, incident_date, is_anonymous, submitted_by, auto_flagged, flag_reason)
            VALUES ('$reportId', '$title', '$type', '$department', '$severity', '$description',
            '$location', '$incidentDate', $isAnonymous, '$submittedBy', $autoFlagged, " . 
            ($flagReason ? "'$flagReason'" : "NULL") . ")";
    
    if ($conn->query($sql)) {
        // Log activity
        if (isset($_SESSION['user_id'])) {
            logActivity($conn, $_SESSION['user_id'], 'Report Submitted', 
                "New $type report submitted - Department: $department");
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Report created successfully',
            'reportId' => $reportId
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to create report: ' . $conn->error]);
    }
}

function updateReport($conn, $data) {
    $reportId = $conn->real_escape_string($data['id']);
    $status = $conn->real_escape_string($data['status']);
    
    $sql = "UPDATE reports SET status = '$status', updated_at = CURRENT_TIMESTAMP 
            WHERE report_id = '$reportId'";
    
    if ($conn->query($sql)) {
        // Log activity
        if (isset($_SESSION['user_id'])) {
            logActivity($conn, $_SESSION['user_id'], 'Status Changed', 
                "Changed report $reportId status to $status");
        }
        
        echo json_encode(['success' => true, 'message' => 'Report updated successfully']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update report']);
    }
}

function logActivity($conn, $userId, $type, $action) {
    $type = $conn->real_escape_string($type);
    $action = $conn->real_escape_string($action);
    
    $sql = "INSERT INTO activity_logs (user_id, action_type, action_description) 
            VALUES ($userId, '$type', '$action')";
    $conn->query($sql);
}
?>