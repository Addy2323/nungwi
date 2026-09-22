import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { all, atomic, audit, id, now, one, run, type Row } from './db';
export class AppError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function passwordHash(password: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function passwordMatches(password: string, stored: string) {
    const [salt, digest] = stored.split(':');
    if (!salt || !digest)
        return false;
    const expected = Buffer.from(digest, 'hex');
    const actual = scryptSync(password, salt, 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const roles = ['admin', 'sales', 'stock', 'delivery', 'customer', 'hotel_manager', 'hotel_staff'] as const;
export type Actor = {
    id: string;
    name: string;
    email: string;
    phone: string;
    phone_verified: number;
    role: typeof roles[number];
    hotel_id: string | null;
    notifications: number;
};
export const staff = (actor: Actor) => ['admin', 'sales', 'stock', 'delivery'].includes(actor.role);
export function permit(actor: Actor, allowed: string[]) { if (!allowed.includes(actor.role))
    throw new AppError('You do not have permission for this action.', 403); }
export function publicUser(row: Row): Actor { return { id: row.id, name: row.name, email: row.email, phone: row.phone, phone_verified: row.phone_verified, role: row.role, hotel_id: row.hotel_id, notifications: row.notifications }; }
export async function currentUser(): Promise<Actor | null> {
    const token = (await cookies()).get('nungwi_session')?.value;
    if (!token)
        return null;
    const user = (await one('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? AND u.active=1', hash(token), now()));
    if (!user)
        return null;
    if (user.hotel_id && !(await one('SELECT id FROM hotels WHERE id=? AND active=1', user.hotel_id)))
        return null;
    return publicUser(user);
}
export async function requireUser() { const user = await currentUser(); if (!user)
    throw new AppError('Please sign in to continue.', 401); return user; }
export async function createSession(userId: string) {
    const token = randomBytes(32).toString('hex');
    (await run('DELETE FROM sessions WHERE expires_at<?', now()));
    (await run('INSERT INTO sessions VALUES (?,?,?)', hash(token), userId, new Date(Date.now() + 7 * 86400000).toISOString()));
    (await cookies()).set('nungwi_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 86400 });
}
export async function logout() { const jar = await cookies(); const value = jar.get('nungwi_session')?.value; if (value)
    (await run('DELETE FROM sessions WHERE token=?', hash(value))); jar.delete('nungwi_session'); }
export function originGuard(request: Request) {
    const origin = request.headers.get('origin');
    const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : new URL(request.url).origin;
    if (origin !== expected)
        throw new AppError('This request must come from this website.', 403);
    if (request.headers.get('sec-fetch-site') === 'cross-site')
        throw new AppError('Cross-site request blocked.', 403);
}
export async function throttle(key: string, maximum = 10, seconds = 900) {
    const accepted = (await atomic(async () => {
        const time = Date.now();
        (await run('DELETE FROM rate_limits WHERE expires_at<?', time));
        const row = (await one('SELECT * FROM rate_limits WHERE key=?', key));
        if (row && row.count >= maximum)
            return false;
        (await run('INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=rate_limits.count+1', key, time + seconds * 1000));
        return true;
    }));
    if (!accepted)
        throw new AppError('Too many attempts. Please try again later.', 429);
}
export async function tokenFor(userId: string, purpose: string, minutes = 60) {
    const token = randomBytes(32).toString('hex');
    (await run('DELETE FROM tokens WHERE user_id=? AND purpose=?', userId, purpose));
    (await run('INSERT INTO tokens VALUES (?,?,?,?,NULL)', hash(token), userId, purpose, new Date(Date.now() + minutes * 60000).toISOString()));
    return token;
}
export async function redeemToken(token: string, purpose: string, password: string) {
    return (await atomic(async () => {
        const record = (await one('SELECT * FROM tokens WHERE token=? AND purpose=? AND used_at IS NULL AND expires_at>?', hash(token), purpose, now()));
        if (!record)
            throw new AppError('This link is invalid or has expired.');
        const user = (await one('SELECT * FROM users WHERE id=? AND active=1', record.user_id));
        if (!user)
            throw new AppError('Account unavailable.');
        (await run('UPDATE users SET password=? WHERE id=?', passwordHash(password), user.id));
        (await run('UPDATE tokens SET used_at=? WHERE user_id=? AND purpose IN (?,?)', now(), user.id, 'reset', 'invite'));
        (await run('DELETE FROM sessions WHERE user_id=?', user.id));
        (await audit(user.id, 'password.set', 'user', user.id, { purpose }));
        return user.id as string;
    }));
}
export function accessibleOrder(actor: Actor, order: Row) {
    if (staff(actor) || order.user_id === actor.id || actor.role === 'hotel_manager' && order.hotel_id === actor.hotel_id)
        return true;
    throw new AppError('Order not found.', 404);
}
