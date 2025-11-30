<?php
require_once __DIR__ . '/config.php';

try {
    $conn = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];
    
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    switch ($method) {
        case 'GET':
            handleGetEmployees($conn);
            break;
            
        case 'POST':
            handleCreateEmployee($conn, $data);
            break;
            
        case 'PUT':
            handleUpdateEmployee($conn, $data);
            break;
            
        case 'DELETE':
            handleDeleteEmployee($conn, $data);
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
// GET - Fetch Employees from 'users' table
// ==========================================
function handleGetEmployees($conn) {
    // Check if requesting single employee by ID
    if (isset($_GET['id'])) {
        getSingleEmployee($conn, $_GET['id']);
        return;
    }
    
    // Build query - Using 'users' table instead of 'employees'
    $sql = "SELECT 
                u.id,
                u.full_name as name,
                u.email,
                u.role,
                u.department,
                u.status,
                u.last_active,
                u.created_at,
                u.wellness_score,
                (SELECT COUNT(*) FROM reports WHERE reporter_id = u.id) as total_reports,
                (SELECT COUNT(*) FROM reports WHERE reporter_id = u.id AND status != 'Resolved') as active_reports
            FROM users u
            WHERE 1=1";
    
    $params = [];
    $types = "";
    
    // Filter by department
    if (isset($_GET['department']) && $_GET['department'] !== 'All') {
        $sql .= " AND u.department = ?";
        $params[] = $_GET['department'];
        $types .= "s";
    }
    
    // Filter by role
    if (isset($_GET['role'])) {
        $sql .= " AND u.role = ?";
        $params[] = $_GET['role'];
        $types .= "s";
    }
    
    // Filter by status
    if (isset($_GET['status'])) {
        $sql .= " AND u.status = ?";
        $params[] = $_GET['status'];
        $types .= "s";
    }
    
    $sql .= " ORDER BY u.created_at DESC";
    
    $stmt = $conn->prepare($sql);
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $employees = [];
    while ($row = $result->fetch_assoc()) {
        $employees[] = formatEmployeeResponse($row);
    }
    
    echo json_encode([
        'success' => true,
        'data' => $employees
    ]);
}

// ==========================================
// GET Single Employee
// ==========================================
function getSingleEmployee($conn, $empId) {
    $sql = "SELECT 
                u.id,
                u.full_name as name,
                u.email,
                u.role,
                u.department,
                u.status,
                u.last_active,
                u.created_at,
                u.wellness_score,
                (SELECT COUNT(*) FROM reports WHERE reporter_id = u.id) as total_reports,
                (SELECT COUNT(*) FROM reports WHERE reporter_id = u.id AND status != 'Resolved') as active_reports
            FROM users u
            WHERE u.id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $empId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('Employee not found');
    }
    
    $employee = $result->fetch_assoc();
    
    echo json_encode([
        'success' => true,
        'data' => formatEmployeeResponse($employee)
    ]);
}

// ==========================================
// POST - Create Employee
// ==========================================
function handleCreateEmployee($conn, $data) {
    // Check if user is admin
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        throw new Exception('Unauthorized: Admin access required');
    }
    
    // Validate required fields
    $required = ['name', 'email', 'department', 'role'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            throw new Exception("Missing required field: $field");
        }
    }
    
    // Validate email format
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Invalid email format');
    }
    
    // Check if email already exists
    $checkSql = "SELECT id FROM users WHERE email = ?";
    $stmt = $conn->prepare($checkSql);
    $stmt->bind_param("s", $data['email']);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        throw new Exception('Email already exists');
    }
    
    // Generate temporary password
    $tempPassword = generateTempPassword();
    $hashedPassword = password_hash($tempPassword, PASSWORD_DEFAULT);
    
    // Insert new employee into 'users' table
    $sql = "INSERT INTO users (
                full_name, email, password, role, department, 
                wellness_score, status, created_at
            ) VALUES (?, ?, ?, ?, ?, 75, 'Active', NOW())";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param(
        "sssss",
        $data['name'],
        $data['email'],
        $hashedPassword,
        $data['role'],
        $data['department']
    );
    
    if (!$stmt->execute()) {
        throw new Exception('Failed to create employee: ' . $stmt->error);
    }
    
    $newEmployeeId = $conn->insert_id;
    
    // Log activity
    logActivity($conn, $_SESSION['user_id'], 'Account Created', 
        "Created new employee account for {$data['name']} ({$data['department']})", 
        $_SESSION['name']);
    
    echo json_encode([
        'success' => true,
        'message' => 'Employee created successfully',
        'employee' => [
            'id' => $newEmployeeId,
            'name' => $data['name'],
            'email' => $data['email'],
            'employeeId' => 'EMP-' . str_pad($newEmployeeId, 6, '0', STR_PAD_LEFT),
            'department' => $data['department'],
            'role' => $data['role']
        ],
        'tempPassword' => $tempPassword
    ]);
}

// ==========================================
// PUT - Update Employee
// ==========================================
function handleUpdateEmployee($conn, $data) {
    // Check if user is admin
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        throw new Exception('Unauthorized: Admin access required');
    }
    
    if (empty($data['id'])) {
        throw new Exception('Employee ID is required');
    }
    
    // Check if employee exists
    $checkSql = "SELECT * FROM users WHERE id = ?";
    $stmt = $conn->prepare($checkSql);
    $stmt->bind_param("i", $data['id']);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('Employee not found');
    }
    
    // Build update query dynamically
    $updates = [];
    $params = [];
    $types = "";
    
    if (isset($data['name'])) {
        $updates[] = "full_name = ?";
        $params[] = $data['name'];
        $types .= "s";
    }
    
    if (isset($data['email'])) {
        // Check if new email is already taken
        $emailCheckSql = "SELECT id FROM users WHERE email = ? AND id != ?";
        $emailStmt = $conn->prepare($emailCheckSql);
        $emailStmt->bind_param("si", $data['email'], $data['id']);
        $emailStmt->execute();
        if ($emailStmt->get_result()->num_rows > 0) {
            throw new Exception('Email already exists');
        }
        
        $updates[] = "email = ?";
        $params[] = $data['email'];
        $types .= "s";
    }
    
    if (isset($data['department'])) {
        $updates[] = "department = ?";
        $params[] = $data['department'];
        $types .= "s";
    }
    
    if (isset($data['status'])) {
        $updates[] = "status = ?";
        $params[] = $data['status'];
        $types .= "s";
    }
    
    if (isset($data['wellnessScore'])) {
        $updates[] = "wellness_score = ?";
        $params[] = $data['wellnessScore'];
        $types .= "i";
    }
    
    if (empty($updates)) {
        throw new Exception('No fields to update');
    }
    
    // Add employee id parameter
    $params[] = $data['id'];
    $types .= "i";
    
    $sql = "UPDATE users SET " . implode(", ", $updates) . " WHERE id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    
    if (!$stmt->execute()) {
        throw new Exception('Failed to update employee: ' . $stmt->error);
    }
    
    // Log activity
    logActivity($conn, $_SESSION['user_id'], 'Employee Updated', 
        "Updated employee record for ID: {$data['id']}", $_SESSION['name']);
    
    echo json_encode([
        'success' => true,
        'message' => 'Employee updated successfully'
    ]);
}

// ==========================================
// DELETE - Delete Employee
// ==========================================
function handleDeleteEmployee($conn, $data) {
    // Check if user is admin
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        throw new Exception('Unauthorized: Admin access required');
    }
    
    if (empty($data['id'])) {
        throw new Exception('Employee ID is required');
    }
    
    // Prevent deleting yourself
    if ($data['id'] == $_SESSION['user_id']) {
        throw new Exception('Cannot delete your own account');
    }
    
    // Check if employee has reports
    $checkSql = "SELECT COUNT(*) as count FROM reports WHERE reporter_id = ?";
    $stmt = $conn->prepare($checkSql);
    $stmt->bind_param("i", $data['id']);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    
    if ($result['count'] > 0) {
        // Soft delete instead of hard delete
        $sql = "UPDATE users SET status = 'Inactive' WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $data['id']);
        
        if (!$stmt->execute()) {
            throw new Exception('Failed to deactivate employee: ' . $stmt->error);
        }
        
        $message = 'Employee deactivated (has existing reports)';
    } else {
        // Hard delete if no reports
        $sql = "DELETE FROM users WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $data['id']);
        
        if (!$stmt->execute()) {
            throw new Exception('Failed to delete employee: ' . $stmt->error);
        }
        
        if ($stmt->affected_rows === 0) {
            throw new Exception('Employee not found');
        }
        
        $message = 'Employee deleted successfully';
    }
    
    // Log activity
    logActivity($conn, $_SESSION['user_id'], 'Employee Deleted', 
        "Deleted/deactivated employee ID: {$data['id']}", $_SESSION['name']);
    
    echo json_encode([
        'success' => true,
        'message' => $message
    ]);
}

// ==========================================
// Helper Functions
// ==========================================
function formatEmployeeResponse($row) {
    return [
        'id' => $row['id'],
        'employeeId' => 'EMP-' . str_pad($row['id'], 6, '0', STR_PAD_LEFT),
        'name' => $row['name'],
        'email' => $row['email'],
        'role' => ucfirst($row['role']), // Capitalize first letter
        'department' => $row['department'] ?? 'Unassigned',
        'status' => $row['status'] ?? 'Active',
        'lastActive' => $row['last_active'] ?? $row['created_at'],
        'createdAt' => $row['created_at'],
        'totalReports' => $row['total_reports'] ?? 0,
        'activeReports' => $row['active_reports'] ?? 0,
        'wellnessScore' => $row['wellness_score'] ?? 75
    ];
}

function generateTempPassword() {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    $password = '';
    for ($i = 0; $i < 12; $i++) {
        $password .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $password;
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