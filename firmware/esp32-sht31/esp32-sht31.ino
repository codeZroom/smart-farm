#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Adafruit_SHT31.h>
#include <ArduinoJson.h>
#include <time.h>
#include "config.local.h"

static const char* FIRMWARE_VERSION = "1.0.0";
static const uint32_t SEND_INTERVAL_MS = 30000;
Adafruit_SHT31 sensor;
bool sensorReady = false;
uint32_t lastSend = 0;
uint32_t lastWifiAttempt = 0;

bool timeReady() { return time(nullptr) > 1735689600; }
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22); // ESP32 DevKit: SDA=21, SCL=22
  Wire.setTimeOut(1000);
  sensorReady = sensor.begin(0x44);
  Serial.println(sensorReady ? "SHT31 ready" : "SHT31 init failed; will retry");
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastWifiAttempt = millis();
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  Serial.printf("SmartFarm firmware %s\n", FIRMWARE_VERSION);
}

void transmit() {
  if (!timeReady()) { Serial.println("Waiting for NTP; TLS request skipped"); return; }
  if (strncmp(API_URL, "https://", 8) != 0) { Serial.println("HTTPS URL required"); return; }
  if (!sensorReady) sensorReady = sensor.begin(0x44);
  float temperature = sensorReady ? sensor.readTemperature() : NAN;
  float humidity = sensorReady ? sensor.readHumidity() : NAN;
  bool invalid = !isfinite(temperature) || !isfinite(humidity) || temperature < -40 || temperature > 125 || humidity < 0 || humidity > 100;
  JsonDocument payload;
  payload["deviceId"] = DEVICE_ID;
  payload["firmwareVersion"] = FIRMWARE_VERSION;
  if (invalid) {
    payload["sensorError"] = true;
    sensorReady = false;
    Serial.println("Sensor read failed");
  } else {
    payload["temperature"] = temperature;
    payload["humidity"] = humidity;
    Serial.printf("Temperature %.2f C / humidity %.2f %%RH\n", temperature, humidity);
  }
  String body;
  serializeJson(payload, body);
  WiFiClientSecure tls;
  tls.setCACert(ROOT_CA);
  tls.setHandshakeTimeout(10);
  HTTPClient http;
  http.setConnectTimeout(10000);
  http.setTimeout(10000);
  http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
  if (!http.begin(tls, API_URL)) { Serial.println("HTTPS initialization failed"); return; }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + DEVICE_API_KEY);
  int status = http.POST(body);
  // Never log URL, authorization header, local settings or response bodies.
  Serial.printf("API HTTP status: %d\n", status);
  if (status == 401) Serial.println("Device key rejected; check provisioning");
  else if (status == 429) Serial.println("Rate limited; retry on next measurement");
  else if (status != 201) Serial.println("Transmission failed; retry on next measurement");
  http.end();
}

void loop() {
  uint32_t now = millis();
  if (WiFi.status() != WL_CONNECTED) {
    if ((uint32_t)(now - lastWifiAttempt) >= 15000) {
      lastWifiAttempt = now;
      Serial.println("Wi-Fi reconnecting");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  } else if ((uint32_t)(now - lastSend) >= SEND_INTERVAL_MS) {
    lastSend = now;
    transmit();
  }
  delay(50);
}
