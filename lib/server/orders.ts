import { NO_EXPIRY } from '../product-workflow'
import { eachAsync } from './db'
import { randomBytes, randomInt } from 'node:crypto';
import { all, atomic, audit, id, now, one, run, setting, type Row } from './db';
import { accessibleOrder, AppError, hash, permit, staff, throttle, type Actor } from './auth';
import { orderInput, ruleInput, phone } from './validation';
import { orderNotification, notifyOrder, statusEvent } from './notifications';
export const statusSequence = ['Pending', 'Confirmed', 'Preparing', 'Driver assigned', 'Ready for pickup', 'Picked up', 'Out for delivery', 'Driver arriving', 'Delivered'];
export async function catalogue(includeArchived = false) {
    return (await all(`SELECT p.*, COALESCE((SELECT SUM(b.remaining-b.reserved) FROM batches b WHERE b.product_id=p.id AND b.expires_at>?),0) AS available, COALESCE((SELECT SUM(b.reserved) FROM batches b WHERE b.product_id=p.id),0) AS reserved FROM products p ${includeArchived ? '' : 'WHERE p.active=1'} ORDER BY p.created_at`, now()));
}
export function commissionAmount(eligible: number, raw: unknown) {
    const rule = ruleInput.parse(raw);
    if (rule.method === 'fixed')
        return Math.min(eligible, rule.value);
    let rate = rule.value;
    if (rule.method === 'tiered')
        rate = [...rule.tiers].sort((a, b) => b.threshold - a.threshold).find(tier => eligible >= tier.threshold)?.rate || 0;
    return Math.round(eligible * rate / 100);
}
export async function paymentTotals(orderId: string) {
    const row = (await one("SELECT COALESCE(SUM(CASE WHEN kind='payment' THEN amount ELSE -amount END),0) AS paid, COALESCE(SUM(CASE WHEN kind='refund' THEN amount ELSE 0 END),0) AS refunded FROM payments WHERE order_id=?", orderId))!;
    const order = (await one('SELECT total FROM orders WHERE id=?', orderId))!;
    return { paid: row.paid as number, refunded: row.refunded as number, payment_status: row.refunded > 0 ? (row.paid === 0 ? 'Refunded' : 'Partially refunded') : row.paid >= order.total ? 'Paid' : row.paid > 0 ? 'Partially paid' : 'Unpaid', outstanding: Math.max(0, order.total - row.paid - row.refunded) };
}
export async function syncCommission(orderId: string) {
    const commission = (await one('SELECT * FROM commissions WHERE order_id=?', orderId));
    if (!commission)
        return;
    const order = (await one('SELECT * FROM orders WHERE id=?', orderId))!;
    const totals = (await paymentTotals(orderId));
    const earned = order.status === 'Delivered' && totals.paid + totals.refunded >= order.total ? Math.max(0, Math.round(commission.expected * (1 - totals.refunded / Math.max(1, order.total)))) : 0;
    (await run('UPDATE commissions SET earned=? WHERE order_id=?', earned, orderId));
}
export async function placeOrder(actor: Actor, raw: unknown, quoteOnly = false): Promise<Row> {
    const input = orderInput.parse(raw);
    return (await atomic(async () => {
        const existing = (await one('SELECT id FROM orders WHERE user_id=? AND idempotency_key=?', actor.id, input.idempotency_key));
        if (existing && !quoteOnly)
            return (await orderDetails(actor, existing.id));
        if (actor.hotel_id && !(await one('SELECT id FROM hotels WHERE id=? AND active=1', actor.hotel_id)))
            throw new AppError('Hotel account is inactive.');
        const merged = new Map<string, {
            productId: string;
            unit?: string;
            quantity: number;
        }>();
        input.items.forEach(item => { const key = JSON.stringify([item.product_id, item.unit || null]); const previous = merged.get(key); merged.set(key, { productId: item.product_id, unit: item.unit, quantity: (previous?.quantity || 0) + item.quantity }); });
        const demanded = new Map<string, number>();
        const lines = (await Promise.all([...merged.values()].map(async ({ productId, unit, quantity }) => {
            const product = (await one('SELECT * FROM products WHERE id=? AND active=1', productId));
            if (!product)
                throw new AppError('A product is no longer available.');
            if (quantity < product.min_qty || quantity > 1000)
                throw new AppError(`${product.name}: minimum ${product.min_qty}, maximum 1,000 selling units.`);
            const offering = unit && unit !== product.unit ? JSON.parse(product.units).find((option: Row) => option.unit === unit) : product;
            if (!offering)
                throw new AppError('This selling unit is unavailable.');
            const baseQuantity = quantity * offering.unit_size;
            demanded.set(productId, (demanded.get(productId) || 0) + baseQuantity);
            const batches = (await all('SELECT * FROM batches WHERE product_id=? AND expires_at>? AND remaining>reserved ORDER BY expires_at,created_at', productId, now()));
            if (batches.reduce((s, b) => s + b.remaining - b.reserved, 0) < demanded.get(productId)!)
                throw new AppError(`${product.name} does not have enough unexpired stock.`, 409);
            const price = actor.hotel_id && offering.hotel_price !== null ? offering.hotel_price : offering.price;
            return { product, offering, quantity, baseQuantity, batches, price };
        })));
        const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
        const deposit = lines.reduce((s, l) => s + l.offering.deposit * l.quantity, 0);
        let discount = 0;
        let promotion: Row | undefined;
        if (input.promotion) {
            promotion = (await one('SELECT * FROM promotions WHERE code=? AND active=1 AND starts_at<=? AND ends_at>?', input.promotion.toUpperCase(), now(), now()));
            if (!promotion || promotion.audience !== 'all' && promotion.audience !== (actor.hotel_id ? 'hotel' : 'customer'))
                throw new AppError('This promotion is not available for this order.');
            const ids: string[] = JSON.parse(promotion.product_ids);
            const eligible = lines.filter(l => !ids.length || ids.includes(l.product.id)).reduce((s, l) => s + l.price * l.quantity, 0);
            discount = Math.min(eligible, promotion.kind === 'percentage' ? Math.round(eligible * promotion.value / 100) : promotion.value);
        }
        if (subtotal < Number((await setting('minimum_order', '0'))))
            throw new AppError(`Minimum order is TZS ${(await setting('minimum_order', '0'))}.`);
        const deliveryFee = subtotal - discount >= Number((await setting('free_delivery_threshold', '66250'))) ? 0 : Number((await setting('delivery_fee', '6500')));
        const tax = Math.round((subtotal - discount) * Number((await setting('tax_percent', '0'))) / 100);
        const total = subtotal - discount + deliveryFee + tax + deposit;
        if (quoteOnly)
            return { subtotal, discount, delivery_fee: deliveryFee, tax, deposit, total, items: lines.map(line => ({ name: line.product.name, quantity: line.quantity, unit_price: line.price })) };
        const expected = (raw as Row).expected_total;
        if (expected !== undefined && expected !== total)
            throw new AppError('The total changed. Review the order again before confirming.', 409);
        let referral: Row | undefined;
        if (input.referral_code) {
            referral = (await one('SELECT * FROM hotels WHERE code=? AND active=1', input.referral_code.toUpperCase()));
            if (!referral)
                throw new AppError('Hotel referral code is invalid.');
            if (actor.hotel_id)
                throw new AppError('Hotel purchases cannot also be customer referrals.');
        }
        const orderId = id();
        const number = `NS-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
        const code = String(randomInt(100000, 1000000));
        (await run('INSERT INTO orders (id,number,user_id,hotel_id,referral_id,recipient,phone,address,instructions,delivery_window,subtotal,discount,delivery_fee,tax,deposit,total,payment_method,promotion,code_hash,customer_code,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', orderId, number, actor.id, actor.hotel_id, referral?.id || null, input.recipient, input.phone, input.address, input.instructions, input.delivery_window, subtotal, discount, deliveryFee, tax, deposit, total, input.payment_method, promotion ? JSON.stringify(promotion) : null, hash(`${orderId}:${code}`), code, input.idempotency_key, now(), now()));
        for (const line of lines) {
            const itemId = id();
            let remaining = line.baseQuantity;
            let cost = 0;
            (await run('INSERT INTO order_items (id,order_id,product_id,name,quantity,base_quantity,unit,unit_price,deposit) VALUES (?,?,?,?,?,?,?,?,?)', itemId, orderId, line.product.id, line.product.name, line.quantity, line.baseQuantity, line.offering.unit, line.price, line.offering.deposit * line.quantity));
            for (const batch of (await all('SELECT * FROM batches WHERE product_id=? AND expires_at>? AND remaining>reserved ORDER BY expires_at,created_at', line.product.id, now()))) {
                if (remaining === 0)
                    break;
                const allocated = Math.min(remaining, batch.remaining - batch.reserved);
                remaining -= allocated;
                cost += allocated * batch.cost;
                (await run('UPDATE batches SET reserved=reserved+? WHERE id=?', allocated, batch.id));
                (await run('INSERT INTO allocations VALUES (?,?,?,?,?)', id(), itemId, batch.id, allocated, 'reserved'));
                (await movement(actor, line.product.id, batch.id, orderId, 'reserved', allocated, batch.cost, 'Order placed'));
            }
            (await run('UPDATE order_items SET cost=? WHERE id=?', cost, itemId));
        }
        const hotel = referral || (actor.hotel_id ? (await one('SELECT * FROM hotels WHERE id=?', actor.hotel_id)) : undefined);
        if (hotel) {
            const rule = JSON.parse(hotel.rule);
            const isEligible = rule.scope === 'both' || rule.scope === (referral ? 'referral' : 'purchase');
            if (isEligible)
                (await run('INSERT INTO commissions (id,order_id,hotel_id,rule,eligible,expected,created_at) VALUES (?,?,?,?,?,?,?)', id(), orderId, hotel.id, JSON.stringify(rule), subtotal - discount, commissionAmount(subtotal - discount, rule), now()));
        }
        (await history(actor.id, orderId, 'Pending', 'Order placed; stock reserved.'));
        await notifyOrder(orderId,'ORDER_CREATED');
        (await audit(actor.id, 'order.created', 'order', orderId, { total }));
        return (await orderDetails(actor, orderId));
    }));
}
async function movement(actor: Actor | null, productId: string, batchId: string, orderId: string | null, kind: string, quantity: number, cost: number, reason: string) { (await run('INSERT INTO stock_movements VALUES (?,?,?,?,?,?,?,?,?,?)', id(), productId, batchId, orderId, kind, quantity, cost, reason, actor?.id || null, now())); }
async function history(actorId: string | null, orderId: string, status: string, note: string) { (await run('INSERT INTO order_history VALUES (?,?,?,?,?,?)', id(), orderId, status, note, actorId, now())); }
export async function orderDetails(actor: Actor, orderId: string): Promise<Row & {
    items: Row[];
    history: Row[];
    payments: Row[];
}> {
    const order = (await one('SELECT * FROM orders WHERE id=?', orderId));
    if (!order)
        throw new AppError('Order not found.', 404);
    accessibleOrder(actor, order);
    const { code_hash, driver_token, customer_code, ...safe } = order;
    return { ...safe, ...(await paymentTotals(orderId)), customer_code: staff(actor) ? undefined : customer_code, driver: order.driver ? JSON.parse(order.driver) : null, items: (await all('SELECT * FROM order_items WHERE order_id=?', orderId)).map(item => { if (!staff(actor)) {
            const { cost, ...safe } = item;
            return safe;
        } return item; }), history: (await all('SELECT h.*,u.name AS actor FROM order_history h LEFT JOIN users u ON u.id=h.actor_id WHERE order_id=? ORDER BY created_at', orderId)), payments: (await all('SELECT * FROM payments WHERE order_id=? ORDER BY created_at', orderId)) };
}
export async function listOrders(actor: Actor, from = '0000', to = '9999'): Promise<Row[]> {
    let clause = '';
    const args: any[] = [from, to];
    if (!staff(actor)) {
        if (actor.role === 'hotel_manager') {
            clause = ' AND hotel_id=?';
            args.push(actor.hotel_id);
        }
        else {
            clause = ' AND user_id=?';
            args.push(actor.id);
        }
    }
    const orders = await all(`SELECT * FROM orders WHERE created_at>=? AND created_at<?${clause} ORDER BY created_at DESC`, ...args);
    if (orders.length === 0) return [];
    
    const orderIds = orders.map(o => o.id);
    const placeholders = orderIds.map(() => '?').join(',');
    
    const [allItems, allHistory, allPayments] = await Promise.all([
        all(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, ...orderIds),
        all(`SELECT h.*, u.name AS actor FROM order_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.order_id IN (${placeholders}) ORDER BY h.created_at`, ...orderIds),
        all(`SELECT * FROM payments WHERE order_id IN (${placeholders}) ORDER BY created_at`, ...orderIds)
    ]);
    
    const itemsByOrder = new Map<string, Row[]>();
    for (const item of allItems) {
        let list = itemsByOrder.get(item.order_id);
        if (!list) { list = []; itemsByOrder.set(item.order_id, list); }
        if (!staff(actor)) { const { cost, ...safe } = item; list.push(safe); }
        else { list.push(item); }
    }
    
    const historyByOrder = new Map<string, Row[]>();
    for (const h of allHistory) {
        let list = historyByOrder.get(h.order_id);
        if (!list) { list = []; historyByOrder.set(h.order_id, list); }
        list.push(h);
    }
    
    const paymentsByOrder = new Map<string, Row[]>();
    for (const p of allPayments) {
        let list = paymentsByOrder.get(p.order_id);
        if (!list) { list = []; paymentsByOrder.set(p.order_id, list); }
        list.push(p);
    }
    
    const isStaffActor = staff(actor);
    return orders.map((order): Row => {
        const { code_hash, driver_token, customer_code, ...safe } = order;
        const payments = paymentsByOrder.get(order.id) || [];
        const paid = payments.reduce((s, p) => s + (p.kind === 'payment' ? p.amount : -p.amount), 0);
        const refunded = payments.reduce((s, p) => s + (p.kind === 'refund' ? p.amount : 0), 0);
        const payment_status = refunded > 0 ? (paid === 0 ? 'Refunded' : 'Partially refunded') : paid >= order.total ? 'Paid' : paid > 0 ? 'Partially paid' : 'Unpaid';
        const outstanding = Math.max(0, order.total - paid - refunded);
        
        return {
            ...safe,
            paid,
            refunded,
            payment_status,
            outstanding,
            customer_code: isStaffActor ? undefined : customer_code,
            driver: order.driver ? JSON.parse(order.driver) : null,
            items: itemsByOrder.get(order.id) || [],
            history: historyByOrder.get(order.id) || [],
            payments
        };
    });
}
export async function changeStatus(actor: Actor, orderId: string, status: string, code = '', note = '') {
    permit(actor, ['admin', 'sales', 'delivery']);
    return changeStatusInternal(actor,orderId,status,code,note);
}
export async function changeDeliveryStatus(orderId:string,status:string) {
    if(!['Picked up','Out for delivery','Driver arriving'].includes(status)) throw new AppError('Invalid driver action.');
    return changeStatusInternal(null,orderId,status);
}
async function changeStatusInternal(actor:Actor|null,orderId:string,status:string,code='',note='') {
    if (status === 'Delivered')
        (await throttle(`delivery-code:${orderId}`, 10, 900));
    return (await atomic(async () => {
        const order = (await one('SELECT * FROM orders WHERE id=?', orderId));
        if (!order)
            throw new AppError('Order not found.', 404);
        if (order.status === status)
            return actor ? await orderDetails(actor, orderId) : undefined;
        const allowed: Record<string, string[]> = { Pending: ['Confirmed', 'Cancelled'], Confirmed: ['Preparing', 'Cancelled'], Preparing: ['Driver assigned', 'Ready for pickup', 'Out for delivery', 'Cancelled'], 'Driver assigned':['Ready for pickup','Out for delivery','Cancelled'], 'Ready for pickup':['Picked up','Out for delivery','Cancelled'], 'Picked up':['Out for delivery','Failed delivery'], 'Out for delivery': ['Driver arriving','Delivered', 'Failed delivery'], 'Driver arriving':['Delivered','Failed delivery'], 'Failed delivery': ['Out for delivery', 'Returned'], Delivered: ['Returned'], Cancelled: [], Returned: [] };
        if (!allowed[order.status]?.includes(status))
            throw new AppError(`Cannot move from ${order.status} to ${status}.`, 409);
        if (['Driver assigned','Ready for pickup','Picked up','Out for delivery','Driver arriving'].includes(status) && !order.driver) throw new AppError('Assign a driver, vehicle and arrival estimate before dispatch.');
        if (status === 'Out for delivery' || status === 'Picked up') {
            if (!order.driver)
                throw new AppError('Assign a driver, vehicle and arrival estimate before dispatch.');
            for (const row of (await all("SELECT a.*,b.expires_at,b.cost,i.product_id FROM allocations a JOIN batches b ON b.id=a.batch_id JOIN order_items i ON i.id=a.item_id WHERE i.order_id=? AND a.state='reserved'", orderId))) {
                if (row.expires_at <= now())
                    throw new AppError('A reserved batch has expired. Cancel this order and place it again with usable stock.', 409);
                (await run('UPDATE batches SET remaining=remaining-?,reserved=reserved-? WHERE id=?', row.quantity, row.quantity, row.batch_id));
                (await run("UPDATE allocations SET state='sold' WHERE id=?", row.id));
                (await movement(actor, row.product_id, row.batch_id, orderId, 'sold', -row.quantity, row.cost, 'Dispatched'));
            }
        }
        if (status === 'Cancelled')
            for (const row of (await all("SELECT a.*,i.product_id,b.cost FROM allocations a JOIN order_items i ON i.id=a.item_id JOIN batches b ON b.id=a.batch_id WHERE i.order_id=? AND a.state='reserved'", orderId))) {
                (await run('UPDATE batches SET reserved=reserved-? WHERE id=?', row.quantity, row.batch_id));
                (await run("UPDATE allocations SET state='released' WHERE id=?", row.id));
                (await movement(actor, row.product_id, row.batch_id, orderId, 'released', -row.quantity, row.cost, 'Cancelled'));
            }
        if (status === 'Delivered' && hash(`${orderId}:${code}`) !== order.code_hash)
            throw new AppError('The delivery confirmation code is incorrect.');
        if (status === 'Returned') {
            if (!note.trim())
                throw new AppError('Record the condition and reason for the return.');
            // Returned drinks require inspection; they are recorded as quarantined, never automatically resold.
            for (const row of (await all("SELECT a.*,i.product_id,b.cost FROM allocations a JOIN order_items i ON i.id=a.item_id JOIN batches b ON b.id=a.batch_id WHERE i.order_id=? AND a.state='sold'", orderId))) {
                (await run("UPDATE allocations SET state='returned' WHERE id=?", row.id));
                (await movement(actor, row.product_id, row.batch_id, orderId, 'returned_quarantine', row.quantity, row.cost, note));
            }
        }
        (await run('UPDATE orders SET status=?,updated_at=? WHERE id=?', status, now(), orderId));
        (await history(actor?.id || null, orderId, status, note));
        (await syncCommission(orderId));
        await notifyOrder(orderId,statusEvent[status]);
        (await audit(actor?.id || null, 'order.status', 'order', orderId, { from: order.status, to: status, note }));
        return actor ? await orderDetails(actor, orderId) : undefined;
    }));
}
export async function assignDriver(actor: Actor, orderId: string, input: {
    driver_id: string;
    eta: string;
    instructions: string;
}) {
    permit(actor, ['admin', 'sales']);
    return (await atomic(async () => {
        const order = (await one('SELECT * FROM orders WHERE id=?', orderId));
        const driver = (await one('SELECT * FROM drivers WHERE id=? AND active=1', input.driver_id));
        if (!order || !driver)
            throw new AppError('Choose an existing order and active driver.');
        if (!['Confirmed', 'Preparing', 'Driver assigned', 'Ready for pickup', 'Out for delivery', 'Failed delivery'].includes(order.status))
            throw new AppError('Confirm the order before assigning delivery.');
        if (!input.eta.trim())
            throw new AppError('Enter an estimated arrival time or delivery window.');
        driver.phone = phone.parse(driver.phone);
        if (!await setting('sms_shop_location',process.env.SHOP_LOCATION||'Nungwi Main Shop, Zanzibar')) throw new AppError('Configure the shop pickup location in SMS settings before assigning a driver.');
        const assignment = JSON.stringify({ ...driver, eta: input.eta, instructions: input.instructions });
        if (order.driver === assignment)
            return (await orderDetails(actor, orderId));
        const token = randomBytes(32).toString('hex');
        (await run('UPDATE orders SET driver=?,driver_token=?,driver_token_expires=?,updated_at=? WHERE id=?', assignment, hash(token), new Date(Date.now() + 24 * 3600000).toISOString(), now(), orderId));
        if (order.status === 'Preparing') await run("UPDATE orders SET status='Driver assigned' WHERE id=?",orderId);
        (await history(actor.id, orderId, order.status === 'Preparing' ? 'Driver assigned' : order.status, `Driver assigned: ${driver.name}; estimated arrival: ${input.eta}.`));
        const due = (await paymentTotals(orderId)).outstanding;
        await notifyOrder(orderId,'DRIVER_ASSIGNED',`assignment:${hash(token)}`,{
            deliveryLink:process.env.APP_URL?`${process.env.APP_URL}/delivery/${token}`:'',
            deliveryInstructions:`${order.instructions} ${input.instructions}. ${order.payment_method==='cash'?`Collect TZS ${due}.`:'Do not collect cash.'} Estimated arrival: ${input.eta}.`
        });
        (await audit(actor.id, 'delivery.assigned', 'order', orderId, { driver: driver.name, eta: input.eta }));
        return (await orderDetails(actor, orderId));
    }));
}
export async function recordPayment(actor: Actor, orderId: string, input: {
    amount: number;
    kind: string;
    method: string;
    reference: string;
}) {
    permit(actor, ['admin', 'sales']);
    return (await atomic(async () => {
        const order = (await one('SELECT * FROM orders WHERE id=?', orderId));
        if (!order)
            throw new AppError('Order not found.', 404);
        const existing = (await one('SELECT * FROM payments WHERE reference=?', input.reference));
        if (existing) {
            if (existing.order_id === orderId && existing.amount === input.amount && existing.kind === input.kind)
                return (await orderDetails(actor, orderId));
            throw new AppError('This payment reference is already used.', 409);
        }
        const totals = (await paymentTotals(orderId));
        if (input.amount <= 0 || !Number.isSafeInteger(input.amount))
            throw new AppError('Enter a positive whole TZS amount.');
        if (input.kind === 'refund' && input.amount > totals.paid)
            throw new AppError('Refund cannot exceed the net payments received.');
        if (input.kind === 'payment' && (['Cancelled', 'Returned'].includes(order.status) || input.amount > totals.outstanding))
            throw new AppError('Payment exceeds the collectible balance or order is closed.');
        (await run('INSERT INTO payments VALUES (?,?,?,?,?,?,?,?)', id(), orderId, input.amount, input.kind, input.method, input.reference, actor.id, now()));
        (await syncCommission(orderId));
        (await audit(actor.id, `payment.${input.kind}`, 'order', orderId, input));
        (await orderNotification(orderId, `${order.number}: ${input.kind === 'refund' ? 'Refund recorded' : 'Payment received'} TZS ${input.amount}. Reference ${input.reference}.`, `${orderId}:payment:${input.reference}`));
        return (await orderDetails(actor, orderId));
    }));
}
export async function receiveStock(actor: Actor, input: {
    product_id: string;
    label: string;
    expires_at?: string | null;
    quantity: number;
    cost: number;
    reason: string;
}) {
    permit(actor, ['admin', 'stock']);
    if (input.expires_at && input.expires_at <= now())
        throw new AppError('Receive usable stock with a future expiry date.');
    return (await atomic(async () => { if (!(await one('SELECT id FROM products WHERE id=?', input.product_id)))
        throw new AppError('Product not found.');
        const product = (await one('SELECT track_expiry FROM products WHERE id=?',input.product_id))!;
        if (product.track_expiry && !input.expires_at) throw new AppError('Enter an expiry date for this product.');
        const batch = id(); (await run('INSERT INTO batches VALUES (?,?,?,?,?,0,?,?)', batch, input.product_id, input.label, input.expires_at || NO_EXPIRY, input.quantity, input.cost, now())); (await movement(actor, input.product_id, batch, null, 'received', input.quantity, input.cost, input.reason)); (await audit(actor.id, 'stock.received', 'batch', batch, input)); return batch; }));
}
export async function adjustStock(actor: Actor, input: {
    batch_id: string;
    quantity: number;
    kind: 'damaged' | 'expired';
    reason: string;
}) {
    permit(actor, ['admin', 'stock']);
    return (await atomic(async () => { const batch = (await one('SELECT * FROM batches WHERE id=?', input.batch_id)); if (!batch || input.quantity > batch.remaining - batch.reserved)
        throw new AppError('Only unreserved stock can be adjusted. Cancel affected orders first.'); if (input.kind === 'expired' && batch.expires_at > now())
        throw new AppError('This batch has not expired.'); (await run('UPDATE batches SET remaining=remaining-? WHERE id=?', input.quantity, batch.id)); (await movement(actor, batch.product_id, batch.id, null, input.kind, -input.quantity, batch.cost, input.reason)); (await audit(actor.id, 'stock.adjusted', 'batch', batch.id, input)); }));
}
export async function payout(actor: Actor, hotelId: string, reference: string) {
    permit(actor, ['admin']);
    return (await atomic(async () => {
        if ((await one('SELECT id FROM payouts WHERE reference=?', reference)))
            throw new AppError('Payout reference already recorded.', 409);
        const rows = (await all('SELECT * FROM commissions WHERE hotel_id=? AND earned!=paid', hotelId));
        const balance = rows.reduce((sum, row) => sum + row.earned - row.paid, 0);
        if (balance <= 0)
            throw new AppError('No commission balance is payable. Refund adjustments are included.');
        const payoutId = id();
        (await run('INSERT INTO payouts VALUES (?,?,?,?,?,?)', payoutId, hotelId, balance, reference, actor.id, now()));
        (await eachAsync(rows, async (row) => { (await run('INSERT INTO payout_items VALUES (?,?,?)', payoutId, row.id, row.earned - row.paid)); (await run('UPDATE commissions SET paid=earned WHERE id=?', row.id)); }));
        (await audit(actor.id, 'commission.payout', 'hotel', hotelId, { amount: balance, reference }));
        return { id: payoutId, amount: balance };
    }));
}
