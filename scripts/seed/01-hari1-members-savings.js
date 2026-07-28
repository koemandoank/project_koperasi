// HARI 1 - Fondasi: 3 user staf baru + 100 anggota baru + savings historis
// Rentang simulasi: 2025-08-01 s.d. 2026-07-27
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };

const SIM_START = new Date('2025-08-01');
const SIM_END = new Date('2026-07-27');

const FIRST_M = ['Ahmad','Budi','Candra','Dedi','Eko','Fajar','Gilang','Hendra','Irfan','Joko','Kurniawan','Lukman','Made','Nanda','Oki','Putra','Rizky','Surya','Taufik','Umar','Wahyu','Yudi','Zaenal','Agus','Bambang'];
const FIRST_F = ['Ayu','Bella','Citra','Dewi','Eka','Fitri','Gita','Hana','Indah','Julia','Kartika','Lestari','Maya','Nadia','Oktavia','Putri','Rina','Sari','Tia','Umi','Vina','Wulan','Yuni','Zahra','Anisa'];
const LAST = ['Pratama','Saputra','Wijaya','Santoso','Kusuma','Setiawan','Nugroho','Firmansyah','Ramadhan','Hidayat','Susanto','Gunawan','Rahman','Permana','Wibowo','Syahputra','Handoko','Kurniadi','Salsabila','Anggraini'];
const CITIES = ['Cilegon','Serang','Anyer','Merak','Bojonegara','Kramatwatu','Pulomerak','Cibeber','Purwakarta','Ciwandan'];
const UNIT_IDS = [1,2,3];

function rand(n){ return Math.floor(Math.random()*n); }
function pick(arr){ return arr[rand(arr.length)]; }
function randDate(start, end){ return new Date(start.getTime() + Math.random()*(end.getTime()-start.getTime())); }
function fmtDate(d){ return d.toISOString().slice(0,10); }
function pad(n,l){ return String(n).padStart(l,'0'); }

function genNIK(birthDate, gender, used){
  let nik;
  do {
    const region = '36'+pad(rand(100),2)+pad(rand(10),2); // 6 digit kode wilayah dummy Banten (36xx)
    const dd = birthDate.getDate() + (gender==='female' ? 40 : 0);
    const mm = birthDate.getMonth()+1;
    const yy = birthDate.getFullYear() % 100;
    const seq = pad(rand(10000),4);
    nik = `${region}${pad(dd,2)}${pad(mm,2)}${pad(yy,2)}${seq}`;
  } while (used.has(nik));
  used.add(nik);
  return nik;
}

async function main(){
  console.log('=== HARI 1: Setup staf + 100 anggota baru ===');

  // --- 1. Tambah 3 user staf baru ---
  const staffHash = await bcrypt.hash('Staf#2026', 10);
  const staffToAdd = [
    { username: 'kasir2', email: 'kasir2@koperasisulfindo.internal', role: 'kasir', full_name: 'Rina Kasir Dua' },
    { username: 'pengurus2', email: 'pengurus2@koperasisulfindo.internal', role: 'pengurus', full_name: 'Bambang Pengurus Dua' },
    { username: 'akuntan2', email: 'akuntan2@koperasisulfindo.internal', role: 'petugas_akuntan', full_name: 'Siti Akuntan Dua' },
  ];
  const newStaffIds = {};
  for (const s of staffToAdd) {
    const exists = await prisma.users.findUnique({ where: { username: s.username } });
    if (exists) { newStaffIds[s.role] = newStaffIds[s.role] || []; newStaffIds[s.role].push(exists.id); continue; }
    const created = await prisma.users.create({
      data: { username: s.username, email: s.email, password: staffHash, role: s.role, is_active: true, created_at: new Date(), updated_at: new Date() }
    });
    newStaffIds[s.role] = newStaffIds[s.role] || [];
    newStaffIds[s.role].push(created.id);
    console.log('Staff created:', s.username, s.role, created.id.toString());
  }

  // --- 2. Ambil member_code terakhir ---
  const lastMember = await prisma.members.findFirst({ orderBy: { member_code: 'desc' }, select: { member_code: true } });
  const lastNum = lastMember ? parseInt(lastMember.member_code.split('-')[1], 10) : 0;
  console.log('Starting member_code from:', lastNum + 1);

  const usedNIK = new Set((await prisma.members.findMany({ select: { nik: true } })).map(m => m.nik));
  const usedEmail = new Set((await prisma.members.findMany({ select: { email: true } })).map(m => m.email).filter(Boolean));
  const usedUsername = new Set((await prisma.users.findMany({ select: { username: true } })).map(u => u.username));

  const memberPassword = await bcrypt.hash('K0pmember01', 10);

  let created = 0;
  const summary = [];

  for (let i = 0; i < (process.env.SEED_LIMIT ? parseInt(process.env.SEED_LIMIT) : 100); i++) {
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const first = gender === 'male' ? pick(FIRST_M) : pick(FIRST_F);
    const last = pick(LAST);
    const fullName = `${first} ${last}`;
    const birthDate = randDate(new Date('1972-01-01'), new Date('2001-12-31'));
    const joinDate = randDate(SIM_START, new Date('2026-06-30'));
    const nik = genNIK(birthDate, gender, usedNIK);
    const memberCode = `MBR-${pad(lastNum + 1 + i, 4)}`;

    let emailBase = `${first}.${last}${lastNum + 1 + i}`.toLowerCase();
    let email = `${emailBase}@gmail.com`;
    let n = 1;
    while (usedEmail.has(email)) { email = `${emailBase}${n++}@gmail.com`; }
    usedEmail.add(email);

    let username = emailBase;
    n = 1;
    while (usedUsername.has(username)) { username = `${emailBase}${n++}`; }
    usedUsername.add(username);

    const member = await prisma.members.create({
      data: {
        member_code: memberCode,
        nik,
        full_name: fullName,
        email,
        phone: `08${pad(rand(100000000),9)}`,
        address: `Jl. ${pick(['Merdeka','Pahlawan','Sudirman','Diponegoro','Ahmad Yani'])} No. ${rand(99)+1}, ${pick(CITIES)}`,
        birth_date: birthDate,
        gender,
        join_date: joinDate,
        status: 'active',
        unit_id: pick(UNIT_IDS),
        created_at: joinDate,
        updated_at: joinDate,
      }
    });

    const user = await prisma.users.create({
      data: {
        member_id: member.id,
        username,
        email,
        password: memberPassword,
        role: 'anggota',
        is_active: true,
        created_at: joinDate,
        updated_at: joinDate,
      }
    });

    // --- Savings: SP (id 3, sekali), SW (id 2, bulanan), SS (id 1, acak 2-5x) ---
    const staffAll = [...(newStaffIds.pengurus || []), ...(newStaffIds.petugas_akuntan || [])];
    const processedBy = staffAll.length ? pick(staffAll) : null;

    // SP - Simpanan Pokok
    let spBalance = 100000;
    const spSaving = await prisma.savings.create({ data: { member_id: member.id, saving_type_id: 3, balance: spBalance, total_deposit: spBalance, total_withdraw: 0, created_at: joinDate, updated_at: joinDate } });
    await prisma.saving_transactions.create({ data: {
      savings_id: spSaving.id, member_id: member.id, type: 'deposit', amount: spBalance,
      balance_before: 0, balance_after: spBalance, reference_no: `SDP-${memberCode}-INIT`,
      note: 'Setoran Simpanan Pokok awal keanggotaan', processed_by: processedBy,
      transaction_at: joinDate, created_at: joinDate, updated_at: joinDate,
    }});

    // SW - Simpanan Wajib bulanan dari join_date s.d. SIM_END
    let swBalance = 0;
    const swSaving = await prisma.savings.create({ data: { member_id: member.id, saving_type_id: 2, balance: 0, total_deposit: 0, total_withdraw: 0, created_at: joinDate, updated_at: joinDate } });
    let cursor = new Date(joinDate.getFullYear(), joinDate.getMonth(), 25);
    if (cursor < joinDate) cursor.setMonth(cursor.getMonth() + 1);
    const swTx = [];
    while (cursor <= SIM_END) {
      const before = swBalance;
      swBalance += 50000;
      swTx.push({
        savings_id: swSaving.id, member_id: member.id, type: 'deposit', amount: 50000,
        balance_before: before, balance_after: swBalance,
        reference_no: `SDW-${memberCode}-${cursor.getFullYear()}${pad(cursor.getMonth()+1,2)}`,
        note: 'Setoran Simpanan Wajib bulanan', processed_by: processedBy,
        transaction_at: new Date(cursor), created_at: new Date(cursor), updated_at: new Date(cursor),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    if (swTx.length) await prisma.saving_transactions.createMany({ data: swTx });
    await prisma.savings.update({ where: { id: swSaving.id }, data: { balance: swBalance, total_deposit: swBalance } });

    // SS - Simpanan Sukarela acak 2-5x
    let ssBalance = 0;
    const ssSaving = await prisma.savings.create({ data: { member_id: member.id, saving_type_id: 1, balance: 0, total_deposit: 0, total_withdraw: 0, created_at: joinDate, updated_at: joinDate } });
    const ssCount = 2 + rand(4);
    const ssTx = [];
    for (let k = 0; k < ssCount; k++) {
      const amt = (5 + rand(25)) * 10000; // 50rb - 300rb
      const before = ssBalance;
      ssBalance += amt;
      const txDate = randDate(joinDate, SIM_END);
      ssTx.push({
        savings_id: ssSaving.id, member_id: member.id, type: 'deposit', amount: amt,
        balance_before: before, balance_after: ssBalance,
        reference_no: `SDS-${memberCode}-${pad(k+1,2)}`,
        note: 'Setoran Simpanan Sukarela', processed_by: processedBy,
        transaction_at: txDate, created_at: txDate, updated_at: txDate,
      });
    }
    if (ssTx.length) await prisma.saving_transactions.createMany({ data: ssTx });
    await prisma.savings.update({ where: { id: ssSaving.id }, data: { balance: ssBalance, total_deposit: ssBalance } });

    created++;
    summary.push({ member_code: memberCode, full_name: fullName, join_date: fmtDate(joinDate), total_savings: spBalance + swBalance + ssBalance });
    if (created % 20 === 0) console.log(`... ${created}/100 anggota selesai`);
  }

  console.log(`\n=== SELESAI: ${created} anggota baru dibuat ===`);
  console.log('Contoh 3 pertama:', summary.slice(0,3));
  console.log('Contoh 3 terakhir:', summary.slice(-3));

  const fs = require('fs');
  fs.writeFileSync(require('path').join(__dirname, '..', '..', 'docs', 'backups', 'hari1-members-summary.json'), JSON.stringify(summary, null, 2));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
