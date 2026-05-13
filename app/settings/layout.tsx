import { Container } from "@/components/shared/container";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container id="settings" className="py-6">
      {children}
    </Container>
  );
}
