#pragma once
// Interface only: configure protocol, slave IDs, wiring, scaling and registers
// after obtaining the actual H392 and soil sensor manufacturer's documentation.
struct ModbusMeasurement { bool connected=false; float temperature=0; float moisture=0; float ec=0; };
class ModbusSensors {public: void begin(){} void update(){} };
