# Phân tích bộ hồ sơ CTG BuildHub — Dev Handoff V1.0

**Đối tượng phân tích:** `CTG_BUILDHUB_DEV_HANDOFF_V1.0.zip` — 10 tài liệu Word + README + Manifest
**Ngày phát hành hồ sơ:** 22/08/2026 · **Baseline:** 61 quy trình nghiệp vụ CTG BuildHub V1.0
**Ngày phân tích:** 25/08/2026
**Toàn vẹn gói:** 10/10 file khớp SHA-256 và dung lượng khai báo trong `00_MANIFEST.json`

---

## 1. Kết luận điều hành

Gói hồ sơ này là một **Solution Outline / Pre-Dev Baseline chất lượng tốt**, nhưng **chưa đạt chuẩn "Dev Handoff"** theo đúng nghĩa bàn giao cho đội phát triển thi công.

| Câu hỏi | Trả lời |
|---|---|
| Đủ để chốt kiến trúc, lập backlog Epic, khởi động R0–R1? | **Có** |
| Đủ để một team dev độc lập code R2 Commerce MVP mà không hỏi lại? | **Chưa** |
| Rào chắn lớn nhất | Không có API contract thật, ma trận phân quyền rỗng, data model không có cấu trúc, 4 quyết định nghiệp vụ chưa chốt |
| Ước lượng độ sẵn sàng tổng thể | **≈ 45%** so với chuẩn bàn giao |

Nghịch lý cốt lõi cần xử lý ngay: README quy định **"Dev không tự đặt business rule/hạn mức/tolerance"**, trong khi SRS viện dẫn "hạn mức" 6 lần, "tolerance" 2 lần, "ngưỡng" 1 lần mà **không có phụ lục tham số nào**. Nếu Decision Log PD-03 không chốt trước Sprint 0, đội dev bị khóa cứng: không được giả định, cũng không có số để code.

---

## 2. Bản đồ nội dung và kiểm tra nhất quán số học

Phần khung xương của hồ sơ rất chỉn chu. Kiểm đếm tự động cho kết quả khớp tuyệt đối:

| Chỉ số | Số lượng | Kết quả |
|---|---|---|
| Quy trình baseline khai báo | 61 | — |
| Requirement nghiệp vụ (BR-xxx-nn) | 61 (+6 BR-GEN xuyên hệ thống) | ✅ khớp |
| Đặc tả chức năng (FS-xxx-nn) | 61 | ✅ khớp |
| Dòng ma trận truy xuất RTM | 61 | ✅ khớp |
| Màn hình (LST + DTL) | 122 = 61 × 2 | ✅ khớp |
| Event catalog | 61 | ✅ khớp |
| Cột "AI" trong SRS | 61/61 có giá trị | ✅ khớp |
| Cột "Audit/Event" trong SRS | 61/61 có giá trị | ✅ khớp |
| Phân bổ ưu tiên BRD | 37 Must / 24 Should | — |

Phân bổ 12 miền nghiệp vụ: IAM 5 · PRJ 6 · DSN 6 · SRC 7 · COM 6 · FUL 5 · CON 8 · WRK 4 · FIN 4 · SUP 4 · TRS 2 · ADM 4 = **61**.

Kết luận: **không có quy trình nào bị bỏ sót hoặc nhân đôi** giữa các tài liệu. Đây là điểm mạnh thực sự.

---

## 3. Điểm mạnh cần giữ nguyên

1. **Sợi truy xuất 7 lớp** (Process → Requirement → Function → Screen/API/Data → Test → Evidence) được khai báo nhất quán ở cả 10 tài liệu, không phải khẩu hiệu.
2. **Kỷ luật kiểm soát hiếm gặp** trong tài liệu nội địa: bản ghi đã phát hành là bất biến (sửa bằng revision/adjustment), idempotency bắt buộc cho POST tài chính/đơn hàng, outbox/inbox chống mất–trùng event, maker–checker, và 4 quy tắc SoD cụ thể (người tạo không tự duyệt; người đổi tài khoản NCC không duyệt thanh toán đầu; Storekeeper không tự duyệt chênh kiểm kê; AI không là approver pháp lý).
3. **Bộ abuse-case CT-01…CT-12** đánh trúng rủi ro thật của ngành: tách PR né hạn mức, nhận hàng vượt/không PO, hóa đơn thiếu GRN, gian lận đổi tài khoản ngân hàng, đồng bộ trùng khi offline, AI rò rỉ chéo tenant, AI gọi tool vượt quyền. Đây là tư duy kiểm soát chín, không phải checklist hình thức.
4. **Quản trị AI đúng chuẩn**: Human Gate bắt buộc, tool allowlist, kill switch, golden set tách khỏi dữ liệu phát triển, canary, và Business Owner phải ký kết quả eval trước khi phát hành.
5. **ADR-002: modular monolith + event outbox cho MVP**, kèm câu "không tách microservice theo từng màn hình" — lựa chọn kiến trúc đúng cho quy mô pilot 1–2 dự án, tránh được bẫy phổ biến nhất.
6. **Quyết định treo được quản lý minh bạch** bằng Decision Log thay vì giấu dưới dạng giả định ngầm.

---

## 4. Phát hiện: Blocker (phải xử lý trước Sprint 0)

### B-01 — Ma trận phân quyền là khung rỗng
Tài liệu 04 có 61 dòng Process Permission Matrix, nhưng **61/61 dòng có cột Action và Scope giống hệt nhau** (`View/Create/Submit/Approve theo step` / `Org+Project+Package`). Tương tự, **20/20 vai trò trong Role Catalog có mô tả phạm vi và dữ liệu nhạy cảm giống hệt nhau**. Approval Matrix ghi ngưỡng là "Cấu hình theo pháp nhân" — tức chưa có số.

*Hệ quả:* không thể cấu hình policy engine ABAC; không thể viết test CT-01/CT-03; kiến trúc ADR-003 (ABAC theo org/project/package) không có dữ liệu đầu vào.

### B-02 — Không tồn tại API contract
Tài liệu 08 chỉ liệt kê **12 base path × {GET, POST} = 24 dòng** ở mức miền. Trong khi đó RTM (tài liệu 10) truy xuất tới **61 mã `API-xxx-nn`** — những mã này **không xuất hiện ở bất kỳ đâu trong gói**. Không có request/response schema, không có mã lỗi theo endpoint, không có phân trang/lọc, không có OpenAPI.

*Hệ quả:* frontend và backend không thể làm việc song song; hợp đồng tích hợp ERP/bank/e-invoice không thể ký.

### B-03 — Chuẩn định danh kỹ thuật không dùng được
- **22/24 API path** chứa tiếng Việt có dấu: `/api/v1/định-danh-và-tổ-chức`, `/api/v1/dự-án`, `/api/v1/thi-công`…
- **61/61 tên event** là tiếng Việt CamelCase có dấu, trong đó **15 tên chứa dấu phẩy**: `Thay Đổi,HủyHoặcĐóngPoChanged`, `Nhập,Xuất,ChuyểnVàKiểmKêKhoChanged`…

*Hệ quả:* URL vi phạm RFC 3986 (phải percent-encode, log và trace trở nên vô nghĩa); tên topic có dấu phẩy không hợp lệ với hầu hết message broker; sinh code từ schema sẽ hỏng.

### B-04 — Data model không đủ để sinh migration
Tài liệu 08 chỉ liệt kê 8 nhóm entity dưới dạng danh sách phẳng. **Không có** khóa chính/khóa ngoại, quan hệ, lực lượng (cardinality), kiểu dữ liệu, ràng buộc, index, hay từ điển trường.

Ngoài ra, **ít nhất 14 entity mà chính SRS yêu cầu lại vắng mặt**:

| Quy trình yêu cầu | Entity thiếu |
|---|---|
| COM-02 (đề nghị mua) | `purchase_requisition` |
| COM-01 (nhu cầu vật tư) | `demand_plan`, `boq` |
| COM-06 (bảng giá) | `price_list` |
| COM-05 (vật tư thay thế) | `substitution` |
| SRC-07 (bảo lãnh/bảo hiểm) | `guarantee` / `bond` |
| PRJ-03 (ngân sách cơ sở) | `budget` |
| PRJ-04 / CON-08 (tiến độ) | `schedule_activity` |
| WRK-02 (khoán việc) | `work_order` |
| WRK-03 (chấm công) | `time_record` |
| WRK-01 (đội thợ) | `crew` / `crew_member` |
| FIN-03 (đối soát ngân hàng) | `bank_statement` |
| Xuyên suốt (BR-GEN-05) | `audit_log` |
| Xuyên suốt | `notification`, `attachment` |

Đáng chú ý: `purchase_requisition` là mắt xích **bắt buộc** của KPI số 1 trong tài liệu 01 ("PR→RFQ→Award→PO→GRN→Invoice trace đạt 100% pilot") — nhưng không có trong data model.

### B-05 — Decision Log chưa chốt và không có mốc ngày thật
PD-01 (dự án/nhóm vật tư pilot), PD-02 (seller-of-record), PD-03 (hạn mức/tolerance), PD-04 (System of Record kế toán) đều còn mở; hạn chỉ ghi tương đối ("Trước Sprint 0", "Trước UAT"), không có ngày cụ thể và không có cơ chế leo thang khi trễ.

PD-03 chặn trực tiếp: COM-02 (chống tách PR né hạn mức), COM-03 (PO không vượt tolerance), FUL-02 (chặn nhận vượt PO ngoài tolerance), FUL-04 (ngưỡng adjustment cần duyệt độc lập), FIN-01/FIN-02 (chính sách 3-way và phê duyệt nhiều cấp), và toàn bộ Approval Matrix ở tài liệu 04.

---

## 5. Phát hiện: Nghiêm trọng

### S-01 — Sợi truy xuất đứt tại 17/61 quy trình (28%)
Mã màn hình trong RTM (tài liệu 10) **không tồn tại** trong Screen Inventory (tài liệu 05):

| RTM ghi | Screen Inventory thực có | Số quy trình ảnh hưởng |
|---|---|---|
| `SITE-031-DTL` … `SITE-043-DTL` | `WRK-031-DTL` … `WRK-043-DTL` | 13 (FUL-01…05, CON-01…08) |
| `FIN-048-DTL` … `FIN-051-DTL` | `OWN-048-DTL` … `OWN-051-DTL` | 4 (FIN-01…04) |

Đây chính là các quy trình tiền và kho — nhóm rủi ro cao nhất. Sợi truy xuất là cam kết trung tâm của cả bộ hồ sơ, nên lỗi này phải sửa trước khi bất kỳ tài liệu nào được ký baseline.

### S-02 — Hai ứng dụng có 0 màn hình
Navigation Model khai báo 9 app, nhưng Screen Inventory chỉ phủ 7:

| App | Số quy trình có màn hình |
|---|---|
| Worker/Site PWA | 17 |
| Materials | 13 |
| Project Owner | 10 |
| Design | 6 |
| Control Center | 6 |
| BuildHub One | 5 |
| Supplier | 4 |
| **Contractor** | **0** |
| **Public Web** | **0** |

Trong khi đó BRD gán app "Contractor" cho **31/61 requirement**. Một app xuất hiện ở hơn nửa số yêu cầu nghiệp vụ mà không có màn hình nào là mâu thuẫn nội bộ nghiêm trọng.

### S-03 — Gán ứng dụng sai ngữ cảnh sử dụng
Toàn bộ 17 quy trình FUL + CON bị dồn vào **Worker/Site PWA**, bao gồm cả những việc rõ ràng thuộc văn phòng: FUL-01 (NCC lập kế hoạch giao hàng, ASN) và CON-08 (Planner/PM/Sponsor theo dõi tiến độ, dự báo chậm). Ngược lại, FIN-01…04 nằm trong app **Project Owner** dù actor được SRS ghi là Supplier/AP/Treasury/Bank.

*Hệ quả:* ước lượng khối lượng PWA bị thổi phồng, yêu cầu offline bị áp nhầm chỗ, và ranh giới bounded context bị vẽ sai ngay từ đầu.

### S-04 — Agent Catalog được sinh máy móc, không phải thiết kế
58 dòng AG-001…AG-058 được suy ra trực tiếp từ cột "AI" của SRS rồi sắp xếp theo alphabet, dẫn tới:
- **10/58 dòng là tên ghép** (`Document AI; Identity Agent`, `Quality Agent; RCA Agent`…) — hai agent bị đếm thành một.
- **`Document AI` xuất hiện ở 3 mã khác nhau** (AG-017, AG-018, AG-022); **`Identity Agent` cũng ở 3 mã** (AG-017, AG-021, AG-022).
- **58/58 dòng có Scope, Tool policy, Gate, KPI giống hệt nhau.**

Tài liệu có mẫu Agent Card rất tốt ở mục 3, nhưng **không có agent nào được điền theo mẫu đó**. Chưa thể xây dựng eval set hay tính chi phí token.

### S-05 — SRS thiếu chiều sâu để lập trình
61 đặc tả có cấu trúc đẹp (Actor/Trigger/Flow/Validation/Exception/State/AI/Postcondition), nhưng:
- **Precondition giống hệt nhau ở 61/61 đặc tả** ("Actor active; đúng org/project/role; dữ liệu nguồn hợp lệ") — tức không có tiền điều kiện thật.
- Không có **validation cấp trường** (bắt buộc/định dạng/độ dài/khoảng giá trị).
- Không có **tiêu chí chấp nhận dạng Given/When/Then**.
- SLA được nhắc 3 lần nhưng **không có con số nào**.
- Không có sequence diagram hay state machine chính thức, dù mỗi đặc tả đều khai báo chuỗi trạng thái.

### S-06 — Không có bộ Test Case
RTM trỏ tới `TC-xxx-01..05` cho cả 61 quy trình (≈ **305 ca kiểm thử**), nhưng gói **không chứa nội dung ca nào**. Tiêu chí Exit của UAT ("100% critical pass; ≥95% total") do đó không đo được, và quy tắc số 3 của README ("chỉ nghiệm thu khi có Test Case và Execution Evidence") không thể thực thi.

### S-07 — MVP scope và ưu tiên BRD không khớp
- Tài liệu 01 đưa **Field (Site PWA: receiving, daily plan/report, inspection)** vào MVP, nhưng BRD gắn nhãn **Should** cho CON-02/03/04.
- Toàn bộ miền **DSN là Should**, trong khi tài liệu 01 xếp Design vào tận **R4 Scale**.
- **Không có bảng ánh xạ 61 quy trình → R1/R2/R3/R4.** Đội dev không biết quy trình nào thuộc sprint nào.

---

## 6. Phát hiện: Trung bình

| ID | Nội dung |
|---|---|
| M-01 | **NFR tự mâu thuẫn**: Availability ≥99.5%/tháng cho phép ~3h39' downtime, nhưng RTO Tier-1 là ≤4h — một sự cố đúng bằng RTO đã phá vỡ SLA của cả tháng. |
| M-02 | **NFR thiếu**: số người dùng đồng thời, dung lượng dữ liệu/kích thước file tối đa, thời lượng offline tối đa trước khi buộc sync, cửa sổ chạy batch/AI job, thời hạn lưu trữ cụ thể theo loại bản ghi. |
| M-03 | **Design System chưa dùng được**: font Arial, màu mô tả bằng chữ ("Navy primary; teal action") không có mã hex, không có thang màu semantic; 18/18 component và 14/14 flow có tiêu chí chấp nhận giống hệt nhau. |
| M-04 | **KPI không đo được**: "giảm ≥30% thời gian xử lý RFQ so baseline" nhưng baseline chưa từng được đo; "agent acceptance ≥70%" chưa định nghĩa công thức tính. |
| M-05 | **Event model quá thô**: mỗi quy trình chỉ có duy nhất một event `…Changed`, mâu thuẫn với SRS ("event theo trạng thái"); consumer buộc phải mở payload mới biết chuyện gì xảy ra. Không có schema trường, không có chính sách tương thích ngược dù đã ghi "v1". |
| M-06 | **Thiếu chiều pháp lý Việt Nam**: WRK-01 thu thập CCCD và WRK-03 dùng xác thực liveness — dữ liệu sinh trắc học thuộc nhóm nhạy cảm theo Nghị định 13/2023/NĐ-CP, nhưng hồ sơ không nhắc tới nghĩa vụ nào. Tương tự, tích hợp e-invoice và e-sign không viện dẫn khung pháp lý hóa đơn điện tử và chữ ký số. |
| M-07 | **Thiếu tài liệu trong gói**: OpenAPI/AsyncAPI · ERD + DDL · test case book · kế hoạch migration & cutover · thiết kế môi trường/CI-CD/DevOps · glossary & data dictionary · ước lượng nguồn lực và roadmap có mốc ngày · danh sách vendor bên thứ ba (e-sign, OCR, ngân hàng, BIM). |

---

## 7. Đánh giá độ sẵn sàng theo từng tài liệu

| # | Tài liệu | Mức độ | Ước lượng | Ghi chú |
|---|---|---|---|---|
| 01 | Product Vision & MVP Scope | Sẵn sàng | 85% | Thiếu mốc ngày và cách đo baseline KPI |
| 02 | BRD toàn hệ sinh thái | Sẵn sàng | 80% | Thiếu ánh xạ quy trình → release |
| 03 | Functional Spec / SRS | Cần bổ sung mạnh | 50% | Khung tốt, thiếu validation/AC/SLA |
| 04 | Role–Permission–Approval | **Khung rỗng** | 15% | Chặn ABAC và toàn bộ kiểm soát phê duyệt |
| 05 | Screen Inventory & IA | Cần bổ sung | 55% | Lỗi mã ở 17 dòng, 2 app trống |
| 06 | UI/UX & Design System | **Khung rỗng** | 25% | Chưa đủ dựng UI kit |
| 07 | Solution Architecture | Sẵn sàng có điều kiện | 70% | ADR tốt; NFR cần siết |
| 08 | Database / API / Event | **Khung rỗng về contract** | 30% | Blocker B-02, B-03, B-04 |
| 09 | AI Agent Spec & Evaluation | Cần bổ sung | 40% | Mẫu tốt, chưa có agent card thật |
| 10 | Test / Traceability / UAT | Cần bổ sung | 45% | Thiếu toàn bộ nội dung test case |

---

## 8. Khuyến nghị hành động

### Đợt 1 — Trước Sprint 0 (ưu tiên tuyệt đối, ~2 tuần)
1. **Chốt PD-01…PD-04** kèm phụ lục tham số bằng số: hạn mức phê duyệt theo pháp nhân, tolerance nhận hàng theo nhóm vật tư, ngưỡng adjustment kho, chính sách 3-way. *(CFO / Process Owner)*
2. **Sửa 17 mã màn hình sai** trong RTM: `SITE-031…043` → `WRK-031…043`, `FIN-048…051` → `OWN-048…051`, rồi tái phát hành tài liệu 10. *(Product Council)*
3. **Ban hành chuẩn định danh kỹ thuật ASCII**: đổi API path sang `/api/v1/{domain}` tiếng Anh, đổi tên event sang `ctg.{domain}.{entity}.{state}.v1`, cấm dấu tiếng Việt và dấu phẩy trong mọi identifier. *(Kiến trúc sư trưởng)*
4. **Điền ma trận RBAC thật** dạng `role × resource × action × condition` cho tối thiểu 3 miền của R2: COM, FUL, FIN. *(Process Owner + Security)*
5. **Quyết định chủ sở hữu app** cho FUL/CON/FIN và bổ sung màn hình cho app Contractor. *(Product Council)*

### Đợt 2 — Trong Sprint 0 (~3–4 tuần)
6. **OpenAPI 3.1** cho trọn luồng xương sống PR → RFQ → Award → PO → GRN → Invoice → Payment (22 đặc tả thuộc R2).
7. **ERD + DDL + migration script**, bổ sung 14 entity còn thiếu, đặc biệt `purchase_requisition`, `budget`, `time_record`, `audit_log`.
8. **Given/When/Then** cho 22 đặc tả R2 kèm validation cấp trường và số SLA cụ thể.
9. **Design tokens có mã hex** + dựng 18 component với trạng thái loading/error/empty/disabled/permission-aware thật.
10. **Siết NFR**: gỡ mâu thuẫn 99.5% ↔ RTO 4h; bổ sung concurrent users, giới hạn file, cửa sổ offline.

### Đợt 3 — Song song R2 (~6 tuần)
11. **Test case book**: 12 abuse-case CT-01…CT-12 + ~110 ca cho 22 đặc tả R2.
12. **Agent Card thật** cho 6 agent pilot (BOQ Reader, Demand Planner, RFQ Analyst, Receiving Assistant, Discrepancy Agent, Payment Auditor) + golden set tách biệt + ngưỡng eval bằng số.
13. **Rà soát tuân thủ**: Nghị định 13/2023/NĐ-CP cho CCCD và dữ liệu sinh trắc học; khung pháp lý hóa đơn điện tử và chữ ký số cho tích hợp e-invoice/e-sign.
14. **Đo baseline KPI hiện tại** để chỉ tiêu "giảm ≥30%" trở nên đo được.

---

## 9. Đề xuất mở rộng Decision Log

| ID | Quyết định cần chốt | Owner đề xuất | Chặn việc gì |
|---|---|---|---|
| PD-05 | Chuẩn định danh API path và tên event (ASCII) | Kiến trúc sư trưởng | B-03, toàn bộ code generation |
| PD-06 | Phân loại dữ liệu + thời hạn lưu trữ, gồm dữ liệu sinh trắc học | Security + Legal | M-06, thiết kế bảng và mã hóa |
| PD-07 | Chủ sở hữu ứng dụng cho FUL / CON / FIN; phạm vi app Contractor | Product Council | S-02, S-03, ước lượng PWA |
| PD-08 | Lựa chọn vendor e-sign, OCR, ngân hàng, BIM | CIO + Procurement | Integration Matrix, hợp đồng |
| PD-09 | Định nghĩa và phương pháp đo baseline KPI | Product + PMO | M-04, tiêu chí nghiệm thu R3 |
| PD-10 | Ánh xạ 61 quy trình → R1/R2/R3/R4 | Product Council | S-07, lập kế hoạch sprint |

---

## 10. Nhận định cuối

Bộ hồ sơ thể hiện tư duy quản trị chín: kỷ luật bất biến, phân tách nhiệm vụ, kiểm soát AI có Human Gate, và bộ abuse-case đúng trọng tâm rủi ro ngành xây dựng. Khung xương truy xuất 61 quy trình khớp tuyệt đối qua cả 10 tài liệu — điều hiếm thấy.

Vấn đề nằm ở **độ sâu, không phải độ rộng**. Ba tài liệu quyết định khả năng thi công — 04 (phân quyền), 06 (design system) và 08 (API/data/event) — hiện đang ở dạng khung mẫu với giá trị mặc định lặp lại, chứ chưa phải nội dung thiết kế. Cùng với 4 quyết định nghiệp vụ chưa chốt, đây là toàn bộ khoảng cách giữa "hồ sơ đẹp" và "hồ sơ code được".

Khoảng cách này hoàn toàn khắc phục được: **ước tính 4–6 tuần công việc đặc tả tập trung**, phần lớn có thể chạy song song với Sprint 0, để đưa gói lên đúng chuẩn bàn giao cho R2 Commerce MVP.
