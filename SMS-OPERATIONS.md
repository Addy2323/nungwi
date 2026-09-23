# NUNGWI SHOP SMS operations

The application uses PostgreSQL as its durable SMS outbox. Order changes and notification records commit together; the provider is contacted after the request or by the worker, so a gateway outage does not roll back an order. Existing Twilio and email support remain available.

## Configuration

1. Apply `npm run db:migrate -- --sms-only` to an existing installation with migrations 001 and 002. The full migration command also includes 006 on clean installs. The local database has an unrelated pre-existing drinks-catalog migration mismatch; SMS-only avoids that migration.
2. Configure server environment variables from `.env.example`: `SMS_PROVIDER=macksms`, `SMS_BASE_URL=https://macksms.co.tz/portal/api/`, `SMS_SENDER_ID`, and either `SMS_API_KEY` (Basic header/Base64 key) or `SMS_API_SECRET` (secret key) plus `SMS_SECRET_CODE`. Never expose these through `NEXT_PUBLIC_` variables.
3. Generate and retain a 32-byte hexadecimal `SMS_ENCRYPTION_KEY`. All app and worker processes need the same key. OTP payloads use authenticated encryption; hashes use HMAC. Back up the key securely. Do not change it while OTPs are pending.
4. Set `APP_URL` to the public HTTPS shop URL. In Dashboard → Notifications, set the **actual shop pickup location**, registered sender ID, administrator contact and desired notification switches. If no administrator phone is configured, active administrator accounts receive alerts; duplicate normalized numbers receive one alert.
5. Fund the MackSMS account. During implementation, read-only checks accepted the supplied credentials and registered sender `LotusRise`, but reported no SMS credit. No real messages were sent during development.

Sender registration is controlled by the provider. All default message bodies identify NUNGWI SHOP even when the account's registered sender is LotusRise. To change the visible sender, first register the desired sender with MackSMS.

## Background processing

Run `npm run notifications:run -- --watch` under your host's process supervisor, alongside the web application. Alternatively schedule `npm run notifications:run` every minute. Use the same environment and database as the app. The worker expands campaigns in batches of 100 and sends at most 100 messages per cycle. Multiple workers use serialized PostgreSQL claims and unique event keys.

The web application's existing post-response hook opportunistically processes small batches. It is not a replacement for the supervised worker: campaign expansion, retries, expired-code cleanup and status polling need the worker.

## Delivery reports

In MackSMS → System Settings → API Configuration → Webhooks, enable reports and set the HTTPS callback URL to `APP_URL/api/sms/webhook`. The documented callback has no signature. The endpoint therefore treats callbacks only as hints and fetches the authoritative report with server credentials before changing status. Periodic polling provides recovery if callbacks are lost.

Reference: https://documenter.getpostman.com/view/41324507/2sAYkHpe7i

## Registration and delivery

Registration first queues a six-digit OTP, valid for five minutes. The customer account and session are created only after successful verification. A new challenge invalidates the previous challenge. Resends have a 60-second cooldown and a five-per-hour phone limit; verification allows five attempts. Disabling SMS or OTP pauses registration; it never bypasses verification. Existing accounts can verify changed phone numbers from their Account page.

The extended order sequence is Pending → Confirmed → Preparing (processing) → Driver assigned → Ready for pickup → Picked up → Out for delivery → Driver arriving → Delivered. Existing direct dispatch transitions are retained for compatibility. Assignment validates the driver phone and requires the configured pickup address. Expiring driver links permit pickup, dispatch, arriving and recipient-code delivery confirmation for that order only. Pickup consumes reserved stock; dispatch does not consume it twice. Payment reconciliation remains separate from delivery.

The customer schema does not store gender/title, so messages use names without guessing a salutation. Locations, customer contacts, items and driver details come from the actual order and shop settings.

## Status and recovery

- `queued`: pending, including delayed rate-limit retries.
- `submitted`: gateway accepted the message; delivery is not yet confirmed.
- `sent` / `delivered`: last confirmed provider report.
- `failed`: confirmed rejection, expiry or disabled category. OTPs must be resent through the verification flow, not the admin retry button.
- `unknown`: timeout, malformed response, or an interrupted sending worker. Reconcile with the provider before any resend. There is no automatic retry for these outcomes because MackSMS does not document idempotent message submission.

HTTP 429 responses retry with exponential backoff, up to five attempts. Provider-confirmed permanent failures are visible for administrator action. Provider errors never include full provider response bodies, credentials or OTPs in application logs. OTP message bodies are hidden in history and encrypted queue payloads are removed after submission, uncertainty, expiry or supersession. Expired challenges are pruned after 24 hours.

Bulk campaigns respect customer SMS preferences, deduplicate normalized numbers and recheck active status/preferences before queueing. Active customers means customers with an order in the last 90 days. A campaign completion indicator means expansion into the outbox is complete; consult message history for delivery outcomes. Recipient lists shown for manual selection are limited to 5,000 users; group campaigns include all matching records.

## Validation

`npm test` uses temporary PostgreSQL schemas. SMS-specific tests mock all provider traffic, and cover OTP lifecycle and redaction, encryption, phone normalization, provider message-ID precision, retries, concurrent claims, duplicate protection and bulk expansion. The platform tests cover the complete delivery lifecycle and stock consumption at pickup.

Live handset delivery remains unverified until the account is funded and an authorized recipient completes a real registration or order flow.

Verification completed: 77 automated tests pass. The production build passes with existing upload-path tracing warnings. `python tests/sms-ui.py` checks desktop/mobile signup against a local production server on port 3100 with intercepted signup requests; local Vercel analytics 404s are excluded from app-error assertions.
