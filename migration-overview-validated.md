# Validated Migration Overview (Legacy -> React)

This document validates the migration state against actual code in:

- Legacy: `Athar/beta`
- React: `athar-react`
- Baseline: `migration-estimate.md`

---

## A) Corrected Migration Status

### 1) Pages and Routes Validation

| Legacy source | React destination | Original status (estimate) | Actual status | Notes / corrections |
|---|---|---|---|---|
| `Athar/beta/index.html` | `/` -> `src/pages/Home.jsx` | Unspecified/assumed migrated | Fully migrated | Route and page exist; landing parity is functional |
| `Athar/beta/programs.html` | `/programs` -> `src/pages/ProgramsList.jsx` | Unspecified/assumed in progress | Partially migrated | Route exists, but page content is mock/unrelated to Athar tools |
| `Athar/beta/profile.html` | `/profile` -> `src/pages/Profile.jsx` | Unspecified/assumed in progress | Partially migrated | Mostly UI shell with mock metrics/activity; legacy functional depth missing |
| `Athar/beta/athar.html` (Muntalaq) | `/athar` -> `src/pages/tools/MuntalaqPage.jsx` | Unspecified | Fully migrated | Tool UI + API call to `/strategy` wired |
| `Athar/beta/admin.html` | `/admin/*` | Unspecified/assumed in progress | Partially migrated | Activation/users/announcements/complaints/invoices exist; dashboard and categories incomplete |
| `Athar/beta/pricing.html` | None | Mentioned in inventory | Not migrated | `/pricing` is linked but no route/page in `src/App.jsx` |
| `Athar/beta/complaints.html` (user-facing) | None | Not clearly tracked | Not migrated | Footer links `/complaints`, but no route/page |
| `Athar/beta/darsi.html` | None | Unspecified | Not migrated | No route/UI for Murtakiz |
| `Athar/beta/masar.html` | None | Unspecified | Not migrated | No route/UI |
| `Athar/beta/miyad.html` | None | Unspecified | Not migrated | No route/UI |
| `Athar/beta/mueen.html` | None | Unspecified | Not migrated | No route/UI |
| `Athar/beta/mithaq.html` | None | Inconsistently tracked | Not migrated | Legacy page exists; no React route/UI |
| `Athar/beta/ethraa.html` | None | Unspecified | Not migrated | No route/UI |
| `Athar/beta/mulham.html` | None | Unspecified | Not migrated | No route/UI |
| `Athar/beta/mutasiq.html` | None | Unspecified | Not migrated | No route/UI |
| `Athar/beta/privacy.html` | None | Not clearly tracked | Not migrated | Footer links `/privacy`, but no route/page |
| `Athar/beta/terms.html` | None | Not clearly tracked | Not migrated | Footer links `/terms`, but no route/page |
| `Athar/beta/refund-policy.html` | None | Not clearly tracked | Not migrated | Footer links `/refund`, but no route/page |

### 2) UI Components Audit

| Area | Original status (estimate) | Actual status | Notes / corrections |
|---|---|---|---|
| Shared navbar/footer/header | Unspecified | Fully migrated | Legacy component-loader pattern replaced by React layout/components |
| Public announcement banners | Unspecified | Partially migrated | Admin announcement CRUD exists, but public rotating banner display parity is missing |
| Program detail page | Unspecified | Partially migrated | `src/pages/ProgramTool.jsx` exists but has no route in `src/App.jsx` |
| Programs grid | Unspecified | Partially migrated | Uses mock startup/business content, not Athar educational tools |

### 3) JavaScript Logic Validation

| Legacy responsibility | Original status (estimate) | Actual status | Notes / corrections |
|---|---|---|---|
| Muntalaq generation (`assets/js/athar.js`) | Unspecified | Fully migrated | Implemented in `src/features/tools/MuntalaqTool.jsx` |
| Auth and route protection (`require-auth.js`) | Unspecified | Partially migrated | Split across `ProtectedRoute` and `AdminRoute`; behavior not fully equivalent |
| Admin behavior (`assets/js/admin.js`) | In progress | Partially migrated | Core admin sections migrated; dashboard and categories unfinished |
| Profile behavior (`assets/js/profile.js`) | In progress | Partially migrated | React profile lacks many real data flows and remains partly mock |
| Tool modules (`darsi`, `masar`, `miyad`, `mueen`, `mithaq`, `ethraa`, `mulham`, `mutasiq`) | Unspecified | Not migrated | API wrappers exist for many, but no tool UIs/routes |

### 4) Netlify Functions Cross-Check

#### Key correction to baseline

- `migration-estimate.md` says Netlify functions are 37 files.
- Actual JS function files in `Athar/beta/netlify/functions` are 35.

#### Function usage summary

| Function | Listed in estimate? | Referenced in React API client? | Used by current React UI? | Notes |
|---|---|---|---|---|
| `strategy.js` | Yes | Yes | Yes | Used by Muntalaq |
| `user-status.js` | Yes | Yes | Yes | Used by route guards |
| `admin-activate.js` | Yes | Yes | Yes | Used by activation/users admin pages |
| `admin-users-list.js` | Yes | Yes | Yes | Used by users admin page |
| `admin-announcement.js` | Yes | Yes | Yes | Used by announcements admin page |
| `complaints-list.js` | Yes | Yes | Yes | Used by admin complaints page |
| `complaints-get.js` | No | Yes | Yes | Used by admin complaints details |
| `complaints-reply.js` | No | Yes | Yes | Used by admin complaints reply |
| `invoices-list.js` | No | Yes | Yes | Used by admin invoices page |
| `payments-create-invoice.js` | Yes | Yes | No | Pricing page/route missing |
| `promo-redeem.js` | No | Yes | No | Pricing page/route missing |
| `murtakaz.js` | No | Yes | No | Wrapper exists, UI missing |
| `mulham.js` | No | Yes | No | Wrapper exists, UI missing |
| `mueen-plan.js` | No | Yes | No | Wrapper exists, UI missing |
| `gemini-ethraa.js` | Yes | Yes | No | Wrapper exists, UI missing |
| `gemini-mithaq.js` | No | Yes | No | Wrapper exists, UI missing |
| `add-miyad-event.js` | No | Yes | No | Wrapper exists, UI missing |
| `delete-miyad-event.js` | No | Yes | No | Wrapper exists, UI missing |
| `get-reminder-settings.js` | No | Yes | No | Wrapper exists, UI missing |
| `save-reminder-settings.js` | No | Yes | No | Wrapper exists, UI missing |
| `complaints-create.js` | No | Yes | No | User complaints page missing |
| `complaint-messages.js` | No | Yes | No | User complaints page missing |
| `complaint-user-reply.js` | No | Yes | No | User complaints page missing |
| `user-complaints-list.js` | No | Yes | No | User complaints page missing |
| `log-tool-usage.js` | Yes | Yes | No | Wrapped but not broadly connected in React UI |
| `upsert-user.js` | Yes | No | No | Not wired in React API client |
| `remind-miyad.js` | Yes | No | N/A | Scheduled backend task |
| `moyasar-webhook.js` | Yes | No | N/A | Backend webhook |
| `payments-webhook.js` | No | No | N/A | Backend webhook |

### 5) Content and Copy Validation

| Area | Original status (estimate) | Actual status | Notes / corrections |
|---|---|---|---|
| Programs copy parity | Unspecified | Partially migrated | React `ProgramsList` content does not match legacy educational tool copy |
| Navigation targets | Unspecified | Partially migrated | Nav/footer strings exist, but several linked routes are missing |
| Legal/support copy pages | Not clearly tracked | Not migrated | Missing React pages for privacy/terms/refund/complaints |
| Profile content parity | Unspecified | Partially migrated | Includes placeholder/mock activity and stats |

---

## B) Remaining Work List

### High Priority

- Build and route `/pricing` with real payment + promo flow using `payments-create-invoice` and `promo-redeem`.
- Replace `ProgramsList` mock catalog with real Athar tools and valid tool destinations.
- Add missing linked pages/routes: `/privacy`, `/terms`, `/refund`, `/complaints`.
- Implement user-facing complaints workflow (create/list/thread/reply) using existing API wrappers.
- Migrate remaining core tools before launch parity: Murtakiz, Masar, Miyad, Mueen, Mithaq, Ethraa, Mulham, Mutasiq.

### Medium Priority

- Complete admin dashboard with real data instead of static placeholders.
- Implement categories management or remove/hide it until ready.
- Add public announcement/banner rendering parity to match legacy behavior.
- Align auth/subscription guard behavior with legacy expectations across protected routes.
- Connect profile page to real invoices/usage/history data.

### Low Priority

- Remove or wire orphaned `src/pages/ProgramTool.jsx`.
- Trim unused API wrappers or mark with clear TODO ownership.
- Final copy cleanup to match approved legacy wording where required.
- Consolidate content source of truth to avoid contradictory strings.

---

## C) Migration Roadmap

1. **Fix route integrity first**
   - Add all currently linked but missing routes/pages (`/pricing`, legal/support routes).
   - Eliminate dead links from navbar/footer/CTAs.

2. **Complete launch-blocking user flows**
   - Pricing and payment conversion path.
   - User complaints support path.
   - Real profile data path.

3. **Migrate tools by impact order**
   - Murtakiz -> Masar -> Miyad -> Mueen -> Mithaq -> Ethraa -> Mulham -> Mutasiq.

4. **Close admin parity gaps**
   - Replace dashboard mocks with real metrics.
   - Decide categories scope (implement or remove from current release).

5. **Finalize UX and content parity**
   - Restore public announcement/banner behavior.
   - Reconcile copy and wording differences.
   - Remove orphan/unused pages and wrappers.

6. **Pre-launch gate**
   - No dead routes from visible links.
   - No critical pages dependent on mock data.
   - Core user journeys pass end-to-end checks.
