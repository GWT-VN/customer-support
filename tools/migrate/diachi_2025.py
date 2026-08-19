"""Chuẩn hoá địa chỉ theo cải cách hành chính 1/7/2025.

BỐI CẢNH (tra 2026-07-15, nguồn: vinhomes.vn, thuvienphapluat.vn, baochinhphu.vn):
  · Từ 1/7/2025 Việt Nam bỏ CẤP HUYỆN — chính quyền địa phương còn 2 cấp:
    tỉnh/thành phố → phường/xã. Địa chỉ chuẩn: số nhà, đường, PHƯỜNG/XÃ, TỈNH/TP.
  · 63 tỉnh → 34 tỉnh.  10.035 xã/phường → 3.321.

NGUYÊN TẮC: chỉ map cái ĐÃ TRA XÁC MINH. Không chắc -> để trống + ghi lý do.
Bịa địa chỉ = thợ đến sai nhà, tệ hơn để trống.

⚠️ BẪY ĐÃ GẶP: "Phú Mỹ Hưng" có HAI nơi khác hẳn nhau —
   khu đô thị Phú Mỹ Hưng (Quận 7 cũ) vs xã Phú Mỹ Hưng (Củ Chi, nay là xã An Nhơn Tây).
   Cách nhau ~40km. KHÔNG map tự động theo tên.
"""

import re

# ── Tỉnh cũ -> tỉnh mới (63 -> 34, hiệu lực 1/7/2025) ───────────────────────
#    Chỉ liệt kê những tỉnh THỰC SỰ xuất hiện trong data khách GWT.
TINH_CU_MOI = {
    "hải dương":  "Hải Phòng",
    "bắc kạn":    "Thái Nguyên",
    "vĩnh phúc":  "Phú Thọ",
    "hà nam":     "Ninh Bình",
    "bình dương": "TP.HCM",
    "bình phước": "Đồng Nai",
    "đắk nông":   "Lâm Đồng",
    "daknong":    "Lâm Đồng",
    "phú yên":    "Đắk Lắk",
    "yên bái":    "Lào Cai",
    "quảng bình": "Quảng Trị",
    "bắc giang":  "Bắc Ninh",
    "thái bình":  "Hưng Yên",
    "vũng tàu":   "TP.HCM",
    "bà rịa":     "TP.HCM",
    "quảng nam":  "Đà Nẵng",
    "kon tum":    "Quảng Ngãi",
}

# ── Khu đô thị -> địa chỉ chuẩn 2025. ĐÃ TRA XÁC MINH từng cái. ─────────────
#    (regex nhận dạng, đường/số nhà, phường/xã MỚI, tỉnh/TP MỚI, ghi chú tên cũ)
KDT = [
    (r"ocean\s?park\s*3|op3",
     "", "xã Tân Tiến", "Hưng Yên", "OP3 — trước: xã Tân Tiến/Nghĩa Trụ, h. Văn Giang"),
    (r"ocean\s?park\s*2|op2",
     "", "xã Nghĩa Trụ", "Hưng Yên", "OP2 — trước: h. Văn Giang, Hưng Yên"),
    (r"ocean\s?park\s*1|op1|ocean\s?park(?!\s*\d)|ocen\s?park|ocenpark",
     "", "xã Gia Lâm", "Hà Nội", "OP1 — trước: xã Đa Tốn/Dương Xá/Kiêu Kỵ, h. Gia Lâm"),
    (r"times?\s?city|tỉm city",
     "458 Minh Khai", "phường Vĩnh Tuy", "Hà Nội", "trước: p. Vĩnh Tuy/Mai Động, Q. Hai Bà Trưng"),
    (r"\becopark\b",
     "", "xã Phụng Công", "Hưng Yên", "trước: xã Xuân Quan/Cửu Cao/Phụng Công, h. Văn Giang"),
    (r"smart\s?city|smartcity|vinsmart",
     "", "phường Tây Mỗ", "Hà Nội", "trước: p. Tây Mỗ/Đại Mỗ, Q. Nam Từ Liêm"),
    (r"star\s?city|starcity",
     "Đại lộ Lê Lợi", "phường Hạc Thành", "Thanh Hoá", "trước: p. Đông Hải/Đông Hương, TP Thanh Hoá"),
    (r"thảo điền",
     "", "phường An Khánh", "TP.HCM", "trước: p. Thảo Điền, TP Thủ Đức"),
]

# ── Chuẩn hoá cách viết tên khu đô thị (Park2 -> Park 2, v.v.) ──────────────
VIET_LAI = [
    (r"\btime\s?city\b|\btỉm city\b", "Times City"),
    (r"\bocen\s?park\b|\bocenpark\b", "Ocean Park"),
    (r"\bvinhome\b(?!s)",             "Vinhomes"),
    (r"\bgadenia\b",                  "Gardenia"),
    (r"\bsmartcity\b",                "Smart City"),
    (r"\bstarcity\b",                 "Star City"),
    (r"\briveside\b",                 "Riverside"),
    (r"\bvinharmony\b",               "Vinhomes Harmony"),
    (r"\bgreenbay\b",                 "Green Bay"),
    (r"\bhà\s?noii\b",                "Hà Nội"),
    (r"\bĐương\b",                    "Đường"),
    (r"\bTh[uụ]y Kh[êe]\b",           "Thuỵ Khuê"),
    # tách số dính chữ: park2 -> Park 2, park9 -> Park 9, p3 -> P3
    (r"\bpark(\d+)\b",                r"Park \1"),
    (r"\btoa\b",                      "Toà"),
]


def viet_lai(addr):
    """Sửa chính tả + tách số dính chữ. -> (chuỗi mới, [mô tả đã sửa])."""
    if not addr:
        return addr, []
    out, done = addr, []
    for pat, repl in VIET_LAI:
        if re.search(pat, out, re.I):
            truoc = out
            out = re.sub(pat, repl, out, flags=re.I)
            if truoc != out:
                done.append(f"{truoc.strip()!r} → {out.strip()!r}" if len(done) == 0 else repl)
    return out, done


def doi_ten_tinh(addr):
    """Tỉnh cũ trong địa chỉ -> (tên tỉnh mới, mô tả). Không có -> (None, None)."""
    if not addr:
        return None, None
    low = addr.lower()
    for cu, moi in TINH_CU_MOI.items():
        if cu in low:
            return moi, f"{cu.title()} đã sáp nhập → {moi} (1/7/2025)"
    return None, None


def dia_chi_2025(addr):
    """-> (địa chỉ chuẩn 2025, căn cứ) hoặc (None, lý do không làm được).

    Chỉ dựng được khi nhận ra KHU ĐÔ THỊ đã tra xác minh. Còn lại trả None —
    không đoán phường/xã của nhà riêng lẻ.
    """
    if not addr:
        return None, "không có địa chỉ gốc"

    fixed, _ = viet_lai(addr)

    for pat, duong, phuong, tinh, ghichu in KDT:
        if re.search(pat, fixed, re.I):
            # giữ lại phần chi tiết căn/toà của khách (bỏ phần hành chính cũ)
            chi_tiet = re.split(r",|\s+-\s+", fixed)[0].strip()
            phan = [chi_tiet]
            if duong:
                phan.append(duong)
            phan += [phuong, tinh]
            return ", ".join(p for p in phan if p), ghichu

    # không nhận ra KĐT -> chỉ đổi được tên tỉnh nếu có
    tinh_moi, vi_sao = doi_ten_tinh(fixed)
    if tinh_moi:
        return None, f"CHỈ đổi được tên tỉnh: {vi_sao}. Phường/xã phải hỏi khách."
    return None, "không nhận ra khu đô thị đã tra — phường/xã phải hỏi khách, không đoán"
