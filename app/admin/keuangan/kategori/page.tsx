import { listCategories } from "@/app/actions/admin/queries";
import { KategoriClient } from "./kategori-client";

export const dynamic = "force-dynamic";

export default async function KategoriPage() {
  const categories = await listCategories();
  return <KategoriClient categories={categories} />;
}
