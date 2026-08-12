/**
 * ระบบดูแลช่วยเหลือนักเรียน - PDF Report Generator
 * Generates official Thai discipline & offense reports with browser print / PDF download
 */

class PDFGenerator {
    constructor() {}

    /**
     * Download or Print Offense Incident PDF Report
     * @param {Object} offense 
     * @param {Object} student 
     */
    generateOffenseReport(offense, student) {
        if (!offense) return;

        const studentName = student ? `${student.prefix || ''}${student.fullName}` : (offense.studentName || '-');
        const studentId = student ? student.studentId : (offense.studentId || '-');
        const gradeRoom = student ? `${student.grade}/${student.room}` : (offense.gradeRoom || '-');
        const numberStr = student ? student.number : (offense.studentNumber || '-');
        const advisors = student ? (student.advisors || '-') : (offense.advisors || '-');
        const levelLabel = offense.level === 'severe' ? 'ร้ายแรง' : (offense.level === 'moderate' ? 'ปานกลาง' : 'เบา');
        const levelClass = offense.level === 'severe' ? 'badge-severe' : (offense.level === 'moderate' ? 'badge-moderate' : 'badge-minor');
        
        let formattedDate = '-';
        if (offense.incidentDate) {
            try {
                formattedDate = new Date(offense.incidentDate).toLocaleDateString('th-TH', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
            } catch (e) {
                formattedDate = offense.incidentDate;
            }
        }

        // Resolve logo URL relative to origin (works on GitHub Pages)
        const logoUrl = (window.location.origin + window.location.pathname)
            .replace(/\/[^/]*$/, '/') + 'logo%20prcare+.png';

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('เบราว์เซอร์บล็อกหน้าต่าง Pop-up กรุณายกเลิกการบล็อกและลองใหม่อีกครั้ง');
            return;
        }

        const htmlContent = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>รายงานการกระทำความผิด - ${studentName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 portrait; margin: 10mm 12mm 10mm 12mm; }
        * { box-sizing: border-box; }
        body {
            font-family: 'Sarabun', 'Prompt', sans-serif;
            font-size: 11pt;
            line-height: 1.35;
            color: #1e1b4b;
            margin: 0; padding: 16px;
            background: #fff;
        }
        /* ===== PRINT BAR (hidden on print) ===== */
        .no-print-bar {
            background: #1e1b4b;
            color: #fff;
            padding: 8px 16px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
            box-shadow: 0 4px 16px rgba(30,27,75,0.15);
        }
        .btn-print {
            padding: 7px 18px;
            background: #f59e0b;
            color: #1e1b4b;
            border: none;
            border-radius: 8px;
            font-size: 12px;
            cursor: pointer;
            font-family: 'Prompt', sans-serif;
            font-weight: 700;
        }
        .btn-print:hover { background: #fbbf24; }

        /* ===== HEADER ===== */
        .header {
            display: flex;
            align-items: center;
            gap: 12px;
            border-bottom: 2.5px double #312e81;
            padding-bottom: 8px;
            margin-bottom: 10px;
        }
        .header-logo {
            width: 64px;
            height: 64px;
            object-fit: contain;
            flex-shrink: 0;
        }
        .header-logo-fallback {
            width: 64px;
            height: 64px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #1e3a8a, #9333ea);
            border-radius: 10px;
            color: #fff;
            font-size: 10pt;
            font-weight: 700;
            text-align: center;
            flex-shrink: 0;
            line-height: 1.2;
        }
        .header-text { flex: 1; text-align: center; }
        .header-text h1 {
            margin: 0;
            font-size: 14pt;
            color: #1e1b4b;
            font-family: 'Prompt', sans-serif;
            font-weight: 700;
            line-height: 1.2;
        }
        .header-text h3 {
            margin: 3px 0 0;
            font-size: 9.5pt;
            color: #4338ca;
            font-weight: 600;
        }

        /* ===== BOXES ===== */
        .box {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 8px 12px;
            background: #f8fafc;
            margin-bottom: 8px;
        }
        .box-title {
            font-weight: 700;
            color: #1e1b4b;
            margin-bottom: 5px;
            font-family: 'Prompt', sans-serif;
            font-size: 10.5pt;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
        }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 3px 6px; vertical-align: top; font-size: 10.5pt; }
        .label { font-weight: 700; width: 120px; color: #334155; white-space: nowrap; }
        .badge {
            display: inline-block;
            padding: 1px 10px;
            border-radius: 16px;
            font-size: 10pt;
            font-weight: 700;
        }
        .badge-severe   { background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }
        .badge-moderate { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
        .badge-minor    { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }

        /* ===== EVIDENCE IMAGE ===== */
        .img-evidence-container {
            margin-top: 6px;
            text-align: center;
            background: #fff;
            padding: 6px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
        }
        .img-evidence {
            max-width: 100%;
            max-height: 160px;
            border-radius: 6px;
            object-fit: contain;
        }

        /* ===== SIGNATURES ===== */
        .signatures {
            margin-top: 18px;
            display: flex;
            justify-content: space-around;
            page-break-inside: avoid;
        }
        .sig-box { text-align: center; width: 42%; font-size: 10pt; }
        .sig-line { margin-top: 28px; border-top: 1px dotted #64748b; padding-top: 4px; }

        /* ===== PRINT OVERRIDES ===== */
        @media print {
            .no-print-bar { display: none !important; }
            body { padding: 0; margin: 0; font-size: 10.5pt; }
            .box { background: #fff !important; border-color: #94a3b8; }
        }
    </style>
</head>
<body>
    <div class="no-print-bar">
        <div><strong>🖨️ ระบบพิมพ์รายงานพฤติกรรม</strong> — กดปุ่มขวามือเพื่อพิมพ์เอกสาร หรือ บันทึกเป็น PDF</div>
        <button class="btn-print" onclick="window.print()">🖨️ พิมพ์เอกสาร / บันทึก PDF</button>
    </div>

    <!-- HEADER WITH LOGO -->
    <div class="header">
        <img src="${logoUrl}" class="header-logo" alt="PR Care+ Logo"
             onerror="this.style.display='none'; document.getElementById('logo-fallback').style.display='flex';">
        <div class="header-logo-fallback" id="logo-fallback" style="display:none;">PR<br>Care+</div>
        <div class="header-text">
            <h1>แบบบันทึกพฤติกรรมและการกระทำความผิดของนักเรียน</h1>
            <h3>งานกิจการนักเรียน โรงเรียนพนมดงรักวิทยา — ระบบดูแลช่วยเหลือนักเรียน (PR Care+)</h3>
        </div>
    </div>

    <!-- STUDENT INFO -->
    <div class="box">
        <div class="box-title">👤 ข้อมูลนักเรียนผู้กระทำความผิด</div>
        <table>
            <tr>
                <td class="label">ชื่อ - นามสกุล:</td>
                <td><strong>${studentName}</strong></td>
                <td class="label">รหัสประจำตัว:</td>
                <td>${studentId}</td>
            </tr>
            <tr>
                <td class="label">ระดับชั้น/ห้อง:</td>
                <td>${gradeRoom}</td>
                <td class="label">เลขที่:</td>
                <td>${numberStr}</td>
            </tr>
            <tr>
                <td class="label">ครูที่ปรึกษา:</td>
                <td colspan="3">${advisors}</td>
            </tr>
        </table>
    </div>

    <!-- INCIDENT DETAILS -->
    <div class="box">
        <div class="box-title">🚨 รายละเอียดเหตุการณ์การกระทำความผิด</div>
        <table>
            <tr>
                <td class="label">วันที่เกิดเหตุ:</td>
                <td>${formattedDate}</td>
                <td class="label">ระดับความผิด:</td>
                <td><span class="badge ${levelClass}">${levelLabel}</span></td>
            </tr>
            <tr>
                <td class="label">หมวดหมู่ความผิด:</td>
                <td>${offense.category || '-'}</td>
                <td class="label">การส่งต่อ:</td>
                <td>${offense.referralType === 'internal' ? 'ส่งต่อภายใน' : (offense.referralType === 'external' ? 'ส่งต่อภายนอก' : 'ไม่มี')}</td>
            </tr>
            <tr>
                <td class="label">รายละเอียดเหตุการณ์:</td>
                <td colspan="3">${offense.details || offense.description || offense.category || '-'}</td>
            </tr>
        </table>
        ${offense.imageUrl ? `
            <div class="img-evidence-container">
                <div style="font-weight:700; margin-bottom:4px; font-size:9.5pt; color:#475569;">📷 ภาพถ่ายหลักฐานประกอบการบันทึก:</div>
                <img src="${offense.imageUrl}" class="img-evidence" alt="รูปหลักฐาน">
            </div>
        ` : ''}
    </div>

    <!-- ACTION TAKEN -->
    <div class="box">
        <div class="box-title">📋 มาตรการแก้ไขและปรับเปลี่ยนพฤติกรรม</div>
        <p style="margin: 2px 0 0; font-size: 10.5pt;">${offense.actionTaken || 'ว่ากล่าวตักเตือน บันทึกประวัติพฤติกรรมในระบบ PR Care+ และแจ้งครูที่ปรึกษาร่วมกำกับดูแล'}</p>
    </div>

    <!-- SIGNATURES -->
    <div class="signatures">
        <div class="sig-box">
            <div class="sig-line">ลงชื่อ..................................................</div>
            <div>(${offense.recordedBy || 'ครูผู้บันทึก/ครูกิจการนักเรียน'})</div>
            <div>ผู้บันทึกข้อมูล</div>
        </div>
        <div class="sig-box">
            <div class="sig-line">ลงชื่อ..................................................</div>
            <div>(นายจาตุรน ศรีละพันธ์)</div>
            <div>หัวหน้างานกิจการนักเรียน / ครูที่ปรึกษา</div>
        </div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); }, 600);
        };
    </script>
</body>
</html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    }
}

const pdfGenerator = new PDFGenerator();
