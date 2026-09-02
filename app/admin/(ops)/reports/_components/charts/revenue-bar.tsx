"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatRupiah } from "@/lib/format";
import { xAxisFormatter, type Period } from "../../_utils/period-date";
import { useChartColors } from "./use-chart-colors";

export function RevenueBar({
  data,
  period,
}: {
  data: Array<{ date: string; revenue: number; count: number }>;
  period: Period;
}) {
  const colors = useChartColors(1);
  if (data.length === 0) {
    return <p className="py-8 text-center text-[12.5px] font-semibold text-muted-foreground">Tidak ada data.</p>;
  }
  const fmt = (val: string) => xAxisFormatter(period, val);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={fmt} fontSize={11} />
        <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
        <Tooltip
          formatter={(value) => formatRupiah(value as number)}
          labelFormatter={(label) => fmt(String(label))}
        />
        <Bar dataKey="revenue" fill={colors[0]} radius={[4, 4, 0, 0]} name="Pendapatan" />
      </BarChart>
    </ResponsiveContainer>
  );
}
