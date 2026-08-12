/**
 * ระบบดูแลช่วยเหลือนักเรียน - Configuration File
 * Firebase Realtime Database & Cloudinary CDN Configuration
 */

const CONFIG = {
    SYSTEM_VERSION: "2.5",
    VERSION: "v2.5",

    // 1. Firebase Realtime Database Configuration
    FIREBASE: {
        DATABASE_URL: "https://prcare-2f41d-default-rtdb.asia-southeast1.firebasedatabase.app/",
        PROJECT_ID: "prcare-2f41d",
        ENDPOINTS: {
            STUDENTS: "students",
            TEACHERS: "teachers",
            SCREENINGS: "screenings",
            MERITS: "merits",
            OFFENSES: "offenses",
            REFERRALS: "referrals",
            ACTIVITIES: "activities",
            USERS: "users",
            SYSTEM_LOGS: "system_logs",
            SETTINGS: "settings"
        }
    },

    // 2. Cloudinary CDN Configuration
    CLOUDINARY: {
        CLOUD_NAME: "eseojbyy",
        UPLOAD_PRESET: "ml_default",
        UPLOAD_URL: "https://api.cloudinary.com/v1_1/eseojbyy/image/upload",
        MAX_FILE_SIZE_MB: 5
    },

    // 3. LocalStorage Cache Keys (Fast Startup 0ms)
    STORAGE_KEYS: {
        STUDENTS: "prcare_students_cache",
        TEACHERS: "prcare_teachers_cache",
        SCREENINGS: "prcare_screenings_cache",
        MERITS: "prcare_merits_cache",
        OFFENSES: "prcare_offenses_cache",
        REFERRALS: "prcare_referrals_cache",
        ACTIVITIES: "prcare_activities_cache",
        AUTH_USER: "prcare_auth_user",
        LAST_SYNC: "prcare_last_sync_timestamp",
        SETTINGS: "prcare_settings_cache"
    },

    // 4. Academic Levels & System Constants
    GRADE_LEVELS: [
        "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6",
        "ปวช.1", "ปวช.2", "ปวช.3"
    ],

    ROLES: {
        STUDENT: "student",
        TEACHER: "teacher",
        ADMIN: "admin"
    },

    ROLE_NAMES_TH: {
        student: "🎓 นักเรียน",
        teacher: "👨‍🏫 ครู / ครูกิจการนักเรียน",
        admin: "🛡️ ผู้ดูแลระบบ (Administrator)"
    },

    SCREENING_LEVELS: {
        NORMAL: { code: "normal", label: "ปกติ", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" },
        RISK:    { code: "risk",   label: "เสี่ยง", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
        PROBLEM: { code: "problem",label: "มีปัญหา/กระทำผิด", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" }
    },

    OFFENSE_LEVELS: {
        MINOR:    { code: "minor",    label: "เบา",      color: "#3b82f6" },
        MODERATE: { code: "moderate", label: "ปานกลาง", color: "#f59e0b" },
        SEVERE:   { code: "severe",   label: "ร้ายแรง",  color: "#ef4444" }
    },

    REFERRAL_TYPES: {
        INTERNAL: { code: "internal", label: "ส่งต่อภายใน",   icon: "arrow-down-left" },
        EXTERNAL: { code: "external", label: "ส่งต่อภายนอก", icon: "arrow-up-right" }
    },

    // 5. Theme System — 10 Premium Themes (5 Dark + 5 Light)
    THEMES: {
        indigo: {
            id: "indigo", name: "Deep Indigo",
            nameTH: "🔵 Deep Indigo (ค่าเริ่มต้น)",
            description: "ดีพ อินดิโก × ทองอำพัน — ธีมดั้งเดิมของระบบ",
            preview: ["#1e1b4b", "#312e81", "#f59e0b"], group: "dark"
        },
        ruby: {
            id: "ruby", name: "Volcanic Ruby Red",
            nameTH: "🔴 Volcanic Ruby Red",
            description: "แดงรูบี้ลาวา × ทองส้มเพลิง — หรูหราร้อนแรง",
            preview: ["#7f1d1d", "#991b1b", "#fbbf24"], group: "dark"
        },
        ocean: {
            id: "ocean", name: "Midnight Ocean",
            nameTH: "🌊 Midnight Ocean",
            description: "น้ำเงินมหาสมุทร × ฟ้าซีเอน — เย็นสงบลึกซึ้ง",
            preview: ["#0c1a2e", "#0f2d4a", "#06b6d4"], group: "dark"
        },
        emerald: {
            id: "emerald", name: "Emerald Forest",
            nameTH: "🌿 Emerald Forest",
            description: "เขียวป่าลึก × ม่วงลาเวนเดอร์ — สดชื่นธรรมชาติ",
            preview: ["#052e16", "#064e3b", "#a78bfa"], group: "dark"
        },
        amethyst: {
            id: "amethyst", name: "Royal Amethyst",
            nameTH: "💜 Royal Amethyst",
            description: "ม่วงอเมทิสต์ × ชมพูโรส — หรูหราราชวงศ์",
            preview: ["#2e1065", "#4c1d95", "#f472b6"], group: "dark"
        },
        snow: {
            id: "snow", name: "Snow White",
            nameTH: "☀️ Snow White",
            description: "น้ำเงินสะอาด × ขาวบริสุทธิ์ — คลีนทันสมัย",
            preview: ["#1e3a5f", "#1e40af", "#f59e0b"], group: "light"
        },
        sakura: {
            id: "sakura", name: "Sakura Blossom",
            nameTH: "🌸 Sakura Blossom",
            description: "ชมพูซากุระ × ส้มอบอุ่น — อ่อนหวานสวยงาม",
            preview: ["#500724", "#831843", "#fb923c"], group: "light"
        },
        sunrise: {
            id: "sunrise", name: "Golden Sunrise",
            nameTH: "🌅 Golden Sunrise",
            description: "ส้มทองพระอาทิตย์ขึ้น × ครีมอบอุ่น — สดใสพลังงาน",
            preview: ["#431407", "#7c2d12", "#f59e0b"], group: "light"
        },
        mint: {
            id: "mint", name: "Arctic Mint",
            nameTH: "🌿 Arctic Mint",
            description: "เขียวมินต์สดชื่น × ฟ้าน้ำ — สะอาดสบายตา",
            preview: ["#022a26", "#134e48", "#06b6d4"], group: "light"
        },
        gray: {
            id: "gray", name: "Soft Gray",
            nameTH: "🌥️ Soft Gray",
            description: "เทาองค์กร × ม่วงอินดิโก — คลาสสิกอ่านง่าย",
            preview: ["#0f172a", "#1e293b", "#818cf8"], group: "light"
        }
    }
};

// Freeze Config
Object.freeze(CONFIG);
