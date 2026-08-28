import type {
  IDataObject,
  IPollFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

/** Mirrors domain.automationEventTypes in the API — GET /events returns only these. */
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

/** n8n does not deduplicate for the node, so this persists the API's cursor. */
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
    // No cursor on a first or manual run: the API defaults to the last 24 hours.
    if (staticData.since && !manualMode) {
      qs.since = staticData.since;
    }

    // IDataObject, not Record<string, unknown> — returnJsonArray rejects the latter.
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

    // Scheduled runs only: a manual test must not consume unseen events.
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
