/**
 * ระบบดูแลช่วยเหลือนักเรียน - Main Application Controller
 * Handles Navigation, Charts, Modals, Event Handlers, and Seed Data
 */

class Application {
    constructor() {
        this.charts = {};
        this.currentView = 'dashboard';
        this.currentScreeningTab = 'behavior';
        this.selectedOffenseProofFile = null;

        // Initialize App on DOM Ready
        document.addEventListener('DOMContentLoaded', () => this.init());
    }

    async init() {
        console.log('[App] Initializing Student Care & Assistance System...');

        // 1. Purge sample student & teacher data
        this.purgeSampleData();
        this.checkAndLoadUserSeedData();

        // 2. Setup Page Routing & Navigation
        this.setupNavigation();

        // 3. Setup Global Event Listeners & Modals
        this.setupEventListeners();

        // 4. Check Auth Status & Apply Permissions
        authManager.applyUIPermissions();
        const activeUser = authManager.getCurrentUser();
        if (activeUser && activeUser.role === 'student') {
            this.switchPage('screening');
        } else {
            this.switchPage('dashboard');
        }

        // 5. Render Initial Dashboard Views & Charts
        this.startLiveClock();
        this.renderDashboard();
        this.renderStudentList();
        this.renderTeacherList();
        this.renderUserList();
        this.renderScreenings();
        this.renderMerits();
        this.renderOffenses();
        this.renderReferrals();
        this.updateReferralAgencyOptions('internal');

        // 6. Realtime Listeners for Data Updates
        window.addEventListener('studentsUpdated', () => {
            this.renderDashboard();
            this.renderStudentList();
            this.updateStudentDropdowns();
        });
        window.addEventListener('teachersUpdated', () => {
            this.renderTeacherList();
        });
        window.addEventListener('usersUpdated', () => {
            this.renderUserList();
        });
        window.addEventListener('screeningsUpdated', () => {
            this.renderDashboard();
            this.renderScreenings();
        });
        window.addEventListener('meritsUpdated', () => {
            this.renderDashboard();
            this.renderMerits();
        });
        window.addEventListener('offensesUpdated', () => {
            this.renderDashboard();
            this.renderOffenses();
        });
        window.addEventListener('referralsUpdated', () => {
            this.renderDashboard();
            this.renderReferrals();
        });
        window.addEventListener('activitiesUpdated', () => {
            this.renderActivitiesList();
        });
        window.addEventListener('authStateChanged', () => {
            authManager.applyUIPermissions();
            this.renderDashboard();
        });
        window.addEventListener('settingsUpdated', (e) => {
            const settings = e.detail || {};
            if (settings.theme) {
                this.applyTheme(settings.theme, false); // false = don't re-save
            }
        });

        // Initialize Student Select Options
        this.updateStudentDropdowns();
        this.updateVersionUI();
        this.initDropZones();
        this.initTheme();
    }

    // ─── Theme System ──────────────────────────────────────
    initTheme() {
        const settings = firebaseService.getSettings();
        this.applyTheme(settings.theme || 'indigo', false);
    }

    applyTheme(themeId, save = true) {
        const validThemes = ['indigo', 'ruby', 'ocean', 'emerald', 'amethyst', 'snow', 'sakura', 'sunrise', 'mint', 'gray'];
        if (!validThemes.includes(themeId)) themeId = 'indigo';
        document.body.dataset.theme = themeId;
        document.querySelectorAll('.theme-card').forEach(card => {
            card.classList.toggle('active', card.dataset.themeId === themeId);
        });
    }

    async changeTheme(themeId) {
        this.applyTheme(themeId, false);
        await firebaseService.saveSettings({ theme: themeId });
        const theme = CONFIG.THEMES[themeId];
        if (window.Swal) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: `เปลี่ยนธีมเป็น ${theme ? theme.nameTH : themeId} แล้ว`,
                showConfirmButton: false,
                timer: 2500,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.addEventListener('mouseenter', Swal.stopTimer);
                    toast.addEventListener('mouseleave', Swal.resumeTimer);
                }
            });
        }
    }

    renderThemePicker() {
        const container = document.getElementById('theme-picker-container');
        if (!container) return;
        const currentTheme = (firebaseService.getSettings() || {}).theme || 'indigo';
        const allThemes = Object.values(CONFIG.THEMES);
        const darkThemes = allThemes.filter(t => t.group === 'dark' || !t.group);
        const lightThemes = allThemes.filter(t => t.group === 'light');

        const renderCard = (t) => `
            <div class="theme-card ${t.id === currentTheme ? 'active' : ''}" data-theme-id="${t.id}" onclick="app.changeTheme('${t.id}')" title="${t.description}">
                <div class="theme-card-badge">✓ ใช้งานอยู่</div>
                <div class="theme-card-preview">
                    <div class="theme-preview-bar" style="background:${t.preview[0]};"></div>
                    <div class="theme-preview-bar" style="background:${t.preview[1]};"></div>
                    <div class="theme-preview-bar" style="background:${t.preview[2]};"></div>
                </div>
                <div class="theme-card-body">
                    <div class="theme-card-name">${t.nameTH}</div>
                    <div class="theme-card-desc">${t.description}</div>
                </div>
            </div>
        `;

        container.innerHTML = `
            <div style="grid-column:1/-1; margin-bottom: 4px;">
                <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.8px;">
                    <i class="ri-moon-fill" style="color:var(--indigo-500);"></i> ธีมโทนเข้ม (Dark)
                </span>
            </div>
            ${darkThemes.map(renderCard).join('')}
            <div style="grid-column:1/-1; margin-top: 12px; margin-bottom: 4px; border-top: 1px solid var(--border-light); padding-top: 16px;">
                <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.8px;">
                    <i class="ri-sun-fill" style="color:#f59e0b;"></i> ธีมโทนสว่าง (Light)
                </span>
            </div>
            ${lightThemes.map(renderCard).join('')}
        `;
    }

    initDropZones() {
        // Student CSV drop zone
        const csvInput = document.getElementById('csv-file-input');
        const csvFilename = document.getElementById('student-csv-filename');
        const csvFileDiv = document.getElementById('student-csv-selected-file');
        if (csvInput) {
            csvInput.addEventListener('change', () => {
                if (csvInput.files.length > 0 && csvFilename && csvFileDiv) {
                    if (csvInput.files.length === 1) {
                        csvFilename.textContent = `เลือก 1 ไฟล์: ${csvInput.files[0].name}`;
                    } else {
                        const names = Array.from(csvInput.files).map(f => f.name).join(', ');
                        csvFilename.textContent = `เลือกทั้งหมด ${csvInput.files.length} ไฟล์: ${names}`;
                    }
                    csvFileDiv.style.display = 'flex';
                }
            });
        }
        // Teacher CSV drop zone
        const tchCsvInput = document.getElementById('teacher-csv-file-input');
        const tchFilename = document.getElementById('teacher-csv-filename');
        const tchFileDiv = document.getElementById('teacher-csv-selected-file');
        if (tchCsvInput) {
            tchCsvInput.addEventListener('change', () => {
                if (tchCsvInput.files.length > 0 && tchFilename && tchFileDiv) {
                    if (tchCsvInput.files.length === 1) {
                        tchFilename.textContent = `เลือก 1 ไฟล์: ${tchCsvInput.files[0].name}`;
                    } else {
                        const names = Array.from(tchCsvInput.files).map(f => f.name).join(', ');
                        tchFilename.textContent = `เลือกทั้งหมด ${tchCsvInput.files.length} ไฟล์: ${names}`;
                    }
                    tchFileDiv.style.display = 'flex';
                }
            });
        }
        // Offense image drop zone
        const offenseDropZone = document.getElementById('offense-drop-zone');
        const offenseFileInput = document.getElementById('offense-file-input');
        if (offenseDropZone && offenseFileInput) {
            offenseDropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                offenseDropZone.classList.add('dragging');
            });
            offenseDropZone.addEventListener('dragleave', () => {
                offenseDropZone.classList.remove('dragging');
            });
            offenseDropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                offenseDropZone.classList.remove('dragging');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    this.handleOffenseImageSelect(file);
                }
            });
            offenseFileInput.addEventListener('change', () => {
                if (offenseFileInput.files.length > 0) {
                    this.handleOffenseImageSelect(offenseFileInput.files[0]);
                }
            });
        }
    }

    // --- Sample Data Purge (Disabled to preserve Cloud Realtime Sync across all devices) ---
    purgeSampleData() {
        // Preserves all real-time cloud database data for multi-device sync
    }

    // --- Navigation Router ---
    setupNavigation() {
        const navLinks = document.querySelectorAll('#sidebar .nav-item a');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetPage = link.getAttribute('data-page');
                if (targetPage) {
                    this.switchPage(targetPage);
                }
            });
        });

        // Mobile Toggle Button
        const mobileBtn = document.getElementById('mobile-menu-toggle');
        const sidebar = document.getElementById('sidebar');
        if (mobileBtn && sidebar) {
            mobileBtn.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-open');
            });
        }
    }

    switchPage(pageId) {
        const user = authManager.getCurrentUser();

        // Enforce strict Role Page Boundaries
        if (user && user.role === 'student') {
            // Student is ONLY allowed to access 'screening'
            pageId = 'screening';
        } else if (user && ['teacher', 'guidance', 'angel', 'hospital', 'police', 'msdhs'].includes(user.role)) {
            // Non-admin roles cannot access 'admin' (ตั้งค่าและจัดการผู้ใช้)
            if (pageId === 'admin') {
                pageId = 'dashboard';
            }
        }

        this.currentView = pageId;

        // Update active nav link
        document.querySelectorAll('#sidebar .nav-item').forEach(item => {
            const link = item.querySelector('a');
            if (link && link.getAttribute('data-page') === pageId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update page visibility
        document.querySelectorAll('.content-page').forEach(page => {
            if (page.id === `page-${pageId}`) {
                page.classList.add('active');
            } else {
                page.classList.remove('active');
            }
        });

        // Close sidebar on mobile
        document.getElementById('sidebar')?.classList.remove('mobile-open');

        // Re-render chart if switching to dashboard
        if (pageId === 'dashboard') {
            this.renderDashboardCharts();
        }

        // Render theme picker when admin page is shown
        if (pageId === 'admin') {
            this.renderThemePicker();
        }
    }

    // --- Global Event Handlers & Modal Setup ---
    setupEventListeners() {
        // Global ESC key listener to close any active modal overlay
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
            }
        });

        // Standalone Modern Login Screen Controls
        document.getElementById('btn-open-login')?.addEventListener('click', () => {
            const loginScreenView = document.getElementById('login-screen-view');
            if (loginScreenView) {
                loginScreenView.classList.remove('hidden');
            } else {
                this.openModal('modal-login');
            }
        });

        document.getElementById('btn-logout')?.addEventListener('click', () => {
            this.confirmLogout();
        });

        // User Avatar Upload Event Handler
        document.getElementById('user-avatar-file-input')?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                this.showAlert('แจ้งเตือน', 'กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WEBP)', 'warning');
                return;
            }

            const reader = new FileReader();
            reader.onload = (evt) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxDim = 250;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxDim) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        }
                    } else {
                        if (height > maxDim) {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    authManager.updateAvatar(resizedDataUrl);
                    this.showToast('อัปเปลี่ยนรูปโปรไฟล์เรียบร้อยแล้ว 🎉', 'success');
                };
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        });

        // Form Standalone Login Submit (Smart Auto Role Login with Specific Errors)
        document.getElementById('standalone-login-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('page-login-user').value;
            const password = document.getElementById('page-login-pass').value;

            if (!username || !username.trim()) {
                this.showAlert('แจ้งเตือน', 'กรุณากรอกชื่อผู้ใช้ / เบอร์โทรศัพท์ / รหัสนักเรียน', 'warning');
                return;
            }

            const res = await authManager.login(null, username, password);
            if (res && res.success) {
                document.getElementById('login-screen-view')?.classList.add('hidden');
                const user = authManager.getCurrentUser();
                this.showToast(`ยินดีต้อนรับ ${user?.name || ''} เข้าสู่ระบบ`, 'success');
                if (user?.role === 'student') {
                    this.switchPage('screening');
                } else {
                    this.switchPage('dashboard');
                }
            } else {
                const titleMap = {
                    user_not_found: 'ไม่พบผู้ใช้งานในฐานข้อมูล ⚠️',
                    invalid_password: 'รหัสผ่านไม่ถูกต้อง ❌',
                    empty_username: 'แจ้งเตือน ⚠️'
                };
                const alertTitle = (res && res.reason && titleMap[res.reason]) ? titleMap[res.reason] : 'ลงชื่อเข้าใช้ไม่สำเร็จ ❌';
                const alertMsg = (res && res.message) ? res.message : 'ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาติดต่อผู้ดูแลระบบ (Admin)';
                this.showAlert(alertTitle, alertMsg, 'error');
            }
        });

        // Modal Login Submit (Fallback)
        document.getElementById('form-login')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const role = document.getElementById('login-role').value;
            const username = document.getElementById('login-username').value;
            const success = await authManager.login(role, username, '');
            if (success) {
                this.closeModal('modal-login');
                this.showToast(`เข้าสู่ระบบสำเร็จในฐานะ: ${CONFIG.ROLE_NAMES_TH[role]}`, 'success');
            }
        });

        // Student Modal & Actions
        document.getElementById('btn-add-student')?.addEventListener('click', () => {
            document.getElementById('form-student').reset();
            document.getElementById('student-id-input').value = '';
            this.openModal('modal-student');
        });

        document.getElementById('form-student')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const student = {
                id: document.getElementById('student-id-input').value || undefined,
                studentId: document.getElementById('std-code').value.trim(),
                prefix: document.getElementById('std-prefix').value,
                fullName: document.getElementById('std-fullname').value.trim(),
                grade: document.getElementById('std-grade').value,
                room: document.getElementById('std-room').value.trim(),
                number: document.getElementById('std-number').value.trim(),
                phone: document.getElementById('std-phone').value.trim(),
                advisors: document.getElementById('std-advisors').value.trim()
            };
            await firebaseService.saveStudent(student);
            this.closeModal('modal-student');
            this.showToast('บันทึกข้อมูลนักเรียนเรียบร้อยแล้ว 🎓', 'success');
        });

        // Teacher Modal & Actions
        document.getElementById('btn-add-teacher')?.addEventListener('click', () => {
            document.getElementById('form-teacher').reset();
            document.getElementById('teacher-id-input').value = '';
            this.openModal('modal-teacher');
        });

        document.getElementById('form-teacher')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const teacher = {
                id: document.getElementById('teacher-id-input').value || undefined,
                prefix: document.getElementById('tch-prefix').value,
                fullName: document.getElementById('tch-fullname').value.trim(),
                position: document.getElementById('tch-position').value,
                responsibleRoom: document.getElementById('tch-room').value.trim(),
                phone: document.getElementById('tch-phone').value.trim()
            };
            await firebaseService.saveTeacher(teacher);
            this.closeModal('modal-teacher');
            this.showToast('บันทึกข้อมูลครูเรียบร้อยแล้ว 👨‍🏫', 'success');
        });

        // CSV Teacher Import Controls
        document.getElementById('btn-import-teacher-csv')?.addEventListener('click', () => this.openModal('modal-teacher-csv-import'));
        document.getElementById('btn-download-teacher-csv-template')?.addEventListener('click', () => csvImporter.downloadTeacherSampleTemplate());
        document.getElementById('btn-export-teachers-csv')?.addEventListener('click', () => {
            const teachers = firebaseService.getTeachers();
            csvImporter.exportTeachersToCSV(teachers);
        });

        document.getElementById('form-teacher-csv-import')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('teacher-csv-file-input');
            if (!fileInput || fileInput.files.length === 0) {
                this.showAlert('แจ้งเตือน', 'กรุณาเลือกไฟล์ CSV สำหรับนำเข้าข้อมูลครู', 'warning');
                return;
            }
            try {
                const parsed = await csvImporter.parseMultipleTeacherCSV(fileInput.files);
                await firebaseService.saveTeachersBatch(parsed);
                this.closeModal('modal-teacher-csv-import');
                const countMsg = fileInput.files.length > 1 
                    ? `นำเข้าข้อมูลครูจาก ${fileInput.files.length} ไฟล์ สำเร็จรวมทั้งหมด ${parsed.length} คน 🎉`
                    : `นำเข้าข้อมูลครูสำเร็จจำนวน ${parsed.length} คน 🎉`;
                this.showAlert('นำเข้าข้อมูลสำเร็จ 🎉', countMsg, 'success');
            } catch (err) {
                this.showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถอ่านไฟล์ CSV ครูได้: ' + err.message, 'error');
            }
        });

        document.getElementById('student-search-input')?.addEventListener('input', () => this.renderStudentList());
        document.getElementById('student-grade-filter')?.addEventListener('change', () => this.renderStudentList());
        document.getElementById('student-room-filter')?.addEventListener('change', () => this.renderStudentList());

        document.getElementById('teacher-search-input')?.addEventListener('input', () => this.renderTeacherList());
        document.getElementById('teacher-position-filter')?.addEventListener('change', () => this.renderTeacherList());

        // User Account Management Events
        document.getElementById('btn-add-user-account')?.addEventListener('click', () => {
            document.getElementById('form-user-account').reset();
            document.getElementById('usr-id-input').value = '';
            this.openModal('modal-user-account');
        });

        document.getElementById('form-user-account')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('usr-id-input').value;
            const username = document.getElementById('usr-username').value.trim();
            const fullName = document.getElementById('usr-fullname').value.trim();
            const role = document.getElementById('usr-role').value;
            const password = document.getElementById('usr-password').value.trim();

            const user = { id: id || undefined, username, fullName, role, password };
            await firebaseService.saveUser(user);
            this.closeModal('modal-user-account');
            this.showToast('บันทึกข้อมูลชื่อผู้ใช้และรหัสผ่านเรียบร้อยแล้ว 🔑', 'success');
        });

        // Backup & Cache Handlers
        document.getElementById('btn-backup-json')?.addEventListener('click', () => {
            this.exportBackupJSON();
        });

        document.getElementById('btn-clear-cache')?.addEventListener('click', () => {
            this.clearCache();
        });

        // Version Control Handler
        document.getElementById('btn-increment-version')?.addEventListener('click', () => {
            const nextVer = this.incrementVersion();
            this.showToast(`อัปเดตเวอร์ชันระบบเป็น ${nextVer} เรียบร้อยแล้ว`, 'info');
        });

        // Delete All Handlers
        document.getElementById('btn-delete-all-students')?.addEventListener('click', () => {
            this.openDeleteStudentScopeModal();
        });

        document.getElementById('del-scope-grade')?.addEventListener('change', () => this.updateDeleteScopeSummary());
        document.getElementById('del-scope-room')?.addEventListener('change', () => this.updateDeleteScopeSummary());
        document.getElementById('btn-confirm-delete-student-scope')?.addEventListener('click', () => this.confirmDeleteStudentScope());

        document.getElementById('btn-open-delete-screening-modal')?.addEventListener('click', () => {
            this.openDeleteScreeningModal();
        });
        document.getElementById('del-scr-type')?.addEventListener('change', () => this.updateDeleteScreeningScopeSummary());
        document.getElementById('del-scr-grade')?.addEventListener('change', () => this.updateDeleteScreeningScopeSummary());
        document.getElementById('del-scr-room')?.addEventListener('change', () => this.updateDeleteScreeningScopeSummary());

        document.getElementById('btn-delete-all-teachers')?.addEventListener('click', async () => {
            const teachers = firebaseService.getTeachers();
            const confirmed = await this.confirmDialog({
                title: '⚠️ ยืนยันการลบข้อมูลครูทั้งหมด',
                message: `คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลครูและบุคลากรทั้งหมด (${teachers.length} รายการ)? การดำเนินการนี้จะไม่สามารถย้อนกลับได้`,
                type: 'danger',
                confirmText: 'ลบข้อมูลครูทั้งหมด',
                cancelText: 'ยกเลิก'
            });
            if (confirmed) {
                localStorage.setItem('prcare_seed_cleared_teachers', 'true');
                await firebaseService.deleteAllTeachers();
                this.showAlert('ลบข้อมูลสำเร็จ', 'ลบข้อมูลครูทั้งหมดเรียบร้อยแล้ว', 'success');
            }
        });

        document.getElementById('btn-delete-all-system-data')?.addEventListener('click', async () => {
            const confirmed = await this.confirmDialog({
                title: '🚨 ยืนยันการลบข้อมูลทั้งหมดในระบบ',
                message: 'คำเตือน: คุณต้องการลบข้อมูลทุกอย่างในระบบ (นักเรียน, ครู, ผลการคัดกรอง, ความผิด, ความดี, การส่งต่อ) ทั้งหมดใช่หรือไม่?',
                type: 'danger',
                confirmText: 'ลบข้อมูลทุกอย่างในระบบ',
                cancelText: 'ยกเลิก'
            });
            if (confirmed) {
                localStorage.setItem('prcare_seed_cleared_students', 'true');
                localStorage.setItem('prcare_seed_cleared_teachers', 'true');
                await firebaseService.deleteAllSystemData();
                this.showAlert('ลบข้อมูลสำเร็จ', 'ลบข้อมูลทั้งหมดในระบบเรียบร้อยแล้ว', 'success');
            }
        });

        // CSV Import Controls
        document.getElementById('btn-import-csv')?.addEventListener('click', () => this.openModal('modal-csv-import'));
        document.getElementById('btn-download-csv-template')?.addEventListener('click', () => csvImporter.downloadSampleTemplate());
        document.getElementById('btn-export-students-csv')?.addEventListener('click', () => {
            const students = firebaseService.getStudents();
            csvImporter.exportStudentsToCSV(students);
        });

        document.getElementById('form-csv-import')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('csv-file-input');
            if (!fileInput || fileInput.files.length === 0) {
                this.showAlert('แจ้งเตือน', 'กรุณาเลือกไฟล์ CSV สำหรับนำเข้า', 'warning');
                return;
            }
            try {
                const parsed = await csvImporter.parseMultipleCSV(fileInput.files);
                await firebaseService.saveStudentsBatch(parsed);
                this.closeModal('modal-csv-import');

                // Reset file input and selected filenames display
                const numFiles = fileInput.files.length;
                fileInput.value = '';
                const selectedFileDiv = document.getElementById('student-csv-selected-file');
                if (selectedFileDiv) selectedFileDiv.style.display = 'none';

                const countMsg = numFiles > 1 
                    ? `นำเข้าข้อมูลนักเรียนจาก ${numFiles} ไฟล์ สำเร็จรวมทั้งหมด ${parsed.length} คน 🎉`
                    : `นำเข้าข้อมูลนักเรียนสำเร็จจำนวน ${parsed.length} คน 🎉`;
                this.showAlert('นำเข้าข้อมูลสำเร็จ 🎉', countMsg, 'success');
            } catch (err) {
                this.showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถอ่านไฟล์ CSV ได้: ' + err.message, 'error');
            }
        });

        // Screening Form Submit (Behavior Risk)
        document.getElementById('form-screening')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const studentId = document.getElementById('screening-student-select').value;
            const scoreAcademic = parseInt(document.getElementById('scr-academic').value || 0);
            const scoreBehavior = parseInt(document.getElementById('scr-behavior').value || 0);
            const scoreSubstance = parseInt(document.getElementById('scr-substance').value || 0);
            const scoreEconomic = parseInt(document.getElementById('scr-economic').value || 0);

            const totalScore = scoreAcademic + scoreBehavior + scoreSubstance + scoreEconomic;
            let resultLevel = 'normal';
            if (totalScore >= 5 || scoreBehavior >= 2) resultLevel = 'problem';
            else if (totalScore >= 2) resultLevel = 'risk';

            const screening = {
                type: 'behavior',
                studentId,
                totalScore,
                resultLevel,
                scores: { academic: scoreAcademic, behavior: scoreBehavior, substance: scoreSubstance, economic: scoreEconomic },
                assessor: authManager.getCurrentUser()?.name || 'ครูผู้ประเมิน',
                assessedAt: new Date().toISOString()
            };
            await firebaseService.saveScreening(screening);
            this.closeModal('modal-screening');
            this.showAlert('บันทึกผลการคัดกรองสำเร็จ 🎉', `ผลการประเมินคัดกรอง: <strong>${CONFIG.SCREENING_LEVELS[resultLevel.toUpperCase()].label}</strong>`, 'success');
            this.switchScreeningTab('behavior');
        });

        // Depression Screening Form Submit (PHQ-A - Exact Form & Scoring)
        document.getElementById('form-depression-screening')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const studentId = document.getElementById('dep-student-select').value;
            let totalScore = 0;
            const qScores = [];
            for (let i = 1; i <= 9; i++) {
                const val = parseInt(document.getElementById(`dep-q${i}`)?.value || 0);
                qScores.push(val);
                totalScore += val;
            }

            const ext1 = document.getElementById('dep-ext1')?.value || 'no';
            const ext2 = document.getElementById('dep-ext2')?.value || 'no';
            const isSuicideRisk = qScores[8] > 0 || ext1 === 'yes' || ext2 === 'yes';

            // Exact PHQ-A Scoring Scale & Interpretation from Image 2
            let resultLevel = 'normal';
            let levelLabel = 'ไม่มีภาวะซึมเศร้า';
            let advice = 'ขณะนี้ยังไม่พบภาวะซึมเศร้าที่ชัดเจน';
            let alertType = 'success';

            if (totalScore >= 20) {
                resultLevel = 'severe_extreme';
                levelLabel = 'มีภาวะซึมเศร้ารุนแรง';
                advice = 'ควรปรึกษาแพทย์ เพื่อวินิจฉัยและบำบัดรักษา';
                alertType = 'error';
            } else if (totalScore >= 15) {
                resultLevel = 'severe_high';
                levelLabel = 'มีภาวะซึมเศร้ามาก';
                advice = 'ควรปรึกษาแพทย์ เพื่อวินิจฉัยและบำบัดรักษา';
                alertType = 'error';
            } else if (totalScore >= 10) {
                resultLevel = 'moderate';
                levelLabel = 'มีภาวะซึมเศร้าปานกลาง';
                advice = 'ควรปรึกษาแพทย์ เพื่อวินิจฉัยและบำบัดรักษา';
                alertType = 'warning';
            } else if (totalScore >= 5) {
                resultLevel = 'mild';
                levelLabel = 'มีภาวะซึมเศร้าเล็กน้อย';
                advice = 'ควรหากิจกรรมที่ช่วยผ่อนคลายอารมณ์ หรือปรึกษาบุคคลใกล้ชิดที่ไว้ใจ';
                alertType = 'info';
            }

            // Look up student details for dashboard aggregation
            const students = firebaseService.getStudents();
            const studentObj = students.find(s => (s.studentId || s.id) === studentId);
            const studentGrade = studentObj ? (studentObj.grade || '') : '';
            const studentName = studentObj ? `${studentObj.prefix || ''}${studentObj.fullName || studentObj.name || ''}` : studentId;

            const screening = {
                type: 'depression',
                studentId,
                studentName,
                grade: studentGrade,
                phqaScore: totalScore,   // numeric score for dashboard aggregation
                totalScore,
                resultLevel,
                levelLabel,
                advice,
                qScores,
                extRisk: { ext1, ext2, isSuicideRisk },
                assessor: authManager.getCurrentUser()?.name || 'ครูผู้ประเมิน',
                assessedAt: new Date().toISOString()
            };


            await firebaseService.saveScreening(screening);
            this.closeModal('modal-depression-screening');

            const extraNotice = isSuicideRisk 
                ? '<br><span style="color:#e11d48; font-weight:700;">🚨 หมายเหตุ: พบความเสี่ยงต่อการคิดทำร้ายตนเอง/ฆ่าตัวตาย ควรได้รับการประเมินความเสี่ยงและเฝ้าระวังการฆ่าตัวตายด่วน!</span>' 
                : '';

            this.showAlert(
                'บันทึกผลการประเมิน PHQ-A สำเร็จ 🎉', 
                `<strong>ผลการประเมิน (คะแนนรวม ${totalScore}/27):</strong> ${levelLabel}<br><small style="color:var(--text-muted);">คำแนะนำ: ${advice}</small>${extraNotice}`, 
                isSuicideRisk ? 'warning' : alertType
            );
            this.switchScreeningTab('depression');

            // Prompt to open Referral modal immediately for severe depression or suicide risk
            if (totalScore >= 15 || isSuicideRisk) {
                const activeUser = authManager.getCurrentUser();
                if (activeUser && activeUser.role !== 'student') {
                    setTimeout(() => {
                        this.confirmDialog({
                            title: '🚨 ตรวจพบความเสี่ยงสุขภาพจิตระดับสูง',
                            message: `ผลการประเมินพบ: <strong>${levelLabel}</strong> (${totalScore}/27)${isSuicideRisk ? '<br><span style="color:#e11d48; font-weight:700;">🚨 มีความเสี่ยงต่อการทำร้ายตนเอง/ฆ่าตัวตาย (เฝ้าระวังด่วน)</span>' : ''}<br><br>ต้องการเปิดแบบฟอร์ม <strong>ส่งต่อนักเรียน (Referral)</strong> ไปยังโรงพยาบาล/พม. ทันทีหรือไม่?`,
                            type: 'warning',
                            confirmText: 'เปิดฟอร์มส่งต่อทันที 🕊️',
                            cancelText: 'ไว้ภายหลัง'
                        }).then(confirmed => {
                            if (confirmed) {
                                this.openReferralForScreening(screening.id);
                            }
                        });
                    }, 800);
                }
            }
        });

        document.getElementById('btn-open-screening')?.addEventListener('click', () => {
            const user = authManager.getCurrentUser();
            const students = firebaseService.getStudents();
            const select = document.getElementById('screening-student-select');
            if (select) {
                select.innerHTML = '<option value="">-- เลือกนักเรียน --</option>';
                students.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.studentId || s.id;
                    opt.textContent = `[${s.grade}/${s.room}] ${s.prefix || ''}${s.fullName || s.name} (${s.studentId || ''})`;
                    select.appendChild(opt);
                });
                if (user && user.role === 'student') {
                    select.value = user.studentId || user.id;
                    select.disabled = true;
                } else {
                    select.disabled = false;
                }
            }
            this.openModal('modal-screening');
        });

        document.getElementById('btn-open-merit')?.addEventListener('click', () => {
            const user = authManager.getCurrentUser();
            const select = document.getElementById('merit-student-select');
            if (select) {
                if (user && user.role === 'student') {
                    select.value = user.studentId;
                    select.disabled = true;
                } else {
                    select.disabled = false;
                }
            }
            this.openModal('modal-merit');
        });

        // Offense Form & Image Drop Setup
        document.getElementById('btn-open-offense')?.addEventListener('click', () => {
            document.getElementById('form-offense').reset();
            document.getElementById('offense-image-preview').style.display = 'none';
            this.selectedOffenseProofFile = null;
            this.openModal('modal-offense');
        });

        const dropZone = document.getElementById('offense-drop-zone');
        const fileInput = document.getElementById('offense-file-input');
        if (dropZone && fileInput) {
            dropZone.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleOffenseImageSelect(e.target.files[0]);
                }
            });
        }

        document.getElementById('form-offense')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const studentId = document.getElementById('offense-student-select').value;
            const students = firebaseService.getStudents();
            const student = students.find(s => s.id === studentId || s.studentId === studentId);

            let imageUrl = '';
            if (this.selectedOffenseProofFile) {
                try {
                    const uploadResult = await cloudinaryService.uploadImage(this.selectedOffenseProofFile);
                    imageUrl = uploadResult.url;
                } catch (err) {
                    console.warn('Image upload failed, continuing without photo:', err);
                }
            }

            const refType = document.getElementById('offense-referral').value;
            const refAgency = refType !== 'none' ? document.getElementById('offense-agency')?.value : '';

            const offense = {
                studentId: student ? student.studentId : studentId,
                studentName: student ? `${student.prefix || ''}${student.fullName}` : 'ไม่ระบุชื่อ',
                gradeRoom: student ? `${student.grade}/${student.room}` : '-',
                studentNumber: student ? student.number : '-',
                level: document.getElementById('offense-level').value,
                category: document.getElementById('offense-category').value,
                location: document.getElementById('offense-location').value.trim(),
                incidentDate: document.getElementById('offense-date').value || new Date().toISOString().slice(0, 10),
                description: document.getElementById('offense-desc').value.trim(),
                actionTaken: document.getElementById('offense-action').value.trim(),
                referralType: refType,
                referralAgency: refAgency,
                imageUrl: imageUrl,
                recordedBy: authManager.getCurrentUser()?.name || 'ครูกิจการนักเรียน'
            };

            await firebaseService.saveOffense(offense);

            // If referral selected, create referral record automatically
            if (offense.referralType !== 'none') {
                const targetAgencyName = offense.referralAgency || (offense.referralType === 'internal' ? 'ครูกิจการนักเรียน' : 'โรงพยาบาลพนมดงรัก');
                await firebaseService.saveReferral({
                    studentId: offense.studentId,
                    studentName: offense.studentName,
                    type: offense.referralType,
                    reason: `กระทำความผิดระดับ ${offense.level}: ${offense.category}${offense.description ? ` (${offense.description})` : ''}`,
                    status: 'pending',
                    targetAgency: targetAgencyName,
                    createdAt: new Date().toISOString()
                });
                this.renderReferrals();
            }

            this.closeModal('modal-offense');
            this.showToast('บันทึกข้อมูลการกระทำผิดเรียบร้อยแล้ว 🚨', 'success');
        });

        // Offense Referral Type Change -> Dynamic Agency Dropdown
        document.getElementById('offense-referral')?.addEventListener('change', (e) => {
            const val = e.target.value;
            const groupEl = document.getElementById('offense-agency-group');
            const agencySelect = document.getElementById('offense-agency');
            if (!groupEl || !agencySelect) return;

            if (val === 'none') {
                groupEl.style.display = 'none';
                agencySelect.innerHTML = '';
            } else {
                groupEl.style.display = 'block';
                agencySelect.innerHTML = '';
                const options = val === 'internal'
                    ? [
                        { value: 'ครูกิจการนักเรียน', label: '👮 1. ครูกิจการนักเรียน' },
                        { value: 'ครูแนะแนว', label: '👩‍🏫 2. ครูแนะแนว' },
                        { value: 'ครูนางฟ้า', label: '🧚‍♀️ 3. ครูนางฟ้า' }
                    ]
                    : [
                        { value: 'โรงพยาบาลพนมดงรัก', label: '🏥 1. โรงพยาบาลพนมดงรัก' },
                        { value: 'สาธารณสุข', label: '🩺 2. สาธารณสุข' },
                        { value: 'พม.', label: '🏛️ 3. พม. (พัฒนาสังคมและความมั่นคงของมนุษย์)' },
                        { value: 'สถานีตำรวจ', label: '👮 4. สถานีตำรวจ' }
                    ];

                options.forEach(opt => {
                    const optEl = document.createElement('option');
                    optEl.value = opt.value;
                    optEl.textContent = opt.label;
                    agencySelect.appendChild(optEl);
                });
            }
        });

        // Merit Activity Submit
        document.getElementById('btn-open-merit')?.addEventListener('click', () => this.openModal('modal-merit'));
        document.getElementById('form-merit')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const studentId = document.getElementById('merit-student-select').value;
            const activityId = document.getElementById('merit-activity-select').value;
            const activities = firebaseService.getActivities();
            const activity = activities.find(a => a.id === activityId);

            const merit = {
                studentId,
                activityName: activity ? activity.name : 'กิจกรรมสาธารณประโยชน์',
                points: activity ? activity.points : 10,
                details: document.getElementById('merit-details').value.trim(),
                recordedDate: new Date().toISOString().slice(0, 10)
            };
            await firebaseService.saveMerit(merit);
            this.closeModal('modal-merit');
            this.showToast('บันทึกการทำความดีสำเร็จ! ⭐', 'success');
        });

        // Referral Type Change -> Dynamic Agency Dropdown Options
        document.getElementById('ref-type')?.addEventListener('change', (e) => {
            this.updateReferralAgencyOptions(e.target.value);
        });

        // Referral Form Submit
        document.getElementById('btn-open-referral')?.addEventListener('click', () => {
            const screeningIdInput = document.getElementById('ref-screening-id');
            if (screeningIdInput) screeningIdInput.value = '';
            const currentType = document.getElementById('ref-type')?.value || 'internal';
            this.updateReferralAgencyOptions(currentType);
            this.openModal('modal-referral');
        });
        document.getElementById('form-referral')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const studentId = document.getElementById('ref-student-select').value;
            const students = firebaseService.getStudents();
            const student = students.find(s => s.studentId === studentId || s.id === studentId);
            const screeningId = document.getElementById('ref-screening-id')?.value;

            const referral = {
                screeningId: screeningId || undefined,
                studentId: student ? student.studentId : studentId,
                studentName: student ? student.fullName : 'นักเรียน',
                type: document.getElementById('ref-type').value,
                targetAgency: document.getElementById('ref-agency').value.trim(),
                reason: document.getElementById('ref-reason').value.trim(),
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            const savedRef = await firebaseService.saveReferral(referral);

            // If referral was created from a screening, also mark screening as referred
            if (screeningId) {
                const allScreenings = firebaseService.getScreenings();
                const matchedScr = allScreenings.find(s => s.id === screeningId);
                if (matchedScr) {
                    matchedScr.referred = true;
                    matchedScr.referralId = savedRef?.id || referral.id;
                    await firebaseService.saveScreening(matchedScr);
                }
            }

            this.closeModal('modal-referral');
            this.showToast('บันทึกการส่งต่อนักเรียนเรียบร้อยแล้ว 🕊️', 'success');
            this.renderScreenings();
            this.renderReferrals();
        });

        // Referral Action & History Form Submit
        document.getElementById('form-referral-action')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const refId = document.getElementById('action-ref-id').value;
            const status = document.getElementById('action-ref-status').value;
            const notes = document.getElementById('action-ref-notes').value.trim();

            if (!notes) {
                this.showToast('กรุณาระบุวิธีหรือผลการดำเนินการช่วยเหลือ', 'warning');
                return;
            }

            const referrals = firebaseService.getReferrals();
            const ref = referrals.find(r => r.id === refId);
            if (!ref) return;

            const currentUser = authManager.getCurrentUser();
            if (!ref.actionLogs) ref.actionLogs = [];

            const newLog = {
                actionDate: new Date().toISOString(),
                actionBy: currentUser?.name || 'บุคลากรผู้รับส่งต่อ',
                actionRole: currentUser?.roleTitle || currentUser?.role || 'ผู้รับส่งต่อ',
                status: status,
                notes: notes
            };

            ref.actionLogs.unshift(newLog);
            ref.status = status;
            ref.lastActionNotes = notes;
            ref.lastActionBy = newLog.actionBy;
            ref.lastActionDate = newLog.actionDate;

            await firebaseService.saveReferral(ref);
            this.closeModal('modal-referral-action');
            this.showToast(status === 'completed' ? 'บันทึกผลการดำเนินการ (ดำเนินการแล้วเสร็จ) เรียบร้อยแล้ว 🎉' : 'บันทึกผลการดำเนินการช่วยเหลือเรียบร้อยแล้ว ✅', 'success');
            this.renderReferrals();
        });

        // Search & Filter Triggers
        document.getElementById('student-search-input')?.addEventListener('input', () => this.renderStudentList());
        document.getElementById('student-grade-filter')?.addEventListener('change', () => this.renderStudentList());
    }

    handleOffenseImageSelect(file) {
        this.selectedOffenseProofFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.getElementById('offense-image-preview');
            if (img) {
                img.src = e.target.result;
                img.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }

    // Modal Helpers
    openModal(id) {
        document.getElementById(id)?.classList.add('active');
    }
    closeModal(id) {
        document.getElementById(id)?.classList.remove('active');
    }

    updateStudentDropdowns() {
        const students = firebaseService.getStudents();
        const dropdowns = ['screening-student-select', 'offense-student-select', 'merit-student-select', 'ref-student-select'];

        dropdowns.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = '<option value="">-- เลือนักเรียน --</option>';
                students.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.studentId || s.id;
                    opt.textContent = `[${s.grade}/${s.room}] ${s.prefix || ''}${s.fullName} (รหัส ${s.studentId})`;
                    el.appendChild(opt);
                });
            }
        });
    }

    // --- Render Dashboard Analytics & Futuristic Charts ---
    renderDashboard() {
        const students = firebaseService.getStudents();
        const screenings = firebaseService.getScreenings();
        const merits = firebaseService.getMerits();
        const offenses = firebaseService.getOffenses();
        const referrals = firebaseService.getReferrals();

        // Update Stat Live Counter Displays
        document.getElementById('stat-total-students').textContent = students.length;
        
        const problemScreenings = screenings.filter(s => s.resultLevel === 'problem').length;
        const riskScreenings = screenings.filter(s => s.resultLevel === 'risk').length;
        document.getElementById('stat-risk-count').textContent = riskScreenings + problemScreenings;

        document.getElementById('stat-merit-count').textContent = merits.length;
        document.getElementById('stat-offense-count').textContent = offenses.length;
        document.getElementById('stat-referral-count').textContent = referrals.length;

        // Render Charts & Activity Feed
        this.renderDashboardCharts();
        this.renderDashboardActivityFeed();
    }

    startLiveClock() {
        const updateClock = () => {
            const el = document.getElementById('clock-time-display');
            if (el) {
                const now = new Date();
                el.textContent = now.toLocaleTimeString('th-TH', { hour12: false });
            }
        };
        updateClock();
        setInterval(updateClock, 1000);
    }

    renderDashboardActivityFeed() {
        const feedContainer = document.getElementById('dashboard-activity-feed');
        if (!feedContainer) return;

        const merits = firebaseService.getMerits().map(m => ({ ...m, type: 'merit', time: m.createdAt }));
        const offenses = firebaseService.getOffenses().map(o => ({ ...o, type: 'offense', time: o.createdAt }));
        const screenings = firebaseService.getScreenings().map(s => ({ ...s, type: 'screening', time: s.createdAt }));

        const allActivities = [...merits, ...offenses, ...screenings]
            .filter(a => a.time)
            .sort((a, b) => new Date(b.time) - new Date(a.time))
            .slice(0, 5);

        feedContainer.innerHTML = '';
        if (allActivities.length === 0) {
            feedContainer.innerHTML = '<div style="text-align:center; padding: 16px; color: #64748b;">ยังไม่มีรายการกิจกรรมการดูแลช่วยเหลือล่าสุด</div>';
            return;
        }

        allActivities.forEach(item => {
            const div = document.createElement('div');
            div.className = 'activity-item';

            let iconClass = 'screening';
            let iconMarkup = '<i class="ri-heart-pulse-line"></i>';
            let title = '';
            let subtitle = '';

            if (item.type === 'merit') {
                iconClass = 'merit';
                iconMarkup = '<i class="ri-award-line"></i>';
                title = `บันทึกความดี: ${item.studentName || 'นักเรียน'}`;
                subtitle = `${item.activityName || item.category || 'จิตอาสาบำเพ็ญประโยชน์'} (+${item.points || 10} คะแนน)`;
            } else if (item.type === 'offense') {
                iconClass = 'offense';
                iconMarkup = '<i class="ri-error-warning-line"></i>';
                title = `รายงานพฤติกรรม: ${item.studentName || 'นักเรียน'}`;
                subtitle = `หมวด: ${item.category} (ระดับ: ${item.level === 'severe' ? 'ร้ายแรง' : item.level === 'moderate' ? 'ปานกลาง' : 'เบา'})`;
            } else {
                iconClass = 'screening';
                iconMarkup = '<i class="ri-shield-user-line"></i>';
                title = `การคัดกรอง: ${item.studentName || 'นักเรียน'}`;
                subtitle = `ผลการประเมิน: ${item.resultLevel === 'problem' ? 'มีปัญหา' : item.resultLevel === 'risk' ? 'กลุ่มเสี่ยง' : 'ปกติ'}`;
            }

            const dateStr = item.time ? new Date(item.time).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

            div.innerHTML = `
                <div class="activity-left">
                    <div class="activity-icon ${iconClass}">${iconMarkup}</div>
                    <div>
                        <div class="activity-title">${title}</div>
                        <div class="activity-sub">${subtitle}</div>
                    </div>
                </div>
                <div class="activity-time"><i class="ri-time-line"></i> ${dateStr}</div>
            `;
            feedContainer.appendChild(div);
        });
    }

    renderDashboardCharts() {
        if (!window.Chart) return;

        const screenings = firebaseService.getScreenings();
        const offenses = firebaseService.getOffenses();

        // 1. Calculate Screening Metrics & Percentages (behavior screenings ONLY)
        const behaviorScreenings = screenings.filter(s => s.type === 'behavior');
        const totalScreened = behaviorScreenings.length || 1;
        const normalCount = behaviorScreenings.filter(s => s.resultLevel === 'normal').length;
        const riskCount = behaviorScreenings.filter(s => s.resultLevel === 'risk').length;
        const problemCount = behaviorScreenings.filter(s => s.resultLevel === 'problem').length;

        const normalPct = Math.round((normalCount / totalScreened) * 100);
        const riskPct = Math.round((riskCount / totalScreened) * 100);
        const problemPct = Math.round((problemCount / totalScreened) * 100);

        // Update Breakdown UI Elements
        const elNormCnt = document.getElementById('dash-cnt-normal');
        const elNormPct = document.getElementById('dash-pct-normal');
        const elNormBar = document.getElementById('dash-bar-normal');
        if (elNormCnt) elNormCnt.textContent = `${normalCount} คน`;
        if (elNormPct) elNormPct.textContent = `${normalPct}%`;
        if (elNormBar) elNormBar.style.width = `${normalPct}%`;

        const elRiskCnt = document.getElementById('dash-cnt-risk');
        const elRiskPct = document.getElementById('dash-pct-risk');
        const elRiskBar = document.getElementById('dash-bar-risk');
        if (elRiskCnt) elRiskCnt.textContent = `${riskCount} คน`;
        if (elRiskPct) elRiskPct.textContent = `${riskPct}%`;
        if (elRiskBar) elRiskBar.style.width = `${riskPct}%`;

        const elProbCnt = document.getElementById('dash-cnt-problem');
        const elProbPct = document.getElementById('dash-pct-problem');
        const elProbBar = document.getElementById('dash-bar-problem');
        if (elProbCnt) elProbCnt.textContent = `${problemCount} คน`;
        if (elProbPct) elProbPct.textContent = `${problemPct}%`;
        if (elProbBar) elProbBar.style.width = `${problemPct}%`;

        // Chart 1: Risk Level Distribution (Modern Doughnut)
        const ctxRisk = document.getElementById('chart-risk-distribution')?.getContext('2d');
        if (ctxRisk) {
            if (this.charts.risk) this.charts.risk.destroy();
            this.charts.risk = new Chart(ctxRisk, {
                type: 'doughnut',
                data: {
                    labels: ['กลุ่มปกติ', 'กลุ่มเสี่ยง', 'กลุ่มมีปัญหา'],
                    datasets: [{
                        data: [normalCount || 1, riskCount, problemCount],
                        backgroundColor: ['#059669', '#d97706', '#e11d48'],
                        borderWidth: 3,
                        borderColor: '#ffffff',
                        hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '72%',
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                color: '#0f172a',
                                font: { family: 'Prompt', size: 12, weight: '600' },
                                padding: 14,
                                usePointStyle: true
                            }
                        }
                    }
                }
            });
        }

        // 2. Calculate Offense Metrics
        const totalOffenses = offenses.length || 1;
        const minor = offenses.filter(o => o.level === 'minor').length;
        const moderate = offenses.filter(o => o.level === 'moderate').length;
        const severe = offenses.filter(o => o.level === 'severe').length;

        const minorPct = Math.round((minor / totalOffenses) * 100);
        const modPct = Math.round((moderate / totalOffenses) * 100);
        const sevPct = Math.round((severe / totalOffenses) * 100);

        const elMinCnt = document.getElementById('dash-cnt-offense-minor');
        const elMinBar = document.getElementById('dash-bar-offense-minor');
        if (elMinCnt) elMinCnt.textContent = `${minor} เคส`;
        if (elMinBar) elMinBar.style.width = `${offenses.length ? minorPct : 0}%`;

        const elModCnt = document.getElementById('dash-cnt-offense-moderate');
        const elModBar = document.getElementById('dash-bar-offense-moderate');
        if (elModCnt) elModCnt.textContent = `${moderate} เคส`;
        if (elModBar) elModBar.style.width = `${offenses.length ? modPct : 0}%`;

        const elSevCnt = document.getElementById('dash-cnt-offense-severe');
        const elSevBar = document.getElementById('dash-bar-offense-severe');
        if (elSevCnt) elSevCnt.textContent = `${severe} เคส`;
        if (elSevBar) elSevBar.style.width = `${offenses.length ? sevPct : 0}%`;

        // Chart 2: Offense Severity Breakdown (Bar)
        const ctxOffense = document.getElementById('chart-offense-summary')?.getContext('2d');
        if (ctxOffense) {
            if (this.charts.offense) this.charts.offense.destroy();
            this.charts.offense = new Chart(ctxOffense, {
                type: 'bar',
                data: {
                    labels: ['ความผิดเบา', 'ปานกลาง', 'ร้ายแรง'],
                    datasets: [{
                        label: 'จำนวนเคสพฤติกรรม',
                        data: [minor, moderate, severe],
                        backgroundColor: ['#0284c7', '#d97706', '#e11d48'],
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { ticks: { color: '#334155', font: { family: 'Prompt', weight: '600' } }, grid: { color: '#e2e8f0' } },
                        x: { ticks: { color: '#0f172a', font: { family: 'Prompt', weight: '600' } }, grid: { display: false } }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }

        // 3. Render PHQ-A Depression Dashboard
        this.renderDepressionDashboard();
    }

    renderDepressionDashboard() {
        if (!window.Chart) return;

        const allStudents = firebaseService.getStudents();
        const screenings = firebaseService.getScreenings();

        // Filter depression records — support both old (totalScore) and new (phqaScore) formats
        const depressionRecords = screenings
            .filter(s => s.type === 'depression')
            .map(s => {
                // Resolve phqaScore: prefer explicit field, fallback to totalScore
                const score = typeof s.phqaScore === 'number' ? s.phqaScore
                            : typeof s.totalScore === 'number' ? s.totalScore
                            : null;
                if (score === null) return null;

                // Resolve grade: prefer stored grade, else look up from students list
                let grade = s.grade || s.studentGrade || '';
                if (!grade && s.studentId) {
                    const stu = allStudents.find(st => (st.studentId || st.id) === s.studentId);
                    if (stu) grade = stu.grade || '';
                }

                return { ...s, phqaScore: score, grade };
            })
            .filter(s => s !== null);

        const total = depressionRecords.length;
        const safeTotal = total || 1;

        // Count by level
        const counts = { normal: 0, mild: 0, moderate: 0, severeHigh: 0, severeExtreme: 0 };
        depressionRecords.forEach(s => {
            const score = s.phqaScore;
            if (score <= 4) counts.normal++;
            else if (score <= 9) counts.mild++;
            else if (score <= 14) counts.moderate++;
            else if (score <= 19) counts.severeHigh++;
            else counts.severeExtreme++;
        });


        const riskCount = counts.moderate + counts.severeHigh + counts.severeExtreme;

        // Update summary badges
        const totalBadge = document.getElementById('phqa-total-badge');
        const riskBadge = document.getElementById('phqa-risk-badge');
        if (totalBadge) totalBadge.textContent = `🧠 ประเมินแล้ว ${total} ราย`;
        if (riskBadge) {
            riskBadge.textContent = `🚨 เฝ้าระวัง ${riskCount} ราย`;
            riskBadge.style.display = riskCount > 0 ? 'inline-block' : 'none';
        }

        // Update center text
        const centerTotal = document.getElementById('phqa-donut-total');
        if (centerTotal) centerTotal.textContent = total;

        // Helper: update a level row
        const updateRow = (key, count) => {
            const pct = Math.round((count / safeTotal) * 100);
            const elCnt = document.getElementById(`phqa-cnt-${key}`);
            const elPct = document.getElementById(`phqa-pct-${key}`);
            const elBar = document.getElementById(`phqa-bar-${key}`);
            if (elCnt) elCnt.textContent = `${count} ราย`;
            if (elPct) elPct.textContent = total > 0 ? `${pct}%` : '0%';
            if (elBar) elBar.style.width = total > 0 ? `${pct}%` : '0%';
        };
        updateRow('normal', counts.normal);
        updateRow('mild', counts.mild);
        updateRow('moderate', counts.moderate);
        updateRow('severe-high', counts.severeHigh);
        updateRow('severe-extreme', counts.severeExtreme);

        // Donut Chart
        const ctxDonut = document.getElementById('chart-phqa-donut')?.getContext('2d');
        if (ctxDonut) {
            if (this.charts.phqaDonut) this.charts.phqaDonut.destroy();
            this.charts.phqaDonut = new Chart(ctxDonut, {
                type: 'doughnut',
                data: {
                    labels: ['ไม่มีภาวะซึมเศร้า', 'เล็กน้อย', 'ปานกลาง', 'มาก', 'รุนแรง'],
                    datasets: [{
                        data: [counts.normal || (total === 0 ? 1 : 0), counts.mild, counts.moderate, counts.severeHigh, counts.severeExtreme],
                        backgroundColor: ['#0284c7', '#059669', '#d97706', '#ea580c', '#e11d48'],
                        borderWidth: 3,
                        borderColor: '#ffffff',
                        hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => {
                                    if (total === 0) return ` ${ctx.label}: ไม่มีข้อมูล`;
                                    const val = ctx.parsed;
                                    const pct = Math.round((val / total) * 100);
                                    return ` ${ctx.label}: ${val} ราย (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Grade-level breakdown table & stacked bar chart
        const grades = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6', 'ปวช.1', 'ปวช.2', 'ปวช.3'];
        const gradeData = {};
        grades.forEach(g => { gradeData[g] = { normal: 0, mild: 0, moderate: 0, severeHigh: 0, severeExtreme: 0, total: 0 }; });

        depressionRecords.forEach(s => {
            const grade = s.grade || s.studentGrade || '';
            if (gradeData[grade] !== undefined) {
                const score = s.phqaScore;
                if (score <= 4) gradeData[grade].normal++;
                else if (score <= 9) gradeData[grade].mild++;
                else if (score <= 14) gradeData[grade].moderate++;
                else if (score <= 19) gradeData[grade].severeHigh++;
                else gradeData[grade].severeExtreme++;
                gradeData[grade].total++;
            }
        });

        // Filter only grades that have data
        const activeGrades = grades.filter(g => gradeData[g].total > 0);

        // Stacked Bar Chart by grade
        const ctxBar = document.getElementById('chart-phqa-by-grade')?.getContext('2d');
        if (ctxBar) {
            if (this.charts.phqaGrade) this.charts.phqaGrade.destroy();
            if (activeGrades.length > 0) {
                this.charts.phqaGrade = new Chart(ctxBar, {
                    type: 'bar',
                    data: {
                        labels: activeGrades,
                        datasets: [
                            {
                                label: 'ไม่มีภาวะซึมเศร้า',
                                data: activeGrades.map(g => gradeData[g].normal),
                                backgroundColor: '#0284c7',
                                borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
                                stack: 'phqa'
                            },
                            {
                                label: 'เล็กน้อย',
                                data: activeGrades.map(g => gradeData[g].mild),
                                backgroundColor: '#059669',
                                stack: 'phqa'
                            },
                            {
                                label: 'ปานกลาง',
                                data: activeGrades.map(g => gradeData[g].moderate),
                                backgroundColor: '#d97706',
                                stack: 'phqa'
                            },
                            {
                                label: 'มาก',
                                data: activeGrades.map(g => gradeData[g].severeHigh),
                                backgroundColor: '#ea580c',
                                stack: 'phqa'
                            },
                            {
                                label: 'รุนแรง',
                                data: activeGrades.map(g => gradeData[g].severeExtreme),
                                backgroundColor: '#e11d48',
                                borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
                                stack: 'phqa'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                stacked: true,
                                ticks: { color: '#0f172a', font: { family: 'Prompt', weight: '600', size: 12 } },
                                grid: { display: false }
                            },
                            y: {
                                stacked: true,
                                beginAtZero: true,
                                ticks: {
                                    color: '#334155',
                                    font: { family: 'Prompt', weight: '600' },
                                    stepSize: 1,
                                    precision: 0
                                },
                                grid: { color: 'rgba(148,163,184,0.2)' }
                            }
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top',
                                labels: {
                                    color: '#0f172a',
                                    font: { family: 'Prompt', size: 11, weight: '600' },
                                    padding: 12,
                                    usePointStyle: true,
                                    pointStyleWidth: 10
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    title: ctx => `ระดับชั้น ${ctx[0].label}`,
                                    label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} ราย`
                                }
                            }
                        }
                    }
                });
            } else {
                // No data - show placeholder
                ctxBar.canvas.style.display = 'none';
            }
        }

        // Grade breakdown table
        const tbody = document.getElementById('phqa-grade-table-body');
        if (tbody) {
            if (activeGrades.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b; padding: 20px;">ยังไม่มีข้อมูลการประเมิน PHQ-A</td></tr>';
            } else {
                tbody.innerHTML = activeGrades.map(g => {
                    const d = gradeData[g];
                    const hasRisk = (d.moderate + d.severeHigh + d.severeExtreme) > 0;
                    return `<tr${hasRisk ? ' style="background: rgba(225,29,72,0.03);"' : ''}>
                        <td><strong>${g}</strong></td>
                        <td style="color:#059669; font-weight:700;">${d.normal}</td>
                        <td style="color:#0284c7; font-weight:700;">${d.mild}</td>
                        <td style="color:#d97706; font-weight:700;">${d.moderate}</td>
                        <td style="color:#ea580c; font-weight:700;">${d.severeHigh}</td>
                        <td style="color:#e11d48; font-weight:700;">${d.severeExtreme}${d.severeExtreme > 0 ? ' 🚨' : ''}</td>
                        <td><strong>${d.total}</strong></td>
                    </tr>`;
                }).join('');
            }
        }
    }

    // --- Render Data Views ---

    renderStudentList() {
        const tbody = document.getElementById('table-students-body');
        if (!tbody) return;

        let students = firebaseService.getStudents();
        const search = document.getElementById('student-search-input')?.value.toLowerCase() || '';
        const gradeFilter = document.getElementById('student-grade-filter')?.value || '';
        const roomFilter = document.getElementById('student-room-filter')?.value || '';

        if (search) {
            students = students.filter(s => 
                (s.fullName && s.fullName.toLowerCase().includes(search)) || 
                (s.studentId && s.studentId.toLowerCase().includes(search)) ||
                (s.number && s.number.includes(search))
            );
        }
        if (gradeFilter) {
            students = students.filter(s => {
                const gStr = String(s.grade || '').trim();
                return gStr === gradeFilter || gStr.startsWith(gradeFilter + '/') || gStr.startsWith(gradeFilter);
            });
        }
        if (roomFilter) {
            const cleanRoomFilter = String(roomFilter).replace(/\D/g, '');
            students = students.filter(s => {
                const rStr = String(s.room || '').trim();
                const gStr = String(s.grade || '').trim();
                const rNum = rStr.replace(/\D/g, '') || (gStr.includes('/') ? (gStr.split('/')[1] || '').replace(/\D/g, '') : '');
                return !cleanRoomFilter || rNum === cleanRoomFilter || rStr === roomFilter || rStr === `ห้อง ${roomFilter}`;
            });
        }

        // Automatic Sorting: Grade ➔ Room (numeric) ➔ Student Number (numeric)
        const gradeOrder = { 'ม.1': 1, 'ม.2': 2, 'ม.3': 3, 'ม.4': 4, 'ม.5': 5, 'ม.6': 6, 'ปวช.1': 7, 'ปวช.2': 8, 'ปวช.3': 9 };
        students.sort((a, b) => {
            const gA = gradeOrder[a.grade] || 99;
            const gB = gradeOrder[b.grade] || 99;
            if (gA !== gB) return gA - gB;

            const rA = parseInt((a.room || '').replace(/\D/g, '')) || 0;
            const rB = parseInt((b.room || '').replace(/\D/g, '')) || 0;
            if (rA !== rB) return rA - rB;

            const nA = parseInt((a.number || '').replace(/\D/g, '')) || 0;
            const nB = parseInt((b.number || '').replace(/\D/g, '')) || 0;
            return nA - nB;
        });

        tbody.innerHTML = '';
        if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding: 24px;">ไม่พบข้อมูลนักเรียน</td></tr>';
            return;
        }

        students.forEach((s, idx) => {
            const tr = document.createElement('tr');
            const num = s.number || (idx + 1).toString();
            const studentId = s.studentId || '-';
            const fullName = s.fullName || '-';
            const gradeRoom = (s.grade && s.room) ? (s.grade.includes('/') ? s.grade : `${s.grade}/${s.room}`) : (s.grade || '-');
            const advisors = s.advisors || s.advisorTeachers || s.guardian || '-';

            tr.innerHTML = `
                <td><strong style="color:#0284c7;">${num}</strong></td>
                <td><strong style="color:#38bdf8;">${studentId}</strong></td>
                <td>${fullName}</td>
                <td><span class="badge badge-normal">${gradeRoom}</span></td>
                <td>${advisors}</td>
                <td>
                    <button class="btn btn-secondary btn-sm teacher-only" onclick="app.editStudent('${s.id}')"><i class="ri-edit-line"></i> แก้ไข</button>
                    <button class="btn btn-danger btn-sm teacher-only" onclick="app.deleteStudent('${s.id}')"><i class="ri-delete-bin-line"></i> ลบ</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        authManager.applyUIPermissions();
    }

    editStudent(id) {
        const students = firebaseService.getStudents();
        const student = students.find(s => s.id === id || s.studentId === id);
        if (student) {
            document.getElementById('student-id-input').value = student.id || '';
            document.getElementById('std-code').value = student.studentId || '';
            document.getElementById('std-prefix').value = student.prefix || 'นาย';
            document.getElementById('std-fullname').value = student.fullName || '';
            document.getElementById('std-grade').value = student.grade || 'ม.1';
            document.getElementById('std-room').value = student.room || '1';
            document.getElementById('std-number').value = student.number || '1';
            document.getElementById('std-phone').value = student.phone || '';
            document.getElementById('std-advisors').value = student.advisors || '';
            this.openModal('modal-student');
        }
    }

    async deleteStudent(id) {
        const confirmed = await this.confirmDialog({
            title: 'ยืนยันการลบข้อมูลนักเรียน',
            message: 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนักเรียนรายนี้ออกจากระบบ? ข้อมูลประวัติและการประเมินทั้งหมดจะถูกลบ',
            type: 'danger',
            confirmText: 'ลบข้อมูลนักเรียน'
        });
        if (confirmed) {
            await firebaseService.deleteStudent(id);
            this.showToast('ลบข้อมูลนักเรียนสำเร็จ 🎓', 'success');
        }
    }

    openDeleteStudentScopeModal() {
        const currentGrade = document.getElementById('student-grade-filter')?.value || 'ALL';
        const currentRoom = document.getElementById('student-room-filter')?.value || 'ALL';

        const gradeSelect = document.getElementById('del-scope-grade');
        const roomSelect = document.getElementById('del-scope-room');

        if (gradeSelect) gradeSelect.value = currentGrade || 'ALL';
        if (roomSelect) roomSelect.value = currentRoom || 'ALL';

        this.updateDeleteScopeSummary();
        this.openModal('modal-delete-student-scope');
    }

    updateDeleteScopeSummary() {
        const grade = document.getElementById('del-scope-grade')?.value || 'ALL';
        const room = document.getElementById('del-scope-room')?.value || 'ALL';
        const summaryText = document.getElementById('del-scope-target-text');

        const students = firebaseService.getStudents();
        const targets = students.filter(s => {
            const matchG = grade === 'ALL' || s.grade === grade || (s.grade && s.grade.startsWith(grade));
            const matchR = room === 'ALL' || s.room === room || s.room === `ห้อง ${room}`;
            return matchG && matchR;
        });

        let targetDesc = '';
        if (grade === 'ALL' && room === 'ALL') {
            targetDesc = `นักเรียนทั้งหมดในระบบ (${targets.length} รายการ)`;
        } else if (grade !== 'ALL' && room === 'ALL') {
            targetDesc = `นักเรียนระดับชั้น ${grade} ทุกห้อง (${targets.length} รายการ)`;
        } else if (grade === 'ALL' && room !== 'ALL') {
            targetDesc = `นักเรียนห้อง ${room} ทุกระดับชั้น (${targets.length} รายการ)`;
        } else {
            targetDesc = `นักเรียนเฉพาะห้อง ${grade}/${room} (${targets.length} รายการ)`;
        }

        if (summaryText) summaryText.textContent = targetDesc;
    }

    async confirmDeleteStudentScope() {
        const grade = document.getElementById('del-scope-grade')?.value || 'ALL';
        const room = document.getElementById('del-scope-room')?.value || 'ALL';

        const students = firebaseService.getStudents();
        const targets = students.filter(s => {
            const matchG = grade === 'ALL' || s.grade === grade || (s.grade && s.grade.startsWith(grade));
            const matchR = room === 'ALL' || s.room === room || s.room === `ห้อง ${room}`;
            return matchG && matchR;
        });

        if (targets.length === 0) {
            this.showAlert('ไม่พบข้อมูลนักเรียน', 'ไม่พบข้อมูลนักเรียนตามเงื่อนไขที่เลือก', 'warning');
            return;
        }

        let scopeLabel = '';
        if (grade === 'ALL' && room === 'ALL') scopeLabel = 'ทั้งหมดทุกห้องในระบบ';
        else if (grade !== 'ALL' && room === 'ALL') scopeLabel = `ระดับชั้น ${grade} ทุกห้อง`;
        else if (grade === 'ALL' && room !== 'ALL') scopeLabel = `ห้อง ${room} ทุกระดับชั้น`;
        else scopeLabel = `เฉพาะห้อง ${grade}/${room}`;

        const confirmed = await this.confirmDialog({
            title: `⚠️ ยืนยันการลบข้อมูลนักเรียน (${scopeLabel})`,
            message: `คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนักเรียน ${scopeLabel} จำนวน ${targets.length} รายการออกจากระบบ?`,
            type: 'danger',
            confirmText: 'ยืนยันลบข้อมูล',
            cancelText: 'ยกเลิก'
        });

        if (confirmed) {
            this.closeModal('modal-delete-student-scope');
            if (grade === 'ALL' && room === 'ALL') {
                localStorage.setItem('prcare_seed_cleared_students', 'true');
                await firebaseService.deleteAllStudents();
                this.showAlert('ลบข้อมูลสำเร็จ 🎉', 'ลบข้อมูลนักเรียนทั้งหมดในระบบเรียบร้อยแล้ว', 'success');
            } else {
                const count = await firebaseService.deleteStudentsByGradeRoom(grade === 'ALL' ? '' : grade, room === 'ALL' ? '' : room);
                this.showAlert('ลบข้อมูลสำเร็จ 🎉', `ลบข้อมูลนักเรียน (${scopeLabel}) สำเร็จจำนวน ${count} รายการ`, 'success');
            }
        }
    }

    renderTeacherList() {
        const tbody = document.getElementById('table-teachers-body');
        if (!tbody) return;

        let teachers = firebaseService.getTeachers();
        const search = document.getElementById('teacher-search-input')?.value.toLowerCase() || '';
        const positionFilter = document.getElementById('teacher-position-filter')?.value || '';

        if (search) {
            teachers = teachers.filter(t => 
                (t.fullName && t.fullName.toLowerCase().includes(search)) || 
                (t.position && t.position.toLowerCase().includes(search)) ||
                (t.responsibleRoom && t.responsibleRoom.toLowerCase().includes(search)) ||
                (t.phone && t.phone.includes(search))
            );
        }
        if (positionFilter) {
            teachers = teachers.filter(t => t.position === positionFilter || (t.position && t.position.includes(positionFilter)));
        }

        // Executive & Position Hierarchy Sorting: ผู้อำนวยการ > รองผู้อำนวยการ > ครูกิจการนักเรียน/หัวหน้างาน > ครูประจำชั้น/ที่ปรึกษา > อื่นๆ
        const getPosPriority = (pos) => {
            if (!pos) return 99;
            const p = pos.trim();
            if (p.includes('ผู้อำนวยการ') && !p.includes('รอง')) return 1;
            if (p.includes('รองผู้อำนวยการ')) return 2;
            if (p.includes('ผู้บริหาร')) return 3;
            if (p.includes('กิจการนักเรียน') || p.includes('ปกครอง')) return 4;
            if (p.includes('ประจำชั้น') || p.includes('ที่ปรึกษา')) return 5;
            if (p.includes('แนะแนว')) return 6;
            if (p.includes('ครูผู้สอน') || p.includes('ครู')) return 7;
            return 10;
        };

        teachers.sort((a, b) => {
            const prioA = getPosPriority(a.position);
            const prioB = getPosPriority(b.position);
            if (prioA !== prioB) return prioA - prioB;
            return (a.fullName || '').localeCompare(b.fullName || '', 'th');
        });

        tbody.innerHTML = '';
        if (teachers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding: 24px;">ไม่พบข้อมูลครู/บุคลากร</td></tr>';
            return;
        }

        teachers.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong style="color:#0f172a;">${t.prefix || ''}${t.fullName}</strong></td>
                <td><span class="badge badge-minor">${t.position}</span></td>
                <td><span class="badge badge-normal">${t.responsibleRoom || t.responsibleGrade || '-'}</span></td>
                <td>${t.phone || '-'}</td>
                <td>
                    <button class="btn btn-secondary btn-sm teacher-only" onclick="app.editTeacher('${t.id}')"><i class="ri-edit-line"></i> แก้ไข</button>
                    <button class="btn btn-danger btn-sm teacher-only" onclick="app.deleteTeacher('${t.id}')"><i class="ri-delete-bin-line"></i> ลบ</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        authManager.applyUIPermissions();
    }

    async deleteTeacher(id) {
        const confirmed = await this.confirmDialog({
            title: 'ยืนยันการลบข้อมูลครู/บุคลากร',
            message: 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลครู/บุคลากรท่านนี้ออกจากระบบ?',
            type: 'danger',
            confirmText: 'ลบข้อมูลครู'
        });
        if (confirmed) {
            await firebaseService.deleteTeacher(id);
            this.showToast('ลบข้อมูลครูสำเร็จ 👨‍🏫', 'success');
        }
    }

    editTeacher(id) {
        const teachers = firebaseService.getTeachers();
        const t = teachers.find(item => item.id === id);
        if (t) {
            document.getElementById('teacher-id-input').value = t.id;
            document.getElementById('tch-prefix').value = t.prefix || 'นาย';
            document.getElementById('tch-fullname').value = t.fullName;
            document.getElementById('tch-position').value = t.position;
            document.getElementById('tch-room').value = t.responsibleRoom || t.responsibleGrade || '';
            document.getElementById('tch-phone').value = t.phone || '';
            this.openModal('modal-teacher');
        }
    }

    editStudent(id) {
        const students = firebaseService.getStudents();
        const s = students.find(item => item.id === id);
        if (s) {
            document.getElementById('student-id-input').value = s.id;
            document.getElementById('std-code').value = s.studentId;
            document.getElementById('std-prefix').value = s.prefix || 'นาย';
            document.getElementById('std-fullname').value = s.fullName;
            document.getElementById('std-grade').value = s.grade;
            document.getElementById('std-room').value = s.room;
            document.getElementById('std-number').value = s.number;
            document.getElementById('std-phone').value = s.phone || '';
            document.getElementById('std-advisors').value = s.advisors || s.advisorTeachers || s.guardian || '';
            this.openModal('modal-student');
        }
    }

    openBehaviorModal() {
        const user = authManager.getCurrentUser();
        const students = firebaseService.getStudents();
        const select = document.getElementById('screening-student-select');
        if (select) {
            select.innerHTML = '<option value="">-- เลือกนักเรียน --</option>';
            students.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.studentId || s.id;
                opt.textContent = `[${s.grade}/${s.room}] ${s.prefix || ''}${s.fullName || s.name} (${s.studentId || ''})`;
                select.appendChild(opt);
            });
            if (user && user.role === 'student') {
                select.value = user.studentId || user.id;
                select.disabled = true;
            } else {
                select.disabled = false;
            }
        }
        this.openModal('modal-screening');
    }

    openDepressionModal() {
        const user = authManager.getCurrentUser();
        const students = firebaseService.getStudents();
        const select = document.getElementById('dep-student-select');
        if (select) {
            select.innerHTML = '<option value="">-- เลือกนักเรียน --</option>';
            students.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.studentId || s.id;
                opt.textContent = `[${s.grade}/${s.room}] ${s.prefix || ''}${s.fullName || s.name} (${s.studentId || ''})`;
                select.appendChild(opt);
            });
            if (user && user.role === 'student') {
                select.value = user.studentId || user.id;
                select.disabled = true;
            } else {
                select.disabled = false;
            }
        }
        for (let i = 1; i <= 9; i++) {
            const el = document.getElementById(`dep-q${i}`);
            if (el) el.value = "0";
        }
        this.openModal('modal-depression-screening');
    }

    switchScreeningTab(tabType) {
        this.currentScreeningTab = tabType;
        const btnBehavior = document.getElementById('tab-scr-behavior');
        const btnDepression = document.getElementById('tab-scr-depression');

        if (tabType === 'depression') {
            btnBehavior?.classList.remove('active');
            btnDepression?.classList.add('active');
        } else {
            btnBehavior?.classList.add('active');
            btnDepression?.classList.remove('active');
        }

        this.renderScreenings();
    }

    renderScreenings() {
        const tbody = document.getElementById('table-screenings-body');
        if (!tbody) return;
        const allScreenings = firebaseService.getScreenings();
        const students = firebaseService.getStudents();
        const allReferrals = firebaseService.getReferrals();
        const user = authManager.getCurrentUser();

        // Calculate card counts for both 2 assessments
        const behaviorScreenings = allScreenings.filter(s => !s.type || s.type === 'behavior');
        const depressionScreenings = allScreenings.filter(s => s.type === 'depression');

        const cntBehaviorEl = document.getElementById('cnt-behavior-num');
        const cntDepressionEl = document.getElementById('cnt-depression-num');
        const heroCntBehaviorEl = document.getElementById('hero-cnt-behavior');
        const heroCntDepressionEl = document.getElementById('hero-cnt-depression');

        if (cntBehaviorEl) cntBehaviorEl.textContent = behaviorScreenings.length;
        if (cntDepressionEl) cntDepressionEl.textContent = depressionScreenings.length;
        if (heroCntBehaviorEl) heroCntBehaviorEl.textContent = `${behaviorScreenings.length} ราย`;
        if (heroCntDepressionEl) heroCntDepressionEl.textContent = `${depressionScreenings.length} ราย`;

        const currentTab = this.currentScreeningTab || 'behavior';
        let targetScreenings = currentTab === 'depression' ? depressionScreenings : behaviorScreenings;

        // If Student role, filter to student's own screening records
        if (user && user.role === 'student') {
            targetScreenings = targetScreenings.filter(s => s.studentId === user.studentId || s.studentId === user.id);
        }

        // Sort latest assessment date first (newest to oldest)
        targetScreenings.sort((a, b) => {
            const timeA = new Date(a.assessedAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.assessedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
        });

        const tableTitleEl = document.getElementById('screening-table-title');
        if (tableTitleEl) {
            tableTitleEl.textContent = currentTab === 'depression' 
                ? 'ประวัติผลการประเมินภาวะซึมเศร้าในวัยรุ่น (PHQ-A)' 
                : 'ประวัติผลการคัดกรองพฤติกรรมเสี่ยง (4 ด้าน)';
        }

        const thead = document.getElementById('table-screenings-head');
        if (thead) {
            if (currentTab === 'depression') {
                thead.innerHTML = `
                    <tr>
                        <th>นักเรียน</th>
                        <th>ระดับภาวะซึมเศร้า (PHQ-A)</th>
                        <th>คะแนนรวม (0-27)</th>
                        <th>คำแนะนำ / การเฝ้าระวัง</th>
                        <th>ครู/ผู้ประเมิน</th>
                        <th>วันที่ประเมิน</th>
                        <th class="teacher-only">จัดการ</th>
                    </tr>
                `;
            } else {
                thead.innerHTML = `
                    <tr>
                        <th>นักเรียน</th>
                        <th>ผลการคัดกรอง</th>
                        <th>คะแนนรวมความเสี่ยง</th>
                        <th>ครู/ผู้ประเมิน</th>
                        <th>วันที่ประเมิน</th>
                        <th class="teacher-only">จัดการ</th>
                    </tr>
                `;
            }
        }

        tbody.innerHTML = '';
        if (targetScreenings.length === 0) {
            const colspan = currentTab === 'depression' ? 7 : 6;
            tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center; color:#64748b; padding: 24px;">ยังไม่มีประวัติ${currentTab === 'depression' ? 'การประเมินภาวะซึมเศร้า (PHQ-A)' : 'การคัดกรองพฤติกรรมเสี่ยง'}</td></tr>`;
            return;
        }

        const depLevelsMap = {
            normal: { label: 'ไม่มีภาวะซึมเศร้า', bg: 'rgba(2,132,199,0.1)', color: '#0284c7', advice: 'ขณะนี้ยังไม่พบภาวะซึมเศร้าที่ชัดเจน' },
            mild: { label: 'มีภาวะซึมเศร้าเล็กน้อย', bg: 'rgba(5,150,105,0.1)', color: '#059669', advice: 'ควรหากิจกรรมที่ช่วยผ่อนคลายอารมณ์ หรือปรึกษาบุคคลใกล้ชิดที่ไว้ใจ' },
            moderate: { label: 'มีภาวะซึมเศร้าปานกลาง', bg: 'rgba(217,119,6,0.1)', color: '#d97706', advice: 'ควรปรึกษาแพทย์ เพื่อวินิจฉัยและบำบัดรักษา' },
            severe_high: { label: 'มีภาวะซึมเศร้ามาก', bg: 'rgba(234,88,12,0.1)', color: '#ea580c', advice: 'ควรปรึกษาแพทย์ เพื่อวินิจฉัยและบำบัดรักษา' },
            severe_extreme: { label: 'มีภาวะซึมเศร้ารุนแรง', bg: 'rgba(225,29,72,0.12)', color: '#e11d48', advice: 'ควรปรึกษาแพทย์ เพื่อวินิจฉัยและบำบัดรักษา' }
        };

        targetScreenings.forEach(scr => {
            const student = students.find(s => s.studentId === scr.studentId || s.id === scr.studentId);
            const tr = document.createElement('tr');

            if (scr.type === 'depression') {
                const depInfo = depLevelsMap[scr.resultLevel] || depLevelsMap.normal;
                const isRisk = scr.extRisk?.isSuicideRisk || (scr.qScores && scr.qScores[8] > 0);
                const needsReferral = scr.resultLevel === 'severe_high' || scr.resultLevel === 'severe_extreme' || isRisk;

                const isReferred = scr.referred === true || allReferrals.some(r => r.screeningId === scr.id || (r.studentId === scr.studentId && new Date(r.createdAt) >= new Date(scr.assessedAt || 0)));

                const riskBadge = isRisk 
                    ? `<br><span class="badge" style="background:rgba(225,29,72,0.15); color:#be123c; border:1px solid #e11d48; font-size:0.75rem; margin-top:4px; font-weight:700;">🚨 เสี่ยงฆ่าตัวตาย/ทำร้ายตนเอง (เฝ้าระวังด่วน)</span>`
                    : '';

                let referralBtn = '';
                if (needsReferral) {
                    if (isReferred) {
                        referralBtn = `<button class="btn btn-success btn-sm" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; font-weight: 700; border: none; box-shadow: 0 2px 8px rgba(16,185,129,0.35); margin-right: 6px; display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 8px; transition: all 0.2s ease;" onclick="app.openReferralForScreening('${scr.id}')" title="ส่งต่อนักเรียนเรียบร้อยแล้ว (คลิกเพื่อแก้ไข/ดูข้อมูล)">
                            <i class="ri-checkbox-circle-fill"></i> ส่งต่อแล้ว
                        </button>`;
                    } else {
                        referralBtn = `<button class="btn btn-warning btn-sm" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; font-weight: 700; border: none; box-shadow: 0 2px 8px rgba(245,158,11,0.35); margin-right: 6px; display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 8px; transition: all 0.2s ease;" onclick="app.openReferralForScreening('${scr.id}')" title="คลิกเพื่อส่งต่อนักเรียนไปยังโรงพยาบาล/พม./ผู้เชี่ยวชาญ">
                            <i class="ri-git-pull-request-line"></i> ส่งต่อ
                        </button>`;
                    }
                }

                tr.innerHTML = `
                    <td><strong>${student ? `${student.prefix || ''}${student.fullName} (${student.grade}/${student.room})` : (user && user.role === 'student' ? user.name : scr.studentId)}</strong></td>
                    <td>
                        <span class="badge" style="background:${depInfo.bg}; color:${depInfo.color}; border:1px solid ${depInfo.color}; font-weight:700; font-size:0.85rem;">
                            ${scr.levelLabel || depInfo.label}
                        </span>
                        ${riskBadge}
                    </td>
                    <td><strong style="color:var(--text-heading); font-size:0.95rem;">${scr.totalScore} / 27</strong></td>
                    <td style="max-width:280px; font-size:0.85rem; color:var(--text-muted); line-height:1.4;">${scr.advice || depInfo.advice}</td>
                    <td>${scr.assessor || '-'}</td>
                    <td>${scr.assessedAt ? new Date(scr.assessedAt).toLocaleDateString('th-TH') : '-'}</td>
                    <td class="teacher-only" style="white-space: nowrap;">
                        ${referralBtn}
                        <button class="btn btn-danger btn-sm" onclick="app.deleteSingleScreening('${scr.id}')"><i class="ri-delete-bin-line"></i> ลบ</button>
                    </td>
                `;
            } else {
                const levelInfo = CONFIG.SCREENING_LEVELS[scr.resultLevel?.toUpperCase()] || CONFIG.SCREENING_LEVELS.NORMAL;
                tr.innerHTML = `
                    <td><strong>${student ? `${student.prefix || ''}${student.fullName} (${student.grade}/${student.room})` : (user && user.role === 'student' ? user.name : scr.studentId)}</strong></td>
                    <td><span class="badge" style="background:${levelInfo.bg}; color:${levelInfo.color}; border:1px solid ${levelInfo.color}; font-weight:600;">${levelInfo.label}</span></td>
                    <td><strong style="color:var(--text-heading);">${scr.totalScore} คะแนน</strong></td>
                    <td>${scr.assessor || '-'}</td>
                    <td>${scr.assessedAt ? new Date(scr.assessedAt).toLocaleDateString('th-TH') : '-'}</td>
                    <td class="teacher-only">
                        <button class="btn btn-danger btn-sm" onclick="app.deleteSingleScreening('${scr.id}')"><i class="ri-delete-bin-line"></i> ลบ</button>
                    </td>
                `;
            }

            tbody.appendChild(tr);
        });

        authManager.applyUIPermissions();
    }

    /**
     * Open Referral Modal prefilled with student depression / high risk assessment data
     */
    openReferralForScreening(screeningId) {
        const screenings = firebaseService.getScreenings();
        const scr = screenings.find(s => s.id === screeningId);
        if (!scr) return;

        const students = firebaseService.getStudents();
        const student = students.find(s => s.studentId === scr.studentId || s.id === scr.studentId);

        this.updateStudentDropdowns();

        const screeningIdInput = document.getElementById('ref-screening-id');
        if (screeningIdInput) {
            screeningIdInput.value = screeningId;
        }

        const studentSelect = document.getElementById('ref-student-select');
        if (studentSelect) {
            studentSelect.value = scr.studentId;
            if (!studentSelect.value && student) {
                studentSelect.value = student.studentId || student.id;
            }
        }

        const refTypeEl = document.getElementById('ref-type');
        if (refTypeEl) {
            refTypeEl.value = 'external'; // Default to external hospital / msdhs referral
        }

        this.updateReferralAgencyOptions('external', 'โรงพยาบาลพนมดงรัก');

        const isRisk = scr.extRisk?.isSuicideRisk || (scr.qScores && scr.qScores[8] > 0);
        let riskText = '';
        if (isRisk) {
            riskText = ' 🚨 [เฝ้าระวังด่วน: มีความเสี่ยงต่อการทำร้ายตนเอง/ฆ่าตัวตาย]';
        }

        const reasonEl = document.getElementById('ref-reason');
        if (reasonEl) {
            reasonEl.value = `ผลการคัดกรองภาวะซึมเศร้า (PHQ-A): ${scr.levelLabel || 'มีความเสี่ยงสูง'} (คะแนนรวม ${scr.totalScore || 0}/27)${riskText}\nคำแนะนำ: ${scr.advice || 'ส่งต่อเพื่อรับการประเมิน วินิจฉัย และบำบัดรักษาทางการแพทย์'}`;
        }

        this.openModal('modal-referral');
    }

    /**
     * Update Agency / Recipient dropdown options based on referral type (internal vs external)
     */
    updateReferralAgencyOptions(type = 'internal', defaultVal = '') {
        const agencySelect = document.getElementById('ref-agency');
        if (!agencySelect) return;

        agencySelect.innerHTML = '';
        let options = [];

        if (type === 'internal') {
            options = [
                { value: 'ครูกิจการนักเรียน', label: '👮 1. ครูกิจการนักเรียน' },
                { value: 'ครูแนะแนว', label: '👩‍🏫 2. ครูแนะแนว' },
                { value: 'ครูนางฟ้า', label: '🧚‍♀️ 3. ครูนางฟ้า' }
            ];
        } else {
            options = [
                { value: 'โรงพยาบาลพนมดงรัก', label: '🏥 1. โรงพยาบาลพนมดงรัก' },
                { value: 'สาธารณสุข', label: '🩺 2. สาธารณสุข' },
                { value: 'พม.', label: '🏛️ 3. พม. (พัฒนาสังคมและความมั่นคงของมนุษย์)' },
                { value: 'สถานีตำรวจ', label: '👮 4. สถานีตำรวจ' }
            ];
        }

        options.forEach((opt, idx) => {
            const optionEl = document.createElement('option');
            optionEl.value = opt.value;
            optionEl.textContent = opt.label;
            if (defaultVal && (defaultVal === opt.value || defaultVal.includes(opt.value))) {
                optionEl.selected = true;
            } else if (!defaultVal && idx === 0) {
                optionEl.selected = true;
            }
            agencySelect.appendChild(optionEl);
        });

        // If custom defaultVal was provided and not matched, add it
        if (defaultVal && !options.some(o => o.value === defaultVal || defaultVal.includes(o.value))) {
            const customOpt = document.createElement('option');
            customOpt.value = defaultVal;
            customOpt.textContent = defaultVal;
            customOpt.selected = true;
            agencySelect.appendChild(customOpt);
        }
    }

    renderMerits() {
        const tbody = document.getElementById('table-merits-body');
        if (!tbody) return;
        let merits = firebaseService.getMerits();
        const students = firebaseService.getStudents();
        const user = authManager.getCurrentUser();

        // If Student role, filter to student's own merit records
        if (user && user.role === 'student') {
            merits = merits.filter(m => m.studentId === user.studentId || m.studentId === user.id);
        }

        // Sort latest merit date first (newest to oldest)
        merits.sort((a, b) => {
            const timeA = new Date(a.recordedDate || a.createdAt || 0).getTime();
            const timeB = new Date(b.recordedDate || b.createdAt || 0).getTime();
            return timeB - timeA;
        });

        tbody.innerHTML = '';
        if (merits.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">ยังไม่มีรายการทำความดี</td></tr>';
            return;
        }

        merits.forEach(m => {
            const student = students.find(s => s.studentId === m.studentId || s.id === m.studentId);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${student ? `${student.prefix || ''}${student.fullName} (${student.grade}/${student.room})` : (user && user.role === 'student' ? user.name : m.studentId)}</td>
                <td><strong style="color:#34d399;">${m.activityName}</strong></td>
                <td>+${m.points} คะแนน</td>
                <td>${m.details || '-'}</td>
                <td>${m.recordedDate}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    renderOffenses() {
        const tbody = document.getElementById('table-offenses-body');
        if (!tbody) return;
        const offenses = firebaseService.getOffenses();

        tbody.innerHTML = '';
        if (offenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding: 24px;">ไม่มีประวัติการกระทำความผิด</td></tr>';
            return;
        }

        // Sort latest offense date first (newest to oldest)
        offenses.sort((a, b) => {
            const timeA = new Date(a.incidentDate || a.createdAt || 0).getTime();
            const timeB = new Date(b.incidentDate || b.createdAt || 0).getTime();
            return timeB - timeA;
        });

        offenses.forEach(off => {
            const levelBadgeClass = `badge-${off.level}`;
            const levelLabel = off.level === 'severe' ? 'ร้ายแรง' : (off.level === 'moderate' ? 'ปานกลาง' : 'เบา');

            const escapedName = (off.studentName || 'นักเรียน').replace(/'/g, "\\'");
            const imageTdHtml = off.imageUrl 
                ? `<div style="display:flex; align-items:center; gap:8px;">
                     <img src="${off.imageUrl}" alt="หลักฐาน" style="width:40px; height:40px; border-radius:8px; object-fit:cover; border:1px solid var(--border-light); cursor:pointer; box-shadow: var(--shadow-sm);" onclick="app.previewImage('${off.imageUrl}', '${escapedName}')" title="คลิกเพื่อขยายดูรูปภาพ">
                     <button class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 0.78rem;" onclick="app.previewImage('${off.imageUrl}', '${escapedName}')"><i class="ri-search-eye-line"></i> ดูรูป</button>
                   </div>`
                : `<span class="text-dim text-sm"><i class="ri-image-off-line"></i> ไม่มีรูป</span>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${off.studentName}</strong> <br><small style="color:var(--text-muted);">${off.gradeRoom || ''}</small></td>
                <td><span class="badge ${levelBadgeClass}">${levelLabel}</span></td>
                <td>${off.category}</td>
                <td>${off.incidentDate || '-'}</td>
                <td>${imageTdHtml}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="app.downloadOffensePDF('${off.id}')"><i class="ri-printer-line"></i> พิมพ์รายงาน / PDF</button>
                    <button class="btn btn-danger btn-sm teacher-only" onclick="app.deleteOffense('${off.id}')"><i class="ri-delete-bin-line"></i> ลบ</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        authManager.applyUIPermissions();
    }

    previewImage(url, title = 'รูปภาพหลักฐาน') {
        if (!url) return;
        const modal = document.getElementById('modal-image-preview');
        const imgEl = document.getElementById('preview-image-src');
        const titleEl = document.getElementById('preview-image-title');
        if (modal && imgEl) {
            imgEl.src = url;
            if (titleEl) {
                titleEl.innerHTML = `<i class="ri-image-line" style="color: var(--indigo-500);"></i> รูปภาพหลักฐาน: ${title}`;
            }
            this.openModal('modal-image-preview');
        } else if (window.Swal) {
            Swal.fire({
                title: `📷 รูปภาพหลักฐาน: ${title}`,
                imageUrl: url,
                imageAlt: title,
                imageWidth: 600,
                imageHeight: 'auto',
                showCloseButton: true,
                showConfirmButton: true,
                confirmButtonText: 'ปิดหน้าต่าง',
                confirmButtonColor: '#4f46e5',
                allowOutsideClick: true,
                allowEscapeKey: true
            });
        } else {
            window.open(url, '_blank');
        }
    }

    async deleteOffense(id) {
        const confirmed = await this.confirmDialog({
            title: 'ยืนยันการลบรายการพฤติกรรม',
            message: 'คุณแน่ใจหรือไม่ว่าต้องการลบรายการกระทำผิดนี้ออกจากระบบ?',
            type: 'danger',
            confirmText: 'ลบรายการ'
        });
        if (confirmed) {
            await firebaseService.deleteOffense(id);
            this.showToast('ลบรายการสำเร็จ', 'success');
        }
    }

    async downloadOffensePDF(id) {
        const offenses = firebaseService.getOffenses();
        const offense = offenses.find(o => o.id === id);
        if (offense) {
            const students = firebaseService.getStudents();
            const student = students.find(s => s.studentId === offense.studentId || s.id === offense.studentId);
            pdfGenerator.generateOffenseReport(offense, student);
        } else {
            this.showAlert('ไม่พบข้อมูล', 'ไม่พบข้อมูลรายการกระทำความผิดที่เลือก', 'error');
        }
    }

    renderReferrals() {
        const tbody = document.getElementById('table-referrals-body');
        if (!tbody) return;
        const allReferrals = firebaseService.getReferrals();
        const students = firebaseService.getStudents();
        const user = authManager.getCurrentUser();

        // 1. Calculate and update Stat Chips & Tab Counters
        const totalCount = allReferrals.length;
        const internalCount = allReferrals.filter(r => r.type === 'internal').length;
        const externalCount = allReferrals.filter(r => r.type !== 'internal').length;
        const pendingCount = allReferrals.filter(r => (r.status || 'pending') === 'pending').length;
        const completedCount = allReferrals.filter(r => r.status === 'completed').length;

        const updateText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        updateText('ref-stat-total', totalCount);
        updateText('ref-stat-internal', internalCount);
        updateText('ref-stat-external', externalCount);
        updateText('ref-stat-pending', pendingCount);
        updateText('ref-stat-completed', completedCount);

        updateText('tab-cnt-all', totalCount);
        updateText('tab-cnt-internal', internalCount);
        updateText('tab-cnt-external', externalCount);
        updateText('tab-cnt-pending', pendingCount);
        updateText('tab-cnt-completed', completedCount);

        // 2. Filter referrals based on active tab and search query
        const activeTab = this.currentRefTab || 'all';
        const searchInput = document.getElementById('ref-search-input');
        const query = (searchInput?.value || '').trim().toLowerCase();

        let filtered = [...allReferrals];

        if (activeTab === 'internal') {
            filtered = filtered.filter(r => r.type === 'internal');
        } else if (activeTab === 'external') {
            filtered = filtered.filter(r => r.type !== 'internal');
        } else if (activeTab === 'pending') {
            filtered = filtered.filter(r => (r.status || 'pending') === 'pending');
        } else if (activeTab === 'completed') {
            filtered = filtered.filter(r => r.status === 'completed');
        }

        if (query) {
            filtered = filtered.filter(r => {
                const sName = (r.studentName || '').toLowerCase();
                const sId = (r.studentId || '').toLowerCase();
                const agency = (r.targetAgency || '').toLowerCase();
                const reason = (r.reason || '').toLowerCase();
                return sName.includes(query) || sId.includes(query) || agency.includes(query) || reason.includes(query);
            });
        }

        // Sort latest referral first (newest to oldest)
        filtered.sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
        });

        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b; padding: 28px;">ไม่พบรายการส่งต่อนักเรียนในหมวดหมู่นี้</td></tr>';
            return;
        }

        filtered.forEach(ref => {
            const student = students.find(s => s.studentId === ref.studentId || s.id === ref.studentId);
            const tr = document.createElement('tr');

            // Format Type Pill
            const isInternal = ref.type === 'internal';
            const typeBadge = isInternal
                ? `<span class="badge badge-internal-pill"><i class="ri-community-line"></i> ส่งต่อภายใน</span>`
                : `<span class="badge badge-external-pill"><i class="ri-hospital-line"></i> ส่งต่อภายนอก</span>`;

            // Format Agency Pill / Icon
            let agencyIcon = isInternal ? '👩‍🏫' : '🏥';
            if (ref.targetAgency?.includes('กิจการนักเรียน') || ref.targetAgency?.includes('ปกครอง')) agencyIcon = '👮';
            else if (ref.targetAgency?.includes('นางฟ้า')) agencyIcon = '🧚‍♀️';
            else if (ref.targetAgency?.includes('แนะแนว')) agencyIcon = '👩‍🏫';
            else if (ref.targetAgency?.includes('โรงพยาบาล') || ref.targetAgency?.includes('รพ')) agencyIcon = '🏥';
            else if (ref.targetAgency?.includes('สาธารณสุข')) agencyIcon = '🩺';
            else if (ref.targetAgency?.includes('พม')) agencyIcon = '🏛️';
            else if (ref.targetAgency?.includes('ตำรวจ')) agencyIcon = '👮';

            const agencyDisplay = `<span style="display:inline-flex; align-items:center; gap:6px; font-weight:600; color:var(--text-heading);">
                <span style="font-size:1.1rem;">${agencyIcon}</span> ${ref.targetAgency || '-'}
            </span>`;

            // Format Reason Box
            const hasUrgentAlert = ref.reason?.includes('🚨') || ref.reason?.includes('เฝ้าระวัง') || ref.reason?.includes('ฆ่าตัวตาย');
            const reasonDisplay = hasUrgentAlert
                ? `<div class="ref-reason-box-alert">${ref.reason}</div>`
                : `<div class="ref-reason-box-normal">${ref.reason}</div>`;

            // History badge if logs exist
            const logsCount = (ref.actionLogs || []).length;
            const historyBadge = logsCount > 0
                ? `<div style="margin-top: 6px;"><button type="button" class="btn btn-sm" style="background: rgba(2,132,199,0.08); border: 1px solid rgba(2,132,199,0.25); color: #0284c7; font-size: 0.76rem; font-weight: 700; padding: 2px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;" onclick="app.openReferralActionModal('${ref.id}')" title="ดูประวัติการดำเนินการทั้งหมด"><i class="ri-history-line"></i> ประวัติการช่วยเหลือ (${logsCount})</button></div>`
                : '';

            // Check permission to process
            const canProcess = this.canUserProcessReferral(user, ref);

            // Format Status Toggle / Action Button
            const isCompleted = ref.status === 'completed';
            let statusDisplay = '';

            if (canProcess) {
                statusDisplay = isCompleted
                    ? `<button class="status-toggle-btn status-completed" onclick="app.openReferralActionModal('${ref.id}')" title="คลิกเพื่อบันทึกหรือดูผลการดำเนินการ"><i class="ri-checkbox-circle-fill"></i> ดำเนินการแล้วเสร็จ <span style="font-size:0.75rem; opacity:0.85;">(คลิก)</span></button>`
                    : `<button class="status-toggle-btn status-pending" onclick="app.openReferralActionModal('${ref.id}')" title="คลิกเพื่อบันทึกวิธีดำเนินการกับเคสนี้"><i class="ri-time-line"></i> รอการดำเนินการ <span style="font-size:0.75rem; opacity:0.85;">(คลิก)</span></button>`;
            } else {
                statusDisplay = isCompleted
                    ? `<button class="status-toggle-btn status-completed" onclick="app.openReferralActionModal('${ref.id}')" style="cursor:pointer;" title="คลิกเพื่อดูประวัติการดำเนินการ"><i class="ri-checkbox-circle-fill"></i> ดำเนินการแล้วเสร็จ</button>`
                    : `<button class="status-toggle-btn" onclick="app.openReferralActionModal('${ref.id}')" style="background:rgba(245,158,11,0.1); color:#b45309; border:1px dashed rgba(245,158,11,0.4); cursor:pointer;" title="เฉพาะ ${ref.targetAgency || 'ผู้รับส่งต่อ'} เท่านั้นที่สามารถกดดำเนินการได้ (คลิกเพื่อดูประวัติ)"><i class="ri-lock-line"></i> รอ ${ref.targetAgency || 'ผู้รับส่งต่อ'} ดำเนินการ</button>`;
            }

            // Format Student Cell
            const studentInfo = student
                ? `<strong>${student.prefix || ''}${student.fullName}</strong><br><small style="color:var(--text-muted); font-size:0.8rem;">${student.grade}/${student.room} • รหัส ${student.studentId || ref.studentId}</small>`
                : `<strong>${ref.studentName || 'นักเรียน'}</strong><br><small style="color:var(--text-muted); font-size:0.8rem;">รหัส ${ref.studentId}</small>`;

            const dateStr = ref.createdAt ? new Date(ref.createdAt).toLocaleDateString('th-TH') : '-';

            tr.innerHTML = `
                <td>${studentInfo}</td>
                <td>${typeBadge}</td>
                <td>${agencyDisplay}</td>
                <td style="max-width: 320px;">${reasonDisplay}${historyBadge}</td>
                <td>${statusDisplay}</td>
                <td style="color:var(--text-muted); font-size:0.85rem;">${dateStr}</td>
                <td class="teacher-only" style="white-space: nowrap;">
                    <button class="btn btn-danger btn-sm" onclick="app.deleteSingleReferral('${ref.id}')" title="ลบรายการส่งต่อ"><i class="ri-delete-bin-line"></i> ลบ</button>
                </td>
            `;

            tbody.appendChild(tr);
        });

        authManager.applyUIPermissions();
    }

    /**
     * Check if the current user has permission to process / update status of a referral case
     */
    canUserProcessReferral(user, ref) {
        if (!user || !ref) return false;
        if (user.role === 'admin') return true;

        const target = (ref.targetAgency || '').toLowerCase();
        const role = user.role;
        const uName = (user.name || '').toLowerCase();
        const uUsername = (user.username || '').toLowerCase();

        // 1. Angel role / name matches
        if (role === 'angel' || uName.includes('นางฟ้า') || uUsername.includes('angel')) {
            if (target.includes('นางฟ้า')) return true;
        }

        // 2. Guidance role / name matches
        if (role === 'guidance' || uName.includes('แนะแนว') || uUsername.includes('guidance')) {
            if (target.includes('แนะแนว')) return true;
        }

        // 3. Hospital role
        if (role === 'hospital') {
            if (target.includes('โรงพยาบาล') || target.includes('สาธารณสุข') || target.includes('รพ')) return true;
        }

        // 4. Police role
        if (role === 'police') {
            if (target.includes('ตำรวจ')) return true;
        }

        // 5. MSDHS (พม.) role
        if (role === 'msdhs') {
            if (target.includes('พม') || target.includes('พัฒนาสังคม')) return true;
        }

        // 6. Teacher / Personnel role if target is general school staff / student affairs
        if (role === 'teacher') {
            if (target.includes('ฝ่ายปกครอง') || target.includes('กิจการนักเรียน') || target.includes('ครูประจำชั้น')) return true;
        }

        return false;
    }

    /**
     * Open Referral Action Modal (for processing action & viewing history)
     */
    openReferralActionModal(refId) {
        const referrals = firebaseService.getReferrals();
        const ref = referrals.find(r => r.id === refId);
        if (!ref) return;

        const students = firebaseService.getStudents();
        const student = students.find(s => s.studentId === ref.studentId || s.id === ref.studentId);
        const user = authManager.getCurrentUser();
        const canProcess = this.canUserProcessReferral(user, ref);

        // Fill hidden ID
        const idInput = document.getElementById('action-ref-id');
        if (idInput) idInput.value = refId;

        // Fill Summary Box
        const summaryBox = document.getElementById('action-ref-summary-box');
        if (summaryBox) {
            const isInternal = ref.type === 'internal';
            summaryBox.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                    <div>
                        <strong style="font-size: 1.05rem; color: #0284c7;">${student ? `${student.prefix || ''}${student.fullName}` : ref.studentName}</strong>
                        <span style="font-size: 0.85rem; color: var(--text-muted); margin-left: 6px;">(${student ? `${student.grade}/${student.room}` : ''} รหัส ${student ? (student.studentId || ref.studentId) : ref.studentId})</span>
                    </div>
                    <span class="badge ${isInternal ? 'badge-internal-pill' : 'badge-external-pill'}">${isInternal ? '🏫 ส่งต่อภายใน' : '🏥 ส่งต่อภายนอก'}</span>
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 6px;">
                    <strong>หน่วยงาน / ผู้รับส่งต่อที่มอบหมาย:</strong> <span style="color: #4f46e5; font-weight: 700;">${ref.targetAgency || '-'}</span>
                </div>
                <div style="font-size: 0.86rem; color: var(--text-muted); background: var(--bg-card); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-light); line-height: 1.4;">
                    <strong>เหตุผลการส่งต่อ:</strong> ${ref.reason}
                </div>
            `;
        }

        // Fill History List
        const historyList = document.getElementById('action-ref-history-list');
        if (historyList) {
            const logs = ref.actionLogs || [];
            if (logs.length === 0) {
                historyList.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); padding: 18px; background: var(--bg-card); border-radius: 12px; border: 1px dashed var(--border-light); font-size: 0.88rem;">
                        <i class="ri-history-line" style="font-size: 1.6rem; display: block; margin-bottom: 4px; color: var(--text-dim);"></i>
                        ยังไม่มีบันทึกประวัติการดำเนินการช่วยเหลือสำหรับเคสนี้
                    </div>
                `;
            } else {
                historyList.innerHTML = logs.map(log => {
                    const isComp = log.status === 'completed';
                    const statusBadge = isComp
                        ? `<span class="badge" style="background: rgba(16,185,129,0.15); color: #047857; font-size: 0.76rem; font-weight: 700; border-radius: 6px; padding: 2px 8px;"><i class="ri-checkbox-circle-fill"></i> ดำเนินการแล้วเสร็จ</span>`
                        : `<span class="badge" style="background: rgba(245,158,11,0.15); color: #b45309; font-size: 0.76rem; font-weight: 700; border-radius: 6px; padding: 2px 8px;"><i class="ri-time-line"></i> กำลังดำเนินการ</span>`;
                    const dateStr = log.actionDate ? new Date(log.actionDate).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

                    return `
                        <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-left: 4px solid ${isComp ? '#10b981' : '#f59e0b'}; border-radius: 10px; padding: 12px 14px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
                                <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-heading); display: flex; align-items: center; gap: 6px;">
                                    <span>👤 ${log.actionBy}</span>
                                    <span style="font-weight: 400; color: var(--text-muted); font-size: 0.8rem;">(${log.actionRole || 'ผู้ดำเนินการ'})</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    ${statusBadge}
                                    <span style="font-size: 0.78rem; color: var(--text-muted);"><i class="ri-calendar-line"></i> ${dateStr}</span>
                                </div>
                            </div>
                            <div style="font-size: 0.88rem; color: var(--text-body); line-height: 1.45; white-space: pre-wrap;">${log.notes}</div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Toggle New Action Form vs Readonly notice based on permission
        const inputSection = document.getElementById('action-ref-input-section');
        const readonlyNotice = document.getElementById('action-ref-readonly-notice');
        const readonlyText = document.getElementById('action-ref-readonly-text');
        const btnSave = document.getElementById('btn-save-referral-action');

        if (canProcess) {
            if (inputSection) inputSection.style.display = 'block';
            if (readonlyNotice) readonlyNotice.style.display = 'none';
            if (btnSave) btnSave.style.display = '';

            const statusSelect = document.getElementById('action-ref-status');
            if (statusSelect) statusSelect.value = ref.status || 'pending';

            const notesInput = document.getElementById('action-ref-notes');
            if (notesInput) notesInput.value = '';

            const byInput = document.getElementById('action-ref-by');
            if (byInput) byInput.value = `${user?.name || 'ผู้รับส่งต่อ'} (${user?.roleTitle || user?.role || 'เจ้าหน้าที่'})`;
        } else {
            if (inputSection) inputSection.style.display = 'none';
            if (readonlyNotice) {
                readonlyNotice.style.display = 'flex';
                if (readonlyText) {
                    readonlyText.innerHTML = `🔒 คุณกำลังเปิดดูข้อมูลเคสนี้ใน<strong>โหมดดูข้อมูล</strong> (เฉพาะ <strong>${ref.targetAgency || 'ผู้รับส่งต่อ'}</strong> เท่านั้นที่สามารถกดดำเนินการและเปลี่ยนสถานะเคสนี้ได้)`;
                }
            }
            if (btnSave) btnSave.style.display = 'none';
        }

        this.openModal('modal-referral-action');
    }

    switchReferralFilterTab(tabName = 'all') {
        this.currentRefTab = tabName;
        document.querySelectorAll('.referral-tab-btn').forEach(btn => {
            if (btn.getAttribute('data-ref-tab') === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        this.renderReferrals();
    }

    openDirectReferralModal(type = 'internal') {
        const refTypeEl = document.getElementById('ref-type');
        if (refTypeEl) refTypeEl.value = type;
        this.updateReferralAgencyOptions(type);
        const screeningIdInput = document.getElementById('ref-screening-id');
        if (screeningIdInput) screeningIdInput.value = '';
        this.openModal('modal-referral');
    }

    async toggleReferralStatus(refId, newStatus) {
        const referrals = firebaseService.getReferrals();
        const ref = referrals.find(r => r.id === refId);
        if (!ref) return;

        ref.status = newStatus;
        await firebaseService.saveReferral(ref);
        this.showToast(newStatus === 'completed' ? 'อัปเดตสถานะเป็น "ดำเนินการแล้วเสร็จ" ✅' : 'อัปเดตสถานะเป็น "รอการดำเนินการ" ⏳', 'info');
        this.renderReferrals();
    }

    async deleteSingleReferral(refId) {
        const confirmed = await this.confirmDialog({
            title: 'ยืนยันการลบรายการส่งต่อ',
            message: 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลการส่งต่อนักเรียนรายการนี้? การกระทำนี้ไม่สามารถย้อนกลับได้',
            type: 'danger',
            confirmText: 'ลบข้อมูล',
            cancelText: 'ยกเลิก'
        });
        if (!confirmed) return;

        await firebaseService.deleteReferral(refId);
        this.showToast('ลบรายการส่งต่อนักเรียนเรียบร้อยแล้ว', 'success');
        this.renderReferrals();
        this.renderScreenings();
    }

    renderActivitiesList() {
        const listEl = document.getElementById('activities-catalog-list');
        if (!listEl) return;
        const activities = firebaseService.getActivities();
        listEl.innerHTML = '';
        activities.forEach(a => {
            const div = document.createElement('div');
            div.className = 'glass-panel';
            div.style.marginBottom = '12px';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="color:#38bdf8; font-size:1.1rem;">${a.name}</strong>
                        <div style="font-size:0.85rem; color:#94a3b8;">หมวดหมู่: ${a.category}</div>
                    </div>
                    <span class="badge badge-normal">+${a.points} คะแนน</span>
                </div>
            `;
            listEl.appendChild(div);
        });
    }

    // --- Standalone Login Helpers ---
    setLoginRole(role) {
        document.getElementById('page-login-role').value = role;
        const pills = {
            teacher: document.getElementById('role-pill-teacher'),
            student: document.getElementById('role-pill-student'),
            admin: document.getElementById('role-pill-admin')
        };

        Object.keys(pills).forEach(r => {
            if (pills[r]) {
                if (r === role) pills[r].classList.add('active');
                else pills[r].classList.remove('active');
            }
        });

        const userLabel = document.getElementById('page-login-user-label');
        const passLabel = document.getElementById('page-login-pass-label');
        const usernameInput = document.getElementById('page-login-user');
        const passwordInput = document.getElementById('page-login-pass');
        const hintText = document.getElementById('login-role-hint-text');

        if (role === 'teacher') {
            if (userLabel) userLabel.innerHTML = '<i class="ri-phone-line" style="color: #0284c7;"></i> เบอร์โทรศัพท์ (ชื่อผู้ใช้)';
            if (passLabel) passLabel.innerHTML = '<i class="ri-lock-2-line" style="color: #0284c7;"></i> รหัสผ่าน (เบอร์โทรศัพท์)';
            if (usernameInput) { usernameInput.placeholder = 'กรอกเบอร์โทรศัพท์ (เช่น 0812345678)...'; usernameInput.value = ''; }
            if (passwordInput) { passwordInput.placeholder = 'กรอกเบอร์โทรศัพท์ซ้ำอีกครั้ง...'; passwordInput.value = ''; }
            if (hintText) hintText.innerHTML = 'สำหรับครู: กรอกเบอร์โทรศัพท์เป็นทั้งชื่อผู้ใช้และรหัสผ่านในการเข้าใช้งาน';
        } else if (role === 'student') {
            if (userLabel) userLabel.innerHTML = '<i class="ri-id-card-line" style="color: #0284c7;"></i> รหัสประจำตัวนักเรียน (ชื่อผู้ใช้)';
            if (passLabel) passLabel.innerHTML = '<i class="ri-lock-2-line" style="color: #0284c7;"></i> รหัสผ่าน (รหัสประจำตัวนักเรียน)';
            if (usernameInput) { usernameInput.placeholder = 'กรอกรหัสประจำตัวนักเรียน (เช่น 67001)...'; usernameInput.value = ''; }
            if (passwordInput) { passwordInput.placeholder = 'กรอกรหัสประจำตัวนักเรียนซ้ำอีกครั้ง...'; passwordInput.value = ''; }
            if (hintText) hintText.innerHTML = 'สำหรับนักเรียน: กรอกรหัสประจำตัวนักเรียนเป็นทั้งชื่อผู้ใช้และรหัสผ่านในการเข้าใช้งาน';
        } else if (role === 'admin') {
            if (userLabel) userLabel.innerHTML = '<i class="ri-user-shield-line" style="color: #0284c7;"></i> ชื่อผู้ใช้ผู้ดูแลระบบ (Admin Username)';
            if (passLabel) passLabel.innerHTML = '<i class="ri-lock-2-line" style="color: #0284c7;"></i> รหัสผ่าน (Password)';
            if (usernameInput) { usernameInput.placeholder = 'admin'; usernameInput.value = 'admin'; }
            if (passwordInput) { passwordInput.placeholder = '••••••••'; passwordInput.value = 'admin123'; }
            if (hintText) hintText.innerHTML = 'สำหรับผู้ดูแลระบบ: กรอก Username (admin) และ Password (admin123)';
        }
    }

    togglePasswordVisibility(inputId, btn) {
        const input = document.getElementById(inputId);
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = '<i class="ri-eye-off-line"></i>';
        } else {
            input.type = 'password';
            btn.innerHTML = '<i class="ri-eye-line"></i>';
        }
    }
    // --- User Accounts Seed Data & Methods ---
    checkAndLoadUserSeedData() {
        // Preserves all server user accounts from Firebase Cloud
    }

    renderUserList() {
        const tbody = document.getElementById('table-users-body');
        if (!tbody) return;

        const users = firebaseService.getUsers();
        tbody.innerHTML = '';

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">ไม่มีข้อมูลผู้ใช้งานระบบ</td></tr>';
            return;
        }

        users.forEach(u => {
            const tr = document.createElement('tr');
            let roleBadge = 'badge-normal';
            let roleTitle = '👨‍🏫 ครู / บุคลากร';

            if (u.role === 'admin') {
                roleBadge = 'badge-risk';
                roleTitle = '🛡️ ผู้ดูแลระบบ';
            } else if (u.role === 'student') {
                roleBadge = 'badge-minor';
                roleTitle = '🎓 นักเรียน';
            } else if (u.role === 'guidance') {
                roleBadge = 'badge-normal';
                roleTitle = '👩‍🏫 ครูแนะแนว';
            } else if (u.role === 'angel') {
                roleBadge = 'badge-minor';
                roleTitle = '🧚‍♀️ ครูนางฟ้า';
            } else if (u.role === 'hospital') {
                roleBadge = 'badge-normal';
                roleTitle = '🏥 โรงพยาบาล';
            } else if (u.role === 'police') {
                roleBadge = 'badge-risk';
                roleTitle = '👮 สถานีตำรวจ';
            } else if (u.role === 'msdhs') {
                roleBadge = 'badge-moderate';
                roleTitle = '🏛️ พม. (พัฒนาสังคมฯ)';
            } else {
                roleBadge = 'badge-normal';
                roleTitle = '👨‍🏫 ครู / บุคลากร';
            }

            tr.innerHTML = `
                <td><strong style="color:#0284c7;">${u.username}</strong></td>
                <td>${u.fullName}</td>
                <td><span class="badge ${roleBadge}">${roleTitle}</span></td>
                <td><code style="background:#f1f5f9; padding:4px 8px; border-radius:6px; font-weight:700; color:#e11d48;">${u.password || '******'}</code></td>
                <td><span class="badge badge-normal"><i class="ri-checkbox-circle-line"></i> ใช้งานอยู่</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="app.editUser('${u.id}')"><i class="ri-edit-line"></i> แก้ไข</button>
                    <button class="btn btn-danger btn-sm" onclick="app.deleteUser('${u.id}')"><i class="ri-delete-bin-line"></i> ลบ</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        authManager.applyUIPermissions();
    }

    editUser(id) {
        const users = firebaseService.getUsers();
        const user = users.find(u => u.id === id);
        if (user) {
            document.getElementById('usr-id-input').value = user.id;
            document.getElementById('usr-username').value = user.username || '';
            document.getElementById('usr-fullname').value = user.fullName || '';
            document.getElementById('usr-role').value = user.role || 'teacher';
            document.getElementById('usr-password').value = user.password || '';
            this.openModal('modal-user-account');
        }
    }

    async deleteUser(id) {
        const confirmed = await this.confirmDialog({
            title: 'ยืนยันการลบบัญชีผู้ใช้งาน',
            message: 'คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีผู้ใช้และรหัสผ่านนี้ออกจากระบบ?',
            type: 'danger',
            confirmText: 'ลบบัญชีผู้ใช้'
        });
        if (confirmed) {
            await firebaseService.deleteUser(id);
            this.showToast('ลบบัญชีผู้ใช้เรียบร้อยแล้ว 🔑', 'success');
        }
    }

    exportBackupJSON() {
        const backupData = {
            exportDate: new Date().toISOString(),
            system: 'งานกิจการนักเรียนโรงเรียนพนมดงรักวิทยา',
            version: '2026.1.0',
            students: firebaseService.getStudents(),
            teachers: firebaseService.getTeachers(),
            users: firebaseService.getUsers(),
            screenings: firebaseService.getScreenings(),
            merits: firebaseService.getMerits(),
            offenses: firebaseService.getOffenses(),
            referrals: firebaseService.getReferrals()
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup_prcare_system_${new Date().toISOString().slice(0,10)}.json`;
        link.click();
    }

    async clearCache() {
        const confirmed = await this.confirmDialog({
            title: 'ยืนยันการล้างแคชระบบ',
            message: 'คุณต้องการล้างแคชเครื่อง LocalStorage ทั้งหมดใช่หรือไม่? (ระบบจะซิงค์ข้อมูลใหม่จากคลาวด์)',
            type: 'warning',
            confirmText: 'ล้างแคชเครื่อง'
        });
        if (confirmed) {
            localStorage.clear();
            await this.showAlert('ล้างแคชเรียบร้อย', 'ล้างแคชเครื่องเรียบร้อยแล้ว กำลังโหลดข้อมูลใหม่...', 'success');
            window.location.reload();
        }
    }

    // --- Dynamic System Version Control ---
    getVersion() {
        return CONFIG.VERSION || (CONFIG.SYSTEM_VERSION ? `v${CONFIG.SYSTEM_VERSION}` : 'v1.4');
    }

    setVersion(newVer) {
        CONFIG.VERSION = newVer;
        this.updateVersionUI();
    }

    updateVersionUI() {
        const ver = this.getVersion();
        const formattedVer = ver.startsWith('(') ? ver : `(${ver})`;
        ['app-sidebar-version', 'app-login-version', 'app-login-banner-version'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = formattedVer;
        });
    }

    incrementVersion() {
        const current = this.getVersion();
        const clean = current.replace(/^v/i, '');
        const parts = clean.split('.');
        let major = parseInt(parts[0]) || 1;
        let minor = parseInt(parts[1]) || 0;
        minor += 1;
        const newVer = `v${major}.${minor}`;
        this.setVersion(newVer);
        return newVer;
    }

    // --- Screening Deletion Handlers (Single / Scope / All) ---
    async deleteSingleScreening(id) {
        const confirmed = await this.confirmDialog({
            title: '🗑️ ยืนยันการลบผลการประเมิน',
            message: 'คุณแน่ใจหรือไม่ว่าต้องการลบผลการประเมินรายการนี้ออกจากระบบ? การดำเนินการนี้จะไม่สามารถย้อนกลับได้',
            type: 'danger',
            confirmText: 'ลบรายการนี้'
        });
        if (confirmed) {
            await firebaseService.deleteScreening(id);
            this.showAlert('ลบข้อมูลสำเร็จ 🎉', 'ลบผลการประเมินรายการที่เลือกเรียบร้อยแล้ว', 'success');
        }
    }

    openDeleteScreeningModal() {
        this.updateDeleteScreeningScopeSummary();
        this.openModal('modal-delete-screening-scope');
    }

    updateDeleteScreeningScopeSummary() {
        const type = document.getElementById('del-scr-type')?.value || 'all';
        const grade = document.getElementById('del-scr-grade')?.value || 'all';
        const room = document.getElementById('del-scr-room')?.value || 'all';

        const allStudents = firebaseService.getStudents();
        const screenings = firebaseService.getScreenings();

        const targets = screenings.filter(s => {
            if (type !== 'all' && s.type !== type) return false;

            let sGrade = s.grade || s.studentGrade || '';
            let sRoom = s.room || s.studentRoom || '';
            if (!sGrade || !sRoom) {
                const stu = allStudents.find(st => (st.studentId || st.id) === s.studentId);
                if (stu) {
                    if (!sGrade) sGrade = stu.grade || '';
                    if (!sRoom) sRoom = stu.room || '';
                }
            }

            if (grade !== 'all' && sGrade !== grade && !sGrade.startsWith(grade)) return false;
            if (room !== 'all' && sRoom !== room && sRoom !== `ห้อง ${room}` && sRoom !== room.toString()) return false;

            return true;
        });

        const summaryEl = document.getElementById('del-scr-scope-summary');
        if (summaryEl) {
            const typeLabel = type === 'behavior' ? 'เฉพาะคัดกรอง 4 ด้าน' : type === 'depression' ? 'เฉพาะ PHQ-A' : 'ทุกประเภท';
            const gradeLabel = grade === 'all' ? 'ทุกระดับชั้น' : grade;
            const roomLabel = room === 'all' ? 'ทุกห้องเรียน' : `ห้อง ${room}`;
            summaryEl.innerHTML = `พบผลการประเมินที่เข้าเงื่อนไข (${typeLabel} \| ${gradeLabel} \| ${roomLabel}): <strong style="color:#e11d48; font-size:1.1rem;">${targets.length}</strong> รายการ`;
        }
    }

    async confirmDeleteScreeningScope() {
        const type = document.getElementById('del-scr-type')?.value || 'all';
        const grade = document.getElementById('del-scr-grade')?.value || 'all';
        const room = document.getElementById('del-scr-room')?.value || 'all';

        const gradeLabel = grade === 'all' ? 'ทุกระดับชั้น' : grade;
        const roomLabel = room === 'all' ? 'ทุกห้องเรียน' : `ห้อง ${room}`;
        const typeLabel = type === 'behavior' ? 'คัดกรองพฤติกรรมเสี่ยง 4 ด้าน' : type === 'depression' ? 'ภาวะซึมเศร้า (PHQ-A)' : 'ทั้งหมดทุกประเภท';

        const confirmed = await this.confirmDialog({
            title: '⚠️ ยืนยันการลบผลการประเมินตามขอบเขต',
            message: `คุณแน่ใจหรือไม่ว่าต้องการลบผลการประเมิน (${typeLabel}) ของระดับชั้น [${gradeLabel} ${roomLabel}]? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
            type: 'danger',
            confirmText: 'ยืนยันลบตามขอบเขต'
        });

        if (confirmed) {
            const count = await firebaseService.deleteScreeningsScope({ type, grade, room });
            this.closeModal('modal-delete-screening-scope');
            this.showAlert('ลบข้อมูลสำเร็จ 🎉', `ลบผลการประเมินตามขอบเขตสำเร็จจำนวน ${count} รายการ`, 'success');
        }
    }

    async confirmDeleteAllScreenings() {
        const type = document.getElementById('del-scr-type')?.value || 'all';
        const typeLabel = type === 'behavior' ? 'คัดกรองพฤติกรรมเสี่ยง 4 ด้าน' : type === 'depression' ? 'ภาวะซึมเศร้า (PHQ-A)' : 'ทั้งหมดทุกประเภท';

        const confirmed = await this.confirmDialog({
            title: '🚨 ยืนยันการลบผลการประเมินทั้งหมดในระบบ',
            message: `คำเตือน: คุณแน่ใจหรือไม่ว่าต้องการลบผลการประเมิน [${typeLabel}] ของนักเรียนทุกระดับชั้นทั้งหมดในระบบ?`,
            type: 'danger',
            confirmText: 'ลบผลการประเมินทั้งหมด'
        });

        if (confirmed) {
            const count = await firebaseService.deleteAllScreenings(type);
            this.closeModal('modal-delete-screening-scope');
            this.showAlert('ลบข้อมูลสำเร็จ 🎉', `ลบผลการประเมินทั้งหมดในระบบเรียบร้อยแล้ว (${count} รายการ)`, 'success');
        }
    }

    // --- Custom Confirmation Dialog Helper ---
    confirmDialog({ title, message, type = 'danger', confirmText = 'ยืนยัน', cancelText = 'ยกเลิก' }) {
        return new Promise((resolve) => {
            const modal = document.getElementById('modal-confirm-dialog');
            const iconWrapper = document.getElementById('confirm-dialog-icon');
            const iconI = document.getElementById('confirm-dialog-icon-i');
            const titleEl = document.getElementById('confirm-dialog-title');
            const msgEl = document.getElementById('confirm-dialog-message');
            const btnCancel = document.getElementById('confirm-dialog-btn-cancel');
            const btnOk = document.getElementById('confirm-dialog-btn-ok');

            if (!modal) {
                resolve(window.confirm(`${title}\n\n${message}`));
                return;
            }

            if (titleEl) titleEl.textContent = title || 'ยืนยันการทำรายการ';
            if (msgEl) msgEl.innerHTML = message || 'คุณต้องการดำเนินการนี้ใช่หรือไม่?';

            if (iconWrapper) iconWrapper.className = `confirm-icon-wrapper ${type}`;
            if (iconI) {
                if (type === 'danger') iconI.className = 'ri-error-warning-line';
                else if (type === 'warning') iconI.className = 'ri-alert-line';
                else iconI.className = 'ri-question-line';
            }

            if (btnOk) {
                btnOk.className = `btn btn-${type === 'info' ? 'primary' : type === 'warning' ? 'warning' : 'danger'}`;
                btnOk.innerHTML = `<i class="ri-checkbox-circle-line"></i> ${confirmText}`;
            }

            if (btnCancel) {
                btnCancel.innerHTML = `<i class="ri-close-line"></i> ${cancelText}`;
            }

            this.openModal('modal-confirm-dialog');

            const cleanup = () => {
                btnOk?.removeEventListener('click', handleOk);
                btnCancel?.removeEventListener('click', handleCancel);
                modal?.removeEventListener('click', handleOverlayClick);
            };

            const handleOk = (e) => {
                if (e) e.preventDefault();
                cleanup();
                this.closeModal('modal-confirm-dialog');
                resolve(true);
            };

            const handleCancel = (e) => {
                if (e) e.preventDefault();
                cleanup();
                this.closeModal('modal-confirm-dialog');
                resolve(false);
            };

            const handleOverlayClick = (e) => {
                if (e.target === modal) {
                    handleCancel(e);
                }
            };

            btnOk?.addEventListener('click', handleOk);
            btnCancel?.addEventListener('click', handleCancel);
            modal?.addEventListener('click', handleOverlayClick);
        });
    }

    // --- Modern Custom Popup Alerts & Toasts ---
    showAlert(title, message = '', type = 'success') {
        if (window.Swal) {
            const iconMap = {
                success: 'success',
                error: 'error',
                warning: 'warning',
                info: 'info',
                danger: 'error'
            };
            const btnColorMap = {
                success: '#059669',
                error: '#e11d48',
                warning: '#d97706',
                info: '#0284c7',
                danger: '#be123c'
            };
            return Swal.fire({
                title: title,
                html: message,
                icon: iconMap[type] || 'info',
                confirmButtonText: 'ตกลง',
                confirmButtonColor: btnColorMap[type] || '#be123c',
                allowOutsideClick: true,
                allowEscapeKey: true
            });
        } else {
            alert(`${title}\n${message}`);
        }
    }

    showToast(title, type = 'success') {
        if (window.Swal) {
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.addEventListener('mouseenter', Swal.stopTimer);
                    toast.addEventListener('mouseleave', Swal.resumeTimer);
                }
            });
            Toast.fire({
                icon: type === 'danger' ? 'error' : type,
                title: title
            });
        } else {
            console.log(`[Toast] ${type}: ${title}`);
        }
    }

    async confirmLogout() {
        if (window.Swal) {
            const result = await Swal.fire({
                title: '🚪 ยืนยันการออกจากระบบ',
                text: 'คุณต้องการออกจากระบบ PR Care+ ใช่หรือไม่?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'ออกจากระบบ',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#e11d48',
                cancelButtonColor: '#64748b',
                reverseButtons: true,
                allowOutsideClick: true,
                allowEscapeKey: true
            });
            if (result.isConfirmed) {
                authManager.logout();
                this.showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
                this.switchPage('dashboard');
            }
        } else {
            const confirmed = confirm('คุณต้องการออกจากระบบใช่หรือไม่?');
            if (confirmed) {
                authManager.logout();
                this.switchPage('dashboard');
            }
        }
    }
}

const app = new Application();
window.app = app;
