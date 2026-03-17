import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const counts = await Promise.all([
    prisma.staff.count(),
    prisma.category.count(),
    prisma.menuItem.count(),
    prisma.menuVariant.count(),
    prisma.package.count(),
    prisma.tableSession.count(),
    prisma.orderItem.count(),
    prisma.transaction.count(),
    prisma.expense.count(),
    prisma.attendanceRecord.count(),
  ]);

  console.log("📊 Database Record Counts:");
  console.log(`  • Staff: ${counts[0]}`);
  console.log(`  • Categories: ${counts[1]}`);
  console.log(`  • Menu Items: ${counts[2]}`);
  console.log(`  • Menu Variants: ${counts[3]}`);
  console.log(`  • Packages: ${counts[4]}`);
  console.log(`  • Table Sessions: ${counts[5]}`);
  console.log(`  • Order Items: ${counts[6]}`);
  console.log(`  • Transactions: ${counts[7]}`);
  console.log(`  • Expenses: ${counts[8]}`);
  console.log(`  • Attendance Records: ${counts[9]}`);

  // Get sample data
  console.log("\n📋 Sample Data:");
  const staff = await prisma.staff.findFirst();
  const session = await prisma.tableSession.findFirst();
  const transaction = await prisma.transaction.findFirst();
  
  console.log(`  • First Staff: ${staff?.name} (${staff?.role})`);
  console.log(`  • First Session: ${session?.name} - ${session?.customerAlias}`);
  console.log(`  • First Transaction: ₽${transaction?.totalAmount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
