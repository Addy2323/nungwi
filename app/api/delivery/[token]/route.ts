import { deliveryDetails, confirmDelivery } from '@/lib/server/delivery';
import { AppError, originGuard } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: {
    params: Promise<{
        token: string;
    }>;
}) { try {
    return Response.json({ data: (await deliveryDetails((await params).token)) }, { headers: { 'Cache-Control': 'no-store' } });
}
catch (e) {
    return Response.json({ error: (e as Error).message }, { status: e instanceof AppError ? e.status : 500 });
} }
export async function POST(request: Request, { params }: {
    params: Promise<{
        token: string;
    }>;
}) { try {
    originGuard(request);
    const body = await request.json();
    if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code))
        throw new AppError('Enter the six-digit customer code.');
    return Response.json({ data: (await confirmDelivery((await params).token, body.code)) });
}
catch (e) {
    return Response.json({ error: (e as Error).message }, { status: e instanceof AppError ? e.status : 500 });
} }
