#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include "config.local.h"
#include "sensors/WaterSensor.h"
#include "sensors/Co2Sensor.h"
#include "sensors/UvSensor.h"
#include "sensors/ModbusSensors.h"
static const char* VERSION="2.0.0";
WaterSensor water;Co2Sensor co2(Serial2);UvSensor uv;ModbusSensors futureSensors;
uint32_t lastSend=0,lastWifi=0;
void setup(){Serial.begin(115200);water.begin();co2.begin();uv.begin();futureSensors.begin();WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);lastWifi=millis();configTime(0,0,"pool.ntp.org","time.google.com");Serial.println("Smart Farm firmware 2.0.0");}
void sendReadings(){
 if(time(nullptr)<1735689600){Serial.println("NTP not ready; TLS skipped");return;}
 if(strncmp(API_URL,"https://",8)!=0){Serial.println("HTTPS required");return;}
 JsonDocument doc;doc["deviceId"]=DEVICE_ID;doc["firmwareVersion"]=VERSION;JsonObject readings=doc["readings"].to<JsonObject>();JsonObject states=doc["sensorStatuses"].to<JsonObject>();
 float temperature;int ppm,raw,mv;
 if(water.read(temperature)){readings["water_temperature"]=temperature;Serial.printf("Water: %.2f C\n",temperature);}else{readings["water_temperature"]=nullptr;states["water_temperature"]="error";Serial.println("Water sensor error");}
 if(co2.read(ppm)){readings["co2"]=ppm;Serial.printf("CO2: %d ppm\n",ppm);}else{readings["co2"]=nullptr;states["co2"]=co2.warming()?"warming":"error";Serial.println(co2.warming()?"CO2 warming up":"CO2 unavailable");}
 uv.read(raw,mv);readings["uv_raw"]=raw;readings["uv_voltage"]=mv;Serial.printf("UV raw: %d; %d mV (uncalibrated)\n",raw,mv);
 const char* absent[]={"air_temperature","air_humidity","soil_1_moisture","soil_1_temperature","soil_1_ec","soil_2_moisture","soil_2_temperature","soil_2_ec"};for(auto name:absent){readings[name]=nullptr;states[name]="disconnected";}
 String body;serializeJson(doc,body);WiFiClientSecure tls;tls.setCACert(ROOT_CA);tls.setHandshakeTimeout(10);HTTPClient http;http.setConnectTimeout(10000);http.setTimeout(10000);http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
 if(!http.begin(tls,API_URL)){Serial.println("HTTPS setup failed");return;}http.addHeader("Content-Type","application/json");http.addHeader("Authorization",String("Bearer ")+DEVICE_API_KEY);int code=http.POST(body);Serial.printf("HTTP status: %d\n",code);if(code==401)Serial.println("Device authentication failed");else if(code==422)Serial.println("Invalid sensor payload");else if(code==429)Serial.println("Rate limited; retry next interval");else if(code==503)Serial.println("Server unavailable; retry next interval");else if(code!=201)Serial.println("Transmission failed; retry next interval");http.end();
}
void loop(){uint32_t now=millis();co2.update();futureSensors.update();if(WiFi.status()!=WL_CONNECTED){if((uint32_t)(now-lastWifi)>=15000){lastWifi=now;WiFi.disconnect();WiFi.begin(WIFI_SSID,WIFI_PASSWORD);Serial.println("Wi-Fi reconnecting");}}else if((uint32_t)(now-lastSend)>=30000){lastSend=now;sendReadings();}delay(10);}
