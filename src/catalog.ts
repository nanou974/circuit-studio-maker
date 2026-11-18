import { draftToBuilder, guessElectrical, ELECTRICAL, type ModuleDraft } from './aiModule';
import type { LibraryPart } from './library';

/**
 * Built-in catalogue of common ESP32 / Arduino modules.
 *
 * Each entry is a procedural PCB: board outline + labelled pins. Sizes and pin
 * order are the typical ones for the most common clone of each board — they are
 * flagged `verified:false`, and vendors do differ, so check against your unit.
 * Pin spec: `L:a,b|R:c|T:d|B:e`. Left/right are listed top-to-bottom, top/bottom
 * left-to-right. A label may carry an electrical override: `LV1:b`
 * (i input, o output, b bidirectional, p passive, g ground, v power-in, w power-out).
 */
type Row = [id: string, name: string, category: string, w: number, h: number, color: string, spec: string, description: string, pitch?: number];

const BLUE = '#1f5fa8', GREEN = '#176b54', RED = '#a8232b', BLACK = '#1d1d20', PURPLE = '#4a2a73';
const NOTE = ' Typical dimensions and pin order — verify against your board.';

export const CATALOG_VERSION = 1;

const ROWS: Row[] = [
  // ── Power ───────────────────────────────────────────────
  ['tp4056', 'TP4056 Li-ion charger (protected)', 'Power', 26, 17, BLUE, 'L:IN+,IN-|R:OUT+,B+,B-,OUT-', '1 A single-cell Li-ion/LiPo charger with DW01 protection. IN from USB 5 V, battery on B+/B-, load on OUT+/OUT-.'],
  ['xl4015', 'XL4015 5 A buck converter', 'Power', 51, 23, BLUE, 'L:IN+,IN-|R:OUT+,OUT-', 'Adjustable step-down converter, 4–38 V in, 1.25–36 V out, 5 A max.'],
  ['lm2596', 'LM2596 buck converter', 'Power', 43, 21, BLUE, 'L:IN+,IN-|R:OUT+,OUT-', 'Adjustable step-down converter, 3 A max.'],
  ['mp1584', 'MP1584EN mini buck converter', 'Power', 22, 17, BLUE, 'L:IN+,IN-|R:OUT+,OUT-', 'Tiny 3 A adjustable step-down converter.'],
  ['mt3608', 'MT3608 boost converter', 'Power', 37, 17, BLUE, 'L:VIN+,VIN-|R:VOUT+,VOUT-', 'Adjustable step-up converter, 2–24 V in, up to 28 V out, 2 A.'],
  ['xl6009', 'XL6009 boost converter', 'Power', 43, 21, BLUE, 'L:IN+,IN-|R:OUT+,OUT-', 'Adjustable step-up converter, 4 A switch.'],
  ['ams1117', 'AMS1117-3.3 regulator module', 'Power', 22, 16, BLUE, 'L:VIN,GND|R:VOUT:w,GND', '800 mA linear 3.3 V regulator breakout.'],
  ['l7805', 'L7805 regulator (TO-220)', 'Power', 10, 15, BLACK, 'B:IN:v,GND,OUT:w', '5 V 1 A linear regulator, pins seen from the front.'],
  ['mb102', 'MB102 breadboard power supply', 'Power', 53, 32, GREEN, 'T:VIN+:v,GND|B:3V3:w,5V:w,GND', 'Breadboard power module with selectable 3.3 V / 5 V rails.'],
  ['ina219', 'INA219 current sensor', 'Sensors', 25.5, 22.7, BLUE, 'T:VCC,GND,SCL,SDA|B:VIN+:p,VIN-:p', 'I2C high-side current/voltage/power monitor (26 V, 3.2 A with 0.1 Ω shunt).'],
  // ── Motor drivers & actuators ───────────────────────────
  ['l298n', 'L298N dual motor driver', 'Motor drivers', 43, 43, RED, 'L:OUT1:o,OUT2:o|R:OUT3:o,OUT4:o|B:12V,GND,5V,ENA,IN1,IN2,IN3,IN4,ENB', 'Dual H-bridge, 2 A per channel, 5–35 V motor supply.'],
  ['a4988', 'A4988 stepper driver', 'Motor drivers', 15.5, 20.5, RED, 'L:ENABLE:i,MS1:i,MS2:i,MS3:i,RESET:i,SLEEP:i,STEP:i,DIR:i|R:VMOT,GND,2B:o,2A:o,1A:o,1B:o,VDD,GND', 'Microstepping bipolar stepper driver, up to 2 A.'],
  ['tb6612fng', 'TB6612FNG dual motor driver', 'Motor drivers', 20, 20, RED, 'L:PWMA:i,AIN2:i,AIN1:i,STBY:i,BIN1:i,BIN2:i,PWMB:i,GND|R:VM,VCC,GND,A01:o,A02:o,B02:o,B01:o,GND', 'Dual DC motor driver, 1.2 A per channel, 15 V max.'],
  ['uln2003-board', 'ULN2003 stepper driver board', 'Motor drivers', 32, 35, BLUE, 'B:IN1,IN2,IN3,IN4|L:-,+', 'Driver board for the 28BYJ-48 stepper (5 V).'],
  ['l293d', 'L293D motor driver (DIP-16)', 'ICs', 10.16, 20, BLACK, 'L:EN1:i,IN1:i,OUT1:o,GND,GND,OUT2:o,IN2:i,VCC2:v|R:VCC1:v,IN4:i,OUT4:o,GND,GND,OUT3:o,IN3:i,EN2:i', 'Quad half-H driver, 600 mA per channel.'],
  ['pca9685', 'PCA9685 16-ch servo driver', 'Motor drivers', 62, 25, BLUE, 'T:GND,OE:i,SCL,SDA,VCC,V+', 'I2C 16-channel 12-bit PWM / servo controller (servo outputs not modelled).'],
  ['sg90', 'SG90 micro servo', 'Actuators', 23, 12, '#2b5fa5', 'B:GND,VCC:v,SIG:i', '9 g micro servo. Brown = GND, red = VCC, orange = signal.'],
  ['dc-motor-130', 'DC motor (130 size)', 'Actuators', 25, 20, '#8a8d91', 'R:M+:p,M-:p', 'Small brushed DC motor.'],
  ['buzzer-active', 'Active buzzer module', 'Actuators', 22, 12, BLACK, 'B:I/O:i,VCC,GND', 'Buzzer module with built-in oscillator.'],
  ['relay-1ch', 'Relay module 1-channel', 'Actuators', 50, 26, BLUE, 'L:VCC,GND,IN:i|R:NC:p,COM:p,NO:p', '5 V relay board, 10 A / 250 VAC contacts.'],
  ['relay-2ch', 'Relay module 2-channel', 'Actuators', 51, 38, BLUE, 'L:VCC,IN1:i,IN2:i,GND|R:K1_NC:p,K1_COM:p,K1_NO:p,K2_NC:p,K2_COM:p,K2_NO:p', '5 V two-channel relay board.'],
  ['relay-4ch', 'Relay module 4-channel', 'Actuators', 75, 55, BLUE, 'L:VCC,IN1:i,IN2:i,IN3:i,IN4:i,GND|R:K1_NC:p,K1_COM:p,K1_NO:p,K2_NC:p,K2_COM:p,K2_NO:p,K3_NC:p,K3_COM:p,K3_NO:p,K4_NC:p,K4_COM:p,K4_NO:p', '5 V four-channel relay board.'],
  // ── Sensors ─────────────────────────────────────────────
  ['hc-sr04', 'HC-SR04 ultrasonic sensor', 'Sensors', 45, 20, BLUE, 'B:VCC,TRIG,ECHO,GND', 'Ultrasonic distance sensor, 2–400 cm, 5 V. ECHO outputs 5 V: level-shift for 3.3 V boards.'],
  ['hc-sr501', 'HC-SR501 PIR motion sensor', 'Sensors', 32, 24, GREEN, 'B:VCC,OUT:o,GND', 'Passive infrared motion sensor, 5–20 V, 3.3 V logic out.'],
  ['dht11', 'DHT11 temperature/humidity module', 'Sensors', 22, 12, BLUE, 'B:VCC,DATA:o,GND', 'Digital temperature and humidity sensor (3-pin module).'],
  ['dht22', 'DHT22 / AM2302 module', 'Sensors', 25, 15, BLUE, 'B:VCC,DATA:o,GND', 'Higher-accuracy digital temperature and humidity sensor (3-pin module).'],
  ['ds18b20', 'DS18B20 temperature module', 'Sensors', 20, 12, GREEN, 'B:VCC,DQ:b,GND', '1-Wire digital temperature sensor module.'],
  ['bme280', 'BME280 environmental sensor', 'Sensors', 15, 11.5, PURPLE, 'B:VCC,GND,SCL,SDA,CSB:i,SDO:i', 'I2C/SPI temperature, humidity and pressure sensor, 3.3 V.'],
  ['bmp280', 'BMP280 pressure sensor', 'Sensors', 15, 11.5, PURPLE, 'B:VCC,GND,SCL,SDA,CSB:i,SDO:i', 'I2C/SPI barometric pressure and temperature sensor.'],
  ['aht20', 'AHT20 temperature/humidity', 'Sensors', 17, 12, GREEN, 'B:VIN,GND,SCL,SDA', 'I2C temperature and humidity sensor.'],
  ['bh1750', 'BH1750 light sensor', 'Sensors', 18, 14, PURPLE, 'B:VCC,GND,SCL,SDA,ADDR:i', 'I2C ambient light sensor (lux).'],
  ['mpu6050', 'MPU-6050 (GY-521) IMU', 'Sensors', 20.5, 15.5, BLUE, 'B:VCC,GND,SCL,SDA,XDA:b,XCL:b,AD0:i,INT:o', '6-axis accelerometer + gyroscope, I2C.'],
  ['vl53l0x', 'VL53L0X ToF distance sensor', 'Sensors', 25, 11, PURPLE, 'B:VIN,GND,SCL,SDA,GPIO1:o,XSHUT:i', 'I2C time-of-flight laser distance sensor, up to 2 m.'],
  ['max6675', 'MAX6675 thermocouple module', 'Sensors', 21, 15.5, BLUE, 'B:VCC,GND,SCK:i,CS:i,SO:o', 'K-type thermocouple amplifier, SPI.'],
  ['hx711', 'HX711 load-cell amplifier', 'Sensors', 34, 21, RED, 'L:E+:p,E-:p,A-:p,A+:p,B-:p,B+:p|R:GND,DT:b,SCK:i,VCC', '24-bit ADC for load cells.'],
  ['mq2', 'MQ-2 gas sensor module', 'Sensors', 32, 22, BLUE, 'B:VCC,GND,DO:o,AO:o', 'Smoke / LPG / CO gas sensor module, 5 V.'],
  ['soil-resistive', 'Soil moisture sensor module (resistive)', 'Sensors', 30, 16, BLUE, 'B:VCC,GND,DO:o,AO:o', 'YL-69 / HW-103 comparator board.'],
  ['soil-capacitive', 'Capacitive soil moisture sensor v1.2', 'Sensors', 98, 23, BLACK, 'B:GND,VCC,AOUT:o', 'Corrosion-resistant capacitive soil moisture probe.'],
  ['rain-module', 'Rain sensor module', 'Sensors', 30, 16, BLUE, 'B:VCC,GND,DO:o,AO:o', 'Comparator board for the rain plate.'],
  ['water-level', 'Water level sensor', 'Sensors', 62, 20, GREEN, 'B:+,-,S:o', 'Analog water level / depth sensor.'],
  ['fc51', 'FC-51 IR obstacle sensor', 'Sensors', 31, 14, BLUE, 'B:VCC,GND,OUT:o', 'Infrared obstacle avoidance sensor.'],
  ['ky037', 'KY-037 sound sensor', 'Sensors', 35, 15, BLUE, 'B:AO:o,GND,+5V,DO:o', 'Microphone module with analog and digital out.'],
  ['ldr-module', 'LDR light sensor module', 'Sensors', 32, 14, BLUE, 'B:VCC,GND,DO:o,AO:o', 'Photoresistor module with comparator.'],
  ['ttp223', 'TTP223 touch sensor', 'Sensors', 24, 24, PURPLE, 'B:VCC,I/O:o,GND', 'Capacitive touch switch module.'],
  ['ky040', 'KY-040 rotary encoder', 'Sensors', 30, 19, GREEN, 'B:CLK:o,DT:o,SW:o,+,GND', 'Rotary encoder with push button.'],
  ['ky023', 'KY-023 joystick', 'Sensors', 34, 26, GREEN, 'B:GND,+5V,VRx:o,VRy:o,SW:o', 'Two-axis analog joystick with button.'],
  ['neo6m', 'NEO-6M GPS module (GY-NEO6MV2)', 'Sensors', 36, 24, BLUE, 'B:VCC,RX,TX,GND', 'u-blox NEO-6M GPS, UART 9600 baud.'],
  ['rc522', 'RC522 RFID reader', 'Sensors', 40, 60, BLUE, 'B:SDA:i,SCK:i,MOSI:i,MISO:o,IRQ:o,GND,RST:i,3.3V', '13.56 MHz MIFARE reader, SPI. SDA is the SPI chip-select.'],
  ['ds3231', 'DS3231 RTC module', 'Modules', 38, 22, BLUE, 'T:32K:o,SQW:o,SCL,SDA,VCC,GND', 'High-accuracy I2C real-time clock with battery holder.'],
  ['sd-card', 'Micro SD card module (SPI)', 'Modules', 42, 24, BLUE, 'B:CS,SCK,MOSI,MISO,VCC,GND', 'SPI micro SD adapter.'],
  // ── Displays ────────────────────────────────────────────
  ['ssd1306-i2c', 'OLED 0.96" SSD1306 (I2C)', 'Displays', 27, 27, BLACK, 'T:GND,VCC,SCL,SDA', '128×64 monochrome OLED, I2C address 0x3C.'],
  ['ssd1306-spi', 'OLED 0.96" SSD1306 (SPI 7-pin)', 'Displays', 27, 27, BLACK, 'T:GND,VCC,D0:i,D1:i,RES:i,DC:i,CS:i', '128×64 monochrome OLED, SPI (D0 = SCK, D1 = MOSI).'],
  ['lcd1602-i2c', 'LCD 1602 with I2C backpack', 'Displays', 80, 36, GREEN, 'B:GND,VCC,SDA,SCL', '16×2 character LCD with PCF8574 backpack, 5 V.'],
  ['st7735', 'TFT 1.8" ST7735 (SPI)', 'Displays', 34, 56, RED, 'T:LED,SCK:i,SDA:i,A0:i,RESET:i,CS:i,GND,VCC', '128×160 colour TFT, SPI (SDA = MOSI, A0 = DC).'],
  ['max7219', 'MAX7219 8×8 LED matrix', 'Displays', 32, 32, GREEN, 'B:VCC,GND,DIN:i,CS:i,CLK:i', 'Cascadable 8×8 LED matrix driver.'],
  ['tm1637', 'TM1637 4-digit display', 'Displays', 42, 24, BLACK, 'B:CLK:i,DIO:b,VCC,GND', '4-digit 7-segment display with 2-wire interface.'],
  ['ws2812-stick', 'WS2812B 8-LED stick', 'Displays', 51, 10, BLACK, 'L:5V:v,DIN:i,GND|R:5V:v,DOUT:o,GND', 'Addressable RGB LED stick.'],
  // ── Wireless & communication ────────────────────────────
  ['nrf24l01', 'NRF24L01 2.4 GHz radio', 'Wireless', 15, 29, GREEN, 'L:GND,CE:i,SCK:i,MISO:o|R:VCC,CSN:i,MOSI:i,IRQ:o', '2.4 GHz transceiver, 3.3 V, SPI.'],
  ['hc05', 'HC-05 Bluetooth module', 'Wireless', 27, 13, BLUE, 'B:STATE:o,RXD,TXD,GND,VCC,EN:i', 'Bluetooth SPP master/slave, UART.'],
  ['hc06', 'HC-06 Bluetooth module', 'Wireless', 27, 13, BLUE, 'B:VCC,GND,TXD,RXD', 'Bluetooth SPP slave, UART.'],
  ['esp01', 'ESP-01 (ESP8266)', 'Wireless', 14.5, 24.8, BLUE, 'L:GND,GPIO2:b,GPIO0:b,RXD|R:TXD,CH_PD:i,RST:i,VCC', 'ESP8266 Wi-Fi module, 3.3 V.'],
  ['logic-level', 'Logic level converter (4-ch)', 'Modules', 13, 15, GREEN, 'L:LV1:b,LV2:b,LV:v,GND,LV3:b,LV4:b|R:HV1:b,HV2:b,HV:v,GND,HV3:b,HV4:b', 'Bidirectional 3.3 V ↔ 5 V level shifter.'],
  // ── Microcontroller boards ──────────────────────────────
  ['arduino-nano', 'Arduino Nano', 'Microcontroller boards', 18, 43.2, BLUE, 'L:TX1,RX0,RST,GND,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12|R:VIN,GND,RST,5V,A7,A6,A5,A4,A3,A2,A1,A0,AREF,3V3,D13', 'ATmega328P board, 30 pins, USB at the top.'],
  ['wemos-d1-mini', 'WEMOS D1 mini (ESP8266)', 'Microcontroller boards', 25.6, 34.2, BLUE, 'L:RST,A0,D0,D5,D6,D7,D8,3V3|R:TX,RX,D1,D2,D3,D4,GND,5V', 'ESP8266 Wi-Fi board, 16 pins.'],
  ['nodemcu-v3', 'NodeMCU v3 (ESP8266)', 'Microcontroller boards', 25.4, 48.3, BLACK, 'L:A0,RSV,RSV,SD3,SD2,SD1,CMD,SD0,CLK,GND,3V3,EN,RST,GND,VIN|R:D0,D1,D2,D3,D4,3V3,GND,D5,D6,D7,D8,RX,TX,GND,3V3', 'ESP8266 development board, 30 pins.'],
  ['rpi-pico', 'Raspberry Pi Pico', 'Microcontroller boards', 21, 51, GREEN, 'L:GP0,GP1,GND,GP2,GP3,GP4,GP5,GND,GP6,GP7,GP8,GP9,GND,GP10,GP11,GP12,GP13,GND,GP14,GP15|R:VBUS,VSYS,GND,3V3_EN:i,3V3_OUT,ADC_VREF,GP28,GND,GP27,GP26,RUN:i,GP22,GND,GP21,GP20,GP19,GP18,GND,GP17,GP16', 'RP2040 board, pins 1–20 left, 40–21 right (USB at the top).'],
  // ── Discrete & ICs ──────────────────────────────────────
  ['push-button', 'Push button', 'Components', 8, 8, BLACK, 'L:A:p|R:B:p', 'Momentary tactile switch.'],
  ['pot-10k', 'Potentiometer 10 kΩ', 'Components', 12, 9.5, BLUE, 'B:A:p,W:o,B:p', 'Rotary potentiometer: A / wiper / B.'],
  ['2n2222', '2N2222 NPN transistor (TO-92)', 'Components', 6, 6, BLACK, 'B:E:p,B:p,C:p', 'NPN switching transistor, flat face towards you: E, B, C.', 1.27],
  ['irlz44n', 'IRLZ44N MOSFET (TO-220)', 'Components', 10, 15, BLACK, 'B:G:i,D:p,S:p', 'Logic-level N-channel MOSFET, pins seen from the front.'],
  ['pc817', 'PC817 optocoupler (DIP-4)', 'ICs', 10.16, 6, BLACK, 'L:ANODE:i,CATHODE:p|R:COLLECTOR:o,EMITTER:p', 'Single-channel optocoupler.'],
  ['ne555', 'NE555 timer (DIP-8)', 'ICs', 10.16, 10.5, BLACK, 'L:GND,TRIG:i,OUT:o,RESET:i|R:VCC,DISCH:p,THRES:i,CTRL:p', 'Classic 555 timer.'],
  ['lm358', 'LM358 dual op-amp (DIP-8)', 'ICs', 10.16, 10.5, BLACK, 'L:OUT1:o,IN1-:i,IN1+:i,GND|R:VCC,OUT2:o,IN2-:i,IN2+:i', 'Dual operational amplifier.'],
  ['74hc595', '74HC595 shift register (DIP-16)', 'ICs', 10.16, 20, BLACK, 'L:QB:o,QC:o,QD:o,QE:o,QF:o,QG:o,QH:o,GND|R:VCC,QA:o,SER:i,OE:i,RCLK:i,SRCLK:i,SRCLR:i,QH\':o', '8-bit serial-in parallel-out shift register.'],
];

const ELEC: Record<string, (typeof ELECTRICAL)[number]> = { i: 'input', o: 'output', b: 'bidirectional', p: 'passive', g: 'ground', v: 'power-in', w: 'power-out' };
const SIDE: Record<string, 'left' | 'right' | 'top' | 'bottom'> = { L: 'left', R: 'right', T: 'top', B: 'bottom' };

export function parseSpec(spec: string): ModuleDraft['pins'] {
  const pins: ModuleDraft['pins'] = [];
  for (const group of spec.split('|')) {
    const side = SIDE[group[0]];
    for (const item of group.slice(2).split(',')) {
      const [label, code] = item.split(/:(?=[a-z]$)/);
      const electrical = code ? ELEC[code] : guessElectrical(label);
      const v = /^\+?5V$/i.test(label) ? 5 : /^(\+?3V3|3\.3V|3V3_OUT)$/i.test(label) ? 3.3 : /^12V$/i.test(label) ? 12 : undefined;
      pins.push({ label, side, electrical, ...(v !== undefined ? { voltage: v } : {}) });
    }
  }
  return pins;
}

export function catalogParts(): LibraryPart[] {
  return ROWS.map(([id, name, category, w, h, color, spec, description, pitch]) => {
    const layout = draftToBuilder({ name, category: 'Modules', description, width: w, height: h, pcbColor: color, pitch, warnings: [], pins: parseSpec(spec) });
    return {
      id: `builtin-${id}`, name, category, description: description + NOTE, dimensions: layout.dimensions, format: 'procedural-pcb' as const,
      geometry: { kind: 'procedural-pcb' as const, quality: 'enhanced-procedural' as const, pcbColor: layout.color, pcbThickness: layout.dimensions[2], headerRows: 1, headerSpacing: layout.pitch, category, verified: false },
      pins: layout.pins.map(p => ({ ...p, orientation: p.orientation ?? [0, 0, 0] as [number, number, number], electrical: p.electrical ?? 'passive', exitDirection: p.exitDirection ?? [0, 0, 1] as [number, number, number], localPosition: p.localPosition ?? [0, 0, 0] as [number, number, number] })),
    };
  });
}
