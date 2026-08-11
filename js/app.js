/**
 * ระบบดูแลช่วยเหลือนักเรียน - Main Application Controller
 * Handles Navigation, Charts, Modals, Event Handlers, and Seed Data
 */

class Application {
    constructor() {
        this.charts = {};
        this.currentView = 'dashboard';
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
        const validThemes = ['indigo', 'ruby', 'ocean', 'emerald', 'amethyst'];
        if (!validThemes.includes(themeId)) themeId = 'indigo';
        document.body.dataset.theme = themeId;
        // Update active state on theme picker if it's rendered
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
                timerProgressBar: true
            });
        }
    }

    renderThemePicker() {
        const container = document.getElementById('theme-picker-container');
        if (!container) return;
        const currentTheme = (firebaseService.getSettings() || {}).theme || 'indigo';
        container.innerHTML = Object.values(CONFIG.THEMES).map(t => `
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
        `).join('');
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

        // Form Standalone Login Submit
        document.getElementById('standalone-login-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const role = document.getElementById('page-login-role').value;
            const username = document.getElementById('page-login-user').value;
            const password = document.getElementById('page-login-pass').value;

            const success = await authManager.login(role, username, password);
            if (success) {
                document.getElementById('login-screen-view')?.classList.add('hidden');
                console.log(`[App] Logged in successfully as ${role}`);
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
                const countMsg = fileInput.files.length > 1 
                    ? `นำเข้าข้อมูลนักเรียนจาก ${fileInput.files.length} ไฟล์ สำเร็จรวมทั้งหมด ${parsed.length} คน 🎉`
                    : `นำเข้าข้อมูลนักเรียนสำเร็จจำนวน ${parsed.length} คน 🎉`;
                this.showAlert('นำเข้าข้อมูลสำเร็จ 🎉', countMsg, 'success');
            } catch (err) {
                this.showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถอ่านไฟล์ CSV ได้: ' + err.message, 'error');
            }
        });

        // Screening Form Submit
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
        });
        document.getElementById('btn-open-screening')?.addEventListener('click', () => {
            const user = authManager.getCurrentUser();
            const select = document.getElementById('screening-student-select');
            if (select) {
                if (user && user.role === 'student') {
                    select.value = user.studentId;
                    select.disabled = true; // ล็อกไม่ให้เลือกนักเรียนคนอื่นเมื่อประเมินตนเอง
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
                referralType: document.getElementById('offense-referral').value,
                imageUrl: imageUrl,
                recordedBy: authManager.getCurrentUser()?.name || 'ครูกิจการนักเรียน'
            };

            await firebaseService.saveOffense(offense);

            // If referral selected, create referral record automatically
            if (offense.referralType !== 'none') {
                await firebaseService.saveReferral({
                    studentId: offense.studentId,
                    studentName: offense.studentName,
                    type: offense.referralType,
                    reason: `กระทำความผิดระดับ ${offense.level}: ${offense.category}`,
                    status: 'pending',
                    targetAgency: offense.referralType === 'internal' ? 'ครูแนะแนว/ฝ่ายปกครอง' : 'สถานีตำรวจ/สาธารณสุข'
                });
            }

            this.closeModal('modal-offense');
            this.showToast('บันทึกข้อมูลการกระทำผิดเรียบร้อยแล้ว 🚨', 'success');
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

        // Referral Form Submit
        document.getElementById('btn-open-referral')?.addEventListener('click', () => this.openModal('modal-referral'));
        document.getElementById('form-referral')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const studentId = document.getElementById('ref-student-select').value;
            const students = firebaseService.getStudents();
            const student = students.find(s => s.studentId === studentId || s.id === studentId);

            const referral = {
                studentId: student ? student.studentId : studentId,
                studentName: student ? student.fullName : 'นักเรียน',
                type: document.getElementById('ref-type').value,
                targetAgency: document.getElementById('ref-agency').value.trim(),
                reason: document.getElementById('ref-reason').value.trim(),
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            await firebaseService.saveReferral(referral);
            this.closeModal('modal-referral');
            this.showToast('บันทึกการส่งต่อนักเรียนเรียบร้อยแล้ว 🕊️', 'success');
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

        // 1. Calculate Screening Metrics & Percentages
        const totalScreened = screenings.length || 1;
        const normalCount = screenings.filter(s => s.resultLevel === 'normal').length;
        const riskCount = screenings.filter(s => s.resultLevel === 'risk').length;
        const problemCount = screenings.filter(s => s.resultLevel === 'problem').length;

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
            students = students.filter(s => s.grade === gradeFilter || (s.grade && s.grade.startsWith(gradeFilter)));
        }
        if (roomFilter) {
            students = students.filter(s => s.room === roomFilter || s.room === `ห้อง ${roomFilter}`);
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

    renderScreenings() {
        const tbody = document.getElementById('table-screenings-body');
        if (!tbody) return;
        let screenings = firebaseService.getScreenings();
        const students = firebaseService.getStudents();
        const user = authManager.getCurrentUser();

        // If Student role, filter to student's own screening records
        if (user && user.role === 'student') {
            screenings = screenings.filter(s => s.studentId === user.studentId || s.studentId === user.id);
        }

        tbody.innerHTML = '';
        if (screenings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">ยังไม่มีผลการคัดกรองพฤติกรรม</td></tr>';
            return;
        }

        screenings.forEach(scr => {
            const student = students.find(s => s.studentId === scr.studentId || s.id === scr.studentId);
            const levelInfo = CONFIG.SCREENING_LEVELS[scr.resultLevel.toUpperCase()] || CONFIG.SCREENING_LEVELS.NORMAL;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${student ? `${student.prefix || ''}${student.fullName} (${student.grade}/${student.room})` : (user && user.role === 'student' ? user.name : scr.studentId)}</td>
                <td><span class="badge" style="background:${levelInfo.bg}; color:${levelInfo.color}; border:1px solid ${levelInfo.color};">${levelInfo.label}</span></td>
                <td>${scr.totalScore} คะแนน</td>
                <td>${scr.assessor}</td>
                <td>${new Date(scr.assessedAt).toLocaleDateString('th-TH')}</td>
            `;
            tbody.appendChild(tr);
        });
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
        if (window.Swal) {
            Swal.fire({
                title: `📷 รูปภาพหลักฐาน: ${title}`,
                imageUrl: url,
                imageAlt: title,
                imageWidth: 640,
                imageHeight: 'auto',
                showCloseButton: true,
                confirmButtonText: '<i class="ri-check-line"></i> ปิดหน้าต่าง',
                confirmButtonColor: '#4f46e5',
                customClass: {
                    popup: 'swal2-popup'
                }
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
        const referrals = firebaseService.getReferrals();

        tbody.innerHTML = '';
        if (referrals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">ไม่มีรายการส่งต่อ</td></tr>';
            return;
        }

        referrals.forEach(ref => {
            const typeLabel = ref.type === 'internal' ? 'ส่งต่อภายใน' : 'ส่งต่อภายนอก';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${ref.studentName}</strong></td>
                <td><span class="badge badge-minor">${typeLabel}</span></td>
                <td>${ref.targetAgency || '-'}</td>
                <td>${ref.reason}</td>
                <td><span class="badge badge-risk">${ref.status === 'pending' ? 'รอการดำเนินการ' : 'เสร็จสิ้น'}</span></td>
            `;
            tbody.appendChild(tr);
        });
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

        const usernameInput = document.getElementById('page-login-user');
        if (usernameInput) {
            if (role === 'teacher') usernameInput.value = 'teacher1';
            else if (role === 'student') usernameInput.value = 'student1';
            else if (role === 'admin') usernameInput.value = 'admin';
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
        const users = firebaseService.getUsers();
        if (!users || users.length === 0) {
            console.log('[App] Seeding initial User Accounts with Passwords...');
            const defaultUsers = [
                { id: 'USR_ADMIN_01', username: 'admin', fullName: 'ผู้ดูแลระบบ (Admin)', role: 'admin', password: 'admin123', createdAt: new Date().toISOString() },
                { id: 'USR_TEACHER_01', username: 'teacher1', fullName: 'ครูกิจการนักเรียน', role: 'teacher', password: 'teacher123', createdAt: new Date().toISOString() },
                { id: 'USR_STUDENT_01', username: 'student1', fullName: 'นักเรียน', role: 'student', password: '123456', createdAt: new Date().toISOString() }
            ];
            firebaseService.saveUsersBatch(defaultUsers);
        }
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
            let roleTitle = 'ครู / บุคลากร';

            if (u.role === 'admin') {
                roleBadge = 'badge-risk';
                roleTitle = '🛡️ ผู้ดูแลระบบ';
            } else if (u.role === 'student') {
                roleBadge = 'badge-minor';
                roleTitle = '🎓 นักเรียน';
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
            if (msgEl) msgEl.textContent = message || 'คุณต้องการดำเนินการนี้ใช่หรือไม่?';

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
                customClass: {
                    popup: 'swal2-popup'
                }
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
                customClass: {
                    popup: 'swal2-popup'
                }
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
