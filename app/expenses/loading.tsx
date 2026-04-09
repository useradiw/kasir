import { Container } from "@/components/shared/container";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className ?? ""}`} />;
}

export default function ExpensesLoading() {
  return (
    <Container id="expenses-loading" sectionStyle="" className="py-3 space-y-4">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-64" />
    </Container>
  );
}
