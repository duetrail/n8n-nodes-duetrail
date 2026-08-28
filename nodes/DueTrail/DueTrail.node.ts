// NodeConnectionType is a TYPE-only export in current n8n-workflow (the runtime
// value was renamed to NodeConnectionTypes). peerDependencies allows any
// version, so use the string literal, which is valid against both the old enum
// and the new string union.
import type { INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';

/**
 * Actions against the DueTrail public API.
 *
 * Declarative (routing-based) rather than programmatic: every operation is a
 * single REST call, so there is no execute() logic worth owning — and the
 * declarative form is what n8n's own reviewers prefer for API nodes.
 */
export class DueTrail implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'DueTrail',
    name: 'dueTrail',
    icon: 'file:duetrail.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Create invoices, record payments and add notes in DueTrail',
    defaults: { name: 'DueTrail' },
    inputs: ['main' as NodeConnectionType],
    outputs: ['main' as NodeConnectionType],
    credentials: [{ name: 'dueTrailApi', required: true }],
    requestDefaults: {
      baseURL: '={{$credentials.baseUrl}}',
      headers: { Accept: 'application/json' },
    },
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Invoice', value: 'invoice' },
          { name: 'Case', value: 'case' },
        ],
        default: 'invoice',
      },

      // ── Invoice ────────────────────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['invoice'] } },
        options: [
          {
            name: 'Create',
            value: 'create',
            action: 'Create an invoice',
            description: 'Create an invoice and open a paused collection case for it',
            routing: { request: { method: 'POST', url: '/invoices' } },
          },
        ],
        default: 'create',
      },
      {
        displayName: 'Invoice Number',
        name: 'invoice_number',
        type: 'string',
        required: true,
        default: '',
        displayOptions: { show: { resource: ['invoice'], operation: ['create'] } },
        routing: { send: { type: 'body', property: 'invoice_number' } },
      },
      {
        displayName: 'External ID',
        name: 'external_id',
        type: 'string',
        default: '',
        description:
          'Strongly recommended. Your own identifier for this invoice — it is the idempotency key. n8n retries failed steps, and without it a retry creates a second invoice and the customer is chased twice.',
        displayOptions: { show: { resource: ['invoice'], operation: ['create'] } },
        routing: { send: { type: 'body', property: 'external_id' } },
      },
      {
        displayName: 'Customer Name',
        name: 'customer_name',
        type: 'string',
        required: true,
        default: '',
        displayOptions: { show: { resource: ['invoice'], operation: ['create'] } },
        routing: { send: { type: 'body', property: 'customer_name' } },
      },
      {
        displayName: 'Customer Email',
        name: 'customer_email',
        type: 'string',
        placeholder: 'name@email.com',
        default: '',
        description:
          'Becomes the primary contact if this customer is new. Without a contact the case can never send a reminder.',
        displayOptions: { show: { resource: ['invoice'], operation: ['create'] } },
        routing: { send: { type: 'body', property: 'customer_email' } },
      },
      {
        displayName: 'External Customer ID',
        name: 'external_customer_id',
        type: 'string',
        default: '',
        description: 'Your identifier for the customer, so repeat invoices attach to one customer instead of many',
        displayOptions: { show: { resource: ['invoice'], operation: ['create'] } },
        routing: { send: { type: 'body', property: 'external_customer_id' } },
      },
      {
        displayName: 'Total Amount',
        name: 'amount_total',
        type: 'string',
        required: true,
        default: '',
        placeholder: '1250.00',
        displayOptions: { show: { resource: ['invoice'], operation: ['create'] } },
        routing: { send: { type: 'body', property: 'amount_total' } },
      },
      {
        displayName: 'Outstanding Amount',
        name: 'outstanding_amount',
        type: 'string',
        default: '',
        description: 'Leave empty when the whole invoice is unpaid',
        displayOptions: { show: { resource: ['invoice'], operation: ['create'] } },
        routing: { send: { type: 'body', property: 'outstanding_amount' } },
      },
      {
        displayName: 'Currency',
        name: 'currency',
        type: 'string',
        required: true,
        default: 'EUR',
        description: 'Three-letter code, e.g. EUR, USD, GBP',
        displayOptions: { show: { resource: ['invoice'], operation: ['create'] } },
        routing: { send: { type: 'body', property: 'currency' } },
      },
      {
        displayName: 'Issue Date',
        name: 'issued_at',
        type: 'dateTime',
        required: true,
        default: '',
        displayOptions: { show: { resource: ['invoice'], operation: ['create'] } },
        routing: { send: { type: 'body', property: 'issued_at' } },
      },
      {
        displayName: 'Due Date',
        name: 'due_date',
        type: 'dateTime',
        required: true,
        default: '',
        displayOptions: { show: { resource: ['invoice'], operation: ['create'] } },
        routing: { send: { type: 'body', property: 'due_date' } },
      },

      // ── Case ───────────────────────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['case'] } },
        options: [
          {
            name: 'Record Payment',
            value: 'recordPayment',
            action: 'Record a payment against a case',
            description: 'Record a payment so a customer who has paid stops being chased',
            routing: {
              request: { method: 'POST', url: '=/cases/{{$parameter["case_id"]}}/payments' },
            },
          },
          {
            name: 'Add Note',
            value: 'addNote',
            action: 'Add a note to a case',
            description: "Write context onto the case's timeline",
            routing: {
              request: { method: 'POST', url: '=/cases/{{$parameter["case_id"]}}/notes' },
            },
          },
        ],
        default: 'recordPayment',
      },
      {
        displayName: 'Case ID',
        name: 'case_id',
        type: 'string',
        required: true,
        default: '',
        description: 'Every collection event from the trigger node carries the case it belongs to',
        displayOptions: { show: { resource: ['case'] } },
      },
      {
        displayName: 'Amount',
        name: 'amount',
        type: 'string',
        required: true,
        default: '',
        placeholder: '1250.00',
        description: 'A partial payment leaves the case open for the remainder',
        displayOptions: { show: { resource: ['case'], operation: ['recordPayment'] } },
        routing: { send: { type: 'body', property: 'amount' } },
      },
      {
        displayName: 'Note',
        name: 'note',
        type: 'string',
        default: '',
        description: 'Optional context recorded on the case timeline',
        displayOptions: { show: { resource: ['case'], operation: ['recordPayment'] } },
        routing: { send: { type: 'body', property: 'note' } },
      },
      {
        displayName: 'Content',
        name: 'content',
        type: 'string',
        required: true,
        default: '',
        typeOptions: { rows: 3 },
        displayOptions: { show: { resource: ['case'], operation: ['addNote'] } },
        routing: { send: { type: 'body', property: 'content' } },
      },
    ],
  };
}
