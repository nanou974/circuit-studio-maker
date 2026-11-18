import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {catalogParts,parseSpec} from '../src/catalog';
import {LibraryPartSchema} from '../src/library';
import {guessElectrical} from '../src/aiModule';

describe('built-in module catalogue',()=>{
 const parts=catalogParts();
 it('has many valid, unique parts',()=>{
  expect(parts.length).toBeGreaterThanOrEqual(60);
  expect(new Set(parts.map(p=>p.id)).size).toBe(parts.length);
  for(const p of parts){
   expect(()=>LibraryPartSchema.parse(p),p.id).not.toThrow();
   expect(new Set(p.pins.map(x=>x.id)).size,p.id).toBe(p.pins.length);
   for(const pin of p.pins){
    expect(Math.abs(pin.localPosition![0]),`${p.id}/${pin.id}`).toBeLessThanOrEqual(p.dimensions[0]/2+1e-6);
    expect(Math.abs(pin.localPosition![1]),`${p.id}/${pin.id}`).toBeLessThanOrEqual(p.dimensions[1]/2+1e-6);
   }
  }
 });
 it('includes the headline modules with the right pins',()=>{
  const by=(id:string)=>parts.find(p=>p.id===`builtin-${id}`)!;
  expect(by('hc-sr04').pins.map(p=>p.label)).toEqual(['VCC','TRIG','ECHO','GND']);
  expect(by('tp4056').pins.map(p=>p.id)).toEqual(expect.arrayContaining(['IN_PLUS','IN_MINUS','B_PLUS','B_MINUS','OUT_PLUS','OUT_MINUS']));
  expect(by('xl4015').pins).toHaveLength(4);
  expect(by('rpi-pico').pins).toHaveLength(40);
  expect(by('arduino-nano').pins).toHaveLength(30);
 });
 it('classifies electrical roles',()=>{
  expect(guessElectrical('GND')).toBe('ground');expect(guessElectrical('IN-')).toBe('ground');expect(guessElectrical('IN+')).toBe('power-in');
  expect(guessElectrical('OUT+')).toBe('power-out');expect(guessElectrical('VCC')).toBe('power-in');expect(guessElectrical('SDA')).toBe('bidirectional');
  const lv=parseSpec('L:LV1:b,LV:v,GND');expect(lv.map(p=>p.electrical)).toEqual(['bidirectional','power-in','ground']);
  expect(parseSpec('B:+5V')[0].voltage).toBe(5);
 });
});
