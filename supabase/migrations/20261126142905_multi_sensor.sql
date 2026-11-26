begin;
-- Observations are append-only; a null reading is an explicit sensor state, not zero.
create table public.sensor_measurements (
 id bigint generated always as identity primary key,
 device_id uuid not null references public.devices(id),
 sensor_type text not null check(sensor_type in ('water_temperature','co2','uv_voltage','uv_raw','air_temperature','air_humidity','soil_1_moisture','soil_1_temperature','soil_1_ec','soil_2_moisture','soil_2_temperature','soil_2_ec')),
 value numeric,
 status text not null check(status in ('ok','error','warming','disconnected')),
 recorded_at timestamptz not null default now(),
 check((status='ok' and value is not null and value::text not in ('NaN','Infinity','-Infinity')) or (status<>'ok' and value is null))
);
create index sensor_measurements_device_type_time on public.sensor_measurements(device_id,sensor_type,recorded_at desc,id desc);
alter table public.sensor_measurements enable row level security;
revoke all on public.sensor_measurements from public,anon,authenticated;
grant select on public.sensor_measurements to authenticated;
grant all on public.sensor_measurements to service_role;
grant usage,select on sequence public.sensor_measurements_id_seq to service_role;
create policy sensor_measurements_owner on public.sensor_measurements for select to authenticated using(public.owns_device(device_id));
insert into public.sensor_measurements(device_id,sensor_type,value,status,recorded_at)
select device_id,'air_temperature',temperature,'ok',recorded_at from public.sensor_readings
union all select device_id,'air_humidity',humidity,'ok',recorded_at from public.sensor_readings;
create function public.copy_legacy_measurements() returns trigger language plpgsql security invoker set search_path='' as $$begin
 insert into public.sensor_measurements(device_id,sensor_type,value,status,recorded_at) values(new.device_id,'air_temperature',new.temperature,'ok',new.recorded_at),(new.device_id,'air_humidity',new.humidity,'ok',new.recorded_at);return new;
end$$;
revoke all on function public.copy_legacy_measurements() from public,anon,authenticated;
create trigger copy_legacy_measurements after insert on public.sensor_readings for each row execute function public.copy_legacy_measurements();
create function public.ingest_multi_reading(p_device uuid,p_hash text,p_firmware text,p_readings jsonb,p_statuses jsonb default '{}'::jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.devices;t public.device_thresholds;v_time timestamptz=clock_timestamp();item record;v numeric;low numeric;high numeric;s text;temp numeric;hum numeric;valid_count integer=0;
begin
 select * into d from public.devices where id=p_device for update;
 if d.id is null or not d.is_active or not exists(select 1 from public.device_credentials where device_id=p_device and key_hash=p_hash and revoked_at is null) then return jsonb_build_object('status',401);end if;
 if d.last_seen_at>v_time-interval '10 seconds' then return jsonb_build_object('status',429);end if;
 if jsonb_typeof(p_readings)<>'object' or jsonb_typeof(p_statuses)<>'object' or length(p_firmware)>64 then raise exception 'invalid request';end if;
 for item in select key,value from jsonb_each(p_readings) loop
  case item.key
   when 'water_temperature','soil_1_temperature','soil_2_temperature' then low=-55;high=125;
   when 'air_temperature' then low=-40;high=125;
   when 'air_humidity','soil_1_moisture','soil_2_moisture' then low=0;high=100;
   when 'co2' then low=0;high=10000;
   when 'uv_voltage' then low=0;high=3300;
   when 'uv_raw' then low=0;high=4095;
   when 'soil_1_ec','soil_2_ec' then low=0;high=100000;
   else raise exception 'unknown sensor'; end case;
  if item.value='null'::jsonb then
   s=coalesce(p_statuses->>item.key,'disconnected');if s not in ('warming','error','disconnected') then raise exception 'invalid status';end if;
  elsif jsonb_typeof(item.value)='number' then
   if p_statuses ? item.key then raise exception 'invalid status';end if;
   v=(item.value #>> '{}')::numeric;if v<low or v>high or v::text in ('NaN','Infinity','-Infinity') then raise exception 'out of range';end if;s='ok';valid_count=valid_count+1;
  else raise exception 'invalid reading';end if;
 end loop;
 if valid_count=0 or exists(select 1 from jsonb_object_keys(p_statuses) k where not p_readings ? k) then raise exception 'no valid measurement';end if;
 update public.devices set last_seen_at=v_time,firmware_version=coalesce(p_firmware,firmware_version) where id=p_device;
 perform public.set_alert(p_device,'offline',false,'장치 오프라인');
 temp=(p_readings->>'air_temperature')::numeric;hum=(p_readings->>'air_humidity')::numeric;
 if temp is not null and hum is not null then
  insert into public.sensor_readings(device_id,temperature,humidity,recorded_at) values(p_device,temp,hum,v_time);
  select * into t from public.device_thresholds where device_id=p_device;
  perform public.set_alert(p_device,'temperature_high',temp>t.max_temperature,'온도 상한 초과','danger');
  perform public.set_alert(p_device,'temperature_low',temp<t.min_temperature,'온도 하한 미달','danger');
  perform public.set_alert(p_device,'humidity_high',hum>t.max_humidity,'습도 상한 초과');
  perform public.set_alert(p_device,'humidity_low',hum<t.min_humidity,'습도 하한 미달');
 end if;
 for item in select key,value from jsonb_each(p_readings) loop
  if temp is not null and hum is not null and item.key in ('air_temperature','air_humidity') then continue;end if;
  if item.value='null'::jsonb then v=null;s=coalesce(p_statuses->>item.key,'disconnected');else v=(item.value #>> '{}')::numeric;s='ok';end if;
  insert into public.sensor_measurements(device_id,sensor_type,value,status,recorded_at) values(p_device,item.key,v,s,v_time);
 end loop;
 perform public.set_alert(p_device,'sensor_error',exists(select 1 from (select distinct on (m.sensor_type) m.status from public.sensor_measurements m where m.device_id=p_device order by m.sensor_type,m.recorded_at desc,m.id desc) latest where latest.status='error'),'센서 측정 실패','danger');
 return jsonb_build_object('status',201,'recorded_at',v_time);
end$$;
revoke all on function public.ingest_multi_reading(uuid,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_multi_reading(uuid,text,text,jsonb,jsonb) to service_role;
create function public.latest_sensor_measurements(p_device uuid) returns setof public.sensor_measurements language sql stable security invoker set search_path='' as $$select distinct on (m.sensor_type) m.* from public.sensor_measurements m where m.device_id=p_device order by m.sensor_type,m.recorded_at desc,m.id desc$$;
create function public.sensor_measurement_history(p_device uuid,p_hours integer,p_sensor text) returns table(recorded_at timestamptz,average numeric,minimum numeric,maximum numeric,samples bigint) language sql stable security invoker set search_path='' as $$select date_bin(case when p_hours=1 then interval '1 minute' when p_hours=24 then interval '5 minutes' else interval '1 hour' end,m.recorded_at,'2000-01-01'::timestamptz),avg(m.value),min(m.value),max(m.value),count(m.value) from public.sensor_measurements m where m.device_id=p_device and m.sensor_type=p_sensor and p_hours in (1,24,168,720) and m.recorded_at>=now()-make_interval(hours=>p_hours) group by 1 order by 1 limit 721$$;
revoke all on function public.latest_sensor_measurements(uuid),public.sensor_measurement_history(uuid,integer,text) from public,anon;
grant execute on function public.latest_sensor_measurements(uuid),public.sensor_measurement_history(uuid,integer,text) to authenticated,service_role;
commit;
