import { Container } from "@/components/shared/container";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className ?? ""}`} />;
}

export default function AdminLoading() {
  return (
    <Container id="admin-loading" sectionStyle="" className="!max-w-4xl py-6 space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-48" />
    </Container>
  );
}
