import { describe as group, expect, it } from 'vitest';
import { getWeapon, WEAPONS } from './catalog.js';

group('armas que se gastan', () => {
  it('toda arrojadiza tiene stock >= 1 y breakChance 0', () => {
    for (const w of WEAPONS.filter((w) => w.category === 'arrojadiza')) {
      expect(w.stock, w.id).not.toBeNull();
      expect(w.stock ?? 0, w.id).toBeGreaterThanOrEqual(1);
      expect(w.breakChance, w.id).toBe(0);
    }
  });

  it('ninguna arma de mano tiene stock', () => {
    for (const w of WEAPONS.filter((w) => w.category !== 'arrojadiza')) {
      expect(w.stock, w.id).toBeNull();
    }
  });

  it('breakChance va de 0 a 100', () => {
    for (const w of WEAPONS) {
      expect(w.breakChance, w.id).toBeGreaterThanOrEqual(0);
      expect(w.breakChance, w.id).toBeLessThanOrEqual(100);
    }
  });

  it('la banqueta es la mas fragil y la vara de las que menos', () => {
    const max = Math.max(...WEAPONS.map((w) => w.breakChance));
    expect(getWeapon('banqueta').breakChance).toBe(max);
    expect(getWeapon('vara').breakChance).toBeLessThanOrEqual(1);
  });

  it('la botija y la garrafa son de un solo uso, los cuchillos de cinco', () => {
    expect(getWeapon('botija').stock).toBe(1);
    expect(getWeapon('garrafa').stock).toBe(1);
    expect(getWeapon('cuchillos').stock).toBe(5);
  });
});
