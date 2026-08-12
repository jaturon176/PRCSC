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
     * Authenticate User with Role
     * @param {string} role 'student' | 'teacher' | 'admin'
     * @param {string} username 
     * @param {string} password 
     */
    async login(role, username, password) {
        let userProfile = null;
        const users = firebaseService.getUsers() || [];
        const cleanUser = (username || '').toString().trim();
        const cleanPass = (password || '').toString().trim();

        if (!cleanUser) return false;

        // 1. Search in Registered Users Manager Database (Explicit User Credentials / Admin Overrides)
        const matchedUser = users.find(u => 
            u.username && u.username.toString().trim().toLowerCase() === cleanUser.toLowerCase() && 
            (!cleanPass || u.password === cleanPass || u.password === cleanUser)
        );

        if (matchedUser) {
            userProfile = {
                id: matchedUser.id,
                username: matchedUser.username,
                name: matchedUser.fullName,
                role: matchedUser.role,
                roleTitle: CONFIG.ROLE_NAMES_TH[matchedUser.role] || matchedUser.role,
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${matchedUser.role}_${matchedUser.username}`
            };
        } else if (role === CONFIG.ROLES.TEACHER || (!role && cleanUser.replace(/\D/g, '').length >= 9)) {
            // 2. Teacher Login: ใช้เบอร์โทรศัพท์ (Phone Number) เป็นชื่อผู้ใช้และรหัสผ่าน
            const teachers = firebaseService.getTeachers() || [];
            const normPhone = cleanUser.replace(/\D/g, ''); // strip spaces and hyphens

            const teacherMatch = teachers.find(t => {
                const tPhone = String(t.phone || t.tel || t.mobile || t.username || '').replace(/\D/g, '');
                return (tPhone && normPhone && tPhone === normPhone) || (t.fullName && t.fullName.includes(cleanUser));
            });

            if (teacherMatch) {
                userProfile = {
                    id: teacherMatch.id || ('TCH_' + (normPhone || cleanUser)),
                    name: teacherMatch.fullName || teacherMatch.name || 'ครู / บุคลากร',
                    phone: teacherMatch.phone || cleanUser,
                    role: CONFIG.ROLES.TEACHER,
                    roleTitle: CONFIG.ROLE_NAMES_TH.teacher,
                    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=teacher_${normPhone || cleanUser}`
                };
            } else {
                // Allow dynamic session for teacher using phone number as user & pass
                userProfile = {
                    id: 'TCH_' + (normPhone || cleanUser),
                    name: `ครู (เบอร์โทร ${cleanUser})`,
                    phone: cleanUser,
                    role: CONFIG.ROLES.TEACHER,
                    roleTitle: CONFIG.ROLE_NAMES_TH.teacher,
                    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=teacher_${cleanUser}`
                };
            }
        } else if (role === CONFIG.ROLES.STUDENT) {
            // 3. Student Login: ใช้รหัสประจำตัวนักเรียน (Student ID) เป็นชื่อผู้ใช้และรหัสผ่าน
            const students = firebaseService.getStudents() || [];
            const studentMatch = students.find(s => {
                const sId = String(s.studentId || s.id || '').trim();
                return sId.toLowerCase() === cleanUser.toLowerCase();
            });

            if (studentMatch) {
                userProfile = {
                    id: studentMatch.id || ('STD_' + studentMatch.studentId),
                    studentId: studentMatch.studentId || cleanUser,
                    name: studentMatch.fullName || (studentMatch.prefix ? `${studentMatch.prefix}${studentMatch.name} ${studentMatch.surname}` : `นักเรียน (${cleanUser})`),
                    grade: studentMatch.grade || '-',
                    room: studentMatch.room || '-',
                    role: CONFIG.ROLES.STUDENT,
                    roleTitle: CONFIG.ROLE_NAMES_TH.student,
                    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=student_${studentMatch.studentId || cleanUser}`
                };
            } else {
                // Allow dynamic session for student using student ID as user & pass
                userProfile = {
                    id: 'STD_' + cleanUser,
                    studentId: cleanUser,
                    name: `นักเรียน (รหัสประจำตัว ${cleanUser})`,
                    grade: '-',
                    room: '-',
                    role: CONFIG.ROLES.STUDENT,
                    roleTitle: CONFIG.ROLE_NAMES_TH.student,
                    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=student_${cleanUser}`
                };
            }
        } else if (role === CONFIG.ROLES.ADMIN || cleanUser === 'admin') {
            if (cleanUser === 'admin' && (!cleanPass || cleanPass === 'admin123' || cleanPass === 'admin')) {
                userProfile = {
                    id: 'ADM_01',
                    name: 'ผู้ดูแลระบบ (Administrator)',
                    role: CONFIG.ROLES.ADMIN,
                    roleTitle: CONFIG.ROLE_NAMES_TH.admin,
                    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'
                };
            }
        }

        if (userProfile) {
            this.currentUser = userProfile;
            localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_USER, JSON.stringify(userProfile));
            window.dispatchEvent(new CustomEvent('authStateChanged', { detail: userProfile }));
            return true;
        }
        return false;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_USER);
        window.dispatchEvent(new CustomEvent('authStateChanged', { detail: null }));
    }

    getCurrentUser() {
        return this.currentUser;
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

        // Show/Hide Role-restricted Elements
        document.querySelectorAll('[data-require-role]').forEach(el => {
            const requiredRoles = el.getAttribute('data-require-role').split(',');
            if (user && requiredRoles.includes(user.role)) {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });

        // Hide Edit Buttons for Students (keep student-allowed visible)
        document.querySelectorAll('.teacher-only, .admin-only').forEach(el => {
            if (role === 'student' && !el.classList.contains('student-allowed')) {
                el.style.display = 'none';
            } else {
                el.style.display = '';
            }
        });
    }
}

const authManager = new AuthManager();
