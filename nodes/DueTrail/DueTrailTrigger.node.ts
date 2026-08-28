// NodeConnectionType is type-only in current n8n-workflow; see DueTrail.node.ts.
import type {
  IDataObject,
  IPollFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

/** The event types GET /events can return — domain.automationEventTypes in the API. */
const EVENT_TYPES = [
  { name: 'Any Event', value: '' },
  { name: 'Promise Created', value: 'promise_created' },
  { name: 'Promise Broken', value: 'promise_broken' },
  { name: 'Promise Kept', value: 'promise_kept' },
  { name: 'Payment Recorded', value: 'payment_recorded' },
  { name: 'Case Settled (Paid)', value: 'case_closed_paid' },
  { name: 'Case Closed', value: 'case_closed' },
  { name: 'Reminder Sent', value: 'reminder_sent' },
  { name: 'Manual Reminder Sent', value: 'manual_reminder_sent' },
  { name: 'Customer Reported Already Paid', value: 'portal_customer_reported_paid' },
  { name: 'Customer Asked a Question', value: 'portal_customer_question' },
];

/**
 * Polls the DueTrail public API for collection events.
 *
 * Unlike Zapier and Make — which deduplicate for you — n8n hands the node its
 * own persisted state, so this keeps a cursor: the `next_since` the API
 * returns. That is the API's own contract, and it is deliberate that an empty
 * page returns the caller's cursor unchanged rather than "now", so a quiet
 * period cannot skip an event written moments later.
 */
export class DueTrailTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'DueTrail Trigger',
    name: 'dueTrailTrigger',
    icon: 'file:duetrail.svg',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["event"] || "any event"}}',
    description: 'Starts a workflow on DueTrail collection events',
    defaults: { name: 'DueTrail Trigger' },
    polling: true,
    inputs: [],
    outputs: ['main' as NodeConnectionType],
    credentials: [{ name: 'dueTrailApi', required: true }],
    properties: [
      {
        displayName: 'Event',
        name: 'event',
        type: 'options',
        options: EVENT_TYPES,
        default: '',
        description: 'Which collection event should start the workflow',
      },
    ],
  };

  async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
    const credentials = await this.getCredentials('dueTrailApi');
    const event = this.getNodeParameter('event') as string;

    const staticData = this.getWorkflowStaticData('node') as { since?: string };
    const manualMode = this.getMode() === 'manual';

    const qs: Record<string, string | number> = { limit: 100 };
    // On a first run (or a manual test) send no cursor: the API defaults to the
    // last 24 hours, which gives a usable sample without replaying history.
    if (staticData.since && !manualMode) {
      qs.since = staticData.since;
    }

    // IDataObject, not Record<string, unknown>: returnJsonArray below will not
    // accept the latter, because unknown is wider than n8n's GenericValue.
    let response: { events?: IDataObject[]; next_since?: string };
    try {
      response = await this.helpers.httpRequest({
        method: 'GET',
        baseURL: credentials.baseUrl as string,
        url: '/events',
        qs,
        headers: { Authorization: `Bearer ${credentials.apiKey as string}` },
        json: true,
      });
    } catch (error) {
      throw new NodeApiError(this.getNode(), error as never);
    }

    const events = response.events ?? [];

    // Advance the cursor only on a scheduled run. A manual test must not
    // consume events the live workflow has not seen yet.
    if (!manualMode && response.next_since) {
      staticData.since = response.next_since;
    }

    const matching = event ? events.filter((e) => e.type === event) : events;
    if (matching.length === 0) {
      return null;
    }

    return [this.helpers.returnJsonArray(matching)];
  }
}
