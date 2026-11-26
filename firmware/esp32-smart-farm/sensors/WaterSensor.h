#pragma once
#include <OneWire.h>
#include <DallasTemperature.h>
class WaterSensor {
 OneWire wire{4}; DallasTemperature sensor{&wire};
 public:
 void begin(){sensor.begin();sensor.setWaitForConversion(false);sensor.requestTemperatures();}
 bool read(float &value){sensor.begin();value=sensor.getTempCByIndex(0);sensor.requestTemperatures();return isfinite(value)&&value!=DEVICE_DISCONNECTED_C&&value>=-55&&value<=125;}
};
