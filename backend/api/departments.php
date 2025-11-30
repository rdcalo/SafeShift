<?php
require_once __DIR__ . '/config.php';

try {
    $conn = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            handleGetDepartments($conn);
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
// GET - Fetch Departments with Metrics
// ==========================================
function handleGetDepartments($conn) {
    // Check if requesting single department by ID
    if (isset($_GET['id'])) {
        getSingleDepartment($conn, $_GET['id']);
        return;
    }
    
    // Predefined departments (you can also pull from departments table)
    $departments = [
        'Engineering',
        'Marketing',
        'Sales',
        'Human Resources',
        'Operation',
        'Finance',
        'Customer Support'
    ];
    
    $result = [];
    
    foreach ($departments as $index => $deptName) {
        $metrics = calculateDepartmentMetrics($conn, $deptName);
        
        $result[] = [
            'id' => $index + 1,
            'name' => $deptName,
            'employeeCount' => $metrics['employeeCount'],
            'activeReports' => $metrics['activeReports'],
            'totalReports' => $metrics['totalReports'],
            'resolvedReports' => $metrics['resolvedReports'],
            'wellnessScore' => $metrics['wellnessScore'],
            'avgResolutionTime' => $metrics['avgResolutionTime'],
            'criticalReports' => $metrics['criticalReports'],
            'trendDirection' => $metrics['trendDirection']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $result
    ]);
}

// ==========================================
// GET Single Department
// ==========================================
function getSingleDepartment($conn, $deptId) {
    // Map department ID to name
    $departments = [
        1 => 'Engineering',
        2 => 'Marketing',
        3 => 'Sales',
        4 => 'Human Resources',
        5 => 'Operation',
        6 => 'Finance',
        7 => 'Customer Support'
    ];
    
    if (!isset($departments[$deptId])) {
        throw new Exception('Department not found');
    }
    
    $deptName = $departments[$deptId];
    $metrics = calculateDepartmentMetrics($conn, $deptName);
    
    $result = [
        'id' => $deptId,
        'name' => $deptName,
        'employeeCount' => $metrics['employeeCount'],
        'activeReports' => $metrics['activeReports'],
        'totalReports' => $metrics['totalReports'],
        'resolvedReports' => $metrics['resolvedReports'],
        'wellnessScore' => $metrics['wellnessScore'],
        'avgResolutionTime' => $metrics['avgResolutionTime'],
        'criticalReports' => $metrics['criticalReports'],
        'trendDirection' => $metrics['trendDirection']
    ];
    
    echo json_encode([
        'success' => true,
        'data' => $result
    ]);
}

// ==========================================
// Calculate Department Metrics
// ==========================================
function calculateDepartmentMetrics($conn, $deptName) {
    // 1. Employee Count
    $empSql = "SELECT COUNT(*) as count, AVG(wellness_score) as avg_wellness 
               FROM users 
               WHERE department = ? AND status = 'Active'";
    $stmt = $conn->prepare($empSql);
    $stmt->bind_param("s", $deptName);
    $stmt->execute();
    $empResult = $stmt->get_result()->fetch_assoc();
    
    $employeeCount = $empResult['count'];
    $avgWellness = $empResult['avg_wellness'] ?? 75;
    
    // 2. Report Counts
    $reportSql = "SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status != 'Resolved' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
                    SUM(CASE WHEN severity = 'Critical' THEN 1 ELSE 0 END) as critical
                  FROM reports 
                  WHERE department = ?";
    $stmt = $conn->prepare($reportSql);
    $stmt->bind_param("s", $deptName);
    $stmt->execute();
    $reportResult = $stmt->get_result()->fetch_assoc();
    
    $totalReports = $reportResult['total'];
    $activeReports = $reportResult['active'];
    $resolvedReports = $reportResult['resolved'];
    $criticalReports = $reportResult['critical'];
    
    // 3. Average Resolution Time (in hours)
    $resTimeSql = "SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as avg_time 
                   FROM reports 
                   WHERE department = ? AND status = 'Resolved'";
    $stmt = $conn->prepare($resTimeSql);
    $stmt->bind_param("s", $deptName);
    $stmt->execute();
    $resTimeResult = $stmt->get_result()->fetch_assoc();
    
    $avgResolutionTime = round($resTimeResult['avg_time'] ?? 24);
    
    // 4. Trend Direction (compare last 7 days vs previous 7 days)
    $sevenDaysAgo = date('Y-m-d H:i:s', strtotime('-7 days'));
    $fourteenDaysAgo = date('Y-m-d H:i:s', strtotime('-14 days'));
    
    $trendSql = "SELECT 
                    SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as recent,
                    SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) as previous
                 FROM reports 
                 WHERE department = ?";
    $stmt = $conn->prepare($trendSql);
    $stmt->bind_param("ssss", $sevenDaysAgo, $fourteenDaysAgo, $sevenDaysAgo, $deptName);
    $stmt->execute();
    $trendResult = $stmt->get_result()->fetch_assoc();
    
    $recentCount = $trendResult['recent'];
    $previousCount = $trendResult['previous'];
    
    $trendDirection = 'stable';
    if ($recentCount > $previousCount) {
        $trendDirection = 'increasing';
    } elseif ($recentCount < $previousCount) {
        $trendDirection = 'decreasing';
    }
    
    // Calculate Wellness Score (0-100)
    // Factors: low reports, high resolution rate, employee wellness
    $wellnessScore = round($avgWellness);
    
    // Adjust based on report volume (penalize high active reports)
    if ($employeeCount > 0) {
        $reportsPerEmployee = $activeReports / $employeeCount;
        if ($reportsPerEmployee > 0.5) {
            $wellnessScore -= 20;
        } elseif ($reportsPerEmployee > 0.3) {
            $wellnessScore -= 10;
        }
    }
    
    // Adjust based on critical reports
    if ($criticalReports > 0) {
        $wellnessScore -= ($criticalReports * 5);
    }
    
    // Ensure score is within bounds
    $wellnessScore = max(0, min(100, $wellnessScore));
    
    return [
        'employeeCount' => $employeeCount,
        'activeReports' => $activeReports,
        'totalReports' => $totalReports,
        'resolvedReports' => $resolvedReports,
        'wellnessScore' => $wellnessScore,
        'avgResolutionTime' => $avgResolutionTime,
        'criticalReports' => $criticalReports,
        'trendDirection' => $trendDirection
    ];
}
?>