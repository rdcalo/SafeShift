# SafeShift - Safety Reporting System

A comprehensive workplace safety reporting and management system built with PHP and MySQL.

---

## 📋 Prerequisites

Before you begin, ensure you have:
- **XAMPP** (PHP 7.4 or higher, MySQL/MariaDB)
- A modern web browser (Chrome, Firefox, Edge)
- Basic knowledge of running XAMPP

---

## 🚀 Installation Guide

### Step 1: Install XAMPP

1. Download XAMPP from: https://www.apachefriends.org/
2. Install XAMPP (default location: `C:\xampp`)
3. Run XAMPP Control Panel as Administrator

### Step 2: Start Required Services

1. Open **XAMPP Control Panel**
2. Click **Start** next to **Apache**
3. Click **Start** next to **MySQL**
4. Both should show **green** status

### Step 3: Copy Project Files

1. Locate your XAMPP `htdocs` folder:
   - Default location: `C:\xampp\htdocs\`
2. Copy the entire `safeshift` folder into `htdocs`:
   ```
   C:\xampp\htdocs\safeshift\
   ```

### Step 4: Create the Database

1. Open your web browser
2. Go to: `http://localhost/phpmyadmin`
3. Click **"SQL"** tab at the top
4. Copy and paste the SQL code from `database_setup.sql` (see below)
5. Click **"Go"** to execute

### Step 5: Database Setup SQL

Create a file named `database_setup.sql` in your project root or copy this code:

```sql
-- Create database
CREATE DATABASE IF NOT EXISTS safeshift;
USE safeshift;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('employee', 'admin') NOT NULL DEFAULT 'employee',
    department VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert demo users
INSERT INTO users (full_name, email, password, role, department) VALUES
('Demo Employee', 'employee@safeshift.com', 'emp123', 'employee', 'Operations'),
('Admin User', 'admin@safeshift.com', 'admin123', 'admin', 'Management');

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    severity ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL,
    status ENUM('New', 'Under Review', 'Resolved', 'Escalated') DEFAULT 'New',
    department VARCHAR(50) NOT NULL,
    location VARCHAR(100),
    reporter_id INT NOT NULL,
    reporter_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id)
);

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    department VARCHAR(50) NOT NULL,
    position VARCHAR(100),
    phone VARCHAR(20),
    hire_date DATE,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    manager VARCHAR(100),
    employee_count INT DEFAULT 0,
    active_reports INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert demo departments
INSERT INTO departments (name, manager, employee_count, active_reports) VALUES
('Operations', 'John Smith', 45, 3),
('Manufacturing', 'Sarah Johnson', 120, 7),
('Warehouse', 'Mike Davis', 35, 2),
('Quality Control', 'Emily Brown', 28, 1),
('Maintenance', 'Robert Wilson', 15, 4);

-- Activity Log table
CREATE TABLE IF NOT EXISTS activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Department Statistics table
CREATE TABLE IF NOT EXISTS department_statistics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    total_reports INT DEFAULT 0,
    resolved_reports INT DEFAULT 0,
    pending_reports INT DEFAULT 0,
    average_resolution_time INT DEFAULT 0,
    month VARCHAR(7) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

-- Notification Preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    push_notifications BOOLEAN DEFAULT TRUE,
    report_status_updates BOOLEAN DEFAULT TRUE,
    weekly_summary BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_name VARCHAR(200) NOT NULL,
    description TEXT,
    assigned_to INT,
    assigned_by INT,
    related_report_id INT,
    status ENUM('Pending', 'In Progress', 'Completed', 'Cancelled') DEFAULT 'Pending',
    priority ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
    due_date DATE,
    completed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (related_report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- Report Attachments table
CREATE TABLE IF NOT EXISTS report_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- Report Notes table
CREATE TABLE IF NOT EXISTS report_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    user_id INT NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert sample activity log
INSERT INTO activity_log (user_id, action, description, ip_address) VALUES
(1, 'LOGIN', 'User logged in successfully', '127.0.0.1'),
(2, 'LOGIN', 'Admin logged in successfully', '127.0.0.1');

-- Insert sample notification preferences
INSERT INTO notification_preferences (user_id, email_notifications, sms_notifications, push_notifications) VALUES
(1, TRUE, FALSE, TRUE),
(2, TRUE, TRUE, TRUE);
```

### Step 6: Verify Database Configuration

1. Open `backend/api/config.php`
2. Verify these settings:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_USER', 'root');
   define('DB_PASS', ''); // Empty for default XAMPP
   define('DB_NAME', 'safeshift');
   ```

### Step 7: Access the Application

1. Open your web browser
2. Go to: `http://localhost/safeshift/frontend/src/login.html`
3. You should see the SafeShift login page

---

## 🔑 Demo Login Credentials

### Employee Account
- **Email:** `employee@safeshift.com`
- **Password:** `emp123`
- **Role:** Employee

### Admin Account
- **Email:** `admin@safeshift.com`
- **Password:** `admin123`
- **Role:** Admin

---

## 📁 Project Structure

```
safeshift/
├── backend/
│   └── api/
│       ├── config.php          # Database configuration
│       ├── auth.php            # Authentication API
│       ├── reports.php         # Reports management
│       ├── employees.php       # Employee management
│       └── departments.php     # Department management
│
└── frontend/
    └── src/
        ├── login.html          # Login page
        ├── dashboard.html      # Employee dashboard
        ├── admin_dashboard.html # Admin dashboard
        ├── app.js              # Core application logic
        └── login.js            # Login page logic
```

---

## 🔧 Troubleshooting

### Apache Won't Start
- **Problem:** Port 80 is already in use
- **Solution:** 
  1. Close Skype or other programs using port 80
  2. Or change Apache port in XAMPP config

### MySQL Won't Start
- **Problem:** Port 3306 is already in use
- **Solution:**
  1. Close other MySQL instances
  2. Or change MySQL port in XAMPP config

### "Database connection failed"
- **Problem:** MySQL is not running or wrong credentials
- **Solution:**
  1. Make sure MySQL is started in XAMPP (green status)
  2. Verify database name is `safeshift`
  3. Check `config.php` settings

### "Unexpected token" or JSON errors
- **Problem:** PHP errors outputting HTML instead of JSON
- **Solution:**
  1. Check PHP error log: `C:\xampp\apache\logs\error.log`
  2. Make sure database exists
  3. Verify all files are in correct locations

### 404 Not Found
- **Problem:** Files not in correct location
- **Solution:**
  1. Verify project is in `C:\xampp\htdocs\safeshift\`
  2. Check file paths in URLs
  3. Make sure Apache is running

### Blank Page or White Screen
- **Problem:** PHP syntax error or missing files
- **Solution:**
  1. Check browser console (F12) for errors
  2. Check Apache error log
  3. Verify all files were copied correctly

---

## ✅ Testing the Installation

1. **Test Database Connection:**
   - Visit: `http://localhost/safeshift/backend/api/config.php`
   - Should show nothing (blank page is good!)

2. **Test Login API:**
   - Open browser console (F12)
   - Run this code:
   ```javascript
   fetch('http://localhost/safeshift/backend/api/auth.php', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ 
       email: 'employee@safeshift.com', 
       password: 'emp123',
       role: 'employee'
     })
   })
   .then(r => r.json())
   .then(console.log);
   ```
   - Should return: `{success: true, message: "Login successful", ...}`

3. **Test Login Page:**
   - Go to login page
   - Use demo credentials
   - Should redirect to dashboard

---

## 🚨 Important Notes

- **Security:** Demo passwords are plain text. In production, use password hashing!
- **XAMPP Default:** MySQL default user is `root` with no password
- **Localhost Only:** This setup only works on your local machine
- **Browser Cache:** If changes don't appear, clear browser cache (Ctrl+F5)

---

## 📞 Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Verify all installation steps were followed
3. Check XAMPP error logs
4. Check browser console for JavaScript errors

---

## 📝 License

This project is for educational purposes.

---

**Version:** 1.0  
**Last Updated:** November 2025