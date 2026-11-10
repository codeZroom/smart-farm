export type Farm = { id: string; name: string; description: string };
export type Zone = Farm & { farm_id: string };
export type Device = {
  id: string;
  name: string;
  farm_zone_id: string;
  device_type: "ESP32_SHT31";
  firmware_version: string | null;
  last_seen_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type Reading = {
  device_id: string;
  temperature: number;
  humidity: number;
  recorded_at: string;
};
export type Bucket = Reading & {
  min_temperature: number;
  max_temperature: number;
  min_humidity: number;
  max_humidity: number;
  samples: number;
};
export type Threshold = {
  device_id: string;
  min_temperature: number;
  max_temperature: number;
  min_humidity: number;
  max_humidity: number;
  offline_after_seconds: number;
};
export type Alert = {
  id: string;
  device_id: string;
  alert_type: string;
  severity: string;
  message: string;
  created_at: string;
  resolved_at: string | null;
  acknowledged_at: string | null;
};
export type Data = {
  farms: Farm[];
  zones: Zone[];
  devices: Device[];
  thresholds: Threshold[];
  latest: Reading[];
  history: Bucket[] | null;
  alerts: Alert[];
  email: string;
};
