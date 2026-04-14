import { Container } from "@/components/shared/container";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container id="settings" className="!max-w-4xl py-6">
      {children}
    </Container>
  );
}
