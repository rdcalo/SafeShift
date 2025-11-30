<?php
// Include the configuration - adjust path based on your structure
// If config.php is in backend/api/ folder (same as auth.php):
require_once __DIR__ . '/config.php';

// If config.php is in backend/ folder (one level up):
// require_once __DIR__ . '/../config.php';

// Wrap everything in try-catch for better error handling
try {
    // Get the database connection
    $conn = getDBConnection();

    // Get the raw POST data
    $rawData = file_get_contents("php://input");
    
    // Decode JSON input
    $data = json_decode($rawData, true);

    // Check if JSON decode failed
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON input: ' . json_last_error_msg());
    }

    // Initialize response array
    $response = ['success' => false, 'message' => 'An error occurred'];

    // Check what action to perform
    if (isset($data['email']) && isset($data['password'])) {
        
        $email = $conn->real_escape_string($data['email']);
        $role = isset($data['role']) ? $conn->real_escape_string($data['role']) : 'employee';
        $password = $data['password'];

        // Query the database for the user
        $sql = "SELECT id, full_name, email, password, role FROM users WHERE email = '$email' AND role = '$role' LIMIT 1";
        $result = $conn->query($sql);

        if (!$result) {
            throw new Exception('Database query failed: ' . $conn->error);
        }

        if ($result->num_rows > 0) {
            $user = $result->fetch_assoc();

            // Verify Password (supports both hashed and plain text for demo)
            if (password_verify($password, $user['password']) || $password === $user['password']) {
                
                // Login Success
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['role'] = $user['role'];
                $_SESSION['name'] = $user['full_name'];

                $response = [
                    'success' => true,
                    'message' => 'Login successful',
                    'user' => [
                        'id' => $user['id'],
                        'name' => $user['full_name'],
                        'email' => $user['email'],
                        'role' => $user['role']
                    ]
                ];
            } else {
                $response['message'] = 'Invalid password';
            }
        } else {
            $response['message'] = 'User not found or role mismatch';
        }

    } elseif (isset($data['action']) && $data['action'] === 'logout') {
        // Handle Logout
        session_destroy();
        $response = ['success' => true, 'message' => 'Logged out successfully'];

    } elseif (isset($data['action']) && $data['action'] === 'check_session') {
        // Handle Session Check (Auto-login)
        if (isset($_SESSION['user_id'])) {
            $response = [
                'success' => true,
                'user' => [
                    'id' => $_SESSION['user_id'],
                    'role' => $_SESSION['role'],
                    'name' => $_SESSION['name'] ?? 'User'
                ]
            ];
        } else {
            $response['message'] = 'Not logged in';
        }
    } else {
        $response['message'] = 'Invalid request data';
    }

    // Return the JSON response
    echo json_encode($response);

} catch (Exception $e) {
    // Catch any errors and return as JSON
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
}
?>