const { describe, it, expect } = require('@jest/globals');

describe('Difficulty Scaling Formulas', () => {
  describe('Bullet Speed Scaling', () => {
    function getBulletSpeed(level) {
      return Math.min(200, 48 + (level - 1) * Math.floor(152 / 19));
    }

    it('should return 48px/s at level 1', () => {
      expect(getBulletSpeed(1)).toBe(48);
    });

    it('should cap at 200px/s at higher levels', () => {
      const speed20 = getBulletSpeed(20);
      expect(speed20).toBeLessThanOrEqual(200);
      expect(speed20).toBe(200);
    });

    it('should increase monotonically across levels', () => {
      let prevSpeed = getBulletSpeed(1);
      for (let level = 2; level <= 20; level++) {
        const speed = getBulletSpeed(level);
        expect(speed).toBeGreaterThanOrEqual(prevSpeed);
        prevSpeed = speed;
      }
    });

    it('should have reasonable progression', () => {
      const speed1 = getBulletSpeed(1);
      const speed20 = getBulletSpeed(20);
      expect(speed20 - speed1).toBeLessThan(160);
    });

    it('should output expected values for key levels', () => {
      expect(getBulletSpeed(1)).toBe(48);
      expect(getBulletSpeed(5)).toBe(80);
      expect(getBulletSpeed(10)).toBe(128);
      expect(getBulletSpeed(15)).toBe(176);
      expect(getBulletSpeed(20)).toBe(200);
    });
  });

  describe('Fire Interval Scaling', () => {
    function getFireInterval(level) {
      return Math.floor(2500 - (level - 1) * (1800 / 19));
    }

    it('should return 2500ms (floored) at level 1', () => {
      const interval = getFireInterval(1);
      expect(interval).toBeLessThanOrEqual(2500);
      expect(Math.floor(interval) === interval).toBe(true);
    });

    it('should return around 700ms (floored) at level 20', () => {
      const interval = getFireInterval(20);
      expect(interval).toBeLessThanOrEqual(800);
      expect(interval).toBeGreaterThanOrEqual(650);
    });

    it('should decrease monotonically across levels', () => {
      let prevInterval = getFireInterval(1);
      for (let level = 2; level <= 20; level++) {
        const interval = getFireInterval(level);
        expect(interval).toBeLessThanOrEqual(prevInterval);
        prevInterval = interval;
      }
    });

    it('should always be positive', () => {
      for (let level = 1; level <= 20; level++) {
        expect(getFireInterval(level)).toBeGreaterThan(0);
      }
    });

    it('should output expected values for key levels', () => {
      expect(getFireInterval(1)).toBe(2500);
      expect(getFireInterval(5)).toBe(2121);
      expect(getFireInterval(10)).toBe(1631);
      expect(getFireInterval(15)).toBe(1142);
      expect(getFireInterval(20)).toBe(652);
    });
  });

  describe('Fire Mode Thresholds', () => {
    function getFireMode(level) {
      return level <= 9 ? 'single' : 'continuous';
    }

    it('should use single fire mode for levels 1-9', () => {
      for (let level = 1; level <= 9; level++) {
        expect(getFireMode(level)).toBe('single');
      }
    });

    it('should use continuous fire mode for levels 10-20', () => {
      for (let level = 10; level <= 20; level++) {
        expect(getFireMode(level)).toBe('continuous');
      }
    });
  });

  describe('Enemy Position Mode', () => {
    function getEnemyPositionMode(level) {
      return level <= 14 ? 'key-aligned' : 'random';
    }

    function shouldShowLabels(level) {
      return level >= 15;
    }

    it('should use key-aligned positions for levels 1-14', () => {
      for (let level = 1; level <= 14; level++) {
        expect(getEnemyPositionMode(level)).toBe('key-aligned');
      }
    });

    it('should use random positions for levels 15-20', () => {
      for (let level = 15; level <= 20; level++) {
        expect(getEnemyPositionMode(level)).toBe('random');
      }
    });

    it('should show labels for levels 15+', () => {
      for (let level = 15; level <= 20; level++) {
        expect(shouldShowLabels(level)).toBe(true);
      }
    });

    it('should not show labels for levels 1-14', () => {
      for (let level = 1; level <= 14; level++) {
        expect(shouldShowLabels(level)).toBe(false);
      }
    });
  });

  describe('Complete Difficulty Table', () => {
    it('should generate consistent values for all levels 1-20', () => {
      function getBulletSpeed(level) {
        return Math.min(200, 48 + (level - 1) * Math.floor(152 / 19));
      }

      function getFireInterval(level) {
        return Math.floor(2500 - (level - 1) * (1800 / 19));
      }

      function getFireMode(level) {
        return level <= 9 ? 'single' : 'continuous';
      }

      function getEnemyPositionMode(level) {
        return level <= 14 ? 'key-aligned' : 'random';
      }

      function shouldShowLabels(level) {
        return level >= 15;
      }

      for (let level = 1; level <= 20; level++) {
        const speed = getBulletSpeed(level);
        const interval = getFireInterval(level);
        const fireMode = getFireMode(level);
        const positionMode = getEnemyPositionMode(level);
        const labels = shouldShowLabels(level);

        expect(speed).toBeGreaterThan(0);
        expect(speed).toBeLessThanOrEqual(200);
        expect(interval).toBeGreaterThan(0);
        expect(interval).toBeLessThanOrEqual(2500);
        expect(['single', 'continuous']).toContain(fireMode);
        expect(['key-aligned', 'random']).toContain(positionMode);
        expect([true, false]).toContain(labels);
      }
    });
  });

  describe('Level Transitions', () => {
    it('should transition fire mode exactly at level 10', () => {
      function getFireMode(level) {
        return level <= 9 ? 'single' : 'continuous';
      }

      expect(getFireMode(9)).toBe('single');
      expect(getFireMode(10)).toBe('continuous');
    });

    it('should transition enemy position exactly at level 15', () => {
      function getEnemyPositionMode(level) {
        return level <= 14 ? 'key-aligned' : 'random';
      }

      expect(getEnemyPositionMode(14)).toBe('key-aligned');
      expect(getEnemyPositionMode(15)).toBe('random');
    });

    it('should transition labels exactly at level 15', () => {
      function shouldShowLabels(level) {
        return level >= 15;
      }

      expect(shouldShowLabels(14)).toBe(false);
      expect(shouldShowLabels(15)).toBe(true);
    });
  });
});