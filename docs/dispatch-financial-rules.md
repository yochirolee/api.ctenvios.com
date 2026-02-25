# Dispatch & Financial Rules

## Purpose

This document defines the single source of truth between logistics (`Dispatch`) and accounting (`InterAgencyDebt`) to avoid duplicated debts, incorrect pricing, and mixed responsibilities.

## Core Domain Separation

- `Dispatch` answers: what moved, from where, to where, and in which operational state.
- `InterAgencyDebt` answers: who owes whom, how much, and whether it is paid.
- `DispatchPayment` is transitional/compatibility data unless explicitly linked to debt records.

## Functional Contract (10 Rules)

1. `Dispatch` owns logistics only (`sender_agency_id`, `receiver_agency_id`, parcels, status, timestamps).
2. `InterAgencyDebt` owns accounting only (`debtor_agency_id`, `creditor_agency_id`, `amount_in_cents`, debt status).
3. Debt is created per transport leg (`sender -> receiver`), not by original parcel creator.
4. Debt amount is always calculated by real `pricing_agreement` for that specific leg.
5. `finalizeDispatchCreation` sets dispatch to `DISPATCHED`, but does not create debt.
6. Debt is created at reception/closure flow (single source: `smartReceive` or `finalizeReception`).
7. Debt recalculation must be idempotent: cancel/replace previous `PENDING` debts for the same `dispatch_id`.
8. Payments should be applied to `InterAgencyDebt` (source of truth), not directly to `Dispatch`.
9. Financial fields on `Dispatch` (cost/paid/status) are snapshots/derived values only.
10. Every debt cancellation/recalculation must include auditable notes (who, when, and why).

## Canonical Example: `A > B > C`

### Scenario 1: Normal chain

1. `C -> B` dispatch is received.
2. Create debt `C -> B` using `pricing_agreement(C, B)`.
3. Later, `B -> A` dispatch is received.
4. Create debt `B -> A` using `pricing_agreement(B, A)`.

Result: two valid debts for two different legs.

### Scenario 2: B arrives to A with C parcels without previous `C -> B` dispatch

1. Create regularization leg for `C -> B` (received/regularized).
2. Create/complete `B -> A` reception.
3. Create debt `C -> B` with `pricing_agreement(C, B)`.
4. Create debt `B -> A` with `pricing_agreement(B, A)`.

Result: operational shortcut does not remove accounting traceability.

## Current Implementation Notes

- `smartReceive` supports reception and accounting dispatch creation.
- Debt duplication must be prevented by cancelling existing pending debts before re-generation.
- When parent agency receives dispatches assigned to child agency, traceability should be preserved with `origin_dispatch_id` links.

## Visibility Rules (Keep It Simple)

### Dispatch visibility (logistics UI)

- "My dispatches" must show only direct participation:
  - `sender_agency_id = my_agency_id` OR
  - `receiver_agency_id = my_agency_id`.
- Do not expose third-party legs by default (example: A should not see raw `C -> B` dispatches).
- Parent/ancestor agencies may process child-assigned reception operationally, but this does not imply broad list visibility.

### When should A see C-related info?

- A should see C-origin context only when A has a direct leg (`B -> A`, regularization linked to A, or debt involving A).
- For operational simplicity, expose C details as traceability metadata in A's direct leg (summary), not as standalone foreign dispatches.

### Debt visibility (accounting UI)

- "My receivables": `creditor_agency_id = my_agency_id`.
- "My debts": `debtor_agency_id = my_agency_id`.
- Only privileged roles (root/admin) can query beyond their agency scope.

## Implementation Checklist (Phased)

### Phase 1 - Stabilize Current Flow

- [ ] Keep debt creation in only one place (recommended: `smartReceive`).
- [ ] Ensure `finalizeDispatchCreation` remains logistics-only.
- [ ] Ensure debt generation always uses agreement-based calculation per leg.
- [ ] Ensure recalculation path cancels prior `PENDING` debts for same `dispatch_id`.

### Phase 2 - Payment Source of Truth

- [ ] Introduce debt-level payment model (`InterAgencyDebtPayment`) or equivalent relation.
- [ ] Mark debt status from applied payments (`PENDING`, `PARTIALLY_PAID`, `PAID` if supported).
- [ ] Convert dispatch payment status into derived aggregate from debt payments.

### Phase 3 - Read/API Consistency

- [ ] Keep receivables/payables views based on `InterAgencyDebt`.
- [ ] Enforce backend authorization by `req.user.agency_id` for debt access.
- [ ] Expose clear API response sections: logistics vs accounting.
- [ ] Restrict dispatch listing to direct participant rule (`sender` or `receiver` is my agency).
- [ ] Expose upstream context as summary metadata, not as full foreign dispatch records.

### Phase 4 - Auditing and Data Integrity

- [ ] Add periodic integrity checks (`dispatch totals` vs `debt totals`, `paid` vs payment sums).
- [ ] Add explicit notes on auto-cancellations and debt refresh operations.
- [ ] Backfill/repair inconsistent historical records where needed.

## Decision Summary

- Logistics and accounting must remain separate concerns.
- Debt is leg-based and agreement-based.
- Payments belong to debt lifecycle.
- `Dispatch` financial values are convenience snapshots, not primary accounting truth.
- Visibility is direct-by-default: agencies see their own legs; upstream context appears only as linked traceability.
