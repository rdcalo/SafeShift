<?php
require_once __DIR__ . '/config.php';

try {
    $conn = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
    case 'GET':
        handleGetActivityLogs($conn);
        break;
    
    case 'POST':
        handleCreateActivityLog($conn);
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
// GET - Fetch Activity Logs
// ==========================================
function handleGetActivityLogs($conn) {
    // Build query with joins
    $sql = "SELECT 
                a.*,
                u.full_name as user_name,
                u.role as user_role
            FROM activity_log a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE 1=1";
    
    $params = [];
    $types = "";
    
    // Filter by user ID
    if (isset($_GET['userId'])) {
        $sql .= " AND a.user_id = ?";
        $params[] = $_GET['userId'];
        $types .= "i";
    }
    
    // Filter by action type
    if (isset($_GET['action'])) {
        $sql .= " AND a.action = ?";
        $params[] = $_GET['action'];
        $types .= "s";
    }
    
    // Filter by date range
    if (isset($_GET['startDate'])) {
        $sql .= " AND a.created_at >= ?";
        $params[] = $_GET['startDate'];
        $types .= "s";
    }
    
    if (isset($_GET['endDate'])) {
        $sql .= " AND a.created_at <= ?";
        $params[] = $_GET['endDate'];
        $types .= "s";
    }
    
    // Search by description
    if (isset($_GET['search']) && !empty($_GET['search'])) {
        $sql .= " AND (a.description LIKE ? OR a.action LIKE ?)";
        $searchTerm = '%' . $_GET['search'] . '%';
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $types .= "ss";
    }
    
    // Limit results
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    
    $sql .= " ORDER BY a.created_at DESC LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;
    $types .= "ii";
    
    // Prepare and execute
    $stmt = $conn->prepare($sql);
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $logs = [];
    while ($row = $result->fetch_assoc()) {
        $logs[] = formatActivityLogResponse($row);
    }
    
    // Get total count
    $countSql = "SELECT COUNT(*) as total FROM activity_log WHERE 1=1";
    $countResult = $conn->query($countSql);
    $totalCount = $countResult->fetch_assoc()['total'];
    
    echo json_encode([
        'success' => true,
        'data' => $logs,
        'total' => $totalCount,
        'limit' => $limit,
        'offset' => $offset
    ]);
}

// ==========================================
// Helper Functions
// ==========================================
function formatActivityLogResponse($row) {
    // Determine if action is from anonymous user
    $isAnonymous = $row['user_name'] === null || strpos(strtolower($row['description']), 'anonymous') !== false;
    
    return [
        'id' => $row['id'],
        'userId' => $row['user_id'],
        'userName' => $isAnonymous ? 'Anonymous' : ($row['user_name'] ?? 'System'),
        'userRole' => $row['user_role'] ?? 'employee',
        'action' => $row['action'],
        'type' => determineActionType($row['action']),
        'description' => $row['description'],
        'ipAddress' => $row['ip_address'] ?? '0.0.0.0',
        'timestamp' => $row['created_at'],
        'performedBy' => $isAnonymous ? 'anonymous' : ($row['user_id'] ? 'user_' . $row['user_id'] : 'system'),
        'performedByName' => $isAnonymous ? 'Anonymous' : ($row['user_name'] ?? 'System')
    ];
}

function determineActionType($action) {
    $typeMap = [
        'LOGIN' => 'Log In',
        'LOGOUT' => 'Log Out',
        'Report Submitted' => 'Report Submitted',
        'Status Changed' => 'Status Changed',
        'Account Created' => 'Account Created',
        'Account Deleted' => 'Account Deleted',
        'Employee Updated' => 'Role Updated',
        'Profile Updated' => 'Profile Updated',
        'Password Changed' => 'Password Changed'
    ];
    
    return $typeMap[$action] ?? $action;
}

function handleCreateActivityLog($conn) {
    // Get JSON input
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (!$data) {
        throw new Exception('Invalid JSON data');
    }
    
    // Required fields
    $required = ['userId', 'action', 'description'];
    foreach ($required as $field) {
        if (!isset($data[$field])) {
            throw new Exception("Missing required field: $field");
        }
    }
    
    // Insert activity log
    $sql = "INSERT INTO activity_log (user_id, action, description, ip_address, created_at) 
            VALUES (?, ?, ?, ?, NOW())";
    
    $stmt = $conn->prepare($sql);
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    
    $stmt->bind_param(
        "isss",
        $data['userId'],
        $data['action'],
        $data['description'],
        $ipAddress
    );
    
    if (!$stmt->execute()) {
        throw new Exception('Failed to create activity log: ' . $stmt->error);
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Activity logged successfully',
        'id' => $conn->insert_id
    ]);
}
?>