# ERP foundation

Open **Dashboard → Finance → ERP** as an administrator. The ERP balances cover all dates; the dashboard reporting-period filter is hidden here.

## Daily workflow

1. Add suppliers and their payment terms in **Suppliers**.
2. Create a purchase order with products, quantities in base units, and cost per base unit. Save the draft, then approve it.
3. Receive each product against the purchase order. Enter a unique receipt reference and future expiry date. Partial receipts are supported; each receipt creates a batch in the existing inventory system. Receipts cannot exceed ordered quantities.
4. After the complete purchase is received, record the supplier invoice reference. The bill amount comes from the approved purchase lines. Its due date defaults to today plus the supplier's payment terms.
5. Record actual supplier payments under **Supplier bills**. Partial payments are supported; overpayments and duplicate payment references are rejected.
6. Set customer payment terms and issue an invoice for an existing order under **Customer invoices**. Download the invoice PDF. Record customer payments/refunds through the existing **Orders** screen; invoice balances follow those records automatically.
7. Under **Finance**, match recorded transactions to statement lines or cash counts and export the transaction register as CSV. Positive amounts are incoming funds; negative amounts are outflows.

All mutations require admin access, run transactionally, and write audit records. Purchase approval records the approving administrator. This first version allows the creator to approve their own purchase; separate approver roles and approval limits are not implemented.

## Installation

Run `npm run db:migrate -- --erp-only` on an existing installation with migrations `001_postgres` and `002_money_capacity` recorded. This applies `005_erp_foundation` and grants the runtime database role access to the new tables, in one transaction. Re-running is safe. Existing business records are preserved.

The existing `004_master_drinks_catalog` migration assumes category columns that migration `003_tanzania_drinks_scanner` does not create. The targeted ERP option avoids that unrelated migration; it does not mark it applied or repair it. A full fresh database migration still requires resolving that existing catalogue mismatch.

## Scope and limits

- Bills currently cover one fully received purchase order. Supplier tax/freight adjustments, partial-delivery bills, supplier credits, and returns are not implemented.
- Customer terms set invoice due dates. Credit limits, order credit holds, credit notes, recurring billing, and hotel-wide consolidated invoices remain future work. Terms are per customer account.
- Invoice totals and payment balances use the existing order records. Cancelled and returned orders have no collectible invoice balance. This is an operational invoice PDF, not a fiscal integration.
- The transaction register is not a double-entry accounting ledger or an accounting-provider integration. Reconciliation records a manual statement reference; it does not import or verify bank data. Expenses and commissions have no recorded payment method, so they display as unspecified.
- Only explicitly issued invoices appear in invoice aging. The existing Orders and outstanding-order reports remain the source for orders not yet invoiced.
- Stock counts/transfers, POS, returnable-container tracking, expense approvals, payroll, and assets are outside this phase.

## Verification

- `npm run typecheck`
- `npm test` (requires `DATABASE_ADMIN_URL`; integration tests create and remove isolated schemas)
- `node --import tsx scripts/check-erp.ts` with the local app running on port 3001. Requires Python Selenium and Chrome. Checks the five modules, entry forms, authenticated CSV export, and desktop/mobile layouts without creating business records. Its temporary admin session is revoked afterward.
