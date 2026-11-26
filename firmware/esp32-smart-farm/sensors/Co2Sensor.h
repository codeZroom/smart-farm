#pragma once
#include <Arduino.h>
class Co2Sensor {
 HardwareSerial &port; uint32_t started=0,lastRequest=0,requested=0,lastValid=0; uint8_t frame[9]{};size_t count=0;bool waiting=false;int ppm=-1;
 public:
 explicit Co2Sensor(HardwareSerial &serial):port(serial){}
 void begin(){port.begin(9600,SERIAL_8N1,16,17);started=millis();}
 bool warming() const{return (uint32_t)(millis()-started)<180000;}
 void update(){uint32_t now=millis();if(!waiting&&(uint32_t)(now-lastRequest)>=10000){while(port.available())port.read();const uint8_t cmd[9]={0xff,0x01,0x86,0,0,0,0,0,0x79};port.write(cmd,9);waiting=true;requested=now;lastRequest=now;count=0;}
 while(waiting&&port.available()&&count<9){uint8_t c=port.read();if(count==0&&c!=0xff)continue;frame[count++]=c;}
 if(waiting&&count==9){uint8_t sum=0;for(int i=1;i<8;i++)sum+=frame[i];uint8_t check=0xff-sum+1;int value=frame[2]*256+frame[3];if(frame[0]==0xff&&frame[1]==0x86&&frame[8]==check&&value>=0&&value<=10000){ppm=value;lastValid=now;}else{ppm=-1;Serial.println("CO2 response/checksum error");}waiting=false;}
 if(waiting&&(uint32_t)(now-requested)>2000){waiting=false;ppm=-1;Serial.println("CO2 response timeout");}}
 bool read(int &value) const{if(warming()||ppm<0||(uint32_t)(millis()-lastValid)>30000)return false;value=ppm;return true;}
};
