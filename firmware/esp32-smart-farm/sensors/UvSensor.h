#pragma once
#include <Arduino.h>
class UvSensor {public:void begin(){analogReadResolution(12);analogSetPinAttenuation(34,ADC_11db);}void read(int &raw,int &mv){raw=analogRead(34);mv=analogReadMilliVolts(34);}};
