import { Container } from "@/components/shared/container";
import { requireRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import SuppliersClient from "./suppliers-client";

export default async function SuppliersPage() {
  await requireRole("OWNER", "MANAGER");

  const suppliers = await prisma.supplier.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, phone: true, notes: true, createdAt: true },
  });

  return (
    <Container id="admin-suppliers" sectionStyle="" className="py-6">
      <SuppliersClient suppliers={suppliers} />
    </Container>
  );
}
