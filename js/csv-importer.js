/**
 * ระบบดูแลช่วยเหลือนักเรียน - CSV Importer & Exporter Module
 * Parses CSV student records (ม.1-ม.6, ปวช.1-ปวช.3) and exports templates
 */

class CSVImporter {
    constructor() {
        this.sampleTemplateHeaders = "เลขที่,รหัสประจำตัว,ชื่อ-สกุล,ระดับชั้น,ครูที่ปรึกษา\n";
        this.sampleRows = [
            "1,09537,นายจิระ เพชรไพทูรย์,ม.1/3,นายจาตุรน ศรีละพันธ์\n",
            "2,09538,นางสาวสมหญิง สุขใจ,ม.1/3,นายจาตุรน ศรีละพันธ์\n",
            "3,09539,นายสมชาย สายชล,ม.2/1,นางสาวสมศรี ใจดี\n",
            "4,09540,นายวิชัย ดีเลิศ,ปวช.1/2,นายอนันต์ ชัยชนะ\n"
        ];
    }

    /**
     * Download Sample CSV Template file for Teachers
     */
    downloadSampleTemplate() {
        const content = "\uFEFF" + this.sampleTemplateHeaders + this.sampleRows.join("");
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "ตัวอย่างไฟล์นำเข้านักเรียน_เลขที่_รหัสประจำตัว_ชื่อสกุล_ระดับชั้น_ครูที่ปรึกษา.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Parse CSV File input
     * @param {File} file 
     * @returns {Promise<Array<Object>>}
     */
    parseCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);

                    if (lines.length === 0) {
                        reject(new Error("ไฟล์ CSV ไม่มีข้อมูล"));
                        return;
                    }

                    const firstLineCols = this.parseCSVLine(lines[0]);
                    const cleanHeaders = firstLineCols.map(h => h.trim().replace(/^"|"$/g, '').replace(/^\uFEFF/, ''));

                    // Check if line 0 is a header row
                    const isHeaderRow = cleanHeaders.some(h => 
                        /เลข|รหัส|ชื่อ|ชั้น|ครู|number|id|name|grade/i.test(h)
                    );

                    let startIndex = isHeaderRow ? 1 : 0;

                    // Map column indices based on header names if present
                    let idxNum = -1, idxId = -1, idxName = -1, idxGrade = -1, idxRoom = -1, idxAdvisor = -1, idxPhone = -1, idxPrefix = -1;

                    if (isHeaderRow) {
                        cleanHeaders.forEach((h, idx) => {
                            const lower = h.toLowerCase();
                            if (lower.includes('เลขที่') || lower === 'no' || lower === 'seq') idxNum = idx;
                            else if (lower.includes('รหัส')) idxId = idx;
                            else if (lower.includes('คำนำหน้า')) idxPrefix = idx;
                            else if (lower.includes('ชื่อ')) idxName = idx;
                            else if (lower.includes('ระดับชั้น') || lower.includes('ชั้น')) idxGrade = idx;
                            else if (lower === 'ห้อง' || lower.includes('ห้องเรียน')) idxRoom = idx;
                            else if (lower.includes('ครู') || lower.includes('ปรึกษา')) idxAdvisor = idx;
                            else if (lower.includes('โทร')) idxPhone = idx;
                        });
                    }

                    // Fallbacks for requested 5-column format: [เลขที่, รหัสประจำตัว, ชื่อ-สกุล, ระดับชั้น, ครูที่ปรึกษา]
                    if (idxNum === -1) idxNum = 0;
                    if (idxId === -1) idxId = 1;
                    if (idxName === -1) idxName = 2;
                    if (idxGrade === -1) idxGrade = 3;
                    if (idxAdvisor === -1) idxAdvisor = 4;

                    const parsedStudents = [];

                    for (let i = startIndex; i < lines.length; i++) {
                        const cols = this.parseCSVLine(lines[i]);
                        if (cols.length >= 2) {
                            const numberStr = (cols[idxNum] || (i - startIndex + 1).toString()).trim();
                            const rawStudentId = (cols[idxId] || `STD_${Date.now()}_${i}`).trim();
                            
                            let prefix = idxPrefix !== -1 ? (cols[idxPrefix] || '').trim() : '';
                            let rawFullName = (cols[idxName] || '').trim();
                            
                            // Auto extract prefix if attached to name (e.g. นายจิระ เพชรไพทูรย์)
                            if (!prefix && rawFullName) {
                                const prefixes = ['นางสาว', 'นาย', 'เด็กชาย', 'เด็กหญิง', 'นาง', 'ด.ช.', 'ด.ญ.'];
                                for (const p of prefixes) {
                                    if (rawFullName.startsWith(p)) {
                                        prefix = p;
                                        break;
                                    }
                                }
                            }

                            const rawGradeRoom = (cols[idxGrade] || 'ม.1/1').trim();
                            let grade = rawGradeRoom;
                            let room = idxRoom !== -1 ? (cols[idxRoom] || '1').trim() : '1';

                            if (rawGradeRoom.includes('/')) {
                                const parts = rawGradeRoom.split('/');
                                grade = parts[0].trim();
                                room = parts[1].trim();
                            }

                            const phone = idxPhone !== -1 ? (cols[idxPhone] || '').trim() : '';
                            const advisors = (cols[idxAdvisor] || '').trim();

                            if (rawStudentId || rawFullName) {
                                parsedStudents.push({
                                    studentId: rawStudentId,
                                    prefix: prefix,
                                    fullName: rawFullName,
                                    grade: grade,
                                    room: room,
                                    number: numberStr,
                                    phone: phone,
                                    advisors: advisors,
                                    status: 'active',
                                    createdAt: new Date().toISOString()
                                });
                            }
                        }
                    }

                    if (parsedStudents.length === 0) {
                        reject(new Error("ไม่พบข้อมูลนักเรียนที่สมบูรณ์ในไฟล์ CSV"));
                        return;
                    }

                    resolve(parsedStudents);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ CSV ได้"));
            reader.readAsText(file, "UTF-8");
        });
    }

    parseCSVLine(text) {
        const results = [];
        let entry = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                results.push(entry.trim().replace(/^"|"$/g, ''));
                entry = '';
            } else {
                entry += char;
            }
        }
        results.push(entry.trim().replace(/^"|"$/g, ''));
        return results;
    }

    /**
     * Export all students list to CSV File
     * @param {Array<Object>} students 
     */
    exportStudentsToCSV(students) {
        if (!students || students.length === 0) {
            alert('ไม่มีข้อมูลนักเรียนสำหรับส่งออก');
            return;
        }

        let csvContent = "\uFEFF" + this.sampleTemplateHeaders;
        students.forEach((s, idx) => {
            const num = s.number || (idx + 1).toString();
            const id = s.studentId || '';
            const name = s.fullName || `${s.prefix || ''}${s.fullName || ''}`;
            const gradeRoom = (s.grade && s.room) ? (s.grade.includes('/') ? s.grade : `${s.grade}/${s.room}`) : (s.grade || '');
            const advisors = s.advisors || s.advisorTeachers || s.guardian || '';

            const row = [
                `"${num}"`,
                `"${id}"`,
                `"${name}"`,
                `"${gradeRoom}"`,
                `"${advisors}"`
            ].join(",");
            csvContent += row + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `รายชื่อนักเรียนทั้งหมด_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Download Sample Teacher CSV Template
     */
    downloadTeacherSampleTemplate() {
        const headers = "คำนำหน้า,ชื่อ-นามสกุล,ตำแหน่ง,ห้องเรียนที่รับผิดชอบ,เบอร์โทรศัพท์\n";
        const rows = [
            "นาย,สมศักดิ์ รักเรียน,ครูกิจการนักเรียน,ม.1/1,081-222-3333\n",
            "นาง,สมศรี ใจดี,ครูประจำชั้น,ม.1/1,082-333-4444\n",
            "นาย,วิเชียร ดีเลิศ,ครูแนะแนว,ม.2/1,083-444-5555\n"
        ];
        const content = "\uFEFF" + headers + rows.join("");
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "ตัวอย่างไฟล์นำเข้าข้อมูลครู_พนมดงรักวิทยา.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Parse Teacher CSV File input
     * @param {File} file 
     * @returns {Promise<Array<Object>>}
     */
    parseTeacherCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);

                    if (lines.length <= 1) {
                        reject(new Error("ไฟล์ CSV ไม่มีข้อมูลครู"));
                        return;
                    }

                    const parsedTeachers = [];
                    for (let i = 1; i < lines.length; i++) {
                        const cols = this.parseCSVLine(lines[i]);
                        if (cols.length >= 2) {
                            // Format: คำนำหน้า, ชื่อ-นามสกุล, ตำแหน่ง, ห้องเรียนที่รับผิดชอบ, เบอร์โทรศัพท์
                            // OR Format: ชื่อ-นามสกุล, ตำแหน่ง, ห้องเรียนที่รับผิดชอบ, เบอร์โทรศัพท์
                            let prefix = 'ครู';
                            let fullName = cols[0] || '';
                            let position = cols[1] || 'ครูผู้สอน';
                            let responsibleRoom = cols[2] || '';
                            let phone = cols[3] || '';

                            if (cols.length >= 5 || ['นาย', 'นาง', 'นางสาว', 'ดร.'].includes((cols[0] || '').trim())) {
                                prefix = (cols[0] || 'นาย').trim();
                                fullName = (cols[1] || '').trim();
                                position = (cols[2] || 'ครูผู้สอน').trim();
                                responsibleRoom = (cols[3] || '').trim();
                                phone = (cols[4] || '').trim();
                            }

                            parsedTeachers.push({
                                prefix: prefix,
                                fullName: fullName,
                                position: position,
                                responsibleRoom: responsibleRoom,
                                phone: phone,
                                createdAt: new Date().toISOString()
                            });
                        }
                    }
                    resolve(parsedTeachers);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ CSV ครูได้"));
            reader.readAsText(file, "UTF-8");
        });
    }

    /**
     * Export all teachers to CSV
     * @param {Array<Object>} teachers 
     */
    exportTeachersToCSV(teachers) {
        if (!teachers || teachers.length === 0) {
            alert('ไม่มีข้อมูลครูสำหรับส่งออก');
            return;
        }

        const headers = "คำนำหน้า,ชื่อ-นามสกุล,ตำแหน่ง,ห้องเรียนที่รับผิดชอบ,เบอร์โทรศัพท์\n";
        let csvContent = "\uFEFF" + headers;
        teachers.forEach(t => {
            const row = [
                `"${t.prefix || ''}"`,
                `"${t.fullName || ''}"`,
                `"${t.position || ''}"`,
                `"${t.responsibleRoom || t.responsibleGrade || ''}"`,
                `"${t.phone || ''}"`
            ].join(",");
            csvContent += row + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `รายชื่อครูทั้งหมด_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

const csvImporter = new CSVImporter();
