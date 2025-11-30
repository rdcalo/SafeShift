<?php
require_once __DIR__ . '/config.php';

// ==========================================
// ENABLE ERROR LOGGING FOR AUTH
// ==========================================
error_log("=== AUTH.PHP REQUEST START ===");
error_log("Method: " . $_SERVER['REQUEST_METHOD']);
error_log("Session ID: " . session_id());
error_log("Current Session Data: " . print_r($_SESSION, true));

try {
    // Get the database connection
    $conn = getDBConnection();

    // Get the raw POST data
    $rawData = file_get_contents("php://input");
    error_log("Raw input: " . $rawData);
    
    // Decode JSON input
    $data = json_decode($rawData, true);

    // Check if JSON decode failed
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("JSON decode error: " . json_last_error_msg());
        throw new Exception('Invalid JSON input: ' . json_last_error_msg());
    }

    error_log("Decoded data: " . print_r($data, true));

    // Initialize response array
    $response = ['success' => false, 'message' => 'An error occurred'];

    // ==========================================
    // HANDLE LOGIN
    // ==========================================
    if (isset($data['email']) && isset($data['password'])) {
        
        $email = $conn->real_escape_string($data['email']);
        $role = isset($data['role']) ? $conn->real_escape_string($data['role']) : 'employee';
        $password = $data['password'];

        error_log("Login attempt - Email: $email, Role: $role");

        // Query the database for the user (WITH DEPARTMENT)
        $sql = "SELECT id, full_name, email, password, role, department 
                FROM users 
                WHERE email = '$email' AND role = '$role' 
                LIMIT 1";
        
        $result = $conn->query($sql);

        if (!$result) {
            error_log("Database query failed: " . $conn->error);
            throw new Exception('Database query failed: ' . $conn->error);
        }

        if ($result->num_rows > 0) {
            $user = $result->fetch_assoc();
            
            error_log("User found: " . print_r($user, true));

            // Verify Password (supports both hashed and plain text for demo)
            if (password_verify($password, $user['password']) || $password === $user['password']) {
                
                // ==========================================
                // LOGIN SUCCESS - SET SESSION
                // ==========================================
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['role'] = $user['role'];
                $_SESSION['name'] = $user['full_name'];
                $_SESSION['email'] = $user['email'];
                $_SESSION['department'] = $user['department'] ?? 'Unassigned'; // IMPORTANT
                $_SESSION['login_time'] = time();
                $_SESSION['last_activity'] = time();
                
                // Generate session token for security
                $_SESSION['token'] = bin2hex(random_bytes(32));

                // Log successful login
                error_log("=== LOGIN SUCCESS ===");
                error_log("Session ID: " . session_id());
                error_log("User ID: " . $user['id']);
                error_log("User Name: " . $user['full_name']);
                error_log("Department: " . ($user['department'] ?? 'Unassigned'));
                error_log("Session contents: " . print_r($_SESSION, true));

                // Update last_active in database
                $updateSql = "UPDATE users SET last_active = NOW() WHERE id = ?";
                $updateStmt = $conn->prepare($updateSql);
                if ($updateStmt) {
                    $updateStmt->bind_param("i", $user['id']);
                    $updateStmt->execute();
                    error_log("Updated last_active for user");
                }

                // Log login activity
                $activitySql = "INSERT INTO activity_log (user_id, action, description, ip_address, created_at) 
                                VALUES (?, 'LOGIN', 'User logged in successfully', ?, NOW())";
                $activityStmt = $conn->prepare($activitySql);
                if ($activityStmt) {
                    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
                    $activityStmt->bind_param("is", $user['id'], $ipAddress);
                    $activityStmt->execute();
                    error_log("Login activity logged");
                }

                $response = [
                    'success' => true,
                    'message' => 'Login successful',
                    'user' => [
                        'id' => $user['id'],
                        'name' => $user['full_name'],
                        'email' => $user['email'],
                        'role' => $user['role'],
                        'department' => $user['department'] ?? 'Unassigned'
                    ],
                    'sessionId' => session_id() // For debugging
                ];

                error_log("Response: " . print_r($response, true));

            } else {
                error_log("Password verification failed");
                $response['message'] = 'Invalid password';
            }
        } else {
            error_log("User not found - Email: $email, Role: $role");
            $response['message'] = 'User not found or role mismatch';
        }

    // ==========================================
    // HANDLE LOGOUT
    // ==========================================
    } elseif (isset($data['action']) && $data['action'] === 'logout') {
        
        error_log("Logout request");
        
        // Log logout activity before destroying session
        if (isset($_SESSION['user_id'])) {
            $userId = $_SESSION['user_id'];
            $activitySql = "INSERT INTO activity_log (user_id, action, description, ip_address, created_at) 
                            VALUES (?, 'LOGOUT', 'User logged out', ?, NOW())";
            $activityStmt = $conn->prepare($activitySql);
            if ($activityStmt) {
                $ipAddress = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
                $activityStmt->bind_param("is", $userId, $ipAddress);
                $activityStmt->execute();
                error_log("Logout activity logged for user: $userId");
            }
        }

        // Destroy session
        session_unset();
        session_destroy();
        
        error_log("Session destroyed");
        
        $response = ['success' => true, 'message' => 'Logged out successfully'];

    // ==========================================
    // HANDLE SESSION CHECK
    // ==========================================
    } elseif (isset($data['action']) && $data['action'] === 'check_session') {
        
        error_log("Session check request");
        error_log("Session data: " . print_r($_SESSION, true));
        
        if (isset($_SESSION['user_id'])) {
            
            // Update last activity
            $_SESSION['last_activity'] = time();
            
            // Get fresh user data from database
            $userId = $_SESSION['user_id'];
            $userSql = "SELECT id, full_name, email, role, department FROM users WHERE id = ?";
            $userStmt = $conn->prepare($userSql);
            $userStmt->bind_param("i", $userId);
            $userStmt->execute();
            $userResult = $userStmt->get_result();
            
            if ($userResult->num_rows > 0) {
                $user = $userResult->fetch_assoc();
                
                // Update session with latest data
                $_SESSION['name'] = $user['full_name'];
                $_SESSION['department'] = $user['department'] ?? 'Unassigned';
                $_SESSION['email'] = $user['email'];
                
                error_log("Session valid for user: " . $user['id']);
                
                $response = [
                    'success' => true,
                    'user' => [
                        'id' => $user['id'],
                        'role' => $user['role'],
                        'name' => $user['full_name'],
                        'email' => $user['email'],
                        'department' => $user['department'] ?? 'Unassigned'
                    ]
                ];
            } else {
                error_log("User not found in database during session check");
                session_destroy();
                $response['message'] = 'Session invalid - user not found';
            }
        } else {
            error_log("No active session found");
            $response['message'] = 'Not logged in';
        }

    // ==========================================
    // INVALID REQUEST
    // ==========================================
    } else {
        error_log("Invalid request data: " . print_r($data, true));
        $response['message'] = 'Invalid request data';
    }

    // Return the JSON response
    echo json_encode($response);

} catch (Exception $e) {
    // Catch any errors and return as JSON
    error_log("=== ERROR IN AUTH.PHP ===");
    error_log("Error: " . $e->getMessage());
    error_log("File: " . $e->getFile());
    error_log("Line: " . $e->getLine());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
} finally {
    // Close connection if it exists
    if (isset($conn)) {
        $conn->close();
    }
    error_log("=== AUTH.PHP REQUEST END ===\n");
}
?>