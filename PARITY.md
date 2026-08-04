# TurboDocx SDK ↔ n8n Node Parity Matrix

This document tracks coverage of the [TurboDocx JS/TS SDK](https://github.com/TurboDocx/SDK) (`@turbodocx/sdk`)
public API surface inside this n8n community node.

The n8n node re-implements the SDK's HTTP calls directly (it does **not** depend on `@turbodocx/sdk`,
since published community nodes cannot bundle a first-party runtime dependency). This matrix is the
source of truth for what the node must expose to reach parity.

Legend: ✅ implemented · 🟡 partial · ❌ missing · — not applicable to n8n

Baseline captured at: SDK `@turbodocx/sdk@0.4.0`, node `@turbodocx/n8n-nodes-turbodocx@1.2.0`.

---

## Summary

| SDK Module | SDK callable methods | Covered in node (v1.2.0) | Gap |
|---|---:|---:|---|
| TurboSign (`sign.ts`) | 8 | 8 | none |
| Deliverable (`deliverable.ts`) | 7 | 7 | none |
| TurboQuote (`quote.ts`) | 68 | 68 | none |
| TurboPartner (`partner.ts`) | 25 | 25 | none (uses 2nd credential) |
| TurboWebhooks (`webhooks.ts`) | 10 + `verifyWebhookSignature` | 10 + helper | none |

**Full method parity: 118/118 SDK methods wrapped, plus the `verifyWebhookSignature` helper.
Zero gaps, zero strays.** The only SDK surface intentionally not wrapped is the set of
[Deliberate Exclusions](#deliberate-exclusions) — helpers, low-level primitives, and
convenience overloads that have no idiomatic n8n mapping.

> `configure()` on every SDK module is **— (n/a)**: the n8n node supplies auth via credentials, not a static configure call.

---

## TurboSign — `src/modules/sign.ts`

Credential: `turboDocxApi` (apiKey + orgId). Auth headers: `Authorization: Bearer <key>`, `x-rapiddocx-org-id: <orgId>`.

| SDK method | HTTP | n8n resource/operation | Status |
|---|---|---|---|
| `createSignatureReviewLink(req)` | POST `/turbosign/single/prepare-for-review` | turboSign / `prepareForReview` | ✅ |
| `sendSignature(req)` | POST `/turbosign/single/prepare-for-signing` | turboSign / `prepareForSigning` | ✅ |
| `getStatus(documentId)` | GET `/turbosign/documents/{id}/status` | turboSign / `getStatus` | ✅ |
| `getRecipients(documentId)` | GET `/turbosign/documents/{id}/recipients` | turboSign / `getRecipients` | ✅ |
| `download(documentId)` | GET `/turbosign/documents/{id}/download` | turboSign / `downloadDocument` | ✅ |
| `void(documentId, reason)` | POST `/turbosign/documents/{id}/void` | turboSign / `voidDocument` | ✅ |
| `resend(documentId, recipientIds)` | POST `/turbosign/documents/{id}/resend-email` | turboSign / `resendEmail` | ✅ |
| `getAuditTrail(documentId)` | GET `/turbosign/documents/{id}/audit-trail` | turboSign / `getAuditTrail` | ✅ |

Note: `signUrl` is a legacy **field** on the Go and Java `RecipientResponse` models, not a method —
no node operation required. The API never populates it; signing links are emailed to recipients
and are not returned by any endpoint.

---

## Deliverable — `src/modules/deliverable.ts`

Credential: `turboDocxApi`. Document generation from templates with variable substitution.

| SDK method | HTTP | n8n resource/operation | Status |
|---|---|---|---|
| `listDeliverables(opts)` | GET `/v1/deliverable` | deliverable / `list` | ✅ |
| `generateDeliverable(req)` | POST `/v1/deliverable` | deliverable / `generate` | ✅ |
| `getDeliverableDetails(id, opts)` | GET `/v1/deliverable/{id}` | deliverable / `get` | ✅ |
| `updateDeliverableInfo(id, req)` | PATCH `/v1/deliverable/{id}` | deliverable / `update` | ✅ |
| `deleteDeliverable(id)` | DELETE `/v1/deliverable/{id}` | deliverable / `delete` | ✅ |
| `downloadSourceFile(id)` | GET `/v1/deliverable/file/{id}` (binary) | deliverable / `downloadSource` | ✅ |
| `downloadPDF(id)` | GET `/v1/deliverable/file/pdf/{id}` (binary) | deliverable / `downloadPdf` | ✅ |

Envelope quirks: `getDeliverableDetails` unwraps `{ results }`; `generateDeliverable` returns nested `{ results: { deliverable } }`.

---

## TurboQuote — `src/modules/quote.ts`

Credential: `turboDocxApi`. Response envelope: double-unwrap `{ data: { result } }` (single) / `{ data: { results } }` (list).
Several sub-entities → modelled as separate n8n resources for usable UX.

The new `/bulk` and `/number-config` endpoints return a PLURAL `{ results: … }` envelope,
so those handlers `unwrap: 'smart'` then read `.results` manually (`unwrap: 'result'` only
unwraps the singular `{ result }` and would miss them).

### Number Config
| SDK method | HTTP | n8n resource/operation | Status |
|---|---|---|---|
| `getQuoteNumberConfig()` | GET `/v1/quotes/number-config` | quoteNumberConfig / `get` | ✅ |
| `updateQuoteNumberConfig(format)` | PATCH `/v1/quotes/number-config` | quoteNumberConfig / `update` | ✅ |

### Bulk Create
Each POSTs `{ rows }` and returns a single partial-success `BulkImportResult`
(`{ imported, failed, adjusted }`) — not a fan-out. Max 500 rows.
| SDK method | HTTP | n8n resource/operation | Status |
|---|---|---|---|
| `bulkCreateProducts(rows)` | POST `/v1/products/bulk` | product / `bulkCreate` | ✅ |
| `bulkCreatePriceBooks(rows)` | POST `/v1/pricebooks/bulk` | priceBook / `bulkCreate` | ✅ |
| `bulkCreateBundles(rows)` | POST `/v1/bundles/bulk` | bundle / `bulkCreate` | ✅ |
| `bulkCreateCompanies(rows)` | POST `/v1/companies/bulk` | company / `bulkCreate` | ✅ |
| `bulkCreateContacts(rows)` | POST `/v1/contacts/bulk` | contact / `bulkCreate` | ✅ |
| `bulkCreateTypes(rows)` | POST `/v1/types/bulk` | quoteType / `bulkCreate` | ✅ |

### Quotes
| SDK method | HTTP | n8n resource/operation | Status |
|---|---|---|---|
| `listQuotes(opts)` | GET `/v1/quotes` | quote / `list` | ✅ |
| `createQuote(req)` | POST `/v1/quotes` | quote / `create` | ✅ |
| `getQuote(id)` | GET `/v1/quotes/{id}` | quote / `get` | ✅ |
| `updateQuote(id, req)` | PATCH `/v1/quotes/{id}` | quote / `update` | ✅ |
| `deleteQuote(id)` | DELETE `/v1/quotes/{id}` | quote / `delete` | ✅ |
| `duplicateQuote(id)` | POST `/v1/quotes/{id}/duplicate` | quote / `duplicate` | ✅ |
| `applyPriceBook(quoteId, priceBookId)` | POST `/v1/quotes/{id}/apply-pricebook` | quote / `applyPriceBook` | ✅ |
| `removePriceBook(quoteId)` | POST `/v1/quotes/{id}/remove-pricebook` | quote / `removePriceBook` | ✅ |
| `downloadQuotePdf(id)` | GET `/v1/quotes/{id}/pdf` (binary) | quote / `downloadPdf` | ✅ |
| `sendQuote(id, req?)` | POST `/v1/quotes/{id}/send` | quote / `send` | ✅ |
| `sendQuoteWithDeliverable(id, req)` | POST `/v1/quotes/{id}/send-with-deliverable` | quote / `sendWithDeliverable` | ✅ |
| `declineQuote(id, req)` | POST `/v1/quotes/{id}/decline` | quote / `decline` | ✅ |
| `voidQuote(id, req)` | POST `/v1/quotes/{id}/void` | quote / `void` | ✅ |
| `handleExpiredQuote(id, req)` | POST `/v1/quotes/{id}/handle-expired-sent` | quote / `handleExpired` | ✅ |
| `createAndSend(req)` | macro (create→items→bundle→send) | quote / `createAndSend` | ✅ |

### Quote Line Items
| SDK method | HTTP | n8n resource/operation | Status |
|---|---|---|---|
| `listLineItems(quoteId, opts)` | GET `/v1/quotes/{id}/items` | quoteLineItem / `list` | ✅ |
| `addLineItems(quoteId, items)` | POST `/v1/quotes/{id}/items` | quoteLineItem / `add` | ✅ |
| `addBundleLineItems(quoteId, items)` | POST `/v1/quotes/{id}/items/bundle` | quoteLineItem / `addBundle` | ✅ |
| `updateLineItem(quoteId, itemId, req)` | PATCH `/v1/quotes/{id}/items/{itemId}` | quoteLineItem / `update` | ✅ |
| `removeLineItem(quoteId, itemId)` | DELETE `/v1/quotes/{id}/items/{itemId}` | quoteLineItem / `remove` | ✅ |

### Products
| `listProducts` `createProduct` `getProduct` `updateProduct` `deleteProduct` `duplicateProduct` `getProductPrimaryImages` | `/v1/products*` | product / list·create·get·update·delete·duplicate·primaryImages | ✅ |

### Price Books
| `listPriceBooks` `createPriceBook` `getPriceBook` `updatePriceBook` `deletePriceBook` `duplicatePriceBook` `listPriceBookProducts` | `/v1/pricebooks*` | priceBook / list·create·get·update·delete·duplicate·listProducts | ✅ |

### Bundles
| `listBundles` `createBundle` `getBundle` `updateBundle` `deleteBundle` `duplicateBundle` | `/v1/bundles*` | bundle / list·create·get·update·delete·duplicate | ✅ |

### Companies
| `listCompanies` `createCompany` `getCompany` `updateCompany` `deleteCompany` `listCompanyContacts` | `/v1/companies*` | company / list·create·get·update·delete·listContacts | ✅ |

### Contacts
| `listContacts` `createContact` `updateContact` `deleteContact` | `/v1/contacts*` | contact / list·create·update·delete | ✅ |
(no `getContact` in SDK — single-contact lookup not exposed)

### Quote Templates
| `listTemplates` `getTemplate` `getTemplateById` `createTemplate` `updateTemplate` `deleteTemplate` | `/v1/quote-template(s)*` | quoteTemplate / list·getDefault·get·create·update·delete | ✅ |

### Quote Types / Categories
| `listTypes` `createType` `updateType` `deleteType` | `/v1/types*` | quoteType / list·create·update·delete | ✅ |

---

## TurboPartner — `src/modules/partner.ts`

Credential: **`turboDocxPartnerApi`** (NEW — `partnerApiKey` starting with `TDXP-` + `partnerId`).
All endpoints prefixed `/partner/{partnerId}/`. Incompatible auth with the standard credential → separate credential type, selected per-resource via `displayOptions`.

### Partner Organizations
| `createOrganization` `listOrganizations` `getOrganizationDetails` `updateOrganizationInfo` `deleteOrganization` `updateOrganizationEntitlements` | `/organization(s)*` | partnerOrganization / create·list·get·update·delete·updateEntitlements | ✅ |

### Organization Users
| `listOrganizationUsers` `addUserToOrganization` `updateOrganizationUserRole` `removeUserFromOrganization` `resendOrganizationInvitationToUser` | `/organizations/{id}/users*` | partnerOrgUser / list·add·updateRole·remove·resendInvite | ✅ |

### Organization API Keys
| `listOrganizationApiKeys` `createOrganizationApiKey` `updateOrganizationApiKey` `revokeOrganizationApiKey` | `/organizations/{id}/apikeys*` | partnerOrgApiKey / list·create·update·revoke | ✅ |

### Partner API Keys
| `listPartnerApiKeys` `createPartnerApiKey` `updatePartnerApiKey` `revokePartnerApiKey` | `/api-keys*` | partnerApiKey / list·create·update·revoke | ✅ |

### Partner Portal Users
| `listPartnerPortalUsers` `addUserToPartnerPortal` `updatePartnerUserPermissions` `removeUserFromPartnerPortal` `resendPartnerPortalInvitationToUser` | `/users*` | partnerUser / list·add·updatePermissions·remove·resendInvite | ✅ |

### Audit Logs
| `getPartnerAuditLogs(req)` | GET `/audit-logs` | partnerAuditLog / list | ✅ |

---

## TurboWebhooks — `src/modules/webhooks.ts`

Credential: `turboDocxApi` (administrator key). Fixed webhook name `signature`. POST/PATCH return `{ data, message }` (manual `.data` extract).

| SDK method | HTTP | n8n resource/operation | Status |
|---|---|---|---|
| `createWebhook(req)` | POST `/api/webhooks` | webhook / `create` | ✅ |
| `getWebhook()` | GET `/api/webhooks/signature` | webhook / `get` | ✅ |
| `updateWebhook(patch)` | PATCH `/api/webhooks/signature` | webhook / `update` | ✅ |
| `deleteWebhook()` | DELETE `/api/webhooks/signature` | webhook / `delete` | ✅ |
| `testWebhook(req)` | POST `/api/webhooks/signature/test` | webhook / `test` | ✅ |
| `notifyWebhook(req)` | POST `/api/webhooks/signature/notify` | webhook / `notify` | ✅ |
| `regenerateWebhookSecret()` | POST `/api/webhooks/signature/regenerate` | webhook / `regenerateSecret` | ✅ |
| `listWebhookDeliveries(req)` | GET `/api/webhooks/signature/deliveries` | webhook / `listDeliveries` | ✅ |
| `replayWebhookDelivery(id)` | POST `/api/webhooks/signature/replay` | webhook / `replayDelivery` | ✅ |
| `getWebhookStats(req)` | GET `/api/webhooks/signature/stats` | webhook / `getStats` | ✅ |
| `verifyWebhookSignature(...)` | local HMAC verify (no API call) | **TurboDocx Trigger node** (auto-registers + verifies) | ✅ |

The idiomatic n8n consumption path for `signature.document.completed` / `signature.document.voided` events is a
**Trigger node** that registers the webhook on activation and verifies the HMAC signature on each event. This is the
one capability added beyond a strict 1:1 method port; its only enabler is the ported `verifyWebhookSignature` logic.

---

## Deliberate Exclusions

These SDK-domain backend endpoints are **intentionally not wrapped** — they are UI-flow helpers,
low-level primitives, or overloads with no idiomatic n8n mapping. They are **not** parity gaps; they
mirror the [cross-SDK parity rule's exclusion list](https://github.com/TurboDocx/SDK)
(`.claude/rules/cross-sdk-parity.md`). Do not re-add without a decision.

| Module | Excluded endpoint(s) | Rationale |
|---|---|---|
| TurboQuote | `POST /v1/quotes/number-config/preview-floor` | Frontend live-preview helper |
| TurboQuote | `POST /v1/quotes/{id}/items/reorder`, `/items/category-order` | Drag-and-drop presentation only |
| TurboQuote | approval-workflow family (`/v1/quotes/workflows*`, `/{id}/approve`, `/approval-requests`, `/{id}/approval-activity`) | Backend feature not yet production-complete; revisit when it ships |
| TurboSign | `GET /turbosign/documents/signature-documents` (list) + `/turbosign/bulk/*` mail-merge family | Deferred to a future pass, not rejected |
| TurboSign | two-step prep flow (`upload` / `from-deliverable` / `from-template` / `update-with-recipients` / per-doc `prepare-for-*`) | Single-step endpoints already wrapped accept file/fileLink/deliverableId/templateId and cover the API use case |
| Deliverable | `/deliverable-folder`, `/deliverable-item` (org-content organization), `previewpdflink`, `pdf/{filename}` | Unversioned / UI-only |
| TurboPartner | `/partner/access`, `/partner/{id}/context` | UI bootstrap/dashboard |
| TurboWebhooks | `GET /api/webhooks` (list) | No `listWebhooks` by design — the node targets the fixed `signature` webhook |
