import { describe, expect, it } from 'vitest';

import { resourceSliderMarkIndices } from '../resource-options';

describe('resourceSliderMarkIndices', () => {
  it('returns every index when the option list is small', () => {
    expect(resourceSliderMarkIndices([1, 2, 4, 8], 10)).toEqual([0, 1, 2, 3]);
  });

  it('places even round-number ticks on a consecutive 1–192 GB range', () => {
    const options = Array.from({ length: 192 }, (_, index) => index + 1);
    const marks = resourceSliderMarkIndices(options);
    const values = marks.map((index) => options[index]);

    expect(values[0]).toBe(1);
    expect(values[values.length - 1]).toBe(192);
    expect(values.length).toBeLessThanOrEqual(13);
    expect(values).toContain(16);
    expect(values).toContain(64);
    expect(values).toContain(128);
    expect(values).not.toContain(2);
    expect(values).not.toContain(4);
  });

  it('places even round-number ticks on a consecutive 0–192 axis', () => {
    const options = Array.from({ length: 193 }, (_, index) => index);
    const marks = resourceSliderMarkIndices(options);
    const values = marks.map((index) => options[index]);

    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBe(192);
    expect(values.length).toBeLessThanOrEqual(13);
    expect(values).toContain(16);
    expect(values).toContain(64);
    expect(values).toContain(128);
  });

  it('spaces ticks evenly by index for irregular option lists', () => {
    const options = [1, 2, 4, 8, 16, 32, 64, 128, 192];
    const marks = resourceSliderMarkIndices(options, 5);

    expect(marks[0]).toBe(0);
    expect(marks[marks.length - 1]).toBe(options.length - 1);
    expect(marks.length).toBeLessThanOrEqual(5);
  });
});
