import { amountOwed, hasOutstandingBalance } from './balance.js';
import { classifyResponse } from './response-classifier.js';
import { INTENTS, INTENT_LABELS, INTENT_QUEUES, PAUSE_AUTOMATION_INTENTS } from './response-intents.js';
import { teamMemberPool } from './teams.js';

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function addDays(iso, days) {
  const date = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function defaultResponseRules(companyId) {
  return [
    { intent: INTENTS.PAYMENT_CLAIMED, changeStage: 'Payment Verification', pauseReminders: true, createTask: true, taskTitle: 'Verify Payment' },
    { intent: INTENTS.PROOF_OF_PAYMENT_RECEIVED, changeStage: 'Payment Verification', pauseReminders: true, createTask: true, taskTitle: 'Verify proof of payment' },
    { intent: INTENTS.PROMISE_TO_PAY, changeStage: 'Promise to Pay', pauseReminders: true, createPromise: true, createTask: true, taskTitle: 'Check Promise to Pay', followUpDaysAfterPromise: 1 },
    { intent: INTENTS.PAYMENT_EXTENSION_REQUEST, changeStage: 'Extension Requested', pauseReminders: true, createTask: true, taskTitle: 'Review extension request' },
    { intent: INTENTS.PARTIAL_PAYMENT, changeStage: 'Payment Verification', pauseReminders: true, createTask: true, taskTitle: 'Verify partial payment' },
    { intent: INTENTS.BALANCE_DISPUTE, changeStage: 'Dispute', pauseReminders: true, createTask: true, createDispute: true, taskTitle: 'Review balance dispute' },
    { intent: INTENTS.CANCELLATION_REQUEST, changeStage: 'Cancellation Requested', pauseReminders: true, createTask: true, taskTitle: 'Review cancellation request' },
    { intent: INTENTS.EQUIPMENT_COLLECTION_REQUEST, changeStage: 'Recovery Required', pauseReminders: true, createTask: true, createRecovery: true, taskTitle: 'Schedule equipment collection' },
    { intent: INTENTS.CUSTOMER_MOVED, pauseReminders: false, createTask: true, taskTitle: 'Review moved-customer options' },
    { intent: INTENTS.TECHNICAL_SERVICE_ISSUE, pauseReminders: true, createTask: true, taskTitle: 'Technical review' },
    { intent: INTENTS.FINANCIAL_DIFFICULTY, changeStage: 'Payment Arrangement Review', pauseReminders: true, createTask: true, taskTitle: 'Payment arrangement review' },
    { intent: INTENTS.CALLBACK_REQUEST, pauseReminders: false, createTask: true, taskTitle: 'Return customer call' },
    { intent: INTENTS.WRONG_CONTACT, pauseReminders: true, createTask: true, taskTitle: 'Verify contact details' },
    { intent: INTENTS.SENSITIVE_ACCOUNT, pauseReminders: true, createTask: true, taskTitle: 'Sensitive account review' },
    { intent: INTENTS.STATEMENT_REQUEST, pauseReminders: false, createTask: true, taskTitle: 'Send statement / invoice' },
    { intent: INTENTS.PAYMENT_DETAILS_REQUEST, pauseReminders: false, createTask: true, taskTitle: 'Send payment details' },
    { intent: INTENTS.NEEDS_REVIEW, pauseReminders: false, createTask: true, taskTitle: 'Review customer response' },
  ].map((rule, index) => ({
    id: `rr-default-${companyId}-${index + 1}`,
    companyId,
    name: INTENT_LABELS[rule.intent],
    active: true,
    ...rule,
  }));
}

export function defaultAssignmentRules(companyId) {
  return Object.entries(INTENT_QUEUES).map(([intent, queue], index) => ({
    id: `ar-default-${companyId}-${index + 1}`,
    companyId,
    name: `${INTENT_LABELS[intent]} → ${queue}`,
    triggerIntent: intent,
    assignmentType: 'Existing Account Owner',
    queue,
    autoAssign: true,
    active: true,
    priority: 'Medium',
    roundRobinIndex: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

export function resolveAssignee(customer, rule, users = [], teams = []) {
  const type = rule?.assignmentType || 'Existing Account Owner';
  const activeUsers = (users || []).filter((user) => user && user.active !== false && (user.name || user.email));
  if (type === 'Specific User') return rule.assigneeName || rule.assigneeUserId || customer.assignedCollector || '';
  if (type === 'Existing Account Owner') return customer.assignedCollector || rule.assigneeName || '';
  if (type === 'Manual Assignment') return '';
  if (type === 'Round Robin' || type === 'Team') {
    const named = teamMemberPool(rule, teams);
    const pool = named.length ? named : activeUsers.map((user) => user.name || user.email);
    if (!pool.length) return customer.assignedCollector || rule.assigneeName || '';
    const index = Number(rule.roundRobinIndex || 0) % pool.length;
    return pool[index];
  }
  if (type === 'Queue') return customer.assignedCollector || rule.assigneeName || '';
  return customer.assignedCollector || '';
}

function accountStatusForStage(stage, current) {
  if (stage === 'Promise to Pay') return 'Promise to Pay';
  if (stage === 'Paid') return 'Paid';
  if (stage === 'Recovery Required' || stage === 'Equipment Recovery') return 'Recovery Required';
  if (stage === 'Service Cancelled' || stage === 'Cancellation Requested') return current === 'Cancelled' ? 'Cancelled' : current;
  if (stage === 'Follow-up Due' || stage === 'Payment Verification' || stage === 'Extension Requested' || stage === 'Dispute' || stage === 'Payment Arrangement Review') {
    return current === 'Paid' || current === 'Cancelled' ? current : 'Follow-up';
  }
  return current;
}

function nextActionFor(intent, rule) {
  if (rule?.taskTitle) return rule.taskTitle;
  if (intent === INTENTS.PROMISE_TO_PAY) return 'Check Promise to Pay';
  if (intent === INTENTS.PAYMENT_CLAIMED || intent === INTENTS.PROOF_OF_PAYMENT_RECEIVED) return 'Verify Payment';
  if (intent === INTENTS.BALANCE_DISPUTE) return 'Review Dispute';
  if (intent === INTENTS.CALLBACK_REQUEST) return 'Call Customer';
  if (intent === INTENTS.CANCELLATION_REQUEST) return 'Confirm Cancellation';
  if (intent === INTENTS.EQUIPMENT_COLLECTION_REQUEST) return 'Schedule Recovery';
  if (intent === INTENTS.WRONG_CONTACT) return 'Verify Contact Details';
  if (intent === INTENTS.STATEMENT_REQUEST) return 'Send statement / invoice';
  if (intent === INTENTS.PAYMENT_DETAILS_REQUEST) return 'Send payment instructions';
  return 'Review Customer Response';
}

/**
 * Pure function: turn a classified inbound response into customer/task/activity patches.
 * Does not mutate the original objects.
 */
export function applyClassifiedResponse(input) {
  const {
    customer,
    classification,
    communication,
    actor = 'System',
    now = new Date(),
    assignmentRule,
    responseRule,
    companyOwnedEquipment = [],
    users = [],
    teams = [],
  } = input;

  const intent = classification.autoApply ? classification.detectedIntent : INTENTS.NEEDS_REVIEW;
  const rule = responseRule || defaultResponseRules(customer.companyId).find((item) => item.intent === intent) || {};
  const queue = assignmentRule?.queue || INTENT_QUEUES[intent] || 'Needs Review';
  const assignee = resolveAssignee(customer, assignmentRule || { assignmentType: 'Existing Account Owner' }, users, teams);
  const createdAt = now.toISOString();
  const today = todayIso(now);
  const activities = [];
  const actions = [];
  const previousStage = customer.collectionStage || customer.status;
  let nextCustomer = { ...customer };
  let promise = null;
  let followUp = null;
  let dispute = null;
  let recovery = null;
  let roundRobinIndex = assignmentRule?.roundRobinIndex;

  const rotatePool = teamMemberPool(assignmentRule, teams);
  if ((assignmentRule?.assignmentType === 'Round Robin' || assignmentRule?.assignmentType === 'Team') && rotatePool.length) {
    roundRobinIndex = (Number(assignmentRule.roundRobinIndex || 0) + 1) % rotatePool.length;
  }

  const autoApply = Boolean(classification.autoApply);
  const stage = autoApply ? rule.changeStage : undefined;
  if (stage) {
    nextCustomer.collectionStage = stage;
    nextCustomer.status = accountStatusForStage(stage, customer.status);
    actions.push(`Stage ${previousStage || '—'} → ${stage}`);
  }

  const shouldPause = autoApply && (rule.pauseReminders || PAUSE_AUTOMATION_INTENTS.has(intent));
  if (shouldPause) {
    const until =
      intent === INTENTS.PROMISE_TO_PAY && classification.entities?.date
        ? addDays(classification.entities.date, rule.followUpDaysAfterPromise || 1)
        : addDays(today, 14);
    nextCustomer.automationPaused = true;
    nextCustomer.automationPausedReason = INTENT_LABELS[intent] || intent;
    nextCustomer.automationPausedUntil = until;
    actions.push(`Automation paused until ${until} (${nextCustomer.automationPausedReason})`);
  }

  if (intent === INTENTS.WRONG_CONTACT) {
    nextCustomer.contactInvalid = true;
    actions.push('Phone flagged as invalid / wrong contact');
  }
  if (intent === INTENTS.SENSITIVE_ACCOUNT) {
    nextCustomer.sensitiveAccount = true;
    actions.push('Account flagged for sensitive review');
  }
  if (intent === INTENTS.TECHNICAL_SERVICE_ISSUE) {
    nextCustomer.technicalIssuePending = true;
    actions.push('Technical issue pending');
  }

  const nextAction = nextActionFor(intent, rule);
  const dueDate =
    intent === INTENTS.PROMISE_TO_PAY && classification.entities?.date
      ? addDays(classification.entities.date, rule.followUpDaysAfterPromise || 1)
      : today;
  nextCustomer.nextAction = nextAction;
  nextCustomer.nextActionDue = dueDate;
  nextCustomer.nextActionAssignee = assignee || customer.assignedCollector;
  nextCustomer.nextActionPriority = assignmentRule?.priority || 'Medium';
  nextCustomer.lastResponseIntent = classification.detectedIntent;
  nextCustomer.lastContact = `${communication?.channel || 'Message'} · ${INTENT_LABELS[classification.detectedIntent]}`;
  if (assignee && autoApply && assignmentRule?.autoAssign !== false) {
    nextCustomer.assignedCollector = assignee;
  }

  if (autoApply && rule.createPromise && classification.entities?.date && !classification.dateRequired) {
    const amount = classification.entities?.amount || amountOwed(customer.outstanding);
    if (hasOutstandingBalance(customer.outstanding)) {
      promise = {
        id: uid('pr'),
        companyId: customer.companyId,
        customerId: customer.id,
        amount,
        promiseDate: classification.entities.date,
        createdAt,
        status: 'Pending',
        customerComment: classification.entities?.comment,
        internalNote: `Created from ${communication?.channel || 'response'} classification.`,
      };
      nextCustomer.promisedDate = promise.promiseDate;
      nextCustomer.promisedAmount = amount;
      nextCustomer.nextFollowUp = dueDate;
      nextCustomer.status = 'Promise to Pay';
      nextCustomer.collectionStage = 'Promise to Pay';
      actions.push(`Promise created ${amount} for ${promise.promiseDate}`);
      followUp = {
        id: uid('fu'),
        companyId: customer.companyId,
        customerId: customer.id,
        followUpDate: dueDate,
        channel: communication?.channel || 'Any',
        assignedUser: assignee || customer.assignedCollector || actor,
        notes: `Follow up on promise of ${amount}`,
        createdAt,
      };
    }
  } else if (classification.detectedIntent === INTENTS.PROMISE_TO_PAY && classification.dateRequired) {
    actions.push('Promise date required — staff must confirm before a promise is created');
  }

  if (autoApply && intent === INTENTS.PARTIAL_PAYMENT && !classification.claimedCompleted && classification.entities?.amount) {
    promise = {
      id: uid('pr'),
      companyId: customer.companyId,
      customerId: customer.id,
      amount: classification.entities.amount,
      promiseDate: classification.entities.date || addDays(today, 1),
      createdAt,
      status: 'Pending',
      customerComment: classification.entities.comment,
      internalNote: 'Promised partial payment — original outstanding was not changed.',
    };
    nextCustomer.promisedDate = promise.promiseDate;
    nextCustomer.promisedAmount = classification.entities.amount;
    actions.push(`Partial promise created for ${classification.entities.amount}; original outstanding unchanged`);
  }

  if (autoApply && rule.createDispute) {
    dispute = {
      id: uid('dsp'),
      companyId: customer.companyId,
      customerId: customer.id,
      responseId: undefined,
      communicationId: communication?.id,
      reason: classification.entities?.comment || 'Balance disputed',
      amountDisputed: classification.entities?.amount,
      dateRaised: today,
      assignedUser: assignee || customer.assignedCollector || '',
      investigationNotes: '',
      resolution: '',
      dateResolved: '',
      outcome: '',
      status: 'Open',
      createdAt,
    };
    actions.push('Dispute case opened');
  }

  if (autoApply && (rule.createRecovery || intent === INTENTS.EQUIPMENT_COLLECTION_REQUEST)) {
    const gear = (companyOwnedEquipment || []).filter((item) => item.ownership !== 'Customer owned');
    recovery = {
      id: uid('rec'),
      companyId: customer.companyId,
      customerId: customer.id,
      status: 'Awaiting assignment',
      equipment: gear.map((item) => item.type).filter(Boolean).join(', ') || customer.equipment || 'Company equipment',
      equipmentIds: gear.map((item) => item.id),
      technician: assignee || '',
      reason: classification.entities?.comment || 'Customer requested collection',
      priority: assignmentRule?.priority || 'Medium',
      createdAt,
    };
    nextCustomer.status = 'Recovery Required';
    nextCustomer.collectionStage = 'Recovery Required';
    actions.push('Equipment recovery job created');
  }

  const task = rule.createTask !== false || !autoApply
    ? {
        id: uid('task'),
        companyId: customer.companyId,
        customerId: customer.id,
        communicationId: communication?.id,
        type: intent,
        title: nextAction,
        queue,
        status: intent === INTENTS.PROOF_OF_PAYMENT_RECEIVED || intent === INTENTS.PAYMENT_CLAIMED ? 'Awaiting Verification' : 'Pending',
        priority: assignmentRule?.priority || 'Medium',
        dueDate,
        dueTime: classification.entities?.callbackTime,
        assignedUser: assignee || '',
        notes: classification.entities?.comment,
        verificationStatus:
          intent === INTENTS.PAYMENT_CLAIMED || intent === INTENTS.PROOF_OF_PAYMENT_RECEIVED
            ? 'Awaiting Verification'
            : undefined,
        createdAt,
      }
    : null;
  if (task) actions.push(`Task created: ${task.title} → ${queue}${assignee ? ` (${assignee})` : ''}`);

  const classifiedResponse = {
    id: uid('rsp'),
    companyId: customer.companyId,
    customerId: customer.id,
    communicationId: communication?.id,
    channel: communication?.channel || 'Manual',
    direction: communication?.direction || 'Incoming',
    rawMessage: classification.entities?.comment || communication?.message || '',
    detectedIntent: classification.detectedIntent,
    appliedIntent: intent,
    confidence: classification.confidence,
    detectedEntities: classification.entities || {},
    classificationSource: classification.source || 'Rule',
    actionsApplied: actions,
    previousStage,
    newStage: nextCustomer.collectionStage,
    assignedUser: assignee || '',
    needsReview: Boolean(classification.needsReview) || !autoApply,
    dateRequired: Boolean(classification.dateRequired),
    createdAt,
  };

  activities.push({
    id: uid('act'),
    companyId: customer.companyId,
    customerId: customer.id,
    user: actor,
    action: 'Response classified',
    description: `${communication?.channel || 'Message'} received: "${String(classifiedResponse.rawMessage).slice(0, 140)}". Classified ${INTENT_LABELS[classification.detectedIntent]} (${Math.round((classification.confidence || 0) * 100)}%). ${actions.join('. ')}.`,
    createdAt,
  });

  return {
    skipped: false,
    customer: nextCustomer,
    promise,
    followUp,
    task,
    dispute,
    recovery,
    classifiedResponse,
    activities,
    actions,
    assignee,
    roundRobinIndex,
    handledAs: classification.detectedIntent === INTENTS.PROMISE_TO_PAY && promise ? 'promise' : 'classified',
    documentRequest:
      autoApply && intent === INTENTS.STATEMENT_REQUEST
        ? 'statement'
        : autoApply && intent === INTENTS.PAYMENT_DETAILS_REQUEST
          ? 'payment-details'
          : null,
  };
}

function cloneInboundState(store) {
  return {
    customers: [...(store.customers || [])],
    promises: [...(store.promises || [])],
    followUps: [...(store.followUps || [])],
    activities: [...(store.activities || [])],
    communications: [...(store.communications || [])],
    workTasks: [...(store.workTasks || [])],
    classifiedResponses: [...(store.classifiedResponses || [])],
    disputeCases: [...(store.disputeCases || [])],
    recoveries: [...(store.recoveries || [])],
    assignmentRules: [...(store.assignmentRules || [])],
    responseRules: store.responseRules || [],
    equipment: store.equipment || [],
    teams: store.teams || [],
  };
}

function pendingInbound(communications) {
  return communications.filter(
    (item) =>
      item.direction === 'Incoming' &&
      ['Email', 'WhatsApp', 'SMS', 'Phone'].includes(item.channel) &&
      (!item.handledAs || item.handledAs === 'none'),
  );
}

function commitInboundPatch(state, comm, classification, options) {
  const customerIndex = state.customers.findIndex((item) => item.id === comm.customerId);
  const customer = state.customers[customerIndex];
  if (!customer) {
    comm.handledAs = 'skipped';
    return { created: 0, classified: 0, documentRequest: null };
  }
  const assignmentRule = state.assignmentRules.find(
    (rule) => rule.companyId === customer.companyId && rule.active !== false && rule.triggerIntent === classification.detectedIntent,
  );
  const responseRule = (state.responseRules || []).find(
    (rule) =>
      rule.companyId === customer.companyId &&
      rule.active !== false &&
      rule.intent === (classification.autoApply ? classification.detectedIntent : INTENTS.NEEDS_REVIEW),
  );
  const patch = applyClassifiedResponse({
    customer,
    classification,
    communication: comm,
    actor: options.actor || 'System',
    assignmentRule,
    responseRule,
    companyOwnedEquipment: (state.equipment || []).filter((item) => item.customerId === customer.id),
    users: options.users || [],
    teams: options.teams || state.teams || [],
  });
  comm.handledAs = patch.handledAs || 'classified';
  comm.detectedIntent = patch.classifiedResponse?.detectedIntent;
  comm.classificationId = patch.classifiedResponse?.id;
  state.customers[customerIndex] = patch.customer;
  let created = 0;
  if (patch.promise) {
    const existing = state.promises.findIndex((item) => item.customerId === customer.id && item.status === 'Pending');
    if (existing >= 0) state.promises[existing] = { ...state.promises[existing], ...patch.promise, id: state.promises[existing].id };
    else state.promises.unshift(patch.promise);
    created += 1;
  }
  if (patch.followUp) state.followUps.unshift(patch.followUp);
  if (patch.task) state.workTasks.unshift(patch.task);
  if (patch.classifiedResponse) state.classifiedResponses.unshift(patch.classifiedResponse);
  if (patch.dispute) state.disputeCases.unshift(patch.dispute);
  if (patch.recovery) state.recoveries.unshift(patch.recovery);
  if (patch.activities?.length) state.activities.unshift(...patch.activities);
  if (patch.roundRobinIndex != null && assignmentRule) {
    const ruleIndex = state.assignmentRules.findIndex((item) => item.id === assignmentRule.id);
    if (ruleIndex >= 0) state.assignmentRules[ruleIndex] = { ...state.assignmentRules[ruleIndex], roundRobinIndex: patch.roundRobinIndex };
  }
  return {
    created,
    classified: 1,
    documentRequest: patch.documentRequest
      ? {
          kind: patch.documentRequest,
          customerId: customer.id,
          companyId: customer.companyId,
          communicationId: comm.id,
          taskId: patch.task?.id,
        }
      : null,
  };
}

function finishInbound(store, state, created, classified, documentRequests) {
  return {
    store: {
      ...store,
      customers: state.customers,
      promises: state.promises,
      followUps: state.followUps,
      activities: state.activities,
      communications: state.communications,
      workTasks: state.workTasks,
      classifiedResponses: state.classifiedResponses,
      disputeCases: state.disputeCases,
      recoveries: state.recoveries,
      assignmentRules: state.assignmentRules,
    },
    created,
    classified,
    documentRequests,
  };
}

export function applyInboundResponses(store, options = {}) {
  const state = cloneInboundState(store);
  const classify = options.classify || classifyResponse;
  let created = 0;
  let classified = 0;
  const documentRequests = [];
  for (const comm of pendingInbound(state.communications)) {
    const classification = classify(comm.message || '', { hasAttachment: Boolean(comm.hasAttachment) });
    const result = commitInboundPatch(state, comm, classification, { ...options, teams: options.teams || store.teams || [] });
    created += result.created;
    classified += result.classified;
    if (result.documentRequest) documentRequests.push(result.documentRequest);
  }
  return finishInbound(store, state, created, classified, documentRequests);
}

export async function applyInboundResponsesAsync(store, options = {}) {
  const state = cloneInboundState(store);
  const classify = options.classify || classifyResponse;
  let created = 0;
  let classified = 0;
  const documentRequests = [];
  for (const comm of pendingInbound(state.communications)) {
    const classification = await classify(comm.message || '', { hasAttachment: Boolean(comm.hasAttachment) });
    const result = commitInboundPatch(state, comm, classification, { ...options, teams: options.teams || store.teams || [] });
    created += result.created;
    classified += result.classified;
    if (result.documentRequest) documentRequests.push(result.documentRequest);
  }
  return finishInbound(store, state, created, classified, documentRequests);
}
