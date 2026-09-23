import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { originGuard } from '../lib/server/auth';

describe('originGuard', () => {
    it('allows same-origin requests matching Host header', () => {
        const req = new Request('https://vunjabeiliquorzanzibar.co.tz/api/platform', {
            method: 'POST',
            headers: {
                'origin': 'https://vunjabeiliquorzanzibar.co.tz',
                'host': 'vunjabeiliquorzanzibar.co.tz',
            },
        });
        assert.doesNotThrow(() => originGuard(req));
    });

    it('allows www domain alias matching root Host header', () => {
        const req = new Request('https://vunjabeiliquorzanzibar.co.tz/api/platform', {
            method: 'POST',
            headers: {
                'origin': 'https://www.vunjabeiliquorzanzibar.co.tz',
                'host': 'vunjabeiliquorzanzibar.co.tz',
            },
        });
        assert.doesNotThrow(() => originGuard(req));
    });

    it('allows requests matching X-Forwarded-Host reverse proxy header', () => {
        const req = new Request('http://127.0.0.1:3000/api/platform', {
            method: 'POST',
            headers: {
                'origin': 'https://vunjabeiliquorzanzibar.co.tz',
                'x-forwarded-host': 'vunjabeiliquorzanzibar.co.tz',
            },
        });
        assert.doesNotThrow(() => originGuard(req));
    });

    it('allows localhost origin in dev environment', () => {
        const req = new Request('http://localhost:3000/api/platform', {
            method: 'POST',
            headers: {
                'origin': 'http://localhost:3000',
                'host': 'localhost:3000',
            },
        });
        assert.doesNotThrow(() => originGuard(req));
    });

    it('blocks cross-site requests with sec-fetch-site cross-site header', () => {
        const req = new Request('https://vunjabeiliquorzanzibar.co.tz/api/platform', {
            method: 'POST',
            headers: {
                'origin': 'https://vunjabeiliquorzanzibar.co.tz',
                'host': 'vunjabeiliquorzanzibar.co.tz',
                'sec-fetch-site': 'cross-site',
            },
        });
        assert.throws(() => originGuard(req), /Cross-site request blocked/);
    });

    it('blocks untrusted origin hostnames', () => {
        const req = new Request('https://vunjabeiliquorzanzibar.co.tz/api/platform', {
            method: 'POST',
            headers: {
                'origin': 'https://malicious-website.com',
                'host': 'vunjabeiliquorzanzibar.co.tz',
            },
        });
        assert.throws(() => originGuard(req), /This request must come from this website/);
    });
});
