import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { AppError, originGuard, requireUser } from '@/lib/server/auth';
import { orderDetails } from '@/lib/server/orders';
export async function POST(request: Request) {
    try {
        originGuard(request);
        const user = await requireUser();
        if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET)
            throw new AppError('Card payments are not configured.', 503);
        const { orderId } = await request.json();
        const order = (await orderDetails(user, String(orderId)));
        if (['Cancelled', 'Returned'].includes(order.status) || order.outstanding <= 0)
            throw new AppError('This order has no collectible card balance.');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const base = process.env.APP_URL || new URL(request.url).origin;
        const session = await stripe.checkout.sessions.create({ mode: 'payment', line_items: [{ price_data: { currency: 'tzs', unit_amount: order.outstanding * 100, product_data: { name: `Nungwi Shop ${order.number}` } }, quantity: 1 }], metadata: { orderId: order.id, expectedTzs: String(order.outstanding) }, success_url: `${base}/${user.hotel_id ? 'hotel' : 'customer'}?payment=processing`, cancel_url: `${base}/${user.hotel_id ? 'hotel' : 'customer'}` }, { idempotencyKey: `order:${order.id}:balance:${order.outstanding}:payments:${order.payments.length}` });
        return NextResponse.json({ url: session.url });
    }
    catch (error) {
        return NextResponse.json({ error: error instanceof AppError ? error.message : 'Unable to start card payment. Your order remains saved.' }, { status: error instanceof AppError ? error.status : 500 });
    }
}
