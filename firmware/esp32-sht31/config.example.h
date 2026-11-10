#pragma once
// Copy to config.local.h. Never commit the filled file.
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#define API_URL "https://your-development-host.example/api/v1/devices/readings"
#define DEVICE_ID ""
#define DEVICE_API_KEY ""
// PEM root CA for API_URL. Obtain from your host/CA's official trust repository.
// Do not use a short-lived leaf certificate. Update this when the trust chain changes.
static const char ROOT_CA[] PROGMEM = R"PEM(
-----BEGIN CERTIFICATE-----
PASTE_OFFICIAL_ROOT_CA_HERE
-----END CERTIFICATE-----
)PEM";
