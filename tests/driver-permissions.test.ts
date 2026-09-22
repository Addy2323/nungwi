import test from 'node:test';
import assert from 'node:assert/strict';
import { Actor } from '../lib/server/auth.js';
import { saveDriver, staffData, overview } from '../lib/server/platform.js';
import { assignDriver } from '../lib/server/orders.js';
import { reportRows } from '../lib/server/reports.js';

const driverActor: Actor = {
    id: 'driver-123',
    email: 'driver@nungwi.com',
    name: 'Test Driver',
    phone: '+255700000001',
    role: 'delivery',
    hotel_id: null,
    phone_verified: 1,
    notifications: 1
};

test('Driver Role Access Control Security', async (t) => {
    await t.test('prevents driver from saving/adding driver records', async () => {
        await assert.rejects(
            async () => {
                await saveDriver(driverActor, {
                    name: 'Hacker Driver',
                    phone: '+255700000002',
                    vehicle: 'motorcycle',
                    registration: 'MC123'
                });
            },
            (err: any) => err.status === 403 || err.message.includes('Forbidden')
        );
    });

    await t.test('prevents driver from requesting drivers list resource', async () => {
        await assert.rejects(
            async () => {
                await staffData(driverActor, 'drivers');
            },
            (err: any) => err.status === 403 || err.message.includes('Forbidden')
        );
    });

    await t.test('prevents driver from assigning driver to orders', async () => {
        await assert.rejects(
            async () => {
                await assignDriver(driverActor, 'order-1', {
                    driver_id: 'driver-123',
                    eta: '30 mins',
                    instructions: 'Deliver to beach bar'
                });
            },
            (err: any) => err.status === 403 || err.message.includes('Forbidden')
        );
    });

    await t.test('prevents driver from downloading sales and outstanding reports', async () => {
        const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const to = new Date().toISOString().slice(0, 10);

        await assert.rejects(
            async () => {
                await reportRows(driverActor, 'sales', from, to);
            },
            (err: any) => err.status === 403 || err.message.includes('Forbidden')
        );

        await assert.rejects(
            async () => {
                await reportRows(driverActor, 'outstanding', from, to);
            },
            (err: any) => err.status === 403 || err.message.includes('Forbidden')
        );
    });
});
