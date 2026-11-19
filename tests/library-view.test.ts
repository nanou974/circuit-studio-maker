import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW, sourceOf, viewRows, type Usage } from '../src/libraryView';

const rows = [
  ['arduino-uno-r3', 'Arduino Uno R3', 'MICROCONTROLLERS', '44 PINS'],
  ['custom:builtin-tp4056', 'TP4056 charger', 'POWER', '6 PINS'],
  ['custom:builtin-hc-sr04', 'HC-SR04 ultrasonic', 'SENSORS', '4 PINS'],
  ['custom:custom-abc', 'My TFT35', 'MODULES', '10 PINS'],
];
const ids = (r: string[][]) => r.map(x => x[0]);

describe('parts bin view', () => {
  it('classifies the source of a part', () => {
    expect(sourceOf('arduino-uno-r3')).toBe('builtin');
    expect(sourceOf('custom:builtin-tp4056')).toBe('catalog');
    expect(sourceOf('custom:custom-abc')).toBe('mine');
  });

  it('keeps the original order by default', () => {
    expect(ids(viewRows(rows, DEFAULT_VIEW, {}))).toEqual(ids(rows));
  });

  it('filters by source and category', () => {
    expect(ids(viewRows(rows, { ...DEFAULT_VIEW, source: 'catalog' }, {}))).toEqual(['custom:builtin-tp4056', 'custom:builtin-hc-sr04']);
    expect(ids(viewRows(rows, { ...DEFAULT_VIEW, source: 'mine' }, {}))).toEqual(['custom:custom-abc']);
    expect(ids(viewRows(rows, { ...DEFAULT_VIEW, category: 'SENSORS' }, {}))).toEqual(['custom:builtin-hc-sr04']);
  });

  it('sorts by name', () => {
    expect(viewRows(rows, { ...DEFAULT_VIEW, sort: 'name' }, {}).map(r => r[1])).toEqual(['Arduino Uno R3', 'HC-SR04 ultrasonic', 'My TFT35', 'TP4056 charger']);
  });

  it('sorts by usage frequency and by last use, and lists used parts', () => {
    const usage: Usage = { 'custom:builtin-tp4056': { n: 5, last: 100 }, 'custom:custom-abc': { n: 2, last: 300 } };
    expect(ids(viewRows(rows, { ...DEFAULT_VIEW, sort: 'used' }, usage)).slice(0, 2)).toEqual(['custom:builtin-tp4056', 'custom:custom-abc']);
    expect(ids(viewRows(rows, { ...DEFAULT_VIEW, sort: 'recent-used' }, usage)).slice(0, 2)).toEqual(['custom:custom-abc', 'custom:builtin-tp4056']);
    expect(ids(viewRows(rows, { ...DEFAULT_VIEW, source: 'used' }, usage)).sort()).toEqual(['custom:builtin-tp4056', 'custom:custom-abc']);
  });

  it('sorts by date added, newest first', () => {
    const added = { 'custom:custom-abc': 2000, 'custom:builtin-tp4056': 1000 };
    expect(ids(viewRows(rows, { ...DEFAULT_VIEW, sort: 'added' }, {}, added)).slice(0, 2)).toEqual(['custom:custom-abc', 'custom:builtin-tp4056']);
  });
});
