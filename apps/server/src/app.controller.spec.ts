import { describe, expect, it } from 'vitest';
import { AppController } from './app.controller.js';

describe('AppController', () => {
  it('health 返回 ok', () => {
    const ctrl = new AppController();
    const res = ctrl.health();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('campushub-server');
  });
});
