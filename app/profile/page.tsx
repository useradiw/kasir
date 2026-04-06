import { createClient } from "@/utils/supabase/server";
import { requireAuth } from "@/lib/admin-auth";
import { Container } from "@/components/shared/container";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const staff = await requireAuth();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Container id="profile" sectionStyle="bg-white dark:bg-black min-h-screen" className="py-6">
      <ProfileClient
        name={staff.name}
        username={staff.username}
        role={staff.role}
        email={user?.email ?? null}
      />
    </Container>
  );
}
