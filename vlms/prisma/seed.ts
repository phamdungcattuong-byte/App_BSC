import { PrismaClient, OrgType, Role } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'matkhau123';

async function main() {
  console.log('Đang xóa dữ liệu cũ...');
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.idempotencyKey.deleteMany(),
    // Xóa theo đúng thứ tự phụ thuộc khóa ngoại: bản ghi con trước, cha sau.
    prisma.creditNote.deleteMany(),
    prisma.discrepancy.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.paymentRequestLine.deleteMany(),
    prisma.paymentRequest.deleteMany(),
    prisma.supplierBankAccount.deleteMany(),
    prisma.matchResult.deleteMany(),
    prisma.invoiceLine.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.grnLine.deleteMany(),
    prisma.grn.deleteMany(),
    prisma.poLine.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.award.deleteMany(),
    prisma.quoteLine.deleteMany(),
    prisma.quote.deleteMany(),
    prisma.rfqInvitation.deleteMany(),
    prisma.rfqLine.deleteMany(),
    prisma.rfq.deleteMany(),
    prisma.prLine.deleteMany(),
    prisma.purchaseRequisition.deleteMany(),
    prisma.catalogItem.deleteMany(),
    prisma.material.deleteMany(),
    prisma.materialCategory.deleteMany(),
    prisma.wbs.deleteMany(),
    prisma.project.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
  ]);

  console.log('Tạo tổ chức...');
  const buyer = await prisma.organization.create({
    data: {
      code: 'CTG-XD',
      name: 'Công ty Cổ phần Xây dựng Cát Tường',
      taxCode: '0301234567',
      type: OrgType.BUYER,
      address: 'Số 12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
      phone: '02838221100',
    },
  });

  const platform = await prisma.organization.create({
    data: {
      code: 'BUILDHUB',
      name: 'CTG BuildHub - Quản trị sàn',
      taxCode: '0309876543',
      type: OrgType.PLATFORM,
      address: 'Số 12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    },
  });

  const supplierSeeds = [
    { code: 'NCC-THEP', name: 'Công ty TNHH Thép Xây dựng Đông Á', taxCode: '0312345001', address: 'KCN Sóng Thần, Bình Dương' },
    { code: 'NCC-XIMANG', name: 'Công ty CP Xi măng và Vật liệu Bình Minh', taxCode: '0312345002', address: 'Quốc lộ 1A, Long An' },
    { code: 'NCC-TONGHOP', name: 'Công ty TNHH Vật liệu Xây dựng Nam Phát', taxCode: '0312345003', address: 'Đường Vành đai 3, TP. Thủ Đức' },
  ];

  const suppliers = [];
  for (const s of supplierSeeds) {
    suppliers.push(
      await prisma.organization.create({
        data: { ...s, type: OrgType.SUPPLIER, phone: '02836667788' },
      }),
    );
  }

  console.log('Tạo người dùng...');
  const passwordHash = hashPassword(DEMO_PASSWORD);
  const buyerUsers: Array<{ email: string; fullName: string; role: Role }> = [
    { email: 'denghi@cattuong.vn', fullName: 'Trần Quốc Dũng', role: Role.REQUESTER },
    { email: 'muahang@cattuong.vn', fullName: 'Nguyễn Thị Lan', role: Role.BUYER },
    { email: 'pheduyet@cattuong.vn', fullName: 'Lê Minh Hoàng', role: Role.APPROVER },
    { email: 'nhanhang@cattuong.vn', fullName: 'Phạm Văn Tiến', role: Role.RECEIVER },
    { email: 'ketoan@cattuong.vn', fullName: 'Vũ Thu Hà', role: Role.AP },
    { email: 'nganquy@cattuong.vn', fullName: 'Đỗ Trung Kiên', role: Role.TREASURY },
  ];
  for (const u of buyerUsers) {
    await prisma.user.create({
      data: { ...u, passwordHash, organizationId: buyer.id },
    });
  }

  await prisma.user.create({
    data: {
      email: 'quantri@buildhub.vn',
      fullName: 'Quản trị sàn BuildHub',
      role: Role.PLATFORM_ADMIN,
      passwordHash,
      organizationId: platform.id,
    },
  });

  const supplierLogins = ['ncc.thep@donga.vn', 'ncc.ximang@binhminh.vn', 'ncc.vlxd@namphat.vn'];
  const supplierNames = ['Đặng Hữu Nam', 'Bùi Thị Mai', 'Hoàng Văn Sơn'];
  for (let i = 0; i < suppliers.length; i += 1) {
    await prisma.user.create({
      data: {
        email: supplierLogins[i],
        fullName: supplierNames[i],
        role: Role.SUPPLIER_ADMIN,
        passwordHash,
        organizationId: suppliers[i].id,
      },
    });
  }

  console.log('Tạo dự án và WBS...');
  const project = await prisma.project.create({
    data: {
      code: 'CTPS-2026',
      name: 'Khu dân cư Cát Tường Phú Sinh - Giai đoạn 2',
      organizationId: buyer.id,
      location: 'Huyện Đức Hòa, tỉnh Long An',
    },
  });

  const wbsSeeds = [
    { code: 'WBS-01', name: 'Phần móng và hầm', budget: 12_000_000_000 },
    { code: 'WBS-02', name: 'Phần thân khối A', budget: 28_000_000_000 },
    { code: 'WBS-03', name: 'Phần thân khối B', budget: 26_000_000_000 },
    { code: 'WBS-04', name: 'Hoàn thiện và MEP', budget: 18_000_000_000 },
  ];
  const wbsList = [];
  for (const w of wbsSeeds) {
    wbsList.push(await prisma.wbs.create({ data: { ...w, projectId: project.id } }));
  }

  console.log('Tạo danh mục vật liệu...');
  const categorySeeds = [
    { code: 'CAT-THEP', name: 'Thép và kim loại' },
    { code: 'CAT-XIMANG', name: 'Xi măng và phụ gia' },
    { code: 'CAT-GACH', name: 'Gạch và vật liệu xây' },
    { code: 'CAT-CATDA', name: 'Cát, đá và bê tông' },
    { code: 'CAT-MEP', name: 'Điện nước và MEP' },
    { code: 'CAT-HOANTHIEN', name: 'Vật tư hoàn thiện' },
  ];
  const categories: Record<string, string> = {};
  for (const c of categorySeeds) {
    const created = await prisma.materialCategory.create({ data: c });
    categories[c.code] = created.id;
  }

  const materialSeeds = [
    { code: 'VT-TH-D10', name: 'Thép thanh vằn D10 CB400-V', cat: 'CAT-THEP', uom: 'kg', spec: 'TCVN 1651-2:2018, cuộn 11.7m', price: 17_800 },
    { code: 'VT-TH-D12', name: 'Thép thanh vằn D12 CB400-V', cat: 'CAT-THEP', uom: 'kg', spec: 'TCVN 1651-2:2018, cây 11.7m', price: 17_500 },
    { code: 'VT-TH-D16', name: 'Thép thanh vằn D16 CB400-V', cat: 'CAT-THEP', uom: 'kg', spec: 'TCVN 1651-2:2018, cây 11.7m', price: 17_300 },
    { code: 'VT-TH-D20', name: 'Thép thanh vằn D20 CB400-V', cat: 'CAT-THEP', uom: 'kg', spec: 'TCVN 1651-2:2018, cây 11.7m', price: 17_200 },
    { code: 'VT-TH-HOP', name: 'Thép hộp mạ kẽm 50x100x2.0mm', cat: 'CAT-THEP', uom: 'cây', spec: 'Dài 6m, mạ kẽm nhúng nóng', price: 385_000 },
    { code: 'VT-XM-PCB40', name: 'Xi măng PCB40 bao 50kg', cat: 'CAT-XIMANG', uom: 'bao', spec: 'TCVN 6260:2020', price: 92_000 },
    { code: 'VT-XM-PC50', name: 'Xi măng PC50 rời', cat: 'CAT-XIMANG', uom: 'tấn', spec: 'TCVN 2682:2020, xe bồn', price: 1_780_000 },
    { code: 'VT-XM-PGSD', name: 'Phụ gia siêu dẻo gốc Polycarboxylate', cat: 'CAT-XIMANG', uom: 'lít', spec: 'Can 25 lít, giảm nước 25%', price: 48_000 },
    { code: 'VT-GA-TUYNEL', name: 'Gạch ống tuynel 8x8x18cm', cat: 'CAT-GACH', uom: 'viên', spec: 'Mác A1, độ hút nước dưới 16%', price: 1_450 },
    { code: 'VT-GA-BLOCK', name: 'Gạch block bê tông 190x190x390mm', cat: 'CAT-GACH', uom: 'viên', spec: 'Cường độ nén 7.5 MPa', price: 9_800 },
    { code: 'VT-GA-AAC', name: 'Gạch nhẹ AAC 100x200x600mm', cat: 'CAT-GACH', uom: 'viên', spec: 'Khối lượng thể tích 600 kg/m3', price: 14_500 },
    { code: 'VT-CD-CATBT', name: 'Cát bê tông rửa sạch', cat: 'CAT-CATDA', uom: 'm3', spec: 'Module độ lớn 2.0 đến 3.3', price: 420_000 },
    { code: 'VT-CD-CATXAY', name: 'Cát xây tô', cat: 'CAT-CATDA', uom: 'm3', spec: 'Hàm lượng bùn sét dưới 3%', price: 340_000 },
    { code: 'VT-CD-DA1x2', name: 'Đá dăm 1x2 cm', cat: 'CAT-CATDA', uom: 'm3', spec: 'Đá xanh Hóa An, sạch', price: 465_000 },
    { code: 'VT-CD-BTTP', name: 'Bê tông thương phẩm M300 (B22.5)', cat: 'CAT-CATDA', uom: 'm3', spec: 'Độ sụt 12 ± 2cm, xe bồn', price: 1_320_000 },
    { code: 'VT-ME-CVV', name: 'Cáp điện Cadivi CVV 3x2.5mm2', cat: 'CAT-MEP', uom: 'm', spec: 'Ruột đồng, cách điện PVC 0.6/1kV', price: 38_500 },
    { code: 'VT-ME-PPRD25', name: 'Ống nhựa PPR D25 PN20', cat: 'CAT-MEP', uom: 'm', spec: 'Chịu nhiệt 95 độ C, cây 4m', price: 42_000 },
    { code: 'VT-ME-UPVC90', name: 'Ống thoát nước uPVC D90', cat: 'CAT-MEP', uom: 'm', spec: 'Dày 2.5mm, cây 4m', price: 58_000 },
    { code: 'VT-HT-SONLOT', name: 'Sơn lót chống kiềm nội thất', cat: 'CAT-HOANTHIEN', uom: 'thùng', spec: 'Thùng 18 lít, phủ 8 đến 10 m2/lít', price: 1_150_000 },
    { code: 'VT-HT-GACHLAT', name: 'Gạch lát nền granite 600x600mm', cat: 'CAT-HOANTHIEN', uom: 'm2', spec: 'Độ hút nước dưới 0.5%, chống trơn R9', price: 235_000 },
  ];

  const materials = [];
  for (const m of materialSeeds) {
    materials.push(
      await prisma.material.create({
        data: {
          code: m.code,
          name: m.name,
          categoryId: categories[m.cat],
          uom: m.uom,
          spec: m.spec,
        },
      }),
    );
  }

  console.log('Tạo catalog nhà cung cấp...');
  // Mỗi nhà cung cấp mạnh ở một nhóm hàng, nhưng có phủ chéo để so sánh báo giá.
  const coverage: Array<{ supplierIdx: number; cats: string[]; factor: number }> = [
    { supplierIdx: 0, cats: ['CAT-THEP', 'CAT-MEP'], factor: 1.0 },
    { supplierIdx: 1, cats: ['CAT-XIMANG', 'CAT-CATDA', 'CAT-GACH'], factor: 1.0 },
    { supplierIdx: 2, cats: ['CAT-THEP', 'CAT-XIMANG', 'CAT-GACH', 'CAT-CATDA', 'CAT-MEP', 'CAT-HOANTHIEN'], factor: 1.045 },
  ];

  for (const cov of coverage) {
    const supplier = suppliers[cov.supplierIdx];
    for (let i = 0; i < materialSeeds.length; i += 1) {
      const seed = materialSeeds[i];
      if (!cov.cats.includes(seed.cat)) continue;
      // Chênh lệch giá nhẹ giữa các NCC để màn hình so sánh báo giá có ý nghĩa.
      const jitter = 1 + ((i % 5) - 2) * 0.012;
      await prisma.catalogItem.create({
        data: {
          organizationId: supplier.id,
          materialId: materials[i].id,
          sku: `${supplier.code}-${seed.code}`,
          brand: supplier.name.includes('Đông Á') ? 'Đông Á' : supplier.name.includes('Bình Minh') ? 'Bình Minh' : 'Nam Phát',
          listPrice: Math.round((seed.price * cov.factor * jitter) / 100) * 100,
          leadTimeDays: 3 + (i % 5),
          minOrderQty: seed.uom === 'm3' || seed.uom === 'tấn' ? 5 : 100,
          certification: seed.cat === 'CAT-THEP' ? 'CO/CQ theo lô' : null,
        },
      });
    }
  }

  console.log('Tạo tài khoản ngân hàng nhà cung cấp...');
  // Một tài khoản đã xác minh sẵn để luồng thanh toán chạy được ngay,
  // người xác minh là kế toán công nợ nên người phê duyệt phải là người khác.
  const apUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'ketoan@cattuong.vn' },
  });
  const bankSeeds = [
    { idx: 0, bank: 'Ngân hàng TMCP Ngoại thương Việt Nam', branch: 'Chi nhánh Bình Dương', number: '0071000123456' },
    { idx: 1, bank: 'Ngân hàng TMCP Công thương Việt Nam', branch: 'Chi nhánh Long An', number: '0102000654321' },
    { idx: 2, bank: 'Ngân hàng TMCP Á Châu', branch: 'Chi nhánh Thủ Đức', number: '0203000987654' },
  ];
  for (const b of bankSeeds) {
    const supplier = suppliers[b.idx];
    const supplierAdmin = await prisma.user.findFirstOrThrow({
      where: { organizationId: supplier.id, role: Role.SUPPLIER_ADMIN },
    });
    await prisma.supplierBankAccount.create({
      data: {
        organizationId: supplier.id,
        bankName: b.bank,
        branch: b.branch,
        accountNumber: b.number,
        accountHolder: supplier.name.toUpperCase(),
        status: 'VERIFIED',
        declaredById: supplierAdmin.id,
        verifiedById: apUser.id,
        verifiedAt: new Date(),
      },
    });
  }

  const counts = {
    'tổ chức': await prisma.organization.count(),
    'người dùng': await prisma.user.count(),
    'vật liệu': await prisma.material.count(),
    'SKU catalog': await prisma.catalogItem.count(),
    'tài khoản ngân hàng': await prisma.supplierBankAccount.count(),
    WBS: wbsList.length,
  };
  console.log('Seed hoàn tất:', counts);
  console.log(`Mật khẩu dùng chung cho mọi tài khoản demo: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
