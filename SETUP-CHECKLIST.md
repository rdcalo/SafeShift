# SafeShift - Quick Setup Checklist ✅

Print this and check off each step!

---

## 📦 Before You Start

- [ ] Download XAMPP from https://www.apachefriends.org/
- [ ] Unzip the SafeShift project folder
- [ ] Have the database SQL file ready

---

## ⚙️ Installation Steps

### 1. Install XAMPP
- [ ] Run XAMPP installer
- [ ] Install to default location (`C:\xampp`)
- [ ] Complete installation

### 2. Start Services
- [ ] Open XAMPP Control Panel
- [ ] Click **Start** on Apache (should turn green)
- [ ] Click **Start** on MySQL (should turn green)
- [ ] Both services running successfully

### 3. Copy Project Files
- [ ] Navigate to `C:\xampp\htdocs\`
- [ ] Copy entire `safeshift` folder here
- [ ] Verify path is: `C:\xampp\htdocs\safeshift\`

### 4. Create Database
- [ ] Open browser
- [ ] Go to: `http://localhost/phpmyadmin`
- [ ] Click **SQL** tab
- [ ] Copy all SQL from `database_setup.sql`
- [ ] Click **Go** button
- [ ] See "safeshift" database in left sidebar
- [ ] Verify tables were created (should see 16 tables)

### 5. Test the Application
- [ ] Go to: `http://localhost/safeshift/frontend/src/login.html`
- [ ] See the login page load
- [ ] Try Employee login: `employee@safeshift.com` / `emp123`
- [ ] Redirected to dashboard successfully
- [ ] Logout (if there's a logout button)
- [ ] Try Admin login: `admin@safeshift.com` / `admin123`
- [ ] Redirected to admin dashboard successfully

---

## 🎯 Success Indicators

✅ **XAMPP Control Panel:** Apache and MySQL both show green  
✅ **phpMyAdmin:** Can see "safeshift" database with 16 tables  
✅ **Login Page:** Loads without errors  
✅ **Browser Console:** No red error messages (press F12)  
✅ **Login Works:** Successfully logs in and redirects  

---

## ❌ Common Issues

| Problem | Solution |
|---------|----------|
| Apache won't start | Close Skype or change port |
| MySQL won't start | Check for other MySQL services |
| Can't open phpMyAdmin | Make sure MySQL is running |
| Login page not found | Check file path in htdocs |
| JSON errors | Check database exists |
| Blank page | Check browser console (F12) |

---

## 📝 Login Credentials

**Employee:**
- Email: `employee@safeshift.com`
- Password: `emp123`

**Admin:**
- Email: `admin@safeshift.com`
- Password: `admin123`

---

## 🔗 Important URLs

- Login Page: `http://localhost/safeshift/frontend/src/login.html`
- phpMyAdmin: `http://localhost/phpmyadmin`
- XAMPP Dashboard: `http://localhost/dashboard`

---

**Setup Complete!** 🎉

If you checked all boxes above, SafeShift is ready to use!