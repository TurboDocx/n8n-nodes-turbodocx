[![TurboDocx](./banner.png)](https://www.turbodocx.com)

@turbodocx/n8n-nodes-turbodocx
====================
[![NPM Version][npm-image]][npm-url]
[![CodeQL](https://github.com/TurboDocx/n8n-nodes-turbodocx/workflows/CodeQL/badge.svg)](https://github.com/TurboDocx/n8n-nodes-turbodocx/actions/workflows/codeql.yml)
[![GitHub Stars](https://img.shields.io/github/stars/turbodocx/n8n-nodes-turbodocx?style=social)](https://github.com/turbodocx/n8n-nodes-turbodocx)
[![Type Script](https://shields.io/badge/TypeScript-3178C6?logo=TypeScript&logoColor=FFF&style=flat-square)](https://typescript.org)
[![Discord](https://img.shields.io/badge/Discord-Join%20Us-7289DA?logo=discord)](https://discord.gg/NYKwz4BcpX)
[![npm](https://img.shields.io/npm/dm/@turbodocx/n8n-nodes-turbodocx)](https://www.npmjs.com/package/@turbodocx/n8n-nodes-turbodocx)
[![X](https://img.shields.io/badge/X-@TurboDocx-1DA1F2?logo=x&logoColor=white)](https://twitter.com/TurboDocx)
[![Embed TurboDocx in Your App in Minutes](https://img.shields.io/badge/Embed%20TurboDocx%20in%20Your%20App%20in%20Minutes-8A2BE2)](https://www.turbodocx.com/use-cases/embedded-api?utm_source=github&utm_medium=repo&utm_campaign=open_source)

Automate TurboDocx API and TurboSign digital signatures in your n8n workflows. Send signature requests, track document status, and download signed PDFs—all without writing code.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

## Why This Node?

🚀 **Zero-Code Signature Automation** - Build complete document signing workflows with drag-and-drop simplicity. No API knowledge required.

✍️ **Full TurboSign Integration** - Access all TurboSign capabilities: prepare documents for review, send signature requests, track status, download signed PDFs, void requests, and resend emails.

⚡ **Lightning Fast** - Pure TypeScript implementation with zero runtime dependencies. Built for n8n Cloud compatibility and instant deployment.

🔄 **Production Ready** - Built with n8n's best practices, comprehensive error handling, and full TypeScript support for reliable automation.

🛠️ **Developer Friendly** - Clean API design, comprehensive documentation, and detailed examples to get you automating in minutes.

## Installation

### n8n Cloud (Pending Community Node Verification)

1. In your n8n instance, go to **Settings** → **Community Nodes**
2. Click **Install** and enter: `@turbodocx/n8n-nodes-turbodocx`
3. Click **Install** to add the node to your instance

### Self-Hosted n8n

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

```bash
# From your n8n installation directory
npm install @turbodocx/n8n-nodes-turbodocx
# Restart n8n
```

## Credentials Setup

### Getting Your API Key

1. Sign up for a TurboDocx account at [https://turbodocx.com](https://turbodocx.com)
2. Log in to your TurboDocx dashboard
3. Navigate to your account settings or API section
4. Generate an API key
5. Copy the API key

### Adding to n8n

1. In n8n, create a new **TurboDocx API** credential
2. Paste your API key
3. Set the Base URL: `https://api.turbodocx.com` (default)
4. Save the credential

## Operations

### TurboSign

| Operation | What It Does | Use Case |
|-----------|-------------|----------|
| **Prepare for Review** | Upload a document with signature fields and get a preview URL. No emails sent. | Preview field placement before sending to clients |
| **Prepare for Signing** | Upload a document and automatically send signature requests to all recipients | Send employment agreements, contracts, NDAs for signature |
| **Get Document Status** | Check the current status (draft, pending, completed, voided) | Verify all parties have signed before next step |
| **Download Document** | Download the final signed PDF | Archive to cloud storage or send to accounting |
| **Void Document** | Cancel a signature request and invalidate all links | Deal falls through, need to cancel request |
| **Resend Email** | Resend signature request to recipients who haven't signed | Send reminders after 3 days |

**Supported File Types**: PDF, DOCX, PPTX, or URLs to hosted files (S3, Google Drive, etc.)

## Usage Examples

### Simple Contract Signing Workflow

```
[Webhook Trigger] → [HTTP Request: Get Document] → [TurboDocx: Prepare for Signing] → [Slack: Notify Team]
```

**Step-by-step:**
1. Add a **Webhook** node to receive contract data
2. Add **HTTP Request** node to download document from your storage (supports PDF, DOCX, PPTX)
3. Add **TurboDocx** node with operation **TurboSign: Prepare for Signing**
   - **File**: Select binary data from previous node (or provide URL to hosted file)
   - **Recipients**:
     ```json
     [
       {"name":"{{$json.customerName}}","email":"{{$json.customerEmail}}","order":1},
       {"name":"Company Rep","email":"legal@company.com","order":2}
     ]
     ```
   - **Fields**:
     ```json
     [
       {"type":"signature","page":1,"x":100,"y":500,"width":200,"height":50,"recipientOrder":1},
       {"type":"date","page":1,"x":320,"y":500,"width":100,"height":30,"recipientOrder":1},
       {"type":"signature","page":1,"x":100,"y":600,"width":200,"height":50,"recipientOrder":2},
       {"type":"date","page":1,"x":320,"y":600,"width":100,"height":30,"recipientOrder":2}
     ]
     ```
4. Add **Slack** node to notify team when sent

### Auto-Download Completed Contracts

```
[Schedule Trigger] → [TurboDocx: Get Status] → [IF: Status=Completed] → [TurboDocx: Download] → [Google Drive: Upload]
```

**Step-by-step:**
1. **Schedule**: Run every hour
2. **TurboDocx: Get Status**: Check document `{{$json.documentId}}`
3. **IF**: Only continue if status is "completed"
4. **TurboDocx: Download**: Get signed PDF
5. **Google Drive**: Upload to contracts folder

### Reminder System for Pending Signatures

```
[Schedule Trigger] → [TurboDocx: Get Status] → [IF: Pending > 3 Days] → [TurboDocx: Resend Email]
```

### Document Generation + Signature Flow

```
[Webhook] → [TurboDocx: Generate Document] → [TurboSign: Prepare for Signing] → [Email: Notify Sender]
```

**Step-by-step:**
1. **Webhook**: Receive customer data and contract details
2. **TurboDocx: Generate Document**: Create personalized contract from template
   - Returns `deliverableId` in output
3. **TurboSign: Prepare for Signing**:
   - **File Input Method**: Select "Deliverable"
   - **Deliverable ID**: `{{$json.deliverableId}}` (from previous TurboDocx node)
   - **Recipients**:
     ```json
     [
       {"name":"{{$json.customerName}}","email":"{{$json.customerEmail}}","order":1},
       {"name":"Sales Rep","email":"sales@company.com","order":2}
     ]
     ```
   - **Fields**: Use template anchors or coordinates
4. **Email**: Notify sender that signature request was sent

**Why use this workflow:** Seamlessly generate personalized documents and send them for signature in one automation. The deliverable ID links the generated document directly to the signature request.

## Field Placement Methods

TurboSign supports **two methods** for placing signature fields on documents:

### Method 1: Coordinate-Based (Absolute Positioning)

| Property | Type | Required | Description | Example |
|----------|------|----------|-------------|---------|
| `type` | string | ✅ | Field type | `"signature"`, `"date"`, `"text"` |
| `page` | number | ✅ | PDF page number (1-indexed) | `1` |
| `x` | number | ✅ | Horizontal position in pixels | `100` |
| `y` | number | ✅ | Vertical position in pixels | `500` |
| `width` | number | ✅ | Field width in pixels | `200` |
| `height` | number | ✅ | Field height in pixels | `50` |
| `recipientOrder` | number | ✅ | Which recipient fills this field | `1` |

**Example:**
```json
{
  "type": "signature",
  "page": 1,
  "x": 100,
  "y": 500,
  "width": 200,
  "height": 50,
  "recipientOrder": 1
}
```

**Best for:** Documents with consistent layouts where you know exact field positions.

### Method 2: Template Anchor-Based (Dynamic Positioning)

| Property | Type | Required | Description | Example |
|----------|------|----------|-------------|---------|
| `type` | string | ✅ | Field type | `"signature"`, `"date"`, `"text"` |
| `recipientOrder` | number | ✅ | Which recipient fills this field | `1` |
| `template.anchor` | string | ✅ | Text pattern to find in document | `"{sig}"`, `"{client_signature}"` |
| `template.placement` | string | ✅ | Where to place field relative to anchor | `"replace"`, `"after"`, `"below"` |
| `template.width` | number | ✅ | Field width in pixels | `200` |
| `template.height` | number | ✅ | Field height in pixels | `50` |

**Placement Options:**

| Placement | Description |
|-----------|-------------|
| `replace` | Replace the anchor text with the field |
| `after` | Place field to the right of anchor |
| `before` | Place field to the left of anchor |
| `above` | Place field above anchor |
| `below` | Place field below anchor |

**Example:**
```json
{
  "type": "signature",
  "recipientOrder": 1,
  "template": {
    "anchor": "{client_sig}",
    "placement": "replace",
    "width": 180,
    "height": 50
  }
}
```

**Complete Template Anchor Example:**

Document with anchors:
```
Client Signature: {client_sig}    Date: {client_date}
Company Rep: {company_sig}        Date: {company_date}
```

Fields configuration:
```json
[
  {"type": "signature", "recipientOrder": 1, "template": {"anchor": "{client_sig}", "placement": "replace", "width": 180, "height": 50}},
  {"type": "date", "recipientOrder": 1, "template": {"anchor": "{client_date}", "placement": "replace", "width": 100, "height": 30}},
  {"type": "signature", "recipientOrder": 2, "template": {"anchor": "{company_sig}", "placement": "replace", "width": 180, "height": 50}},
  {"type": "date", "recipientOrder": 2, "template": {"anchor": "{company_date}", "placement": "replace", "width": 100, "height": 30}}
]
```

**Best for:** Document templates with variable content where exact positions may shift.

## Field Types Reference

| Type | Description | Use Case |
|------|-------------|----------|
| `signature` | Full signature field | Primary signature area |
| `initial` | Initial field (smaller) | Initial each page or clause |
| `text` | Text input field | Enter names, titles, or custom text |
| `date` | Date picker field | Signature date, start date, etc. |
| `checkbox` | Checkbox field | Agree to terms, opt-in selections |

## Recipients Reference

```json
[
  {
    "name": "John Doe",
    "email": "john@example.com",
    "order": 1
  },
  {
    "name": "Jane Smith",
    "email": "jane@example.com",
    "order": 2
  }
]
```

**Signing Order:**
- Recipients sign in order (order 1, then order 2, etc.)
- Use the same order number for parallel signing (both can sign at the same time)

## File Input Methods

TurboSign supports **4 different ways** to provide documents for signature requests:

| Method | What It Does | When to Use | Example |
|--------|--------------|-------------|---------|
| **Upload File** | Upload PDF, DOCX, or PPTX directly from workflow | Files from triggers, HTTP requests, or local storage | Binary data from previous node |
| **File URL** | Download from external URL (S3, Google Drive, Dropbox, etc.) | Documents hosted on cloud storage or CDN | `https://bucket.s3.amazonaws.com/contract.pdf` |
| **Deliverable** | Reference existing TurboDocx deliverable by UUID | Generated a document and want to send for signature | `550e8400-e29b-41d4-a716-446655440000` |
| **Template** | Use TurboDocx template by UUID (static, no data merge) | Pre-configured templates ready to send as-is | `660e8400-e29b-41d4-a716-446655440001` |

### Supported File Formats

| Format | Extension | Auto-Convert to PDF |
|--------|-----------|---------------------|
| PDF | `.pdf` | No (already PDF) |
| Microsoft Word | `.docx` | ✅ Yes |
| Microsoft PowerPoint | `.pptx` | ✅ Yes |

### Common Workflow Patterns

**Generate + Sign:**
```
[TurboDocx: Generate] → [TurboSign: Prepare for Signing with Deliverable ID]
```

**Download + Sign:**
```
[HTTP Request: Get File] → [TurboSign: Prepare for Signing with Binary Upload]
```

**Cloud Storage + Sign:**
```
[TurboSign: Prepare for Signing with File URL from S3/Drive/Dropbox]
```

## Compatibility

- n8n **1.60.0** or later
- Compatible with **n8n Cloud** (zero runtime dependencies)
- Works with self-hosted n8n instances

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [TurboDocx Website](https://turbodocx.com)
* [TurboDocx Documentation](https://docs.turbodocx.com)

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## Support

**Proudly Built by TurboDocx**
[!["Proudly Sponsored by TurboDocx"](https://image.typedream.com/cdn-cgi/image/width=1920,format=auto,fit=scale-down,quality=100/https://api.typedream.com/v0/document/public/de39171b-a5c9-49c5-bd9c-c2dfd5d632a2/2PZxyx12UwC5HrIA3p6lo16fCms_Group_16_1_.png)](https://www.TurboDocx.com)

For issues or questions:
- **GitHub Issues**: [https://github.com/turbodocx/n8n-nodes-turbodocx/issues](https://github.com/turbodocx/n8n-nodes-turbodocx/issues)
- **Discord**: [Join our community](https://discord.gg/NYKwz4BcpX)

## Related Packages

| Package | Description |
|---------|-------------|
| [@turbodocx/html-to-docx](https://www.npmjs.com/package/@turbodocx/html-to-docx) | Convert HTML to Word documents |

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/@turbodocx/n8n-nodes-turbodocx.svg
[npm-url]: https://npmjs.org/package/@turbodocx/n8n-nodes-turbodocx
