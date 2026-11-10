"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { Bucket } from "@/types";
export function SensorChart({
  rows,
  metric,
}: {
  rows: Bucket[];
  metric: "temperature" | "humidity";
}) {
  const color = metric === "temperature" ? "#bf713c" : "#3c8595";
  return (
    <div
      className="chart"
      role="img"
      aria-label={`${metric === "temperature" ? "온도" : "습도"} 시간별 평균 그래프, ${rows.length}개 집계 구간`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows}>
          <defs>
            <linearGradient id={metric} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 5"
            vertical={false}
            stroke="#e5e9e5"
          />
          <XAxis
            dataKey="recorded_at"
            tickFormatter={(v) =>
              new Date(v).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            }
            minTickGap={60}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={36}
            domain={["auto", "auto"]}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            labelFormatter={(v) => new Date(String(v)).toLocaleString("ko-KR")}
            formatter={(v) => [
              Number(v).toFixed(1),
              metric === "temperature" ? "온도 °C" : "습도 %RH",
            ]}
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke={color}
            fill={`url(#${metric})`}
            strokeWidth={2}
            dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
            isAnimationActive={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
