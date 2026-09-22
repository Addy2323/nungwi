import Stripe from 'stripe';
import { atomic, audit, id, now, one, run } from '@/lib/server/db';
import { syncCommission } from '@/lib/server/orders';
import { orderNotification } from '@/lib/server/notifications';
export async function POST(request: Request) {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET)
        return Response.json({ error: 'Provider not configured.' }, { status: 503 });
    const signature = request.headers.get('stripe-signature');
    if (!signature)
        return Response.json({ error: 'Missing signature.' }, { status: 400 });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET);
    }
    catch {
        return Response.json({ error: 'Invalid signature.' }, { status: 400 });
    }
    try {
        if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
            const session = event.data.object as Stripe.Checkout.Session;
            if (session.payment_status === 'paid' && session.metadata?.orderId)
                (await atomic(async () => {
                    const order = (await one('SELECT * FROM orders WHERE id=?', session.metadata!.orderId));
                    if (!order)
                        throw new Error('Unknown order');
                    if ((await one('SELECT id FROM payments WHERE reference=?', session.id)))
                        return;
                    const amount = Number(session.metadata!.expectedTzs);
                    if (session.currency !== 'tzs' || !Number.isSafeInteger(amount) || amount <= 0 || session.amount_total !== amount * 100)
                        throw new Error('Payment amount mismatch');
                    (await run('INSERT INTO payments VALUES (?,?,?,?,?,?,?,?)', id(), order.id, amount, 'payment', 'card', session.id, null, now()));
                    (await syncCommission(order.id));
                    (await audit(null, 'payment.stripe', 'order', order.id, { session: session.id, amount, event: event.id }));
                    (await orderNotification(order.id, `${order.number}: card payment TZS ${amount} received.`, `${order.id}:stripe:${session.id}`));
                }));
        }
        return Response.json({ received: true });
    }
    catch {
        return Response.json({ error: 'Payment reconciliation failed. Retry required.' }, { status: 500 });
    }
}
