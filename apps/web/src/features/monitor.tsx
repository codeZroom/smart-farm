"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Thermometer,
  Droplets,
  Radio,
  ArrowUpRight,
  RefreshCw,
  Plus,
  Bell,
  Clock,
  WifiOff,
  Leaf,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
const SensorChart = dynamic(
  () => import("@/components/charts/sensor-chart").then((m) => m.SensorChart),
  {
    ssr: false,
    loading: () => <div className="chart-empty">그래프를 불러오는 중…</div>,
  },
);
import type { Data, Device, Threshold } from "@/types";
const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleString("ko-KR") : "수신 이력 없음";
const defaults = {
  min_temperature: 18,
  max_temperature: 28,
  min_humidity: 50,
  max_humidity: 75,
  offline_after_seconds: 120,
};
export function Monitor({ view, id }: { view: string; id?: string }) {
  const [selected, setSelected] = useState(id || "");
  const [period, setPeriod] = useState("24h");
  const [key, setKey] = useState("");
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(true);
  const [install, setInstall] = useState<
    null | (Event & { prompt: () => Promise<void> })
  >(null);
  const qc = useQueryClient();
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as Event & { prompt: () => Promise<void> });
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("beforeinstallprompt", prompt);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  const query = useQuery<Data>({
    queryKey: ["monitor", selected, period],
    queryFn: async () => {
      const res = await fetch(
        `/api/manage?period=${period}${selected ? `&device=${selected}` : ""}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) location.href = "/login";
        throw new Error(json.error);
      }
      return json;
    },
  });
  const data = query.data;
  useEffect(() => {
    if (!selected && data?.devices.length) setSelected(data.devices[0].id);
  }, [data, selected]);
  const save = useMutation({
    mutationFn: async (payload: unknown) => {
      const res = await fetch("/api/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: (result) => {
      setNotice("저장했습니다.");
      if (result.key) setKey(result.key);
      qc.invalidateQueries({ queryKey: ["monitor"] });
    },
    onError: (e) => setNotice(e.message),
  });
  if (query.isPending && (!online || query.fetchStatus === "paused"))
    return (
      <div className="empty">
        <WifiOff />
        <h1>인터넷 연결이 필요합니다</h1>
        <p>
          현재 오프라인이며 표시할 측정 데이터가 없습니다. 연결이 복구되면
          자동으로 다시 조회합니다.
        </p>
      </div>
    );
  if (query.isPending)
    return (
      <div className="loading" role="status">
        <RefreshCw className="spin" />
        농장 상태를 불러오고 있습니다…
      </div>
    );
  if (!data)
    return (
      <div className="empty error">
        <h1>연결을 확인해 주세요</h1>
        <p>{query.error?.message}</p>
        <Button onClick={() => query.refetch()}>다시 시도</Button>
      </div>
    );
  const device = data.devices.find((d) => d.id === selected);
  const threshold = data.thresholds.find((t) => t.device_id === selected);
  const reading = data.latest.find((r) => r.device_id === selected);
  const activeAlerts = data.alerts.filter((a) => !a.resolved_at);
  const history = data.history || [];
  function isOnline(d: Device) {
    const t = data!.thresholds.find((t) => t.device_id === d.id);
    return (
      d.is_active &&
      !!d.last_seen_at &&
      Date.now() - new Date(d.last_seen_at).getTime() <
        (t?.offline_after_seconds || 120) * 1000
    );
  }
  function state(d: Device) {
    if (!d.is_active) return "비활성";
    if (!isOnline(d)) return "오프라인";
    if (
      data!.alerts.some(
        (a) =>
          a.device_id === d.id && !a.resolved_at && a.severity === "danger",
      )
    )
      return "위험";
    const r = data!.latest.find((r) => r.device_id === d.id);
    const t = data!.thresholds.find((t) => t.device_id === d.id);
    if (
      r &&
      t &&
      (r.temperature < t.min_temperature || r.temperature > t.max_temperature)
    )
      return "위험";
    if (r && t && (r.humidity < t.min_humidity || r.humidity > t.max_humidity))
      return "주의";
    if (data!.alerts.some((a) => a.device_id === d.id && !a.resolved_at))
      return "주의";
    return "정상";
  }
  const submit = (
    e: React.FormEvent<HTMLFormElement>,
    action: string,
    extra: Record<string, unknown> = {},
  ) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    save.mutate({ action, data: { ...values, ...extra } });
  };
  const titles: Record<string, string> = {
    dashboard: "대시보드",
    farms: "농장 · 구역",
    devices: "장치 관리",
    detail: "장치 상세",
    statistics: "온습도 통계",
    alerts: "알림 이력",
    thresholds: "장치 임계값",
    settings: "사용자 설정",
  };
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">MY FARM / {view.toUpperCase()}</p>
          <h1>{titles[view]}</h1>
          <p className="muted">
            {view === "dashboard"
              ? "작은 변화도 놓치지 않는, 우리 농장의 현재 상태입니다."
              : "농장의 환경과 연결된 장치를 관리하세요."}
          </p>
        </div>
        <div className="header-meta">
          <span>
            <span className={`dot ${online ? "" : "gray"}`} />
            {online ? "네트워크 연결됨" : "인터넷 오프라인"}
          </span>
          <button aria-label="데이터 새로고침" onClick={() => query.refetch()}>
            <RefreshCw size={18} />
          </button>
        </div>
      </header>
      {!online && (
        <div className="banner">
          <WifiOff size={18} />
          인터넷 연결이 끊겼습니다. 아래는 마지막 조회 데이터이며 현재 상태가
          아닐 수 있습니다.
        </div>
      )}
      {query.isError && (
        <div className="banner error" role="alert">
          새로고침 실패: {query.error.message}. 마지막 조회 데이터를 표시합니다.
        </div>
      )}
      {notice && (
        <div className="banner" role="status">
          {notice}
          <button onClick={() => setNotice("")} aria-label="메시지 닫기">
            ×
          </button>
        </div>
      )}
      {key && (
        <section className="key-panel" role="alert">
          <h2>장치 인증키 · 이번에만 표시됩니다</h2>
          <p>
            펌웨어의 로컬 설정에 안전하게 보관하세요. 닫은 뒤에는 재조회할 수
            없습니다.
          </p>
          <code>{key}</code>
          <Button variant="outline" onClick={() => setKey("")}>
            보관했습니다 · 닫기
          </Button>
        </section>
      )}
      {["dashboard", "detail", "statistics"].includes(view) && (
        <>
          <div className="toolbar">
            <div className="section-label">
              <Leaf size={18} />
              {data.farms.map((f) => f.name).join(" · ") ||
                "등록된 농장이 없습니다"}
            </div>
            <label className="inline-label">
              장치
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">장치를 선택하세요</option>
                {data.devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <select
              aria-label="조회 기간"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {[
                ["1h", "최근 1시간"],
                ["24h", "최근 24시간"],
                ["7d", "최근 7일"],
                ["30d", "최근 30일"],
              ].map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {!device ? (
            <div className="empty">
              <Radio size={36} />
              <h2>첫 번째 장치를 연결해 보세요</h2>
              <p>
                농장과 구역을 만든 후 장치를 등록하면 측정값을 확인할 수
                있습니다.
              </p>
              <Link href="/farms">
                농장 만들기 <ArrowUpRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              <div className="device-intro">
                <h2>
                  {device.name}
                  <span
                    className={`badge ${state(device) === "정상" ? "good" : state(device) === "위험" ? "danger" : state(device) === "주의" ? "warning" : "neutral"}`}
                  >
                    {state(device)}
                  </span>
                </h2>
                <span className="muted small">
                  <Clock size={14} />
                  마지막 측정 {fmt(reading?.recorded_at || null)}
                </span>
              </div>
              <div className="metrics">
                <section className="metric">
                  <div className="metric-label">
                    <span>현재 온도</span>
                    <Thermometer className="warm" size={22} />
                  </div>
                  <strong>
                    {reading ? Number(reading.temperature).toFixed(1) : "—"}
                    <small>°C</small>
                  </strong>
                  <p>
                    설정 범위 {threshold?.min_temperature ?? 18}–
                    {threshold?.max_temperature ?? 28} °C
                  </p>
                </section>
                <section className="metric">
                  <div className="metric-label">
                    <span>현재 상대습도</span>
                    <Droplets className="cool" size={22} />
                  </div>
                  <strong>
                    {reading ? Number(reading.humidity).toFixed(1) : "—"}
                    <small>%RH</small>
                  </strong>
                  <p>
                    설정 범위 {threshold?.min_humidity ?? 50}–
                    {threshold?.max_humidity ?? 75} %RH
                  </p>
                </section>
                <section className="metric">
                  <div className="metric-label">
                    <span>연결된 장치</span>
                    <Radio size={22} />
                  </div>
                  <strong>
                    {data.devices.filter(isOnline).length}
                    <small>/ {data.devices.length}대</small>
                  </strong>
                  <p>
                    활성 {data.devices.filter((d) => d.is_active).length}대 ·
                    등록된 전체 장치 기준
                  </p>
                </section>
                <section className="metric">
                  <div className="metric-label">
                    <span>확인할 알림</span>
                    <Bell size={22} />
                  </div>
                  <strong>
                    {activeAlerts.length}
                    <small>건</small>
                  </strong>
                  <p>최근 100건 중 미해결 알림</p>
                </section>
              </div>
              {!isOnline(device) && (
                <div className="banner">
                  <WifiOff size={18} />
                  장치가 오프라인이거나 비활성 상태입니다. 측정값은 마지막
                  수신값입니다.
                </div>
              )}
              <div className="chart-grid">
                {(["temperature", "humidity"] as const).map((metric) => (
                  <section className="panel" key={metric}>
                    <div className="panel-heading">
                      <h2>
                        {metric === "temperature" ? "온도 변화" : "습도 변화"}{" "}
                        <span className="muted small">
                          {metric === "temperature" ? "°C" : "%RH"}
                        </span>
                      </h2>
                      <span className="muted small">
                        {period} ·{" "}
                        {["7d", "30d"].includes(period)
                          ? "1시간"
                          : period === "24h"
                            ? "5분"
                            : "1분"}{" "}
                        평균
                      </span>
                    </div>
                    {history.length ? (
                      <SensorChart rows={history} metric={metric} />
                    ) : (
                      <div className="chart-empty">
                        이 기간에 수신된 측정 데이터가 없습니다.
                      </div>
                    )}
                  </section>
                ))}
              </div>
              {history.length > 0 && (
                <section className="panel">
                  <h2>기간 통계</h2>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>측정 항목</th>
                          <th>최솟값</th>
                          <th>평균값</th>
                          <th>최댓값</th>
                          <th>측정 수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(["temperature", "humidity"] as const).map(
                          (metric) => {
                            const samples = history.reduce(
                              (s, r) => s + Number(r.samples),
                              0,
                            );
                            return (
                              <tr key={metric}>
                                <td>
                                  {metric === "temperature"
                                    ? "온도 °C"
                                    : "습도 %RH"}
                                </td>
                                <td>
                                  {Math.min(
                                    ...history.map((r) =>
                                      Number(r[`min_${metric}`]),
                                    ),
                                  ).toFixed(1)}
                                </td>
                                <td>
                                  {(
                                    history.reduce(
                                      (s, r) =>
                                        s +
                                        Number(r[metric]) * Number(r.samples),
                                      0,
                                    ) / samples
                                  ).toFixed(1)}
                                </td>
                                <td>
                                  {Math.max(
                                    ...history.map((r) =>
                                      Number(r[`max_${metric}`]),
                                    ),
                                  ).toFixed(1)}
                                </td>
                                <td>{samples}</td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {view === "detail" && (
                <section className="panel">
                  <h2>장치 정보</h2>
                  <dl>
                    <dt>UUID</dt>
                    <dd>{device.id}</dd>
                    <dt>유형</dt>
                    <dd>{device.device_type}</dd>
                    <dt>펌웨어</dt>
                    <dd>{device.firmware_version || "수신 전"}</dd>
                    <dt>마지막 통신</dt>
                    <dd>{fmt(device.last_seen_at)}</dd>
                    <dt>생성일</dt>
                    <dd>{fmt(device.created_at)}</dd>
                    <dt>수정일</dt>
                    <dd>{fmt(device.updated_at)}</dd>
                  </dl>
                  <Link href={`/devices/${device.id}/thresholds`}>
                    임계값 설정 →
                  </Link>
                </section>
              )}
            </>
          )}
        </>
      )}
      {view === "farms" && (
        <>
          <div className="two-col">
            <section className="panel">
              <h2>농장 만들기</h2>
              <form onSubmit={(e) => submit(e, "farm")}>
                <label>
                  농장 이름
                  <input name="name" required maxLength={80} />
                </label>
                <label>
                  설명
                  <textarea name="description" maxLength={500} />
                </label>
                <Button disabled={save.isPending}>
                  <Plus size={17} />
                  농장 등록
                </Button>
              </form>
            </section>
            <section className="panel">
              <h2>재배 구역 만들기</h2>
              <form onSubmit={(e) => submit(e, "zone")}>
                <label>
                  농장
                  <select name="farm_id" required>
                    <option value="">선택하세요</option>
                    {data.farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  구역 이름
                  <input name="name" required maxLength={80} />
                </label>
                <label>
                  설명
                  <textarea name="description" maxLength={500} />
                </label>
                <Button disabled={save.isPending || !data.farms.length}>
                  <Plus size={17} />
                  구역 등록
                </Button>
              </form>
            </section>
          </div>
          <section className="panel">
            <h2>등록된 농장</h2>
            {data.farms.length ? (
              data.farms.map((f) => (
                <div className="farm-row" key={f.id}>
                  <h3>{f.name}</h3>
                  <p className="muted">{f.description}</p>
                  <div className="chips">
                    {data.zones
                      .filter((z) => z.farm_id === f.id)
                      .map((z) => (
                        <span className="badge neutral" key={z.id}>
                          {z.name}
                        </span>
                      ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">아직 농장이 없습니다.</p>
            )}
          </section>
        </>
      )}
      {view === "devices" && (
        <>
          <section className="panel">
            <h2>새 장치 등록</h2>
            <p className="muted small">
              SHT31 센서가 연결된 ESP32 장치를 등록하세요. 키는 한 번만
              표시됩니다.
            </p>
            <form className="row-form" onSubmit={(e) => submit(e, "device")}>
              <label>
                장치 이름
                <input name="name" required maxLength={80} />
              </label>
              <label>
                설치 구역
                <select name="farm_zone_id" required>
                  <option value="">선택하세요</option>
                  {data.zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {data.farms.find((f) => f.id === z.farm_id)?.name} /{" "}
                      {z.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button disabled={save.isPending || !data.zones.length}>
                <Plus size={17} />
                장치 등록
              </Button>
            </form>
          </section>
          <div className="device-grid">
            {data.devices.map((d) => (
              <section className="panel" key={d.id}>
                <div className="panel-heading">
                  <h2>
                    <Radio size={18} />
                    {d.name}
                  </h2>
                  <span className="badge neutral">{state(d)}</span>
                </div>
                <p className="uuid">{d.id}</p>
                <p className="small muted">마지막 통신 {fmt(d.last_seen_at)}</p>
                <Link href={`/devices/${d.id}`}>
                  측정값과 그래프 <ArrowUpRight size={15} />
                </Link>
                <details>
                  <summary>장치 수정 · 인증키 관리</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      save.mutate({
                        action: "update-device",
                        id: d.id,
                        data: {
                          name: v.name,
                          farm_zone_id: v.farm_zone_id,
                          device_type: "ESP32_SHT31",
                          is_active: v.is_active === "on",
                        },
                      });
                    }}
                  >
                    <label>
                      장치 이름
                      <input
                        name="name"
                        defaultValue={d.name}
                        required
                        maxLength={80}
                      />
                    </label>
                    <label>
                      설치 구역
                      <select name="farm_zone_id" defaultValue={d.farm_zone_id}>
                        {data.zones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="check">
                      <input
                        name="is_active"
                        type="checkbox"
                        defaultChecked={d.is_active}
                      />
                      활성화
                    </label>
                    <Button variant="outline" disabled={save.isPending}>
                      변경 저장
                    </Button>
                  </form>
                  <div className="actions">
                    <Button
                      variant="outline"
                      disabled={save.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            "기존 인증키가 즉시 폐기됩니다. 재발급하시겠습니까?",
                          )
                        )
                          save.mutate({ action: "rotate", id: d.id });
                      }}
                    >
                      키 재발급
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={save.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            "장치 전송이 중단됩니다. 키를 폐기하시겠습니까?",
                          )
                        )
                          save.mutate({ action: "revoke", id: d.id });
                      }}
                    >
                      키 폐기
                    </Button>
                  </div>
                </details>
              </section>
            ))}
          </div>
          {!data.devices.length && (
            <div className="empty">
              등록된 장치가 없습니다. 구역을 생성한 후 장치를 등록하세요.
            </div>
          )}
        </>
      )}
      {view === "thresholds" && device && (
        <ThresholdForm
          device={device}
          threshold={threshold}
          pending={save.isPending}
          submit={(values) =>
            save.mutate({ action: "thresholds", id: device.id, data: values })
          }
        />
      )}
      {(view === "dashboard" || view === "alerts") && (
        <section className="panel">
          <div className="panel-heading">
            <h2>
              최근 알림{" "}
              <span className="badge neutral">{data.alerts.length}</span>
            </h2>
            {view === "dashboard" && <Link href="/alerts">전체 보기 →</Link>}
          </div>
          {!data.alerts.length ? (
            <div className="empty compact">
              <Bell size={24} />
              <p>수신된 알림이 없습니다.</p>
            </div>
          ) : (
            data.alerts.slice(0, view === "dashboard" ? 5 : 100).map((a) => (
              <div className="alert-row" key={a.id}>
                <div className={`alert-icon ${a.severity}`}>
                  <Bell size={17} />
                </div>
                <div>
                  <strong>{a.message}</strong>
                  <p className="small muted">
                    {data.devices.find((d) => d.id === a.device_id)?.name} ·{" "}
                    {fmt(a.created_at)}
                  </p>
                  <span className="small">
                    {a.resolved_at ? "해결됨" : "미해결"}
                    {a.acknowledged_at ? " · 확인함" : ""}
                  </span>
                </div>
                {!a.acknowledged_at && (
                  <Button
                    variant="outline"
                    disabled={save.isPending}
                    onClick={() => save.mutate({ action: "resolve", id: a.id })}
                  >
                    확인
                  </Button>
                )}
              </div>
            ))
          )}
          <p className="muted small">
            최근 100건을 표시합니다. 확인 처리는 해결 상태와 별개입니다.
            오프라인 알림은 스케줄러 실행 시 생성됩니다.
          </p>
        </section>
      )}
      {view === "settings" && (
        <div className="two-col">
          <section className="panel">
            <h2>계정</h2>
            <p>{data.email}</p>
            <form onSubmit={(e) => submit(e, "profile")}>
              <label>
                새 비밀번호
                <input
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
              <Button disabled={save.isPending}>비밀번호 변경</Button>
            </form>
          </section>
          <section className="panel">
            <h2>홈 화면에 설치</h2>
            <p className="muted">
              Android Chrome은 설치 버튼 또는 브라우저 메뉴를 이용하세요. iPhone
              Safari는 공유 → 홈 화면에 추가를 선택하세요.
            </p>
            {install ? (
              <Button
                onClick={async () => {
                  await install.prompt();
                  setInstall(null);
                }}
              >
                앱 설치
              </Button>
            ) : (
              <p>브라우저의 홈 화면 추가 메뉴를 확인해 주세요.</p>
            )}
            <h3>데이터 표시</h3>
            <p className="muted small">
              15초 자동 갱신 · 시각은 현재 기기 시간대 · 오프라인에서는 마지막
              조회 데이터임을 표시합니다. 로그아웃하면 메모리의 조회 데이터가
              제거됩니다.
            </p>
          </section>
        </div>
      )}
      <footer className="page-footer">
        온실 · SMART FARM MONITORING
        <span>
          마지막 조회{" "}
          {query.dataUpdatedAt
            ? new Date(query.dataUpdatedAt).toLocaleTimeString("ko-KR")
            : "—"}
        </span>
      </footer>
    </>
  );
}
function ThresholdForm({
  device,
  threshold,
  pending,
  submit,
}: {
  device: Device;
  threshold?: Threshold;
  pending: boolean;
  submit: (v: typeof defaults) => void;
}) {
  return (
    <section className="panel narrow">
      <h2>{device.name} · 정상 범위</h2>
      <p className="muted">
        아래 기본값은 입력 예시이며 작물별 권장값이 아닙니다.
      </p>
      <form
        key={threshold?.device_id}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          submit(
            Object.fromEntries(
              Object.keys(defaults).map((k) => [k, Number(f.get(k))]),
            ) as typeof defaults,
          );
        }}
      >
        {(Object.keys(defaults) as (keyof typeof defaults)[]).map((k, i) => (
          <label key={k}>
            {
              [
                "최저 온도 (°C)",
                "최고 온도 (°C)",
                "최저 습도 (%RH)",
                "최고 습도 (%RH)",
                "오프라인 임계시간 (초)",
              ][i]
            }
            <input
              name={k}
              type="number"
              step={i === 4 ? "1" : "0.1"}
              min={i === 4 ? 60 : i < 2 ? -40 : 0}
              max={i === 4 ? 86400 : i < 2 ? 125 : 100}
              required
              defaultValue={threshold?.[k] ?? defaults[k]}
            />
          </label>
        ))}
        <Button disabled={pending}>임계값 저장</Button>
      </form>
    </section>
  );
}
