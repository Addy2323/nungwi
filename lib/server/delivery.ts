import { atomic, audit, now, one, run, id } from './db';
import { AppError, hash, throttle } from './auth';
import { paymentTotals, syncCommission } from './orders';
import { orderNotification } from './notifications';
export async function deliveryDetails(token: string) {
    if (!/^[0-9a-f]{64}$/.test(token))
        throw new AppError('Delivery link is invalid or expired.', 404);
    const order = (await one('SELECT * FROM orders WHERE driver_token=? AND driver_token_expires>?', hash(token), now()));
    if (!order || !order.driver)
        throw new AppError('Delivery link is invalid or expired.', 404);
    const driver = JSON.parse(order.driver);
    return { id: order.id, number: order.number, status: order.status, recipient: order.recipient, phone: order.phone, address: order.address, instructions: order.instructions, driver, collect: order.payment_method === 'cash' ? (await paymentTotals(order.id)).outstanding : 0 };
}
export async function confirmDelivery(token: string, code: string) {
    const details = (await deliveryDetails(token));
    (await throttle(`delivery-code:${details.id}`, 10, 900));
    return (await atomic(async () => {
        const order = (await one('SELECT * FROM orders WHERE id=?', details.id))!;
        if (order.status === 'Delivered')
            return { message: 'Delivery already confirmed.' };
        if (order.status !== 'Out for delivery')
            throw new AppError('This order has not been dispatched.', 409);
        if (hash(`${order.id}:${code}`) !== order.code_hash)
            throw new AppError('Confirmation code is incorrect.');
        (await run("UPDATE orders SET status='Delivered',updated_at=? WHERE id=?", now(), order.id));
        (await run('INSERT INTO order_history VALUES (?,?,?,?,?,?)', id(), order.id, 'Delivered', 'Confirmed through the assigned driver’s expiring link.', null, now()));
        (await syncCommission(order.id));
        (await audit(null, 'delivery.confirmed', 'order', order.id, { method: 'driver-link' }));
        (await orderNotification(order.id, `${order.number} delivered. Thank you for shopping with Nungwi Shop.`, `${order.id}:driver-delivered`));
        return { message: 'Delivery confirmed. Thank you. Payment collection must still be reconciled by the shop.' };
    }));
}
