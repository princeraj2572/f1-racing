import { describe, expect, it } from 'vitest';
import { timeLeft } from '../src/ui/countdown';

describe('timeLeft', () => {
  const start = Date.parse('2027-03-19T09:00:00+05:30');

  it('splits the time into days, hours, minutes and seconds', () => {
    const now = start - (((3 * 24 + 4) * 60 + 5) * 60 + 6) * 1000;
    expect(timeLeft(start, now)).toEqual({
      days: 3,
      hours: 4,
      minutes: 5,
      seconds: 6,
      done: false,
    });
  });

  it('stops at zero once the date has passed', () => {
    expect(timeLeft(start, start)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      done: true,
    });
    expect(timeLeft(start, start + 5000).done).toBe(true);
  });

  it('rounds partial seconds down so it never shows a time that has not happened', () => {
    expect(timeLeft(start, start - 1500).seconds).toBe(1);
  });
});
