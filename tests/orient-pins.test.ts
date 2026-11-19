import { describe, expect, it } from 'vitest';
import { orientModelPins } from '../src/geometry';
import type { Component } from '../src/model';

const part = (orientation?: [number, number, number], flagged = false): Component => ({
  id: 'c1', modelId: 'custom:abc', name: 'Imported', position: [0, 0, 0], rotation: [0, 0, 0], dimensions: [73.5, 146, 30.6],
  geometry: { kind: 'model', modelFormat: 'glb', modelOrientation: orientation, pinsOriented: flagged || undefined },
  pins: [{ id: 'PIN1', label: 'PIN1', side: 'left', index: 0, localPosition: [8.96, -73, -6.67], orientation: [0, 0, 0], electrical: 'passive', exitDirection: [0, 0, 1] }],
});

describe('orientModelPins', () => {
  it('rotates pins by the model orientation so they meet the displayed model', () => {
    const out = orientModelPins(part([-Math.PI / 2, 0, 0]));
    const [x, y, z] = out.pins[0].localPosition!;
    expect([x, y, z]).toEqual([8.96, -6.67, 73]);
    expect(out.pins[0].exitDirection).toEqual([0, 1, 0]);
    expect(out.geometry?.pinsOriented).toBe(true);
  });

  it('is applied only once', () => {
    const once = orientModelPins(part([-Math.PI / 2, 0, 0]));
    expect(orientModelPins(once)).toBe(once);
  });

  it('leaves unrotated models and built-in parts alone', () => {
    expect(orientModelPins(part()).pins[0].localPosition).toEqual([8.96, -73, -6.67]);
    const builtin = { ...part([-Math.PI / 2, 0, 0]), modelId: 'esp32-wroom' };
    expect(orientModelPins(builtin)).toBe(builtin);
  });
});
