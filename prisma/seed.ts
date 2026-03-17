import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // ============ STAFF (3 non-OWNER) ============
  console.log("📝 Creating staff...");
  const staff = await Promise.all([
    prisma.staff.create({
      data: {
        name: "Ahmad Manager",
        role: "MANAGER",
        isActive: true,
      },
    }),
    prisma.staff.create({
      data: {
        name: "Siti Cashier",
        role: "CASHIER",
        isActive: true,
      },
    }),
    prisma.staff.create({
      data: {
        name: "Budi Staff",
        role: "STAFF",
        isActive: true,
      },
    }),
  ]);
  console.log(`✅ Created ${staff.length} staff records`);

  // ============ CATEGORIES (3) ============
  console.log("📝 Creating categories...");
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: "Minuman",
        sortOrder: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: "Makanan Ringan",
        sortOrder: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: "Makanan Berat",
        sortOrder: 3,
      },
    }),
  ]);
  console.log(`✅ Created ${categories.length} categories`);

  // ============ MENU ITEMS (3 per category) ============
  console.log("📝 Creating menu items...");
  const menuItems = await Promise.all([
    // Minuman
    prisma.menuItem.create({
      data: {
        name: "Kopi Hitam",
        categoryId: categories[0].id,
        price: 15000,
        isHidden: false,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: "Es Teh Manis",
        categoryId: categories[0].id,
        price: 12000,
        isHidden: false,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: "Jus Jeruk",
        categoryId: categories[0].id,
        price: 18000,
        isHidden: false,
      },
    }),
    // Makanan Ringan
    prisma.menuItem.create({
      data: {
        name: "Roti Bakar",
        categoryId: categories[1].id,
        price: 20000,
        isHidden: false,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: "Gorengan",
        categoryId: categories[1].id,
        price: 15000,
        isHidden: false,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: "Lumpia",
        categoryId: categories[1].id,
        price: 25000,
        isHidden: false,
      },
    }),
    // Makanan Berat
    prisma.menuItem.create({
      data: {
        name: "Nasi Goreng",
        categoryId: categories[2].id,
        price: 35000,
        isHidden: false,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: "Mie Ayam",
        categoryId: categories[2].id,
        price: 30000,
        isHidden: false,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: "Soto Ayam",
        categoryId: categories[2].id,
        price: 28000,
        isHidden: false,
      },
    }),
  ]);
  console.log(`✅ Created ${menuItems.length} menu items`);

  // ============ MENU VARIANTS (3 items with variants) ============
  console.log("📝 Creating menu variants...");
  const variants = await Promise.all([
    prisma.menuVariant.create({
      data: {
        menuItemId: menuItems[0].id, // Kopi Hitam
        label: "Reguler",
        priceModifier: 0,
      },
    }),
    prisma.menuVariant.create({
      data: {
        menuItemId: menuItems[0].id, // Kopi Hitam
        label: "Large",
        priceModifier: 5000,
      },
    }),
    prisma.menuVariant.create({
      data: {
        menuItemId: menuItems[3].id, // Roti Bakar
        label: "Cokelat",
        priceModifier: 3000,
      },
    }),
    prisma.menuVariant.create({
      data: {
        menuItemId: menuItems[3].id, // Roti Bakar
        label: "Keju",
        priceModifier: 5000,
      },
    }),
    prisma.menuVariant.create({
      data: {
        menuItemId: menuItems[6].id, // Nasi Goreng
        label: "Telur",
        priceModifier: 0,
      },
    }),
    prisma.menuVariant.create({
      data: {
        menuItemId: menuItems[6].id, // Nasi Goreng
        label: "Ayam",
        priceModifier: 8000,
      },
    }),
  ]);
  console.log(`✅ Created ${variants.length} menu variants`);

  // ============ PACKAGES (3) ============
  console.log("📝 Creating packages...");
  const packages = await Promise.all([
    prisma.package.create({
      data: {
        name: "Paket Sarapan",
        bundlePrice: 45000,
      },
    }),
    prisma.package.create({
      data: {
        name: "Paket Makan Siang",
        bundlePrice: 65000,
      },
    }),
    prisma.package.create({
      data: {
        name: "Paket Minuman",
        bundlePrice: 40000,
      },
    }),
  ]);
  console.log(`✅ Created ${packages.length} packages`);

  // ============ TABLE SESSIONS (3) ============
  console.log("📝 Creating table sessions...");
  const now = new Date();
  const sessions = await Promise.all([
    prisma.tableSession.create({
      data: {
        name: "Meja 1",
        service: "Unknown",
        customerAlias: "Pelanggan A",
        ownerId: staff[0].id,
        orderedAt: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
        servedAt: new Date(now.getTime() - 45 * 60 * 1000), // 45 min ago
        paidAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 min ago
      },
    }),
    prisma.tableSession.create({
      data: {
        name: "Meja 2",
        service: "GoFood",
        customerAlias: "Pelanggan B",
        ownerId: staff[1].id,
        orderedAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 min ago
        servedAt: new Date(now.getTime() - 15 * 60 * 1000), // 15 min ago
      },
    }),
    prisma.tableSession.create({
      data: {
        name: "Meja 3",
        service: "Take_Away",
        customerAlias: "Pelanggan C",
        ownerId: staff[2].id,
        orderedAt: new Date(now.getTime() - 10 * 60 * 1000), // 10 min ago
      },
    }),
  ]);
  console.log(`✅ Created ${sessions.length} table sessions`);

  // ============ ORDER ITEMS (3 per session) ============
  console.log("📝 Creating order items...");
  const orderItems = await Promise.all([
    // Session 1
    prisma.orderItem.create({
      data: {
        tableSessionId: sessions[0].id,
        menuItemId: menuItems[0].id, // Kopi Hitam
        variantId: variants[0].id, // Reguler
        qty: 2,
        note: "Tidak terlalu manis",
        status: "SERVED",
        nameSnapshot: "Kopi Hitam - Reguler",
        price: 15000,
      },
    }),
    prisma.orderItem.create({
      data: {
        tableSessionId: sessions[0].id,
        menuItemId: menuItems[3].id, // Roti Bakar
        variantId: variants[2].id, // Cokelat
        qty: 1,
        status: "SERVED",
        nameSnapshot: "Roti Bakar - Cokelat",
        price: 23000,
      },
    }),
    prisma.orderItem.create({
      data: {
        tableSessionId: sessions[0].id,
        menuItemId: menuItems[6].id, // Nasi Goreng
        variantId: variants[4].id, // Telur
        qty: 1,
        status: "SERVED",
        nameSnapshot: "Nasi Goreng - Telur",
        price: 35000,
      },
    }),
    // Session 2
    prisma.orderItem.create({
      data: {
        tableSessionId: sessions[1].id,
        menuItemId: menuItems[1].id, // Es Teh Manis
        qty: 3,
        status: "SERVED",
        nameSnapshot: "Es Teh Manis",
        price: 12000,
      },
    }),
    prisma.orderItem.create({
      data: {
        tableSessionId: sessions[1].id,
        menuItemId: menuItems[4].id, // Gorengan
        qty: 1,
        status: "PENDING",
        nameSnapshot: "Gorengan",
        price: 15000,
      },
    }),
    prisma.orderItem.create({
      data: {
        tableSessionId: sessions[1].id,
        packageId: packages[0].id, // Paket Sarapan
        qty: 1,
        status: "PREPARING",
        nameSnapshot: "Paket Sarapan",
        price: 45000,
      },
    }),
    // Session 3
    prisma.orderItem.create({
      data: {
        tableSessionId: sessions[2].id,
        menuItemId: menuItems[2].id, // Jus Jeruk
        qty: 2,
        status: "PENDING",
        nameSnapshot: "Jus Jeruk",
        price: 18000,
      },
    }),
    prisma.orderItem.create({
      data: {
        tableSessionId: sessions[2].id,
        menuItemId: menuItems[7].id, // Mie Ayam
        qty: 1,
        status: "PENDING",
        nameSnapshot: "Mie Ayam",
        price: 30000,
      },
    }),
    prisma.orderItem.create({
      data: {
        tableSessionId: sessions[2].id,
        packageId: packages[1].id, // Paket Makan Siang
        qty: 1,
        status: "PENDING",
        nameSnapshot: "Paket Makan Siang",
        price: 65000,
      },
    }),
  ]);
  console.log(`✅ Created ${orderItems.length} order items`);

  // ============ TRANSACTIONS (3) ============
  console.log("📝 Creating transactions...");
  const transactions = await Promise.all([
    prisma.transaction.create({
      data: {
        tableSessionId: sessions[0].id,
        processedById: staff[1].id,
        subtotal: 73000,
        taxAmount: 7300,
        serviceCharge: 5000,
        totalAmount: 85300,
        cashAmount: 85300,
        qrisAmount: 0,
        paymentMethod: "CASH",
        status: "PAID",
      },
    }),
    prisma.transaction.create({
      data: {
        tableSessionId: sessions[1].id,
        processedById: staff[0].id,
        subtotal: 84000,
        taxAmount: 8400,
        serviceCharge: 0,
        totalAmount: 92400,
        cashAmount: 0,
        qrisAmount: 92400,
        paymentMethod: "DYNAMIC_QRIS",
        status: "PAID",
      },
    }),
    prisma.transaction.create({
      data: {
        tableSessionId: sessions[2].id,
        processedById: staff[2].id,
        subtotal: 113000,
        taxAmount: 11300,
        serviceCharge: 0,
        totalAmount: 124300,
        cashAmount: 124300,
        qrisAmount: 0,
        paymentMethod: "CASH",
        status: "PAID",
      },
    }),
  ]);
  console.log(`✅ Created ${transactions.length} transactions`);

  // ============ EXPENSES (3) ============
  console.log("📝 Creating expenses...");
  const expenses = await Promise.all([
    prisma.expense.create({
      data: {
        amount: 150000,
        note: "Pembelian stock bahan minuman",
      },
    }),
    prisma.expense.create({
      data: {
        amount: 200000,
        note: "Perbaikan kompor dapur",
      },
    }),
    prisma.expense.create({
      data: {
        amount: 75000,
        note: "Pembelian tissue dan pembersih",
      },
    }),
  ]);
  console.log(`✅ Created ${expenses.length} expenses`);

  // ============ ATTENDANCE RECORDS (3 per staff) ============
  console.log("📝 Creating attendance records...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const attendance = await Promise.all([
    // Ahmad
    prisma.attendanceRecord.create({
      data: {
        staffId: staff[0].id,
        date: twoDaysAgo,
        status: "PRESENT",
      },
    }),
    prisma.attendanceRecord.create({
      data: {
        staffId: staff[0].id,
        date: yesterday,
        status: "PRESENT",
      },
    }),
    prisma.attendanceRecord.create({
      data: {
        staffId: staff[0].id,
        date: today,
        status: "PRESENT",
      },
    }),
    // Siti
    prisma.attendanceRecord.create({
      data: {
        staffId: staff[1].id,
        date: twoDaysAgo,
        status: "PRESENT",
      },
    }),
    prisma.attendanceRecord.create({
      data: {
        staffId: staff[1].id,
        date: yesterday,
        status: "ABSENT",
      },
    }),
    prisma.attendanceRecord.create({
      data: {
        staffId: staff[1].id,
        date: today,
        status: "PRESENT",
      },
    }),
    // Budi
    prisma.attendanceRecord.create({
      data: {
        staffId: staff[2].id,
        date: twoDaysAgo,
        status: "ABSENT",
      },
    }),
    prisma.attendanceRecord.create({
      data: {
        staffId: staff[2].id,
        date: yesterday,
        status: "PRESENT",
      },
    }),
    prisma.attendanceRecord.create({
      data: {
        staffId: staff[2].id,
        date: today,
        status: "PRESENT",
      },
    }),
  ]);
  console.log(`✅ Created ${attendance.length} attendance records`);

  // ============ SUMMARY ============
  console.log("\n📊 Seed Summary:");
  console.log(`  • Staff: ${staff.length} (MANAGER, CASHIER, STAFF)`);
  console.log(`  • Categories: ${categories.length}`);
  console.log(`  • Menu Items: ${menuItems.length}`);
  console.log(`  • Menu Variants: ${variants.length}`);
  console.log(`  • Packages: ${packages.length}`);
  console.log(`  • Table Sessions: ${sessions.length}`);
  console.log(`  • Order Items: ${orderItems.length}`);
  console.log(`  • Transactions: ${transactions.length}`);
  console.log(`  • Expenses: ${expenses.length}`);
  console.log(`  • Attendance Records: ${attendance.length}`);
  console.log("\n✨ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
