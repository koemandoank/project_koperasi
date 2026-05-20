import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function addMonths(d: Date, n: number) { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; }
function subMonths(d: Date, n: number) { return addMonths(d, -n); }

async function main() {
  console.log('🌱 Seeding dummy data...');
  const now = new Date();
  const startOf2025 = new Date('2025-05-01T00:00:00Z');
  const startOf2026 = new Date('2026-01-01T00:00:00Z');
  function getRandomDate(start: Date, end: Date) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }
  const pwd = await bcrypt.hash('654321', 10);

  // ── UNIT ──────────────────────────────────────────────────────
  const unit = await prisma.unit.upsert({
    where: { code: 'U-001' }, update: {},
    create: { code: 'U-001', name: 'Kantor Pusat', type: 'induk', is_active: true, created_at: now, updated_at: now },
  });

  // ── USERS ─────────────────────────────────────────────────────
  for (const u of [
    { username: 'admin',      email: 'admin@kop.id',       role: 'superadmin' },
    { username: 'superadmin', email: 'superadmin@kop.id',  role: 'superadmin' },
    { username: 'kasir01',    email: 'kasir01@kop.id',     role: 'kasir' },
    { username: 'pengurus01', email: 'pengurus01@kop.id',  role: 'pengurus' },
  ]) {
    await prisma.user.upsert({
      where: { username: u.username }, update: { password: pwd },
      create: { username: u.username, email: u.email, password: pwd, role: u.role as any, is_active: true, created_at: now, updated_at: now },
    });
  }

  // ── MEMBERS (20) ──────────────────────────────────────────────
  const names = [
    'Budi Santoso','Siti Aminah','Andi Pratama','Rina Wahyuni','Dedi Kurniawan',
    'Maya Lestari','Rizky Ramadhan','Nia Safitri','Bayu Wicaksono','Tara Oktaviani',
    'Hendra Wijaya','Irfan Maulana','Putri Ramadhani','Fajar Nugroho','Salsabila Putri',
    'Bagas Saputra','Agus Setiawan','Christine Veronika','Dina Kurniasari','Eko Prakoso',
  ];
  const members: any[] = [];
  for (let i = 0; i < 20; i++) {
    const idx = i + 1;
    // 15 members join in May 2025 to have 1-year history
    // 5 members join exactly in Jan 2026 as requested
    const joinDate = i < 15 ? getRandomDate(startOf2025, startOf2026) : getRandomDate(startOf2026, new Date('2026-01-31T23:59:59Z'));
    const m = await prisma.member.upsert({
      where: { member_code: `MBR-${String(idx).padStart(4,'0')}` }, update: { photo_path: `https://ui-avatars.com/api/?name=${encodeURIComponent(names[i])}&background=random` },
      create: {
        member_code: `MBR-${String(idx).padStart(4,'0')}`,
        nik: `S${String(idx).padStart(4,'0')}`,
        full_name: names[i],
        email: `anggota${String(idx).padStart(2,'0')}@kop.id`,
        phone: `0812${String(10000000+i)}`,
        join_date: joinDate, status: 'active',
        photo_path: `https://ui-avatars.com/api/?name=${encodeURIComponent(names[i])}&background=random`,
        unit_id: unit.id, created_at: joinDate, updated_at: joinDate,
      },
    });
    await prisma.user.upsert({
      where: { member_id: m.id }, update: {},
      create: {
        username: `anggota${String(idx).padStart(2,'0')}`,
        email: `anggota${String(idx).padStart(2,'0')}@kop.id`,
        password: pwd, role: 'anggota', member_id: m.id,
        is_active: true, created_at: joinDate, updated_at: joinDate,
      },
    });
    // Store join date in the m object for later use
    (m as any).join_date = joinDate;
    members.push(m);
  }

  // ── SAVING TYPES ──────────────────────────────────────────────
  const [stPokok, stWajib, stSuka] = await Promise.all([
    prisma.saving_types.upsert({ where:{code:'SP'}, update:{}, create:{code:'SP',name:'Simpanan Pokok',is_mandatory:true,min_amount:100000,monthly_amount:100000,is_withdrawable:false,is_active:true,created_at:now,updated_at:now} }),
    prisma.saving_types.upsert({ where:{code:'SW'}, update:{}, create:{code:'SW',name:'Simpanan Wajib',is_mandatory:true,min_amount:50000,monthly_amount:50000,is_withdrawable:false,is_active:true,created_at:now,updated_at:now} }),
    prisma.saving_types.upsert({ where:{code:'SS'}, update:{}, create:{code:'SS',name:'Simpanan Sukarela',is_mandatory:false,min_amount:10000,monthly_amount:0,is_withdrawable:true,description:'Bunga 3.5% p.a',is_active:true,created_at:now,updated_at:now} }),
  ]);

  // Savings for each member
  const adminUser = await prisma.user.findFirst({ where:{ username:'admin' } });
  for (const m of members) {
    for (const [st, amt] of [[stPokok,100000],[stWajib,50000],[stSuka,500000]] as const) {
      const isWajib = (st as any).code === 'SW';
      const jDate = new Date(m.join_date);
      
      let monthlyCount = 1;
      if (isWajib) {
        let current = new Date(jDate.getFullYear(), jDate.getMonth() + 1, 1);
        const limitDate = new Date(now.getFullYear(), now.getMonth(), 1);
        while (current <= limitDate) {
          monthlyCount++;
          current.setMonth(current.getMonth() + 1);
        }
      }

      const totalDeposit = isWajib ? (amt * monthlyCount) : amt;

      const existing = await prisma.savings.findFirst({ where:{ member_id:m.id, saving_type_id:(st as any).id } });
      if (!existing) {
        const sav = await prisma.savings.create({
          data:{ member_id:m.id, saving_type_id:(st as any).id, balance:totalDeposit, total_deposit:totalDeposit, total_withdraw:0, created_at:now, updated_at:now },
        });
        
        // Setoran Awal
        await prisma.saving_transactions.create({
          data:{
            savings_id:sav.id, member_id:m.id,
            type:'deposit', amount:amt, balance_before:0, balance_after:amt,
            reference_no:`OPEN-${(st as any).code}-${m.member_code}`,
            note:'Setoran awal', transaction_at:m.join_date,
            processed_by:adminUser?.id ?? null,
            created_at:m.join_date, updated_at:m.join_date,
          },
        });

        // Histori Potongan Gaji Bulanan (Simpanan Wajib)
        if (isWajib && monthlyCount > 1) {
          let bal = amt;
          let current = new Date(jDate.getFullYear(), jDate.getMonth() + 1, 25);
          for (let i = 1; i < monthlyCount; i++) {
            const tDate = current > now ? new Date(now) : new Date(current);
            bal += amt;
            await prisma.saving_transactions.create({
              data:{
                savings_id:sav.id, member_id:m.id,
                type:'salary_cut', amount:amt, balance_before:bal - amt, balance_after:bal,
                reference_no:`PAYROLL-${(st as any).code}-${m.member_code}-${current.getFullYear()}${(current.getMonth()+1).toString().padStart(2,'0')}`,
                note:'Potongan Gaji Bulanan', transaction_at:tDate,
                processed_by:adminUser?.id ?? null,
                created_at:tDate, updated_at:tDate,
              },
            });
            current.setMonth(current.getMonth() + 1);
          }
        }
      }
    }
  }

  // ── PRODUCT CATEGORIES ────────────────────────────────────────
  const cats: Record<string,bigint> = {};
  for (const c of [
    {slug:'sembako',name:'Sembako'},{slug:'barang-umum',name:'Barang Umum'},
    {slug:'elektronik',name:'Elektronik'},{slug:'konsinyasi',name:'Konsinyasi'},
  ]) {
    const r = await prisma.product_categories.upsert({
      where:{slug:c.slug}, update:{}, create:{name:c.name,slug:c.slug,is_active:true,sort_order:0,created_at:now,updated_at:now},
    });
    cats[c.slug] = r.id;
  }

  // ── PRODUCTS (12) ─────────────────────────────────────────────
  const prodDefs = [
    {sku:'P-001',name:'Beras 5kg',          cat:'sembako',    pp:45000, price:60000, mp:57000, stock:120, min:20, img: '/images/products/p001.png'},
    {sku:'P-002',name:'Gula Pasir 1kg',     cat:'sembako',    pp:9000,  price:12000, mp:11000, stock:200, min:30, img: '/images/products/p002.png'},
    {sku:'P-003',name:'Minyak Goreng 2L',   cat:'sembako',    pp:25000, price:32000, mp:30000, stock:80,  min:20, img: '/images/products/p003.png'},
    {sku:'P-004',name:'Tepung Terigu 1kg',  cat:'sembako',    pp:8000,  price:11000, mp:10000, stock:150, min:25, img: '/images/products/p004.png'},
    {sku:'P-005',name:'Sabun Mandi',        cat:'barang-umum',pp:5000,  price:8000,  mp:7500,  stock:3,   min:10, img: '/images/products/p005.png'},
    {sku:'P-006',name:'Sampo Sachet',       cat:'barang-umum',pp:3000,  price:5000,  mp:4500,  stock:2,   min:15, img: '/images/products/p006.png'},
    {sku:'P-007',name:'Detergen 1kg',       cat:'barang-umum',pp:12000, price:18000, mp:17000, stock:60,  min:10, img: '/images/products/p007.png'},
    {sku:'P-008',name:'Kopi Sachet 10pcs',  cat:'sembako',    pp:15000, price:22000, mp:21000, stock:90,  min:15, img: null},
    {sku:'P-009',name:'Mie Instan',         cat:'sembako',    pp:2500,  price:4000,  mp:3800,  stock:500, min:50, img: null},
    {sku:'P-010',name:'Baterai AAA 4pcs',   cat:'barang-umum',pp:10000, price:15000, mp:14000, stock:0,   min:10, img: null},
    {sku:'P-011',name:'Headset Kabel',      cat:'elektronik', pp:30000, price:55000, mp:50000, stock:5,   min:3,  img: null},
    {sku:'P-012',name:'Keripik Singkong',   cat:'konsinyasi', pp:8000,  price:13000, mp:12000, stock:40,  min:10, img: null},
    {sku:'P-013',name:'Pop Mie Rasa Ayam',  cat:'sembako',    pp:4000,  price:6000,  mp:5500,  stock:300, min:50, img: null},
    {sku:'P-014',name:'Teh Botol Sosro',    cat:'sembako',    pp:3500,  price:5000,  mp:4500,  stock:200, min:30, img: null},
    {sku:'P-015',name:'Coca Cola 330ml',    cat:'sembako',    pp:5000,  price:7000,  mp:6500,  stock:150, min:20, img: null},
    {sku:'P-016',name:'Susu Ultra 250ml',   cat:'sembako',    pp:4500,  price:6000,  mp:5500,  stock:120, min:20, img: null},
    {sku:'P-017',name:'Kecap Bango 520ml',  cat:'sembako',    pp:20000, price:25000, mp:24000, stock:80,  min:15, img: null},
    {sku:'P-018',name:'Indomie Goreng',     cat:'sembako',    pp:2800,  price:3500,  mp:3300,  stock:300, min:50, img: null},
    {sku:'P-019',name:'Sarden ABC 425g',    cat:'sembako',    pp:18000, price:22000, mp:21000, stock:50,  min:10, img: null},
    {sku:'P-020',name:'Kertas HVS A4',      cat:'barang-umum',pp:45000, price:55000, mp:52000, stock:40,  min:10, img: null},
    {sku:'P-021',name:'Pulpen Faster',      cat:'barang-umum',pp:2500,  price:4000,  mp:3500,  stock:150, min:20, img: null},
    {sku:'P-022',name:'Flashdisk 32GB',     cat:'elektronik', pp:65000, price:85000, mp:80000, stock:20,  min:5,  img: null},
    {sku:'P-023',name:'Mouse Wireless',     cat:'elektronik', pp:75000, price:100000,mp:95000, stock:15,  min:3,  img: null},
    {sku:'P-024',name:'Kacang Garuda',      cat:'konsinyasi', pp:9000,  price:14000, mp:13000, stock:60,  min:15, img: null},
    {sku:'P-025',name:'Roti Aoka',          cat:'konsinyasi', pp:2500,  price:4000,  mp:3500,  stock:100, min:20, img: null},
  ];
  const prods: any[] = [];
  for (const p of prodDefs) {
    const finalImg = (p as any).img || `https://placehold.co/400x400/png?text=${encodeURIComponent(p.name)}`;
    const r = await prisma.products.upsert({
      where:{sku:p.sku}, update:{price:p.price, stock:p.stock, image_path: finalImg},
      create:{
        unit_id:unit.id, category_id:cats[p.cat], sku:p.sku, name:p.name,
        purchase_price:p.pp, price:p.price, member_price:p.mp, stock:p.stock,
        min_stock:p.min, unit_measure:'pcs', is_active:true, is_online:true,
        image_path: finalImg,
        created_at:now, updated_at:now,
      },
    });
    prods.push({...r, ...p});
  }

  // ── LOAN PRODUCTS ─────────────────────────────────────────────
  const [lpModal, lpCepat] = await Promise.all([
    prisma.loan_products.upsert({
      where:{code:'LP-001'}, update:{},
      create:{code:'LP-001',name:'Pinjaman Modal Usaha',interest_rate:1.5,interest_method:'flat',max_tenor:24,max_amount:50000000,min_amount:1000000,admin_fee_pct:1,penalty_pct:0.5,requires_guarantor:false,is_active:true,created_at:now,updated_at:now},
    }),
    prisma.loan_products.upsert({
      where:{code:'LP-002'}, update:{},
      create:{code:'LP-002',name:'Pinjaman Cepat',interest_rate:2.0,interest_method:'flat',max_tenor:6,max_amount:10000000,min_amount:500000,admin_fee_pct:1,penalty_pct:0.5,requires_guarantor:false,is_active:true,created_at:now,updated_at:now},
    }),
  ]);

  // ── LOANS (each member) ───────────────────────────────────────
  for (let mi = 0; mi < members.length; mi++) {
    const m = members[mi];
    const lp = mi % 2 === 0 ? lpModal : lpCepat;
    const isKilat = lp.code === 'LP-002';
    
    // For Kilat: create 1 year history (e.g. 3 loans in the past year)
    // For Modal: 1 active loan disbursed 6 months ago
    const loopCount = isKilat ? 4 : 1; 

    for (let l_idx = 0; l_idx < loopCount; l_idx++) {
      const appNo = `APP-${String(mi+1).padStart(4,'0')}-${l_idx}`;
      const existing = await prisma.loan_applications.findUnique({ where:{application_no:appNo} });
      if (existing) continue;

      let disbDate;
      let isPaidOff = false;

      if (isKilat) {
        // distribute loans after join date
        // Create random dates between joinDate and now
        disbDate = getRandomDate(m.join_date, now);
        // If it's more than 30 days ago, assume it's paid off
        isPaidOff = (now.getTime() - disbDate.getTime()) > (30 * 24 * 60 * 60 * 1000);
      } else {
        disbDate = getRandomDate(m.join_date, now);
      }

      const amount = isKilat ? (500000 + (mi % 5) * 100000) : (5000000 + mi * 500000); // Kilat max 1 jt
      const tenor = isKilat ? 1 : (Number(lp.max_tenor) > 12 ? 12 : Number(lp.max_tenor));
      
      const app = await prisma.loan_applications.create({
        data:{
          member_id:m.id, loan_product_id:lp.id, application_no:appNo,
          amount_requested:amount, tenor_months:tenor,
          repayment_method:'salary_cut', purpose: isKilat ? 'Kebutuhan Mendadak' : 'Modal Usaha',
          status: isPaidOff ? 'disbursed' : 'approved', submitted_at:disbDate, approved_at:disbDate,
          created_at:disbDate, updated_at:disbDate,
        },
      });

      const rate = Number(lp.interest_rate);
      const ppMonth = amount / tenor;
      const intMonth = amount * (rate/100);
      const monthly = ppMonth + intMonth;
      const adminFee = amount * (Number(lp.admin_fee_pct)/100);

      // Determine paid schedules
      const paidSchedulesCount = isKilat && isPaidOff ? tenor : (isKilat ? 0 : 3); // Modal paid 3 months
      const totalPaid = monthly * paidSchedulesCount;

      await prisma.loans.create({
        data:{
          application_id:app.id, member_id:m.id,
          loan_no:`LN-${String(mi+1).padStart(4,'0')}-${l_idx}`,
          principal:amount, interest_rate:lp.interest_rate,
          interest_method:lp.interest_method, admin_fee:adminFee,
          tenor_months:tenor, disbursed_at:disbDate,
          first_due_date:new Date(disbDate.getFullYear(), disbDate.getMonth()+1, 25),
          last_due_date:new Date(disbDate.getFullYear(), disbDate.getMonth()+tenor, 25),
          monthly_installment:monthly,
          outstanding_principal:amount - (ppMonth * paidSchedulesCount),
          total_paid:totalPaid, repayment_method:'salary_cut', 
          status: isPaidOff ? 'paid_off' : 'active',
          loan_schedules:{
            create: Array.from({length:tenor},(_,k)=>{
              const due = new Date(disbDate.getFullYear(), disbDate.getMonth()+k+1, 25);
              const paid = k < paidSchedulesCount;
              return {
                installment_no:k+1, due_date:due,
                principal_due:ppMonth, interest_due:intMonth, total_due:monthly,
                principal_paid:paid?ppMonth:0, interest_paid:paid?intMonth:0,
                penalty_paid:0, paid_at:paid?due:null, status:paid?'paid':'pending',
              };
            }),
          },
        },
      });
    }
  }

  // ── SUPPLIERS (5) ─────────────────────────────────────────────
  const supplierDefs = [
    {code:'SUP-001',name:'PT Sumber Makmur',  contact:'Bapak Hadi',  phone:'021-5551001',city:'Jakarta', terms:30},
    {code:'SUP-002',name:'CV Mitra Sejahtera', contact:'Ibu Rani',   phone:'022-5551002',city:'Bandung', terms:14},
    {code:'SUP-003',name:'UD Berkah Abadi',    contact:'Pak Joko',   phone:'031-5551003',city:'Surabaya',terms:7},
    {code:'SUP-004',name:'PT Fresh Distribusi',contact:'Bu Wati',    phone:'024-5551004',city:'Semarang',terms:21},
    {code:'SUP-005',name:'CV Titip Jual Mas',  contact:'Mas Budi',   phone:'0812-9999001',city:'Solo',   terms:0},
  ];
  const suppRecs: any[] = [];
  for (const s of supplierDefs) {
    const r = await prisma.suppliers.upsert({
      where:{supplier_code:s.code}, update:{},
      create:{
        supplier_code:s.code, supplier_name:s.name, contact_person:s.contact,
        phone:s.phone, city:s.city, payment_terms:s.terms,
        avg_delivery_days:3, is_active:true, created_at:now, updated_at:now,
      },
    });
    suppRecs.push(r);
  }

  // ── WAREHOUSE LOCATIONS ───────────────────────────────────────
  const [wh1, wh2] = await Promise.all([
    prisma.warehouse_locations.upsert({
      where:{location_code:'WH-001'}, update:{},
      create:{unit_id:unit.id,location_code:'WH-001',location_name:'Gudang Utama',location_type:'warehouse',is_active:true,created_at:now,updated_at:now},
    }),
    prisma.warehouse_locations.upsert({
      where:{location_code:'SH-001'}, update:{},
      create:{unit_id:unit.id,location_code:'SH-001',location_name:'Rak Toko Utama',location_type:'main',is_active:true,created_at:now,updated_at:now},
    }),
  ]);

  // Stock balances + reorder points
  for (const p of prods) {
    await prisma.stock_balances.upsert({
      where:{product_id_location_id:{product_id:p.id, location_id:wh1.id}}, update:{qty_on_hand:p.stock},
      create:{product_id:p.id,location_id:wh1.id,qty_on_hand:p.stock,qty_reserved:0,updated_at:now},
    });
    const rpExist = await prisma.stock_reorder_points.findFirst({ where:{product_id:p.id} });
    if (!rpExist) {
      await prisma.stock_reorder_points.create({
        data:{product_id:p.id, reorder_point:p.min, reorder_qty:p.min*2, lead_time_days:3, is_active:true, created_at:now},
      });
    }
  }

  // ── PURCHASE ORDERS ───────────────────────────────────────────
  const poItems = [prods[0],prods[1],prods[2]];
  const poExist = await prisma.purchase_orders.findUnique({ where:{po_no:'PO-2026-001'} });
  if (!poExist) {
    const sub = poItems.reduce((s,p)=>s+p.pp*20,0);
    await prisma.purchase_orders.create({
      data:{
        supplier_id:suppRecs[0].id, po_no:'PO-2026-001',
        po_date:subMonths(now,1), expected_delivery:subMonths(now,0),
        status:'approved', subtotal:sub, tax_amount:sub*0.1,
        total_amount:sub*1.1, notes:'PO rutin bulanan',
        created_by:adminUser!.id,
        po_items:{
          create: poItems.map(p=>({product_id:p.id,qty_ordered:20,unit_price:p.pp,line_total:p.pp*20})),
        },
      },
    });
  }
  const poExist2 = await prisma.purchase_orders.findUnique({ where:{po_no:'PO-2026-002'} });
  if (!poExist2) {
    const sub2 = prods[3].pp * 50;
    await prisma.purchase_orders.create({
      data:{
        supplier_id:suppRecs[1].id, po_no:'PO-2026-002',
        po_date:now, expected_delivery:addDays(now,7),
        status:'draft', subtotal:sub2, tax_amount:sub2*0.1,
        total_amount:sub2*1.1, created_by:adminUser!.id,
        po_items:{create:[{product_id:prods[3].id,qty_ordered:50,unit_price:prods[3].pp,line_total:prods[3].pp*50}]},
      },
    });
  }

  // ── ACCOUNTS PAYABLE ──────────────────────────────────────────
  const apExist = await prisma.accounts_payable.findFirst({ where:{invoice_no:'INV-SUP-001'} });
  if (!apExist) {
    await prisma.accounts_payable.create({
      data:{
        supplier_id:suppRecs[0].id, invoice_no:'INV-SUP-001',
        invoice_date:subMonths(now,1), due_date:addDays(now,5),
        subtotal:2700000, tax_amount:270000, total_amount:2970000,
        amount_paid:0, amount_due:2970000, status:'open',
        ap_details:{create:[{description:'Beras 5kg x60',qty:60,unit_price:45000,line_total:2700000}]},
      },
    });
    await prisma.accounts_payable.create({
      data:{
        supplier_id:suppRecs[1].id, invoice_no:'INV-SUP-002',
        invoice_date:subMonths(now,2), due_date:subMonths(now,1),
        subtotal:1500000, tax_amount:150000, total_amount:1650000,
        amount_paid:825000, amount_due:825000, status:'partial',
        ap_details:{create:[{description:'Minyak Goreng x60',qty:60,unit_price:25000,line_total:1500000}]},
      },
    });
  }

  // ── ACCOUNTS RECEIVABLE ───────────────────────────────────────
  const arExist = await prisma.accounts_receivable.findFirst({ where:{invoice_no:'AR-CUS-001'} });
  if (!arExist) {
    await prisma.accounts_receivable.create({
      data:{
        member_id:members[0].id, customer_name:members[0].full_name,
        invoice_no:'AR-CUS-001', invoice_date:subMonths(now,1),
        due_date:addDays(now,10), subtotal:500000, tax_amount:0,
        total_amount:500000, amount_paid:0, amount_due:500000, status:'open',
        ar_details:{create:[{description:'Bon Belanja',qty:1,unit_price:500000,line_total:500000}]},
      },
    });
  }

  // ── CONSIGNMENT ITEMS ─────────────────────────────────────────
  const cItems = await prisma.consignment_items.findMany({ where:{supplier_id:suppRecs[4].id} });
  if (cItems.length === 0) {
    const ci = await prisma.consignment_items.create({
      data:{ product_id:prods[11].id, supplier_id:suppRecs[4].id, consignment_date:subMonths(now,1), qty_received:100, qty_sold:40, status:'active', created_at:now, updated_at:now },
    });
    await prisma.consignment_payables.create({
      data:{ consignment_id:ci.id, supplier_id:suppRecs[4].id, qty_sold:40, unit_price:8000, total_amount:320000, status:'pending', created_at:now },
    });
  }

  // ── CASH REGISTER ─────────────────────────────────────────────
  const crExist = await prisma.cash_registers.findFirst({ where:{register_no:'CR-001'} });
  if (!crExist) {
    await prisma.cash_registers.create({
      data:{unit_id:unit.id, register_no:'CR-001', register_name:'Kasir 1', location:'Counter Utama', is_active:true, created_at:now, updated_at:now},
    });
  }

  // ── POS ORDERS (past 3 months) ────────────────────────────────
  const payMethods = ['cash','cash','qris','paylater'] as const;
  let orderCount = 0;
  const totalDays = Math.floor((now.getTime() - startOf2025.getTime()) / (1000 * 3600 * 24));
  for (let day = totalDays; day >= 0; day -= 2) {
    const orderDate = addDays(now, -day);
    for (let t = 0; t < 3; t++) {
      const member = members[(day + t) % members.length];
      if (orderDate < member.join_date) continue; // Only create order if member already joined
      const p1 = prods[(day+t) % 9];
      const p2 = prods[(day+t+1) % 9];
      const pm = payMethods[(day+t) % payMethods.length];
      const isPaid = pm !== 'paylater';
      const sub = Number(p1.price)*2 + Number(p2.price);
      const oNo = `ORD-${String(day).padStart(3,'0')}-${t}`;
      const exists = await prisma.orders.findUnique({ where:{order_no:oNo} });
      if (!exists) {
        await prisma.orders.create({
          data:{
            order_no:oNo, member_id:member.id, unit_id:unit.id, channel:'pos',
            subtotal:sub, discount:0, grand_total:sub,
            payment_method:pm, payment_status:isPaid?'paid':'unpaid',
            order_status:'delivered', ordered_at:orderDate,
            paid_at:isPaid?orderDate:null, created_at:orderDate, updated_at:orderDate,
            order_items:{
              create:[
                {product_id:p1.id,product_name:p1.name,qty:2,unit_price:Number(p1.price),discount:0,subtotal:Number(p1.price)*2},
                {product_id:p2.id,product_name:p2.name,qty:1,unit_price:Number(p2.price),discount:0,subtotal:Number(p2.price)},
              ],
            },
          },
        });
        orderCount++;
      }
    }
  }

  // ── LOYALTY PROGRAM ───────────────────────────────────────────
  const lpExist = await prisma.loyalty_programs.findFirst({ where:{program_code:'LP-GOLD'} });
  let loyaltyProg = lpExist;
  if (!lpExist) {
    loyaltyProg = await prisma.loyalty_programs.create({
      data:{ program_code:'LP-GOLD', program_name:'Koperasi Gold Points', description:'1 poin per Rp100', points_per_rupiah:0.01, minimum_purchase:10000, is_active:true, created_at:now, updated_at:now },
    });
  }
  for (let i = 0; i < 10; i++) {
    const m = members[i];
    const existing = await prisma.loyalty_memberships.findFirst({ where:{member_id:m.id, program_id:loyaltyProg!.id} });
    if (!existing) {
      const pts = 1000 + i*250;
      await prisma.loyalty_memberships.create({
        data:{ member_id:m.id, program_id:loyaltyProg!.id, membership_level:'gold', total_points:pts, points_used:500, points_available:pts-500, member_since:subMonths(now,6), created_at:now, updated_at:now },
      });
    }
  }

  // ── MONTHLY CLOSING (3 bulan lalu) ────────────────────────────
  for (let m = 3; m >= 1; m--) {
    const d = subMonths(now, m);
    const mc = { month:d.getMonth()+1, year:d.getFullYear() };
    const existing = await prisma.monthly_closures.findUnique({ where:{month_year:mc} });
    if (!existing) {
      await prisma.monthly_closures.create({
        data:{month:mc.month, year:mc.year, total_revenue:25000000+m*2000000, total_expense:8000000+m*500000, net_income:17000000+m*1500000},
      });
    }
  }

  // ── APP SETTINGS ──────────────────────────────────────────────
  const aSettings = await prisma.app_settings.findFirst();
  if (!aSettings) {
    await prisma.app_settings.create({
      data:{
        company_name:'Koperasi Sulfindo Digital',
        address:'Jl. Kemakmuran No. 1, Jakarta Pusat',
        phone:'021-5550001',
        shu_config:JSON.stringify({
          cadangan_wajib:20, jasa_anggota:40, dana_pengurus:10,
          dana_karyawan:5, dana_pendidikan:10, sosial:5,
          pembangunan_daerah:10,
        }),
      },
    });
  }

  // ── PRICE TIERS per product (CRM) ────────────────────────────
  for (const p of prods.slice(0, 5)) {
    for (const t of [
      {tier:'retail' as const, price: Math.round(Number(p.price)*0.95), min_qty:1},
      {tier:'wholesale' as const, price: Math.round(Number(p.price)*0.85), min_qty:12},
    ]) {
      const e = await prisma.price_tiers.findFirst({ where:{product_id:p.id, tier_name:t.tier, min_qty:t.min_qty} });
      if (!e) await prisma.price_tiers.create({
        data:{product_id:p.id, tier_name:t.tier, min_qty:t.min_qty, price:t.price, is_active:true, created_at:now, updated_at:now},
      });
    }
  }


  console.log(`✅ Done! Orders created: ${orderCount}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
