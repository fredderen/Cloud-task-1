module.exports = async function (context, req) {
  const payload = req.body || {};

  if (!payload.listId) {
    context.res = {
      status: 400,
      body: {
        accepted: false,
        error: 'Missing listId in payload'
      }
    };
    return;
  }

  const paymentId = `PAY-${Date.now()}`;
  const summary = payload.summary || {
    totalItems: Array.isArray(payload.items) ? payload.items.length : 0,
    collectedCount: Array.isArray(payload.items)
      ? payload.items.filter((item) => item.status === 'collected').length
      : 0,
    unavailableCount: Array.isArray(payload.items)
      ? payload.items.filter((item) => item.status === 'unavailable').length
      : 0,
    completionPercent: 0
  };

  context.res = {
    status: 202,
    body: {
      accepted: true,
      paymentId,
      status: 'ACCEPTED',
      eventType: payload.eventType || 'collection.completed',
      version: payload.version || 1,
      listId: payload.listId,
      customerName: payload.customerName || 'Unknown customer',
      submittedAt: payload.submittedAt || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      message: 'Collection accepted for payment processing',
      summary
    }
  };
};
