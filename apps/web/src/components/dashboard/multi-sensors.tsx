"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
const sensors = [
  ["water_temperature", "수온", "°C"],
  ["co2", "CO₂", "ppm"],
  ["uv_voltage", "자외선 전압", "mV"],
  ["uv_raw", "자외선 원시값", "ADC"],
  ["air_temperature", "공기 온도", "°C"],
  ["air_humidity", "공기 습도", "%RH"],
  ["soil_1_moisture", "토양 1 수분", "%"],
  ["soil_1_temperature", "토양 1 온도", "°C"],
  ["soil_1_ec", "토양 1 EC", "µS/cm"],
  ["soil_2_moisture", "토양 2 수분", "%"],
  ["soil_2_temperature", "토양 2 온도", "°C"],
  ["soil_2_ec", "토양 2 EC", "µS/cm"],
] as const;
type Latest = {
  sensor_type: string;
  value: number | null;
  status: string;
  recorded_at: string;
};
type Bucket = {
  recorded_at: string;
  average: number | null;
  minimum: number | null;
  maximum: number | null;
  samples: number;
};
export function MultiSensors({
  deviceId,
  period,
  isOnline,
}: {
  deviceId: string;
  period: string;
  isOnline: boolean;
}) {
  const [sensor, setSensor] = useState<string>("water_temperature");
  const hours: Record<string, number> = {
    "1h": 1,
    "24h": 24,
    "7d": 168,
    "30d": 720,
  };
  const q = useQuery<{ latest: Latest[]; history: Bucket[] }>({
    queryKey: ["sensors", deviceId, period, sensor],
    queryFn: async () => {
      const r = await fetch(
        `/api/v1/sensors?device=${deviceId}&hours=${hours[period]}&sensor=${sensor}`,
        { cache: "no-store" },
      );
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      return data;
    },
  });
  return (
    <section className="panel">
      <h2>센서별 측정</h2>
      <p className="muted small">
        장치 연결 상태와 각 센서의 측정 상태는 별개입니다. 자외선은 보정 전
        전압과 원시값이며 ADC만으로 실제 연결 여부를 확인할 수 없습니다.
      </p>
      {q.isPending ? (
        <p role="status">센서 데이터를 불러오는 중…</p>
      ) : q.isError ? (
        <p role="alert">{q.error.message}</p>
      ) : (
        <>
          <div className="metrics">
            {sensors.map(([key, label, unit]) => {
              const item = q.data.latest.find((x) => x.sensor_type === key);
              const state = !item
                ? "미연결"
                : item.status === "ok"
                  ? key === "uv_raw" || key === "uv_voltage"
                    ? "입력 확인 필요"
                    : "측정됨"
                  : item.status === "warming"
                    ? "예열 중"
                    : item.status === "error"
                      ? "측정 오류"
                      : "미연결";
              return (
                <article className="metric" key={key}>
                  <div className="metric-label">
                    {label}
                    <span>{state}</span>
                  </div>
                  <strong>
                    {item?.status === "ok" && item.value !== null
                      ? Number(item.value).toLocaleString("ko-KR", {
                          maximumFractionDigits: 2,
                        })
                      : "—"}
                    <small>{unit}</small>
                  </strong>
                  <p>
                    {item
                      ? new Date(item.recorded_at).toLocaleString("ko-KR")
                      : "수신 이력 없음"}
                    {!isOnline && item ? " · 장치 오프라인" : ""}
                  </p>
                </article>
              );
            })}
          </div>
          <label>
            센서별 그래프
            <select
              aria-label="센서별 그래프"
              value={sensor}
              onChange={(e) => setSensor(e.target.value)}
            >
              {sensors.map(([key, label, unit]) => (
                <option key={key} value={key}>
                  {label} ({unit})
                </option>
              ))}
            </select>
          </label>
          {q.data.history.some((row) => row.average !== null) ? (
            <div
              className="chart"
              role="img"
              aria-label={`${sensors.find((s) => s[0] === sensor)?.[1]} 시간별 평균 그래프`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={q.data.history}>
                  <CartesianGrid strokeDasharray="3 5" />
                  <XAxis
                    dataKey="recorded_at"
                    tickFormatter={(v) =>
                      new Date(v).toLocaleString("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    }
                    minTickGap={80}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    width={45}
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    labelFormatter={(v) =>
                      new Date(String(v)).toLocaleString("ko-KR")
                    }
                    formatter={(v) =>
                      v == null ? "측정 없음" : Number(v).toFixed(2)
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="average"
                    name="평균"
                    stroke="#27644c"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="chart-empty">선택한 기간에 측정 데이터가 없습니다.</p>
          )}
          {q.data.history.some((row) => row.samples > 0) && (
            <p className="muted small">
              최솟값{" "}
              {Math.min(
                ...q.data.history
                  .filter((row) => row.minimum !== null)
                  .map((row) => Number(row.minimum)),
              ).toFixed(2)}{" "}
              · 평균{" "}
              {(
                q.data.history.reduce(
                  (sum, row) =>
                    sum + Number(row.average ?? 0) * Number(row.samples),
                  0,
                ) /
                q.data.history.reduce(
                  (sum, row) => sum + Number(row.samples),
                  0,
                )
              ).toFixed(2)}{" "}
              · 최댓값{" "}
              {Math.max(
                ...q.data.history
                  .filter((row) => row.maximum !== null)
                  .map((row) => Number(row.maximum)),
              ).toFixed(2)}
            </p>
          )}
        </>
      )}
    </section>
  );
}
