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
        @page { size: A4 portrait; margin: 12mm; }
        * { box-sizing: border-box; }
        body {
            font-family: 'Sarabun', 'Prompt', sans-serif;
            font-size: 14pt;
            line-height: 1.5;
            color: #1e1b4b;
            margin: 0; padding: 24px;
            background: #fff;
        }
        .no-print-bar {
            background: #1e1b4b;
            color: #fff;
            padding: 12px 20px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
            box-shadow: 0 4px 16px rgba(30,27,75,0.15);
        }
        .btn-print {
            padding: 10px 22px;
            background: #f59e0b;
            color: #1e1b4b;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            font-family: 'Prompt', sans-serif;
            font-weight: 700;
            box-shadow: 0 2px 8px rgba(245,158,11,0.3);
            transition: all 0.2s ease;
        }
        .btn-print:hover { background: #fbbf24; transform: translateY(-1px); }
        .header {
            text-align: center;
            border-bottom: 3px double #312e81;
            padding-bottom: 14px;
            margin-bottom: 22px;
        }
        .header h1 { margin: 0; font-size: 20pt; color: #1e1b4b; font-family: 'Prompt', sans-serif; font-weight: 700; }
        .header h3 { margin: 5px 0 0; font-size: 14pt; color: #4338ca; font-weight: 600; }
        .box {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 16px 20px;
            background: #f8fafc;
            margin-bottom: 18px;
        }
        .box-title {
            font-weight: 700;
            color: #1e1b4b;
            margin-bottom: 10px;
            font-family: 'Prompt', sans-serif;
            font-size: 13pt;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
        }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 6px 8px; vertical-align: top; }
        .label { font-weight: 700; width: 130px; color: #334155; }
        .badge {
            display: inline-block;
            padding: 3px 12px;
            border-radius: 20px;
            font-size: 12pt;
            font-weight: 700;
        }
        .badge-severe   { background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }
        .badge-moderate { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
        .badge-minor    { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
        .img-evidence-container {
            margin-top: 14px;
            text-align: center;
            background: #fff;
            padding: 12px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
        }
        .img-evidence {
            max-width: 100%;
            max-height: 280px;
            border-radius: 8px;
            object-fit: contain;
        }
        .signatures {
            margin-top: 48px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
        }
        .sig-box { text-align: center; width: 45%; }
        .sig-line { margin-top: 36px; border-top: 1px dotted #64748b; padding-top: 6px; }
        @media print {
            .no-print-bar { display: none !important; }
            body { padding: 0; margin: 0; }
            .box { background: #fff; border-color: #94a3b8; }
        }
    </style>
</head>
<body>
    <div class="no-print-bar">
        <div><strong>🖨️ ระบบพิมพ์รายงานพฤติกรรม</strong> — กดปุ่มขวามือเพื่อพิมพ์เอกสาร หรือ บันทึกเป็น PDF</div>
        <button class="btn-print" onclick="window.print()">🖨️ พิมพ์เอกสาร / บันทึก PDF</button>
    </div>

    <div class="header">
        <h1>แบบบันทึกพฤติกรรมและการกระทำความผิดของนักเรียน</h1>
        <h3>งานกิจการนักเรียน โรงเรียนพนมดงรักวิทยา — ระบบดูแลช่วยเหลือนักเรียน (PR Care+)</h3>
    </div>

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
                <td>${offense.referralType === 'internal' ? 'ส่งต่อภายใน (ครูแนะแนว/ฝ่ายปกครอง)' : (offense.referralType === 'external' ? 'ส่งต่อภายนอก' : 'ไม่มี')}</td>
            </tr>
            <tr>
                <td class="label">รายละเอียดเหตุการณ์:</td>
                <td colspan="3">${offense.details || offense.description || offense.category || '-'}</td>
            </tr>
        </table>
        ${offense.imageUrl ? `
            <div class="img-evidence-container">
                <div style="font-weight: 700; margin-bottom: 6px; font-size: 11pt; color: #475569;">📷 ภาพถ่ายหลักฐานประกอบการบันทึก:</div>
                <img src="${offense.imageUrl}" class="img-evidence" alt="รูปหลักฐาน">
            </div>
        ` : ''}
    </div>

    <div class="box">
        <div class="box-title">📋 มาตรการแก้ไขและปรับเปลี่ยนพฤติกรรม</div>
        <p style="margin: 4px 0 0;">${offense.actionTaken || 'ว่ากล่าวตักเตือน บันทึกประวัติพฤติกรรมในระบบ PR Care+ และแจ้งครูที่ปรึกษาร่วมกำกับดูแล'}</p>
    </div>

    <div class="signatures">
        <div class="sig-box">
            <div class="sig-line">ลงชื่อ..........................................................</div>
            <div>(${offense.recordedBy || 'ครูผู้บันทึก/ครูกิจการนักเรียน'})</div>
            <div>ผู้บันทึกข้อมูล</div>
        </div>
        <div class="sig-box">
            <div class="sig-line">ลงชื่อ..........................................................</div>
            <div>(นายจาตุรน ศรีละพันธ์)</div>
            <div>หัวหน้างานกิจการนักเรียน / ครูที่ปรึกษา</div>
        </div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); }, 500);
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
