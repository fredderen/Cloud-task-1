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

  context.res = {
    status: 202,
    body: {
      accepted: true,
      paymentId,
      status: 'ACCEPTED',
      listId: payload.listId,
      customerName: payload.customerName,
      receivedAt: new Date().toISOString(),
      message: 'Collection accepted for payment processing'
    }
  };
};
