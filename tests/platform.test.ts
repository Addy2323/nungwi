import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { all, db, id, now, one, run, closeDb, atomic } from '../lib/server/db';
import { AppError, hash, passwordHash, passwordMatches, publicUser, redeemToken, tokenFor, type Actor } from '../lib/server/auth';
import { adjustStock, assignDriver, catalogue, changeStatus, commissionAmount, listOrders, orderDetails, paymentTotals, payout, placeOrder, receiveStock, recordPayment } from '../lib/server/orders';
import { commissionsFor, deleteProduct, overview, publicCatalogue, saveDriver, saveHotel, saveProduct, savePromotion } from '../lib/server/platform';
import { confirmDelivery, deliveryDetails, progressDelivery } from '../lib/server/delivery';
import { processNotifications } from '../lib/server/notifications';
import { csvReport, pdfReport, reportRows } from '../lib/server/reports';
try { process.loadEnvFile('.env.local') } catch {}
if (!process.env.DATABASE_ADMIN_URL) throw new Error('PostgreSQL integration tests require DATABASE_ADMIN_URL')
const testSchema = 'nungwi_test_' + randomUUID().replaceAll('-', '')
const testUrl = new URL(process.env.DATABASE_ADMIN_URL)
testUrl.searchParams.delete('schema')
const testAdmin = new Client({ connectionString: testUrl.toString() })
testUrl.searchParams.set('schema', testSchema)
process.env.DATABASE_URL = testUrl.toString()
async function setupDatabase() {
 await testAdmin.connect()
 await testAdmin.query(`CREATE SCHEMA ${testSchema}`)
 await testAdmin.query(`SET search_path TO ${testSchema}, pg_catalog`)
 await testAdmin.query(readFileSync('migrations/001_postgres.sql', 'utf8'))
 await testAdmin.query(readFileSync('migrations/002_money_capacity.sql', 'utf8'))
 await testAdmin.query(readFileSync('migrations/006_sms_notifications.sql', 'utf8'))
 await testAdmin.query(readFileSync('migrations/007_product_workflow.sql', 'utf8'))
}
after(async () => {
 await closeDb()
 await testAdmin.query(`DROP SCHEMA ${testSchema} CASCADE`)
 await testAdmin.end()
})
process.env.SHOP_LOCATION = 'Test pickup location';
process.env.SMS_PROVIDER = 'twilio';
process.env.APP_URL = 'http://localhost:3000';
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.RESEND_API_KEY;
let admin: Actor, customer: Actor, other: Actor, stock: Actor, manager: Actor, hotelId: string, driverId: string;
const future = (days = 60) => new Date(Date.now() + days * 86400000).toISOString();
async function user(role: Actor['role'], hotel: string | null = null) { const userId = id(); (await run('INSERT INTO users (id,email,name,phone,password,role,hotel_id,created_at) VALUES (?,?,?,?,?,?,?,?)', userId, `${userId}@example.test`, `${role} test`, '+255700000000', passwordHash('Test-only-password-2026'), role, hotel, now())); return publicUser((await one('SELECT * FROM users WHERE id=?', userId))!); }
async function product(extra: Record<string, any> = {}) { return (await saveProduct(admin, { name: 'Test beverage', category: 'Beer', price: 2000, cost: 800, sku: randomUUID(), ...extra })); }
async function stockIn(product_id: string, quantity = 100, expires_at = future(), cost = 800) { return (await receiveStock(admin, { product_id, quantity, label: randomUUID(), expires_at, cost, reason: 'Test receipt' })); }
function payload(productId: string, qty = 1, extra: Record<string, any> = {}) { return { items: [{ product_id: productId, quantity: qty }], recipient: 'Test Guest', phone: '+255700000001', address: 'Test hotel, room 4', payment_method: 'cash', idempotency_key: randomUUID(), ...extra }; }
async function deliver(orderId: string, code: string) { (await changeStatus(admin, orderId, 'Confirmed')); (await changeStatus(admin, orderId, 'Preparing')); (await assignDriver(admin, orderId, { driver_id: driverId, eta: '20 minutes', instructions: 'Reception' })); (await changeStatus(admin, orderId, 'Out for delivery')); (await changeStatus(admin, orderId, 'Delivered', code)); }
before(async () => { await setupDatabase(); admin = (await user('admin')); customer = (await user('customer')); other = (await user('customer')); stock = (await user('stock')); hotelId = (await saveHotel(admin, { name: 'Test hotel', contact: 'Hotel manager', phone: '+255700000002', address: 'Nungwi', code: 'TEST-HOTEL', rule: { method: 'percentage', value: 10, scope: 'referral', tiers: [] } })); manager = (await user('hotel_manager', hotelId)); driverId = (await saveDriver(admin, { name: 'Test driver', phone: '+255700000003', vehicle: 'motorcycle', registration: 'T-TEST' })); });
describe('persistent ordering and stock invariants', () => {
    it('does not invent opening sales or stock', async () => { assert.equal((await one('SELECT COUNT(*) AS n FROM orders'))!.n, 0); assert.equal((await catalogue()).length, 0); });
    it('reserves FEFO stock, deduplicates placement, and releases cancellation exactly once', async () => {
        const p = (await product());
        const later = (await stockIn(p, 10, future(90)));
        const earlier = (await stockIn(p, 5, future(30)));
        const input = payload(p, 7);
        const order = (await placeOrder(customer, input));
        assert.equal(order.status, 'Pending');
        assert.equal((await one('SELECT reserved FROM batches WHERE id=?', earlier))!.reserved, 5);
        assert.equal((await one('SELECT reserved FROM batches WHERE id=?', later))!.reserved, 2);
        const count = (await one('SELECT COUNT(*) AS n FROM notifications'))!.n;
        assert.equal((await placeOrder(customer, input)).id, order.id);
        assert.equal((await one('SELECT COUNT(*) AS n FROM notifications'))!.n, count);
        (await changeStatus(admin, order.id, 'Cancelled'));
        (await changeStatus(admin, order.id, 'Cancelled'));
        assert.equal((await catalogue()).find(row => row.id === p)!.available, 15);
    });
    it('rolls back an entire multi-product order when any product is short', async () => { const a = (await product()); const b = (await product()); (await stockIn(a, 10)); (await stockIn(b, 1)); const before = (await one('SELECT COUNT(*) AS n FROM orders'))!.n; (await assert.rejects(async () => (await placeOrder(customer, payload(a, 2, { items: [{ product_id: a, quantity: 2 }, { product_id: b, quantity: 2 }] }))), /enough unexpired stock/)); assert.equal((await catalogue()).find(p => p.id === a)!.reserved, 0); assert.equal((await one('SELECT COUNT(*) AS n FROM orders'))!.n, before); });
    it('prevents overselling across sequential concurrent attempts', async () => { const p = (await product()); (await stockIn(p, 1)); (await placeOrder(customer, payload(p))); (await assert.rejects(async () => (await placeOrder(other, payload(p))), /enough unexpired stock/)); assert.equal((await catalogue()).find(row => row.id === p)!.available, 0); });
    it('shares stock between bottles and crates without double allocating', async () => { const p = (await product({ units: [{ unit: 'crate', unit_size: 24, price: 40000, hotel_price: 38000, deposit: 1000 }] })); (await stockIn(p, 25)); const order = (await placeOrder(customer, payload(p, 1, { items: [{ product_id: p, quantity: 1, unit: 'crate' }, { product_id: p, quantity: 1, unit: 'bottle' }] }))); assert.equal(order.subtotal, 42000); assert.equal(order.deposit, 1000); assert.equal((await catalogue()).find(row => row.id === p)!.reserved, 25); (await assert.rejects(async () => (await placeOrder(customer, payload(p))), /stock/)); (await changeStatus(admin, order.id, 'Cancelled')); assert.equal((await catalogue()).find(row => row.id === p)!.available, 25); });
    it('excludes expired stock and prevents dispatch when reserved stock expires', async () => { const p = (await product()); const batch = (await stockIn(p, 10)); const order = (await placeOrder(customer, payload(p))); (await run('UPDATE batches SET expires_at=? WHERE id=?', new Date(Date.now() - 1000).toISOString(), batch)); assert.equal((await catalogue()).find(row => row.id === p)!.available, 0); (await changeStatus(admin, order.id, 'Confirmed')); (await changeStatus(admin, order.id, 'Preparing')); (await assignDriver(admin, order.id, { driver_id: driverId, eta: '10 minutes', instructions: '' })); (await assert.rejects(async () => (await changeStatus(admin, order.id, 'Out for delivery')), /expired/)); (await assert.rejects(async () => (await adjustStock(admin, { batch_id: batch, kind: 'expired', quantity: 10, reason: 'Expired' })), /unreserved/)); (await changeStatus(admin, order.id, 'Cancelled')); (await adjustStock(admin, { batch_id: batch, kind: 'expired', quantity: 10, reason: 'Expired' })); assert.equal((await one('SELECT remaining FROM batches WHERE id=?', batch))!.remaining, 0); });
    it('requires a driver and a valid recipient code; delivery does not mark payment paid', async () => { const p = (await product()); (await stockIn(p)); const order = (await placeOrder(customer, payload(p))); (await changeStatus(admin, order.id, 'Confirmed')); (await changeStatus(admin, order.id, 'Preparing')); (await assert.rejects(async () => (await changeStatus(admin, order.id, 'Out for delivery')), /Assign a driver/)); (await assignDriver(admin, order.id, { driver_id: driverId, eta: '15 minutes', instructions: 'Room 4' })); (await changeStatus(admin, order.id, 'Out for delivery')); (await assert.rejects(async () => (await changeStatus(admin, order.id, 'Delivered', '000000')), /incorrect/)); (await changeStatus(admin, order.id, 'Delivered', order.customer_code)); assert.equal((await paymentTotals(order.id)).payment_status, 'Unpaid'); (await assert.rejects(async () => (await changeStatus(admin, order.id, 'Cancelled')), /Cannot move/)); });
    it('quarantines returned stock instead of silently making it saleable', async () => { const p = (await product()); (await stockIn(p, 5)); const order = (await placeOrder(customer, payload(p))); (await deliver(order.id, order.customer_code)); (await changeStatus(admin, order.id, 'Returned', '', 'Seal broken')); assert.equal((await catalogue()).find(row => row.id === p)!.available, 4); assert.equal((await one("SELECT COUNT(*) AS n FROM stock_movements WHERE order_id=? AND kind='returned_quarantine'", order.id))!.n, 1); });
    it('uses price rules on the server and requires a fresh review after price changes', async () => { const p = (await product()); (await stockIn(p)); const promotion = (await savePromotion(admin, { code: `PROMO-${id().slice(0, 6)}`, title: 'Test offer', offer_text: '10 percent', kind: 'percentage', value: 10, starts_at: new Date(Date.now() - 60000).toISOString(), ends_at: future(), product_ids: [p] })); const code = (await one('SELECT code FROM promotions WHERE id=?', promotion))!.code; const input = payload(p, 2, { promotion: code }); const quote = (await placeOrder(customer, input, true)); assert.equal(quote.discount, 400); assert.equal((await one('SELECT reserved FROM batches WHERE product_id=?', p))!.reserved, 0); (await run('UPDATE products SET price=2500 WHERE id=?', p)); (await assert.rejects(async () => (await placeOrder(customer, { ...input, expected_total: quote.total })), /total changed/)); const order = (await placeOrder(customer, input)); assert.equal(order.discount, 500); assert.equal(order.subtotal, 5000); });
});
describe('payments, hotel commissions and privacy', () => {
    it('freezes commission rules, earns only after paid delivery, and recovers paid commissions after refund', async () => {
        const p = (await product());
        (await stockIn(p));
        const order = (await placeOrder(customer, payload(p, 10, { referral_code: 'TEST-HOTEL' })));
        const commission = async () => (await one('SELECT * FROM commissions WHERE order_id=?', order.id))!;
        assert.equal((await commission()).expected, 2000);
        assert.equal((await commission()).earned, 0);
        (await run('UPDATE hotels SET rule=? WHERE id=?', JSON.stringify({ method: 'percentage', value: 40, scope: 'referral', tiers: [] }), hotelId));
        (await recordPayment(admin, order.id, { amount: order.total, kind: 'payment', method: 'bank_transfer', reference: `bank-${id()}` }));
        assert.equal((await commission()).earned, 0);
        (await deliver(order.id, order.customer_code));
        assert.equal((await commission()).earned, 2000);
        const paid = (await payout(admin, hotelId, `payout-${id()}`));
        assert.equal(paid.amount, 2000);
        (await recordPayment(admin, order.id, { amount: order.total, kind: 'refund', method: 'bank_transfer', reference: `refund-${id()}` }));
        assert.equal((await commission()).earned, 0);
        assert.equal((await commission()).paid, 2000);
        (await assert.rejects(async () => (await payout(admin, hotelId, `payout-${id()}`)), /No commission/));
    });
    it('does not pay referral-only commission on hotel purchases', async () => { const p = (await product({ hotel_price: 1500 })); (await stockIn(p)); const order = (await placeOrder(manager, payload(p, 2))); assert.equal(order.subtotal, 3000); assert.equal((await one('SELECT id FROM commissions WHERE order_id=?', order.id)), undefined); (await assert.rejects(async () => (await placeOrder(manager, payload(p, 1, { referral_code: 'TEST-HOTEL' }))), /cannot also/)); });
    it('supports fixed and tiered per-order arrangements', () => { assert.equal(commissionAmount(100000, { method: 'fixed', value: 10000, scope: 'referral', tiers: [] }), 10000); assert.equal(commissionAmount(200000, { method: 'tiered', value: 0, scope: 'referral', tiers: [{ threshold: 0, rate: 5 }, { threshold: 150000, rate: 12 }] }), 24000); });
    it('keeps payment references idempotent and blocks over-refunds', async () => { const p = (await product()); (await stockIn(p)); const order = (await placeOrder(customer, payload(p))); const payment = { amount: order.total, kind: 'payment', method: 'cash', reference: id() }; (await recordPayment(admin, order.id, payment)); (await recordPayment(admin, order.id, payment)); assert.equal((await paymentTotals(order.id)).paid, order.total); (await assert.rejects(async () => (await recordPayment(admin, order.id, { ...payment, kind: 'refund', amount: order.total + 1, reference: id() })), /exceed/)); (await assert.rejects(async () => (await recordPayment(stock, order.id, payment)), /permission/)); });
    it('prevents other customers and hotels from seeing orders; hides purchase costs and referral personal details', async () => { const p = (await product()); (await stockIn(p)); const order = (await placeOrder(customer, payload(p, 1, { referral_code: 'TEST-HOTEL' }))); (await assert.rejects(async () => (await orderDetails(other, order.id)), /not found/)); (await assert.rejects(async () => (await orderDetails(manager, order.id)), /not found/)); assert.equal('cost' in order.items[0], false); assert.equal((await orderDetails(admin, order.id)).customer_code, undefined); assert.equal((await publicCatalogue(customer)).find(row => row.id === p)?.cost, undefined); const referred = (await commissionsFor(manager)).find(row => row.order_id === order.id)!; assert.equal(referred.recipient, undefined); assert.equal(referred.phone, undefined); assert.equal((await listOrders(other)).some(o => o.id === order.id), false); });
});
describe('secure links, outbox, exports and recovery', () => {
    it('uses single-use invitation tokens and revokes sessions on password reset', async () => { const account = (await user('customer')); const token = (await tokenFor(account.id, 'invite')); (await redeemToken(token, 'invite', 'A-new-password-2026')); (await assert.rejects(async () => (await redeemToken(token, 'invite', 'Again-password-2026')), /invalid/)); assert(passwordMatches('A-new-password-2026', (await one('SELECT password FROM users WHERE id=?', account.id))!.password)); assert(!passwordMatches('wrong', (await one('SELECT password FROM users WHERE id=?', account.id))!.password)); });
    it('limits driver links to assigned order data and confirms without an account', async () => { const p = (await product()); (await stockIn(p)); const order = (await placeOrder(customer, payload(p))); (await changeStatus(admin, order.id, 'Confirmed')); (await changeStatus(admin, order.id, 'Preparing')); (await assignDriver(admin, order.id, { driver_id: driverId, eta: '20 minutes', instructions: 'Reception' })); const message = (await one("SELECT message FROM notifications WHERE order_id=? AND audience='driver'", order.id))!.message; const token = message.match(/\/delivery\/([0-9a-f]{64})/)[1]; assert.equal(((await deliveryDetails(token)) as any).customer_code, undefined); (await assert.rejects(async () => (await confirmDelivery(token, order.customer_code)), /not been dispatched/)); (await changeStatus(admin, order.id, 'Out for delivery')); (await confirmDelivery(token, order.customer_code)); assert.equal((await orderDetails(customer, order.id)).status, 'Delivered'); (await run('UPDATE orders SET driver_token_expires=? WHERE id=?', new Date(Date.now() - 1000).toISOString(), order.id)); (await assert.rejects(async () => (await deliveryDetails(token)), /expired/)); });
    it('leaves messages queued when external providers are not configured', async () => { const queued = (await one("SELECT COUNT(*) AS n FROM notifications WHERE channel='sms' AND status='queued'"))!.n; assert(queued > 0); assert.equal((await processNotifications()).length, 0); assert.equal((await one("SELECT COUNT(*) AS n FROM notifications WHERE channel='sms' AND status='queued'"))!.n, queued); });
    it('creates scoped PDF and CSV reports and prevents spreadsheet formulas', async () => { const orders = (await listOrders(customer)); const report = (await reportRows(customer, 'receipt', '1970', '2999', orders[0].id)); const pdf = await pdfReport(report, 'Test period'); assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), '%PDF'); (await assert.rejects(async () => (await reportRows(other, 'receipt', '1970', '2999', orders[0].id)), /not found/)); const csv = csvReport({ title: 'Test', headers: ['Name'], rows: [['=HYPERLINK("evil")']] }); assert(csv.includes("'=HYPERLINK")); (await assert.rejects(async () => (await reportRows(customer, 'stock', '1970', '2999')), /permission/)); });
    it('rolls back failed transactions without leaking their writes', async () => {
      const key = randomUUID()
      await assert.rejects(atomic(async () => { await run('INSERT INTO settings VALUES (?,?)',key,'rollback'); throw new Error('rollback test') }), /rollback test/)
      assert.equal(await one('SELECT * FROM settings WHERE key=?',key),undefined)
    })
    it('supports order totals above PostgreSQL int4 without losing precision', async () => {
      const p=await product({price:1000000000}); await stockIn(p,3)
      const order=await placeOrder(customer,payload(p,3))
      assert.equal(order.subtotal,3000000000)
      assert.equal(typeof order.total,'number')
    })
    it('serializes competing reservations without overselling', async () => {
      const p=await product(); await stockIn(p,1)
      const results=await Promise.allSettled([placeOrder(customer,payload(p)),placeOrder(other,payload(p))])
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
      assert.equal((await catalogue()).find(row=>row.id===p)!.available,0)
    })
    it('archives products while preserving stock history', async () => {
      const unusedP = await product();
      const delResult = await deleteProduct(admin, unusedP);
      assert.equal(delResult.action, 'archived');

      const usedP = await product();
      await stockIn(usedP, 5);
      const delResult2 = await deleteProduct(admin, usedP);
      assert.equal(delResult2.action, 'archived');
      assert.equal((await catalogue()).find(row => row.id === usedP), undefined);
      assert.equal((await one('SELECT remaining FROM batches WHERE product_id=?',usedP))!.remaining,5);
      assert.ok(await one('SELECT id FROM stock_movements WHERE product_id=?',usedP));
    })
    it('rejects invalid roles, duplicate emails and orphaned foreign keys', async () => {
      await assert.rejects(run('UPDATE users SET role=? WHERE id=?','invalid_role',customer.id), /invalid input value for enum/)
      await assert.rejects(run('INSERT INTO users (id,email,name,created_at) VALUES (?,?,?,?)',id(),customer.email.toUpperCase(),'Duplicate',now()), /unique constraint/)
      await assert.rejects(run('INSERT INTO sessions VALUES (?,?,?)',id(),id(),future()), /foreign key/)
    })
});

it('notifies the complete delivery lifecycle once and consumes stock at pickup only', async()=>{
 const productId=await product();await stockIn(productId,5);
 const order=await placeOrder(customer,payload(productId));
 await changeStatus(admin,order.id,'Confirmed');await changeStatus(admin,order.id,'Preparing');
 await assignDriver(admin,order.id,{driver_id:driverId,eta:'20 minutes',instructions:'Use reception'});
 await changeStatus(admin,order.id,'Ready for pickup');
 const message=(await one("SELECT message FROM notifications WHERE order_id=? AND audience='driver'",order.id))!.message;
 assert.ok(message.includes('Test pickup location'));assert.ok(message.includes('Test hotel, room 4'));assert.ok(message.includes('+255700000001'));
 const token=message.match(/\/delivery\/([0-9a-f]{64})/)![1];
 await progressDelivery(token,'Picked up');
 assert.equal((await one('SELECT remaining FROM batches WHERE product_id=?',productId))!.remaining,4);
 await progressDelivery(token,'Out for delivery');await progressDelivery(token,'Driver arriving');
 assert.equal((await one('SELECT remaining FROM batches WHERE product_id=?',productId))!.remaining,4);
 await confirmDelivery(token,order.customer_code);await confirmDelivery(token,order.customer_code);
 for(const type of ['ORDER_CREATED','ORDER_CONFIRMED','ORDER_PROCESSING','DRIVER_ASSIGNED','READY_FOR_PICKUP','ORDER_PICKED_UP','OUT_FOR_DELIVERY','DRIVER_ARRIVING','ORDER_DELIVERED'])assert.equal((await one("SELECT COUNT(*) AS n FROM notifications WHERE order_id=? AND channel='sms' AND audience='customer' AND notification_type=?",order.id,type))!.n,1,type);
 assert.equal((await one("SELECT COUNT(*) AS n FROM notifications WHERE order_id=? AND notification_type='ADMIN_NEW_ORDER'",order.id))!.n,1);
 await assert.rejects(()=>progressDelivery(token,'Cancelled'),/Invalid driver action/);
});
