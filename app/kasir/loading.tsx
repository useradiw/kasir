import { Container } from "@/components/shared/container";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className ?? ""}`} />;
}

export default function KasirLoading() {
  return (
    <Container id="kasir-loading" sectionStyle="" className="py-3 space-y-4">
      <Skeleton className="h-10 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </Container>
  );
}
