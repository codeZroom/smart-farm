#pragma once
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#define API_URL "https://smart-farm-teal.vercel.app/api/v1/devices/readings"
#define DEVICE_ID ""
#define DEVICE_API_KEY ""
// Replace with the official root CA for the endpoint's current certificate chain.
static const char ROOT_CA[] PROGMEM = R"PEM(
-----BEGIN CERTIFICATE-----
PASTE_OFFICIAL_ROOT_CA_HERE
-----END CERTIFICATE-----
)PEM";
