"""Soát chất lượng dữ liệu khách -> sinh cột Note đề xuất sửa.

Nguyên tắc: CHỈ đề xuất cái suy ra được từ bằng chứng trong chính dữ liệu.
KHÔNG bịa địa chỉ. Địa chỉ mơ hồ -> ghi "cần hỏi khách", không đoán.

3 mức trong Note:
  [SỬA]   — chắc chắn, cứ áp dụng (lỗi chính tả rõ ràng)
  [ĐỀ XUẤT] — suy từ địa danh công cộng, nên xác nhận lại
  [HỎI KHÁCH] — không có nguồn nào suy ra được, phải gọi hỏi
"""

import re

# ── 1. Lỗi chính tả rõ ràng: (regex, thay bằng, mô tả) ──────────────────────
TYPOS = [
    (r"\btime\s?city\b", "Times City", "time city → Times City"),
    (r"\bt[ỉi]m city\b", "Times City", "tỉm city → Times City"),
    (r"\bocen\s?park\b", "Ocean Park", "ocen park → Ocean Park"),
    (r"\bocenpark\b", "Ocean Park", "ocenpark → Ocean Park"),
    (r"\bvinhome\b(?!s)", "Vinhomes", "vinhome → Vinhomes"),
    (r"\bgadenia\b", "Gardenia", "gadenia → Gardenia"),
    (r"\bhà\s?noii\b", "Hà Nội", "Hà noii → Hà Nội"),
    (r"\bsmartcity\b", "Smart City", "smartcity → Smart City"),
    (r"\briveside\b", "Riverside", "riveside → Riverside"),
    (r"\bvinharmony\b", "Vinhomes Harmony", "vinharmony → Vinhomes Harmony"),
    (r"\bgreenbay\b", "Green Bay", "greenbay → Green Bay"),
    (r"\bĐương\b", "Đường", "Đương → Đường"),
    (r"\bTh[uụ]y Kh[êe]\b", "Thuỵ Khuê", "Thụy Khê → Thuỵ Khuê"),
]

# ── 2. Địa danh CÔNG CỘNG -> suy ra Tỉnh/TP (bằng chứng: tên khu đô thị) ────
#     Chỉ những khu có MỘT vị trí duy nhất, không nhầm được.
LANDMARKS = [
    # times? — khớp cả trước khi sửa chính tả ("time city") lẫn sau ("Times City")
    (r"times?\s?city|tỉm city",         "Hà Nội",   "Times City ở 458 Minh Khai, Hai Bà Trưng, Hà Nội"),
    (r"ocean\s?park|ocen\s?park|ocenpark", "Hưng Yên", "Vinhomes Ocean Park (Gia Lâm/Văn Giang) — ghi rõ OP1/OP2/OP3"),
    (r"\becopark\b",                    "Hưng Yên", "Ecopark ở Văn Giang, Hưng Yên"),
    (r"smart\s?city|smartcity",         "Hà Nội",   "Vinhomes Smart City ở Tây Mỗ, Nam Từ Liêm, Hà Nội"),
    (r"thảo điền",                      "TP.HCM",   "Thảo Điền thuộc TP Thủ Đức, TP.HCM"),
    (r"saigon pearl",                   "TP.HCM",   "Saigon Pearl ở 92 Nguyễn Hữu Cảnh, Bình Thạnh, TP.HCM"),
    (r"royal city",                     "Hà Nội",   "Royal City ở 72A Nguyễn Trãi, Thanh Xuân, Hà Nội"),
    (r"\bciputra\b",                    "Hà Nội",   "Ciputra ở Bắc Từ Liêm, Hà Nội"),
    (r"ngoại giao đoàn",                "Hà Nội",   "KĐT Ngoại Giao Đoàn ở Xuân Tảo, Bắc Từ Liêm, Hà Nội"),
    (r"vinhomes riverside|vinhome riverside", "Hà Nội", "Vinhomes Riverside ở Long Biên, Hà Nội"),
    (r"phú mỹ hưng",                    "TP.HCM",   "Phú Mỹ Hưng ở Quận 7, TP.HCM"),
    (r"celadon",                        "TP.HCM",   "Celadon City ở Tân Phú, TP.HCM"),
    (r"\bthủ thiêm\b",                  "TP.HCM",   "Thủ Thiêm thuộc TP Thủ Đức, TP.HCM"),
    (r"\bpark city\b|\bparkcity\b",     "Hà Nội",   "Park City ở Hà Đông, Hà Nội"),
    (r"\bgamuda\b",                     "Hà Nội",   "Gamuda Gardens ở Hoàng Mai, Hà Nội"),
]

# ── 3. Quận/huyện/địa danh -> Tỉnh/TP (chỉ những cái KHÔNG trùng tên) ───────
DISTRICTS = [
    (r"long biên|gia lâm|tây hồ|cầu giấy|ba đình|hoàn kiếm|đống đa|thanh xuân|hà đông|"
     r"nam từ liêm|bắc từ liêm|hoàng mai|hai bà trưng|thanh trì|đan phượng|hoài đức|"
     r"thạch thất|mê linh|thuỵ khuê|thụy khuê|giảng võ|kim mã|lý nam đế|minh khai|"
     r"nghĩa tân|tây mỗ|đại mỗ|xuân tảo|ngọc thụy|ngọc thuỵ|phú diễn|văn quán|mễ trì|"
     r"linh đàm|định công|đại kim|pháp vân|yên hoà|yên hòa|trung hoà|trung hòa", "Hà Nội"),
    (r"thủ đức|bình thạnh|gò vấp|tân bình|tân phú|phú nhuận|bình tân|nhà bè|củ chi|"
     r"hóc môn|quận 1|quận 2|quận 4|quận 7|quận 8|quận 12|\bq1\b|\bq2\b|\bq7\b|\bq12\b|"
     r"an phú|an khánh|thạnh mỹ lợi|cát lái|tphcm|tp\.hcm|hồ chí minh|\bhcm\b", "TP.HCM"),
    (r"\bhải phòng\b|lê chân|ngô quyền|thuỷ nguyên|thủy nguyên", "Hải Phòng"),
    (r"\bđà nẵng\b|thanh khê|hải châu|cẩm lệ|ngũ hành sơn", "Đà Nẵng"),
    (r"biên hoà|biên hòa|đồng nai", "Đồng Nai"),
    (r"chí linh|hải dương", "Hải Dương"),
    (r"hạ long|bãi cháy|quảng ninh", "Quảng Ninh"),
    (r"\bhuế\b", "Huế"),
]


def fix_typos(text):
    """-> (text đã sửa, [mô tả lỗi đã sửa]). Không đổi gì thì trả nguyên."""
    if not text:
        return text, []
    fixed, found = text, []
    for pat, repl, desc in TYPOS:
        if re.search(pat, fixed, re.I):
            fixed = re.sub(pat, repl, fixed, flags=re.I)
            found.append(desc)
    return fixed, found


def has_province(text):
    """Địa chỉ đã nêu tỉnh/TP nào chưa?"""
    if not text:
        return None
    for pat, prov in DISTRICTS:
        if re.search(pat, text, re.I):
            return prov
    return None


def guess_province(address):
    """-> (tỉnh/TP, lý do) suy từ địa danh công cộng. Không suy được -> (None, None)."""
    if not address:
        return None, None
    for pat, prov, why in LANDMARKS:
        if re.search(pat, address, re.I):
            return prov, why
    prov = has_province(address)
    if prov:
        return prov, "suy từ tên quận/huyện trong địa chỉ"
    return None, None


def fix_name_case(name):
    """Tên VIẾT HOA HẾT hoặc viết thường đầu -> đề xuất Title Case. Bỏ qua tên công ty."""
    if not name or re.match(r"^(CÔNG TY|CTY|TNHH|SLP|DIEUHOUSE|\d)", name, re.I):
        return None
    if name.isupper() and len(name) > 3:
        return name.title()
    if name[:1].islower():
        return name[:1].upper() + name[1:]
    return None


def audit(row):
    """1 khách -> (Note, mức ưu tiên). Note RỖNG = không cần người động tay.

    Cố ý KHÔNG nhắc "thiếu tỉnh/TP" khi suy ra được — cái đó máy tự điền,
    đưa vào Note chỉ làm nhiễu (293/293 khách đều thiếu province).
    Note chỉ chứa việc CẦN NGƯỜI QUYẾT ĐỊNH.
    """
    notes, worst = [], 0   # 0=không, 1=thấp, 2=vừa, 3=cao
    may = row.get("so_may") or 0

    # SĐT — nghiêm trọng nhất: khoá chính của khách
    if row.get("needs_phone"):
        if row.get("primary_phone"):
            notes.append(f"SĐT SAI DẠNG: {row['primary_phone']} — {row.get('notes') or 'không đúng dạng VN'}. "
                         "Tra Odoo/gọi khách để sửa.")
        else:
            notes.append("THIẾU SĐT — đây là khoá định danh khách, bắt buộc bổ sung.")
        worst = 3

    addr = row.get("address")
    if not addr:
        notes.append("THIẾU ĐỊA CHỈ — không nguồn nào tra được, phải gọi khách hỏi.")
        worst = 3
    else:
        fixed, typos = fix_typos(addr)
        if typos:
            notes.append(f"Sửa chính tả: {'; '.join(typos)}.")
            worst = max(worst, 1)

        prov, _ = guess_province(fixed)
        if not prov:
            notes.append("Địa chỉ KHÔNG nêu tỉnh/TP và KHÔNG suy ra được (tên đường trùng nhiều tỉnh) "
                         "— hỏi khách ở tỉnh/TP nào.")
            worst = max(worst, 2)
        if len(fixed) < 20:
            notes.append(f"Địa chỉ quá ngắn ({len(fixed)} ký tự) — thiếu số nhà/phường, thợ khó tìm.")
            worst = max(worst, 2)

    n = fix_name_case(row.get("full_name"))
    if n:
        notes.append(f"Tên nên viết lại: “{n}”.")
        worst = max(worst, 1)

    # có máy thật ngoài thị trường -> đẩy ưu tiên lên
    if worst >= 2 and may >= 2:
        worst = 3

    muc = {0: "", 1: "Thấp", 2: "Vừa", 3: "CAO"}[worst]
    return " ".join(notes), muc
