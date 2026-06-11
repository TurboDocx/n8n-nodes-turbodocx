# Resource Module Contract

Every TurboDocx resource follows this exact structure so the thin orchestrator
(`TurboDocx.node.ts`) can wire it mechanically. Read the two reference modules
before writing a new one:

- `resources/turboSign/` — multipart upload, binary download, raw output (no unwrap)
- `resources/deliverable/` — Return All/Limit pagination, collections, unwrap modes

## File layout per resource group

```
resources/<group>/<Group>.description.ts   // exports node properties
resources/<group>/<Group>.handler.ts        // exports the execute function(s)
```

A "group" folder may define **multiple n8n resources** (e.g. quote defines `quote`
and `quoteLineItem`). Keep one `*.description.ts` + one `*.handler.ts` per folder.

## Description file

Export, per resource value, an operations array and a fields array:

```ts
import { INodeProperties } from 'n8n-workflow';
const RESOURCE = ['quote'];
export const quoteOperations: INodeProperties[] = [ { displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true, displayOptions: { show: { resource: RESOURCE } }, options: [ /* ... */ ], default: '<firstOp>' } ];
export const quoteFields: INodeProperties[] = [ /* all parameter properties, each with displayOptions.show.resource + operation */ ];
```

## Handler file

```ts
import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { turboDocxApiRequest, turboDocxApiRequestBinary, parseJsonParameter, detectBinaryType } from '../../shared/GenericFunctions';

export async function executeQuote(ctx: IExecuteFunctions, resource: string, operation: string, i: number): Promise<INodeExecutionData[]> { ... }
```

- Return `INodeExecutionData[]` (array — supports list fan-out). Single results return `[{ json: result }]`.
- If the folder owns multiple resources, branch on `resource` first, then `operation`. The execute fn receives both.

## Shared helpers (in `shared/GenericFunctions.ts`)

```ts
turboDocxApiRequest(ctx, { method, endpoint, body?, qs?, credentialName?, multipart?, unwrap? }, itemIndex): Promise<IDataObject>
turboDocxApiRequestBinary(ctx, { method, endpoint, qs?, credentialName? }, itemIndex): Promise<Buffer>
parseJsonParameter(ctx, value, paramName, itemIndex): unknown   // cast the result at the call site
detectBinaryType(buffer): { extension, mimeType }
```

- `endpoint` begins with `/`; base URL is prepended from the credential.
- `unwrap`: `'none'` (default, raw body) | `'smart'` (strip sole `{ data }`) | `'data'` (take `.data` even with siblings — webhook POST/PATCH) | `'result'` (smart then `.result` — TurboQuote single-entity). **TurboQuote single-entity GET/POST/PATCH use `'result'`; list endpoints use `'smart'` then read `.results`.**
- `credentialName`: omit for the standard `turboDocxApi`; pass `CRED_PARTNER` (`'turboDocxPartnerApi'`) for partner resources.
- For multipart uploads set `multipart: true` and put the file as `body.<field> = { value: Buffer, options: { filename, contentType } }`.
- PATCH null semantics: include a field only when the user set it; to clear a nullable field send explicit `null` (don't omit).

## n8n lint rules (enforced — follow exactly to avoid churn)

- Operation `options` MUST be sorted **alphabetically by `name`**. Same for any `options`-type param.
- Operation `name`: simple noun phrase ("Create", "Get", "Get Many", "Update", "Delete", "Send"). The resource dropdown supplies the entity. Do NOT prefix with the resource name.
- `action`: sentence case, "<verb> a <entity>" e.g. `'Create a quote'`, `'Get many products'`.
- List operations: value `list`, name `'Get Many'`. Provide `returnAll` (boolean, description "Whether to return all results or only up to a given limit") + `limit` (number, `typeOptions: { minValue: 1 }`, default 50, description "Max number of results to return", shown when `returnAll: [false]`).
- Boolean params: `default: false`, description starts with "Whether".
- ID params: displayName "<Entity> ID", `required: true`.
- Complex arrays/objects (line items, variables, features): use a `json` field with a helpful `placeholder` + `hint`. Optional scalar fields go in an "Additional Fields" / "Update Fields" / "Filters" `collection`.
- Every field needs `displayOptions.show` scoping it to its resource + operation(s).

## Wiring (done by the orchestrator — provide a manifest)

Each module returns: resource selector entries `{ name, value }` (name Title Case), the import lines, and the routing branch (`else if (resource === 'x' || ...) result = await executeGroup(this, resource, operation, i);`). The orchestrator keeps the resource selector options alphabetically sorted by name.
