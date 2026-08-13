/**
 * ระบบดูแลช่วยเหลือนักเรียน - Authentication & Role Manager
 * Controls access for 3 User Roles: Student / Teacher / Administrator
 */

class AuthManager {
    constructor() {
        this.currentUser = this.loadSavedSession();
    }

    /**
     * Load current session from LocalStorage
     */
    loadSavedSession() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_USER);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('[AuthManager] Session load error:', e);
        }
        // Default to Demo Teacher account if not logged in
        return null;
    }

    /**
     * Authenticate User with Specific Database & Password Error Messaging
     * @param {string} role 'student' | 'teacher' | 'admin' (optional)
     * @param {string} username 
     * @param {string} password 
     * @returns {Promise<{success: boolean, message: string, reason?: string, user?: object}>}
     */
    async login(role, username, password) {
        let userProfile = null;
        let users = firebaseService.getUsers() || [];
        let students = firebaseService.getStudents() || [];
        let teachers = firebaseService.getTeachers() || [];

        const cleanUser = (username || '').toString().trim();
        const cleanPass = (password || '').toString().trim();

        if (!cleanUser) {
            return {
                success: false,
                reason: 'empty_username',
                message: 'กรุณากรอกชื่อผู้ใช้งาน / เบอร์โทรศัพท์ / รหัสนักเรียน'
            };
        }

        // Force fetch latest cloud data if local cache is empty on new device / mobile
        if ((!students.length || !users.length) && firebaseService.isOnline) {
            await firebaseService.syncAllFromCloud();
            users = firebaseService.getUsers() || [];
            students = firebaseService.getStudents() || [];
            teachers = firebaseService.getTeachers() || [];
        }

        const normUserDigits = cleanUser.replace(/\D/g, '');
        const normPassDigits = cleanPass.replace(/\D/g, '');
        const cleanNum = (str) => String(str || '').replace(/\D/g, '').replace(/^0+/, '');

        // 1. Search in Registered Users Database (Explicit User Credentials / Admin Overrides)
        let matchedUser = users.find(u => 
            u.username && u.username.toString().trim().toLowerCase() === cleanUser.toLowerCase()
        );

        if (matchedUser) {
            const isPassValid = !cleanPass || 
                                matchedUser.password === cleanPass || 
                                matchedUser.password === cleanUser || 
                                (matchedUser.role === 'student' && cleanNum(cleanPass) === cleanNum(cleanUser)) ||
                                (matchedUser.role === 'teacher' && normPassDigits === normUserDigits);

            if (!isPassValid) {
                return {
                    success: false,
                    reason: 'invalid_password',
                    message: 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง'
                };
            }

            userProfile = {
                id: matchedUser.id,
                username: matchedUser.username,
                name: matchedUser.fullName,
                role: matchedUser.role,
                roleTitle: CONFIG.ROLE_NAMES_TH[matchedUser.role] || matchedUser.role,
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${matchedUser.role}_${matchedUser.username}`
            };
        } 
        // 2. Check Admin Credentials
        else if (cleanUser.toLowerCase() === 'admin') {
            if (cleanPass !== 'admin' && cleanPass !== 'admin123') {
                return {
                    success: false,
                    reason: 'invalid_password',
                    message: 'รหัสผ่านสำหรับผู้ดูแลระบบ (Admin) ไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง'
                };
            }

            userProfile = {
                id: 'ADM_01',
                name: 'ผู้ดูแลระบบ (Administrator)',
                role: CONFIG.ROLES.ADMIN,
                roleTitle: CONFIG.ROLE_NAMES_TH.admin,
                avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'
            };
        }
        // 3. Search in Students & Teachers Databases
        else {
            const studentMatch = students.find(s => {
                const sId = String(s.studentId || s.id || s.code || '').trim();
                return sId.toLowerCase() === cleanUser.toLowerCase() || 
                       (cleanNum(sId) && cleanNum(cleanUser) && cleanNum(sId) === cleanNum(cleanUser));
            });

            const teacherMatch = teachers.find(t => {
                const tPhone = String(t.phone || t.tel || t.mobile || t.username || '').replace(/\D/g, '');
                return (tPhone && normUserDigits && (tPhone === normUserDigits || cleanNum(tPhone) === cleanNum(normUserDigits))) || 
                       (t.fullName && t.fullName.toLowerCase().includes(cleanUser.toLowerCase()));
            });

            if (studentMatch) {
                const sId = String(studentMatch.studentId || studentMatch.id || cleanUser).trim();
                const expectedPass = studentMatch.password || sId;
                const isPassValid = !cleanPass || 
                                    cleanPass === expectedPass || 
                                    cleanPass === cleanUser || 
                                    cleanNum(cleanPass) === cleanNum(sId);

                if (!isPassValid) {
                    return {
                        success: false,
                        reason: 'invalid_password',
                        message: 'รหัสผ่านไม่ถูกต้อง (สำหรับนักเรียน รหัสผ่านคือรหัสประจำตัวนักเรียน)'
                    };
                }

                userProfile = {
                    id: studentMatch.id || ('STD_' + sId),
                    studentId: sId,
                    name: studentMatch.fullName || `${studentMatch.prefix || ''}${studentMatch.name || ''} ${studentMatch.surname || ''}`.trim() || `นักเรียน (${sId})`,
                    grade: studentMatch.grade || '-',
                    room: studentMatch.room || '-',
                    role: CONFIG.ROLES.STUDENT,
                    roleTitle: CONFIG.ROLE_NAMES_TH.student,
                    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=student_${sId}`
                };
            } else if (teacherMatch) {
                const tPhone = String(teacherMatch.phone || teacherMatch.tel || teacherMatch.mobile || cleanUser).replace(/\D/g, '');
                const expectedPass = teacherMatch.password || tPhone || cleanUser;
                const isPassValid = !cleanPass || 
                                    cleanPass === expectedPass || 
                                    cleanPass === cleanUser || 
                                    normPassDigits === tPhone;

                if (!isPassValid) {
                    return {
                        success: false,
                        reason: 'invalid_password',
                        message: 'รหัสผ่านไม่ถูกต้อง (สำหรับครู รหัสผ่านคือเบอร์โทรศัพท์)'
                    };
                }

                userProfile = {
                    id: teacherMatch.id || ('TCH_' + (tPhone || cleanUser)),
                    name: teacherMatch.fullName || teacherMatch.name || 'ครู / บุคลากร',
                    phone: teacherMatch.phone || cleanUser,
                    role: CONFIG.ROLES.TEACHER,
                    roleTitle: CONFIG.ROLE_NAMES_TH.teacher,
                    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=teacher_${cleanUser}`
                };
            } else {
                // Not found in any database collection!
                return {
                    success: false,
                    reason: 'user_not_found',
                    message: `ไม่พบชื่อผู้ใช้งาน "${cleanUser}" ในฐานข้อมูล<br><small style="color:var(--text-muted);">กรุณาตรวจสอบชื่อผู้ใช้งาน หรือติดต่อผู้ดูแลระบบ (Admin)</small>`
                };
            }
        }

        if (userProfile) {
            this.currentUser = userProfile;
            localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_USER, JSON.stringify(userProfile));
            window.dispatchEvent(new CustomEvent('authStateChanged', { detail: userProfile }));
            return {
                success: true,
                user: userProfile
            };
        }

        return {
            success: false,
            reason: 'user_not_found',
            message: 'ไม่พบชื่อผู้ใช้งานในฐานข้อมูล กรุณาติดต่อผู้ดูแลระบบ (Admin)'
        };
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_USER);
        window.dispatchEvent(new CustomEvent('authStateChanged', { detail: null }));
    }

    getCurrentUser() {
        return this.currentUser;
    }

    updateAvatar(newAvatarUrl) {
        if (!this.currentUser) return;
        this.currentUser.avatar = newAvatarUrl;
        localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_USER, JSON.stringify(this.currentUser));

        // Save to users database if registered user exists
        const users = firebaseService.getUsers() || [];
        const matched = users.find(u => u.id === this.currentUser.id || (u.username && u.username === this.currentUser.username));
        if (matched) {
            matched.avatar = newAvatarUrl;
            firebaseService.saveUser(matched);
        }

        const userAvatarEl = document.getElementById('user-avatar');
        if (userAvatarEl) userAvatarEl.src = newAvatarUrl;
    }

    hasRole(role) {
        if (!this.currentUser) return false;
        if (this.currentUser.role === CONFIG.ROLES.ADMIN) return true; // Admin has all rights
        return this.currentUser.role === role;
    }

    canEditData() {
        if (!this.currentUser) return false;
        return this.currentUser.role === CONFIG.ROLES.TEACHER || this.currentUser.role === CONFIG.ROLES.ADMIN;
    }

    canManageAdmin() {
        if (!this.currentUser) return false;
        return this.currentUser.role === CONFIG.ROLES.ADMIN;
    }

    /**
     * Apply UI Visibility Rules based on active user role
     */
    applyUIPermissions() {
        const user = this.getCurrentUser();
        const role = user ? user.role : 'guest';

        document.body.setAttribute('data-user-role', role);

        // Update Top Navigation User Info
        const userProfileNameEl = document.getElementById('user-profile-name');
        const userRoleBadgeEl = document.getElementById('user-role-badge');
        const userAvatarEl = document.getElementById('user-avatar');

        // Toggle Standalone Login View visibility
        const loginScreenView = document.getElementById('login-screen-view');
        if (loginScreenView) {
            if (user) {
                loginScreenView.classList.add('hidden');
            } else {
                loginScreenView.classList.remove('hidden');
            }
        }

        if (user) {
            if (userProfileNameEl) userProfileNameEl.textContent = user.name;
            if (userRoleBadgeEl) userRoleBadgeEl.textContent = user.roleTitle;
            if (userAvatarEl && user.avatar) userAvatarEl.src = user.avatar;
        } else {
            if (userProfileNameEl) userProfileNameEl.textContent = 'ยังไม่ได้เข้าสู่ระบบ';
            if (userRoleBadgeEl) userRoleBadgeEl.textContent = 'กรุณาล็อกอิน';
        }

        // --- 1. Sidebar Menu Permissions ---
        const navMenu = document.querySelector('.nav-menu');
        if (navMenu) {
            const navItems = navMenu.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                const page = item.querySelector('a')?.getAttribute('data-page');
                if (role === 'admin') {
                    // Admin can see ALL menus
                    item.style.display = '';
                } else if (role === 'teacher') {
                    // Teacher can see ALL menus EXCEPT admin (ตั้งค่าและจัดการผู้ใช้)
                    if (page === 'admin' || item.classList.contains('admin-only')) {
                        item.style.display = 'none';
                    } else {
                        item.style.display = '';
                    }
                } else if (role === 'student') {
                    // Student can ONLY see 'screening' menu
                    if (page === 'screening') {
                        item.style.display = '';
                    } else {
                        item.style.display = 'none';
                    }
                } else {
                    item.style.display = '';
                }
            });
        }

        // --- 2. Student Restrictions in Screening Page ---
        // Hide assessment history table & results panel for Students (ไม่สามารถดูผลการประเมินทั้งของตนเองและของผู้อื่น)
        const historyPanel = document.getElementById('screening-history-panel');
        if (historyPanel) {
            if (role === 'student') {
                historyPanel.style.display = 'none';
            } else {
                historyPanel.style.display = '';
            }
        }

        // Hide "ดูผลประเมิน" buttons on assessment cards for Students
        document.querySelectorAll('.btn-view-results, [onclick*="switchScreeningTab"]').forEach(el => {
            if (role === 'student') {
                el.style.display = 'none';
            } else {
                el.style.display = '';
            }
        });

        // --- 3. Role-based Element Toggles ---
        document.querySelectorAll('[data-require-role]').forEach(el => {
            const requiredRoles = el.getAttribute('data-require-role').split(',');
            if (user && requiredRoles.includes(user.role)) {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });

        document.querySelectorAll('.admin-only').forEach(el => {
            if (role === 'admin') {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });

        document.querySelectorAll('.teacher-only').forEach(el => {
            if (role === 'admin' || role === 'teacher') {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });
    }
}

const authManager = new AuthManager();
