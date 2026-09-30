const { ServiceBusClient } = require("@azure/service-bus");

module.exports = async function (context, req) {
  try {
    const connectionString = process.env.SERVICEBUS_CONNECTION_STRING;
    const queueName = process.env.PAYMENT_QUEUE_NAME || "payment-queue";

    if (!connectionString) {
      context.res = {
        status: 500,
        body: {
          accepted: false,
          error: "SERVICEBUS_CONNECTION_STRING is missing"
        }
      };
      return;
    }

    const payload = req.body || {};

    if (!payload.listId) {
      context.res = {
        status: 400,
        body: {
          accepted: false,
          error: "Missing listId in payload"
        }
      };
      return;
    }

    const queueClient = new ServiceBusClient(connectionString);
    const sender = queueClient.createSender(queueName);

    const message = {
      body: {
        eventType: "collection.completed",
        version: 1,
        correlationId: payload.correlationId || `payment-${Date.now()}`,
        listId: payload.listId,
        customerName: payload.customerName,
        submittedAt: new Date().toISOString(),
        status: "QUEUED_FOR_PAYMENT",
        summary: payload.summary || {},
        items: payload.items || []
      }
    };

    await sender.sendMessages(message);
    await sender.close();
    await queueClient.close();

    context.res = {
      status: 202,
      body: {
        accepted: true,
        message: "Payment request queued successfully",
        listId: payload.listId,
        queue: queueName
      }
    };
  } catch (error) {
    context.log.error("Queue send failed:", error);
    context.res = {
      status: 500,
      body: {
        accepted: false,
        error: error.message
      }
    };
  }
};
