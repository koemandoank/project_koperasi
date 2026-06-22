import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function main() {
  console.log('Start seeding...');

  // 1) Unit
  const unit = await prisma.units.upsert({
    where: { code: 'U-001' },
    update: {},
    create: {
      code: 'U-001',
      name: 'Kantor Pusat',
      type: 'induk',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  // 2) Credentials
  const hashedPassword = await bcrypt.hash('654321', 10);


  // 3) Admin user (superadmin)
  await prisma.users.upsert({
    where: { username: 'admin' },
    update: {
      password: hashedPassword,
      email: 'admin@koperasi.digital',
    },
    create: {
      username: 'admin',
      email: 'admin@koperasi.digital',
      password: hashedPassword,
      role: 'superadmin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  // 3b) Superadmin user baru
  await prisma.users.upsert({
    where: { username: 'superadmin' },
    update: {
      password: hashedPassword,
      email: 'superadmin@koperasi.digital',
      is_active: true,
    },
    create: {
      username: 'superadmin',
      email: 'superadmin@koperasi.digital',
      password: hashedPassword,
      role: 'superadmin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  // 3c) Akuntan user
  await prisma.users.upsert({
    where: { username: 'akuntan01' },
    update: {
      password: hashedPassword,
      email: 'akuntan01@koperasi.digital',
      is_active: true,
    },
    create: {
      username: 'akuntan01',
      email: 'akuntan01@koperasi.digital',
      password: hashedPassword,
      role: 'petugas_akuntan',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  // 3d) Pengawas user
  await prisma.users.upsert({
    where: { username: 'pengawas01' },
    update: {
      password: hashedPassword,
      email: 'pengawas01@koperasi.digital',
      is_active: true,
    },
    create: {
      username: 'pengawas01',
      email: 'pengawas01@koperasi.digital',
      password: hashedPassword,
      role: 'pengawas',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });


  // 4) Seed members (20)
  const memberNames = [
    'Budi Santoso', 'Siti Aminah', 'Andi Pratama', 'Rina Wahyuni', 'Dedi Kurniawan',
    'Maya Lestari', 'Rizky Ramadhan', 'Nia Safitri', 'Bayu Wicaksono', 'Tara Oktaviani',
    'Hendra Wijaya', 'Irfan Maulana', 'Putri Ramadhani', 'Fajar Nugroho', 'Salsabila Putri',
    'Bagas Saputra', 'Agus Setiawan', 'Christine Veronika', 'Dina Kurniasari', 'Eko Prakoso',
  ];

  const now = new Date();
  const members: any[] = [];

  for (let i = 0; i < 20; i++) {
    const idx = i + 1;
    const member_code = `MBR-${String(idx).padStart(4, '0')}`;
    const nik = `S${String(idx).padStart(4, '0')}`;
    const full_name = memberNames[i];
    const email = `anggota${String(idx).padStart(2, '0')}@koperasi.digital`;
    const phone = `08${String(100000000 + i).padStart(10, '0')}`;
    const username = `anggota${String(idx).padStart(2, '0')}`;

    const member = await prisma.members.upsert({
      where: { member_code },
      update: {
        nik, full_name, email, phone, status: 'active', unit_id: unit.id, updated_at: now,
      },
      create: {
        member_code, nik, full_name, email, phone, join_date: now, status: 'active',
        unit_id: unit.id, created_at: now, updated_at: now,
      },
    });

    await prisma.users.upsert({
      where: { member_id: member.id },
      update: {
        username, password: hashedPassword, role: 'anggota', is_active: true, updated_at: now,
      },
      create: {
        username, email, password: hashedPassword, role: 'anggota', member_id: member.id,
        is_active: true, created_at: now, updated_at: now,
      },
    });

    members.push(member);
  }

  // 5) Product categories + products
  const categories = [
    { slug: 'barang-umum', name: 'Barang Umum' },
    { slug: 'sembako', name: 'Sembako' },
    { slug: 'jasa-layanan', name: 'Jasa Layanan' },
  ];

  const categoryIds: Record<string, bigint> = {};
  for (const cat of categories) {
    const created = await prisma.product_categories.upsert({
      where: { slug: cat.slug },
      update: { is_active: true },
      create: {
        name: cat.name, slug: cat.slug, is_active: true, sort_order: 0, created_at: now, updated_at: now,
      },
    });
    categoryIds[cat.slug] = created.id;
  }

  const products = [
    { sku: 'P-001', name: 'Beras 5kg', categorySlug: 'sembako', purchase_price: 45000, price: 60000, stock: 120 },
    { sku: 'P-002', name: 'Gula 1kg', categorySlug: 'sembako', purchase_price: 9000, price: 12000, stock: 200 },
    { sku: 'P-003', name: 'Minyak Goreng 2L', categorySlug: 'sembako', purchase_price: 25000, price: 32000, stock: 100 },
    { sku: 'P-004', name: 'Sabun Cuci', categorySlug: 'barang-umum', purchase_price: 7000, price: 10000, stock: 150 },
  ];

  const productRecords = [];
  for (const p of products) {
    const prd = await prisma.products.upsert({
      where: { sku: p.sku },
      update: { price: p.price, stock: p.stock },
      create: {
        unit_id: unit.id, category_id: categoryIds[p.categorySlug], sku: p.sku, name: p.name,
        purchase_price: p.purchase_price, price: p.price, stock: p.stock, min_stock: 0,
        unit_measure: 'pcs', is_active: true, is_online: true, created_at: now, updated_at: now,
      },
    });
    productRecords.push(prd);
  }

  // 6) Loan products
  const loanProducts = [
    { code: 'LP-001', name: 'Pinjaman Modal', interest_rate: 1.5, interest_method: 'flat' as const, max_tenor: 12, max_amount: 50000000, min_amount: 1000000, admin_fee_pct: 1 },
    { code: 'LP-002', name: 'Pinjaman Cepat', interest_rate: 2.0, interest_method: 'flat' as const, max_tenor: 6, max_amount: 20000000, min_amount: 500000, admin_fee_pct: 1 },
  ];

  for (const lp of loanProducts) {
    await prisma.loan_products.upsert({
      where: { code: lp.code },
      update: { name: lp.name },
      create: {
        code: lp.code, name: lp.name, interest_rate: lp.interest_rate, interest_method: lp.interest_method,
        max_tenor: lp.max_tenor, max_amount: lp.max_amount, min_amount: lp.min_amount,
        admin_fee_pct: lp.admin_fee_pct, penalty_pct: 0, requires_guarantor: false, is_active: true,
        created_at: now, updated_at: now,
      },
    });
  }

  const lpModal = await prisma.loan_products.findUnique({ where: { code: 'LP-001' } });

  // 7) Pengajuan Pinjaman & Peminjaman Uang
  if (lpModal) {
    for (let mi = 0; mi < members.length; mi++) {
      const m = members[mi];

      // Masing-masing member punya 2 history pengajuan pinjaman
      // 1 status rejected, 1 status approved (yang jadi peminjaman berjalan)
      const statuses = ['rejected', 'approved'];
      
      for (let i = 0; i < 2; i++) {
        const appDate = addMonths(now, -(i + 1));
        const applicationNo = `APP-${appDate.getFullYear()}-${String(appDate.getMonth() + 1).padStart(2, '0')}-${String(mi + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;

        const amount = 5000000 + (mi * 500000);
        const tenorMonths = 6;
        const status = statuses[i];

        const app = await prisma.loan_applications.upsert({
          where: { application_no: applicationNo },
          update: {
            status: status as any,
          },
          create: {
            member_id: m.id,
            loan_product_id: lpModal.id,
            application_no: applicationNo,
            amount_requested: amount,
            tenor_months: tenorMonths,
            repayment_method: 'salary_cut', // Potong gaji
            purpose: 'Keperluan ' + (i === 0 ? 'Pribadi' : 'Modal Usaha'),
            status: status as any,
            submitted_at: appDate,
            approved_at: status === 'approved' ? appDate : null,
            rejection_note: status === 'rejected' ? 'Dokumen tidak lengkap' : null,
            created_at: appDate,
            updated_at: appDate,
          },
        });

        // Buat history peminjaman berjalan (loans) jika approved
        if (status === 'approved') {
          const existingLoan = await prisma.loans.findUnique({ where: { application_id: app.id } });
          if (!existingLoan) {
            const principal = Number(amount);
            const interestRate = Number(lpModal.interest_rate);
            const adminFeePct = Number(lpModal.admin_fee_pct);

            const adminFee = principal * (adminFeePct / 100);
            const interestPerMonth = principal * (interestRate / 100);
            const principalPerMonth = principal / tenorMonths;
            const monthlyInstallment = principalPerMonth + interestPerMonth;

            const disbursedAt = appDate;
            const firstDueDate = new Date(disbursedAt.getFullYear(), disbursedAt.getMonth() + 1, 25);
            const lastDueDate = new Date(disbursedAt.getFullYear(), disbursedAt.getMonth() + tenorMonths, 25);

            const schedules = Array.from({ length: tenorMonths }).map((_, idx) => {
              const installmentNo = idx + 1;
              const dueDate = new Date(disbursedAt.getFullYear(), disbursedAt.getMonth() + installmentNo, 25);
              
              // Anggap 1 bulan pertama sudah dibayar
              const isPaid = idx < 1;
              return {
                installment_no: installmentNo,
                due_date: dueDate,
                principal_due: principalPerMonth,
                interest_due: interestPerMonth,
                total_due: monthlyInstallment,
                principal_paid: isPaid ? principalPerMonth : 0,
                interest_paid: isPaid ? interestPerMonth : 0,
                penalty_paid: 0,
                paid_at: isPaid ? addMonths(dueDate, 0) : null,
                status: isPaid ? ('paid' as any) : ('pending' as any),
              };
            });

            await prisma.loans.create({
              data: {
                application_id: app.id,
                member_id: m.id,
                loan_no: `LN-${String(appDate.getFullYear()).slice(-2)}${String(appDate.getMonth() + 1).padStart(2, '0')}-${String(mi + 1).padStart(2, '0')}`,
                principal: amount,
                interest_rate: lpModal.interest_rate,
                interest_method: lpModal.interest_method,
                admin_fee: adminFee,
                tenor_months: tenorMonths,
                disbursed_at: disbursedAt,
                first_due_date: firstDueDate,
                last_due_date: lastDueDate,
                monthly_installment: monthlyInstallment,
                outstanding_principal: amount - principalPerMonth, // 1 bulan udah lunas
                total_paid: monthlyInstallment, // 1 bulan udah lunas
                repayment_method: app.repayment_method,
                status: 'active',
                loan_schedules: {
                  create: schedules,
                },
              },
            });
          }
        }
      }
    }
  }

  // 8) Pembelian Barang (POS Orders) - Cash & Paylater
  for (let mi = 0; mi < members.length; mi++) {
    const m = members[mi];
    const p1 = productRecords[0]; // Beras
    const p2 = productRecords[2]; // Minyak Goreng

    // 2 Transaksi: 1 Cash (Lunas), 1 Paylater (Belum Lunas - v2.2.0)
    for (let i = 0; i < 2; i++) {
      const orderDate = addMonths(now, -i);
      const orderNo = `ORD-${orderDate.getFullYear()}${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(mi + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      
      const paymentMethod = i === 0 ? 'paylater' : 'cash';
      const paymentStatus = i === 0 ? 'unpaid' : 'paid';

      await prisma.orders.upsert({
        where: { order_no: orderNo },
        update: {},
        create: {
          order_no: orderNo,
          member_id: m.id,
          unit_id: unit.id,
          channel: 'pos',
          subtotal: Number(p1.price) + Number(p2.price),
          discount: 0,
          grand_total: Number(p1.price) + Number(p2.price),
          payment_method: paymentMethod as any,
          payment_status: paymentStatus as any,
          order_status: 'delivered',
          ordered_at: orderDate,
          paid_at: paymentStatus === 'paid' ? orderDate : null,
          created_at: orderDate,
          updated_at: orderDate,
          order_items: {
            create: [
              {
                product_id: p1.id,
                product_name: p1.name,
                qty: 1,
                unit_price: p1.price,
                discount: 0,
                subtotal: p1.price,
              },
              {
                product_id: p2.id,
                product_name: p2.name,
                qty: 1,
                unit_price: p2.price,
                discount: 0,
                subtotal: p2.price,
              },
            ],
          },
        },
      });
    }
  }

  // 9) Seed promotions using raw SQL
  console.log('🚀 Mempersiapkan tabel promosi jika belum ada...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS promotions (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      image_url VARCHAR(255) NOT NULL,
      link_url VARCHAR(255) NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('🚀 Menambahkan 4 data promosi dummy...');
  const promotionsData = [
    {
      title: "MEGA DISKON 50% Akhir Bulan!",
      description: "Nikmati potongan harga hingga 50% untuk berbagai kebutuhan pokok dan sembako di Toko Koperasi. Belanja hemat, anggota untung!",
      image_url: "/uploads/promosi/promo-diskon-toko.png",
      link_url: "/toko",
      is_active: 1,
      sort_order: 1,
    },
    {
      title: "Restock Terlaris: Rokok Dunhill Menthol",
      description: "Barang paling laku kini sudah tersedia kembali! Dapatkan Rokok Dunhill Menthol dengan harga spesial khusus anggota di mesin POS/Toko kami.",
      image_url: "/uploads/promosi/promo-dunhill-menthol.png",
      link_url: "/toko/produk",
      is_active: 1,
      sort_order: 2,
    },
    {
      title: "Segera Hadir: Layanan PPOB Koperasi",
      description: "Pengembangan layanan loket pembayaran PPOB (Listrik, Air, Pulsa, dll) sedang berlangsung. Bersiaplah menikmati kemudahan bayar tagihan langsung dari saldo simpanan Anda!",
      image_url: "/uploads/promosi/promo-ppob-coming-soon.png",
      link_url: "",
      is_active: 1,
      sort_order: 3,
    },
    {
      title: "Dana Pinjaman Kilat Telah Tersedia!",
      description: "Butuh dana cepat cair? Produk Pinjaman Kilat kini sudah bisa diajukan dengan proses persetujuan cepat (maksimal tenor 1 bulan). Ajukan sekarang di menu Pinjaman.",
      image_url: "/uploads/promosi/promo-pinjaman-kilat.png",
      link_url: "/pinjaman",
      is_active: 1,
      sort_order: 4,
    }
  ];

  for (const promo of promotionsData) {
    try {
      const existing = await prisma.$queryRawUnsafe<any[]>(
        "SELECT id FROM promotions WHERE title = $1 LIMIT 1",
        promo.title
      );

      if (existing.length === 0) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO promotions (title, description, image_url, link_url, is_active, sort_order, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          promo.title,
          promo.description,
          promo.image_url,
          promo.link_url,
          promo.is_active === 1,
          promo.sort_order
        );
        console.log(`✅ Ditambahkan promosi: ${promo.title}`);
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE promotions SET description = $1, image_url = $2, link_url = $3, is_active = $4, sort_order = $5, updated_at = NOW() WHERE title = $6`,
          promo.description,
          promo.image_url,
          promo.link_url,
          promo.is_active === 1,
          promo.sort_order,
          promo.title
        );
        console.log(`♻️ Diperbarui promosi: ${promo.title}`);
      }
    } catch (e) {
      console.warn(`⚠️ Warning seeding promotion '${promo.title}': Table 'promotions' might not exist yet.`, e);
    }
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

