import { describe, it, expect } from 'vitest';
import { formatCents, formatSigned, centsFromKeypad, decimalString } from '../money.js';

const M = '−';

describe('formatCents', () => {
  it('formats positive cents', () => {
    expect(formatCents(185706, 'en-US')).toBe('$1,857.06');
  });
  it('formats zero', () => {
    expect(formatCents(0, 'en-US')).toBe('$0.00');
  });
  it('formats negatives with a true minus', () => {
    expect(formatCents(-28644, 'en-US')).toBe(`${M}$286.44`);
  });
});

describe('formatSigned', () => {
  it('always signs income', () => {
    expect(formatSigned(165000, 'en-US')).toBe('+$1,650.00');
  });
  it('always signs expenses', () => {
    expect(formatSigned(-5432, 'en-US')).toBe(`${M}$54.32`);
  });
  it('leaves zero unsigned', () => {
    expect(formatSigned(0, 'en-US')).toBe('$0.00');
  });
});

describe('centsFromKeypad', () => {
  it('fills cents-first', () => {
    expect(centsFromKeypad('5')).toBe(5);
    expect(centsFromKeypad('54')).toBe(54);
    expect(centsFromKeypad('543')).toBe(543);
    expect(centsFromKeypad('5432')).toBe(5432);
  });
  it('ignores non-digits and empty input', () => {
    expect(centsFromKeypad('')).toBe(0);
    expect(centsFromKeypad('1a2b')).toBe(12);
  });
});

describe('decimalString', () => {
  it('round-trips exact cents', () => {
    expect(decimalString(38627)).toBe('386.27');
    expect(decimalString(-11373)).toBe('-113.73');
    expect(decimalString(5)).toBe('0.05');
    expect(decimalString(0)).toBe('0.00');
  });
});
