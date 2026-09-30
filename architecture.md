# SPAR Collection Service — System Architecture

## 1. Overview

This document describes the architecture for the **SPAR Collection Service**, the employee-facing part of the SPAR grocery collection system.

Customers already have a separate system for creating shopping lists. The collection system is responsible for receiving those lists, presenting them to SPAR employees on tablets, recording collection results, supporting offline operation, and transferring completed collections to the payment engine.

The solution uses:

- **Vanilla HTML/CSS/JavaScript** for the tablet web application
- **Azure Static Web Apps** for hosting the frontend
- **Azure Functions** for backend APIs and event processing
- **Azure Service Bus** for asynchronous list and payment messaging
- **Azure SQL Database** for persistent transactional data
- **IndexedDB + Service Worker** for offline operation
- **Microsoft Entra ID** for employee authentication
- **Azure Key Vault** for secrets
- **Application Insights / Azure Monitor** for monitoring

The architecture is designed around reliability, offline-first behaviour, asynchronous processing, and idempotent operations.

---

## 2. Functional Requirements

The system must support the following functionality.

| Requirement | Description |
|---|---|
| Web based | Employees use a browser-based application on dedicated tablets. |
| Receive shopping lists | Shopping lists arrive through a queue and become available to employees. |
| Collect items | Employees can mark individual items as collected. |
| Unavailable items | Employees can mark individual items as unavailable. |
| Complete collection | Employees can finish a shopping list when collection is complete. |
| Payment transfer | Completed collections are transferred to the payment engine. |
| Offline support | Employees can continue working when the tablet temporarily has no network connection. |

---

## 3. Non-Functional Requirements and Assumptions

| Requirement | Value / Assumption |
|---|---|
| Expected concurrent users | 200 |
| Lists processed per day | 10,000 |
| Average shopping list size | 500 KB |
| Offline support | Required |
| Desired SLA | Highest possible |
| List delivery mechanism | Queue |
| Frontend technology | HTML/CSS/Vanilla JavaScript |
| Cloud platform | Microsoft Azure |
| Authentication | Microsoft Entra ID |
| Backend style | Serverless APIs and event-driven processing |

### Estimated data volume

The average incoming list volume is approximately:

```text
10,000 lists/day × 500 KB
≈ 5 GB/day
```

This is an average of approximately:

```text
10,000 / 86,400
≈ 0.116 lists/second
```

The system must nevertheless be able to handle bursts rather than relying only on the average rate.

---

# 4. Architecture Goals

The architecture has the following goals:

1. Provide a simple and maintainable employee interface.
2. Allow employees to continue collecting items without Internet connectivity.
3. Synchronize offline changes reliably when connectivity returns.
4. Avoid losing collection progress.
5. Prevent duplicate operations during synchronization.
6. Process shopping lists asynchronously.
7. Isolate the collection workflow from payment-engine availability.
8. Provide monitoring and error handling.
9. Scale to the expected workload.
10. Keep the implementation appropriate for a small team and a case-study project.

---

# 5. High-Level Architecture

```text
                         CUSTOMER SYSTEM
                               |
                               | Shopping List
                               v
                    +------------------------+
                    |   Azure Service Bus    |
                    |    Shopping Queue      |
                    +-----------+------------+
                                |
                                v
                    +------------------------+
                    |    Azure Function      |
                    |    List Processor       |
                    +-----------+------------+
                                |
                                v
                    +------------------------+
                    |      Azure SQL         |
                    |                        |
                    | Lists                  |
                    | List Items             |
                    | Collection Operations  |
                    | Payment Transactions   |
                    +-----------+------------+
                                ^
                                |
                             HTTPS
                                |
              +-----------------+------------------+
              |                                    |
      +-------+--------+                   +-------+--------+
      |    Tablet 1    |       ...         |   Tablet 200   |
      | HTML/CSS/JS    |                   | HTML/CSS/JS    |
      |                |                   |                |
      | Service Worker |                   | Service Worker |
      | IndexedDB      |                   | IndexedDB      |
      +----------------+                   +----------------+
              |
              | Collection completed
              v
       +-----------------------+
       |   Azure Service Bus   |
       |     Payment Queue     |
       +-----------+-----------+
                   |
                   v
       +-----------------------+
       |    Azure Function     |
       |   Payment Processor   |
       +-----------+-----------+
                   |
                   v
       +-----------------------+
       |    Payment Engine     |
       |       REST API        |
       +-----------------------+

Cross-cutting services:
- Microsoft Entra ID
- Azure Key Vault
- Application Insights
- Azure Monitor
- HTTPS
```

---

# 6. Main Components

## 6.1 Tablet Web Application

The employee application is a browser-based application written using:

- HTML
- CSS
- Vanilla JavaScript

No frontend framework is required.

The application provides:

- Employee login
- List overview
- Shopping list details
- Item collection status
- Mark item as collected
- Mark item as unavailable
- Collection completion
- Online/offline status
- Synchronization status

The application should be designed as a Progressive Web App (PWA).

---

## 6.2 Service Worker

The Service Worker allows the application shell to remain available when the tablet is offline.

It caches static assets such as:

```text
index.html
collection.html
styles.css
app.js
collection.js
api.js
db.js
sync.js
```

The Service Worker is responsible for:

- Caching application resources
- Serving cached resources while offline
- Supporting application startup without network connectivity

The Service Worker does not replace IndexedDB. The two have different responsibilities:

```text
Service Worker
    -> Application files

IndexedDB
    -> Shopping lists
    -> Item states
    -> Pending synchronization operations
```

---

## 6.3 IndexedDB

IndexedDB provides persistent local storage in the tablet browser.

The following information should be stored locally:

```text
Shopping Lists
List Items
Pending Operations
Synchronization Metadata
```

Example item:

```json
{
  "listId": "LIST-12345",
  "itemId": "ITEM-001",
  "productId": "MILK-001",
  "productName": "Milk",
  "quantity": 2,
  "status": "COLLECTED"
}
```

Example pending operation:

```json
{
  "operationId": "550e8400-e29b-41d4-a716-446655440000",
  "listId": "LIST-12345",
  "itemId": "ITEM-001",
  "operation": "COLLECTED",
  "createdAt": "2026-09-30T08:20:31Z",
  "status": "PENDING"
}
```

---

# 7. Azure Static Web Apps

The frontend can be hosted using Azure Static Web Apps.

Responsibilities:

- Host HTML
- Host CSS
- Host JavaScript
- Serve the Service Worker
- Provide HTTPS
- Integrate with authentication

The frontend does not directly access Azure SQL or Service Bus.

Instead:

```text
Browser
   |
   | HTTPS
   v
Azure Functions API
```

This prevents database and queue credentials from being exposed to the client.

---

# 8. Azure Functions

Azure Functions provide the backend API and event-driven processing.

Example HTTP endpoints:

```text
GET  /api/lists
GET  /api/lists/{listId}

POST /api/lists/{listId}/items/{itemId}
POST /api/sync

POST /api/lists/{listId}/complete
GET  /api/sync/status
```

Azure Functions are also used for Service Bus-triggered processing:

```text
Shopping Queue
      |
      v
List Processor Function
      |
      v
Azure SQL
```

and:

```text
Payment Queue
      |
      v
Payment Processor Function
      |
      v
Payment Engine
```

---

# 9. Azure Service Bus

Azure Service Bus provides asynchronous communication between system components.

Two logical queues are recommended.

## 9.1 Shopping List Queue

```text
Customer System
      |
      v
Shopping List Queue
      |
      v
List Processor
      |
      v
Azure SQL
```

A message could contain:

```json
{
  "listId": "LIST-12345",
  "customerOrderId": "ORDER-98765",
  "createdAt": "2026-09-30T08:00:00Z",
  "items": [
    {
      "itemId": "ITEM-001",
      "productId": "MILK-001",
      "name": "Milk",
      "quantity": 2
    },
    {
      "itemId": "ITEM-002",
      "productId": "BREAD-001",
      "name": "Bread",
      "quantity": 1
    }
  ]
}
```

## 9.2 Payment Queue

Completed collections are placed on a payment queue.

```text
Collection API
      |
      v
Payment Queue
      |
      v
Payment Processor
      |
      v
Payment Engine
```

This prevents payment-engine failures from blocking the employee collection workflow.

---

# 10. Queue Reliability

Queue processing must be reliable.

The List Processor should follow this sequence:

```text
Receive message
      |
      v
Validate message
      |
      v
Store list in database
      |
      v
Confirm successful processing
      |
      v
Complete queue message
```

If database processing fails:

```text
Queue Message
      |
      v
Function
      |
      X Database error
      |
      v
Retry
```

Messages that repeatedly fail should eventually be moved to the Service Bus dead-letter queue.

This allows failed messages to be investigated without blocking normal processing.

---

# 11. Database Architecture

Azure SQL Database is recommended because the system contains strongly related transactional data.

The main tables are:

```text
ShoppingLists
ShoppingListItems
CollectionOperations
PaymentTransactions
```

---

# 12. ShoppingLists Table

Suggested structure:

```text
ShoppingLists
-------------
Id
CustomerOrderId
Status
AssignedEmployeeId
CreatedAt
StartedAt
CompletedAt
Version
```

Possible statuses:

```text
RECEIVED
IN_PROGRESS
COMPLETED
PAYMENT_PENDING
PAYMENT_COMPLETED
PAYMENT_FAILED
```

---

# 13. ShoppingListItems Table

Suggested structure:

```text
ShoppingListItems
-----------------
Id
ListId
ProductId
ProductName
Quantity
Status
UpdatedAt
```

Possible item statuses:

```text
PENDING
COLLECTED
UNAVAILABLE
```

---

# 14. CollectionOperations Table

This table records operations performed by tablets.

```text
CollectionOperations
--------------------
OperationId
ListId
ItemId
OperationType
DeviceId
CreatedAt
ProcessedAt
```

The `OperationId` should be unique.

This provides idempotency during offline synchronization.

---

# 15. PaymentTransactions Table

Suggested structure:

```text
PaymentTransactions
-------------------
Id
ListId
Status
AttemptCount
ExternalPaymentId
IdempotencyKey
CreatedAt
UpdatedAt
```

Possible statuses:

```text
PENDING
PROCESSING
COMPLETED
FAILED
```

---

# 16. Offline-First Architecture

Offline operation is a core requirement.

The tablet must not depend on continuous Internet connectivity.

The flow is:

```text
                 ONLINE
                   |
                   v
             Get Shopping List
                   |
                   v
                IndexedDB
                   |
                   v
             Employee works
                   |
                   |
                OFFLINE
                   |
                   v
          Save changes locally
                   |
                   v
             Pending Operations
                   |
              CONNECTION
                RETURNS
                   |
                   v
              Sync Engine
                   |
                   v
              Backend API
                   |
                   v
               Azure SQL
```

---

# 17. Offline Item Updates

When an employee marks an item as collected:

```text
Employee clicks "Collected"
            |
            v
Update local item state
            |
            v
Create operation
            |
            v
Save operation in IndexedDB
            |
            v
Update UI immediately
```

If the device is online, the operation can be synchronized immediately.

If offline, it remains in the pending operations store.

---

# 18. Synchronization

Synchronization should be automatic.

Synchronization can occur:

- When the browser detects the device has come online
- Periodically while the application is running
- After application startup
- After a user action, where appropriate

Example:

```javascript
async function syncOperations() {
    if (!navigator.onLine) {
        return;
    }

    const operations = await getPendingOperations();

    for (const operation of operations) {
        try {
            await sendOperation(operation);
            await markOperationAsSynced(operation.operationId);
        } catch (error) {
            console.error("Synchronization failed", error);
            break;
        }
    }
}
```

---

# 19. Idempotency

Offline systems can send the same operation more than once.

Example:

```text
Tablet
   |
   | COLLECT ITEM
   v
Backend
   |
   | Operation processed
   |
   X Response lost
   |
Tablet thinks request failed
   |
   | Sends same operation again
   v
Backend
```

The backend must recognize that the operation was already processed.

Each operation therefore receives a unique `operationId`.

Example:

```json
{
  "operationId": "abc-123",
  "listId": "LIST-12345",
  "itemId": "ITEM-001",
  "operation": "COLLECTED"
}
```

The database should enforce uniqueness on `operationId`.

Result:

```text
First request  -> Processed
Second request -> Ignored / already processed
```

This prevents duplicate state changes.

---

# 20. Collection Completion

The employee should only be able to complete a list when the required collection workflow has been completed.

Example:

```text
Employee
    |
    v
Complete Collection
    |
    v
Backend validates list
    |
    +-- Invalid --> Reject request
    |
    +-- Valid
          |
          v
     Mark COMPLETED
          |
          v
     Create payment message
```

The browser should not communicate directly with the payment engine.

---

# 21. Payment Integration

Payment processing is asynchronous.

Recommended flow:

```text
Collection Completed
        |
        v
Payment Queue
        |
        v
Payment Processor Function
        |
        v
Payment Engine REST API
```

If the payment engine is unavailable:

```text
Payment Queue
      |
      v
Payment Processor
      |
      X Payment engine unavailable
      |
      v
Retry later
```

The collection remains completed while payment processing can retry independently.

---

# 22. Payment Idempotency

Payment requests must also be idempotent.

A unique key should be generated for each completed list.

Example:

```text
Idempotency-Key: LIST-12345
```

If the same payment request is accidentally sent twice, the payment system should recognize the duplicate request.

This helps prevent duplicate charges.

---

# 23. API Security

All communication between the browser and backend must use HTTPS.

The application should use Microsoft Entra ID for employee authentication.

Example:

```text
Employee
   |
   v
Microsoft Entra ID
   |
   | Access Token
   v
Web Application
   |
   | HTTPS + Token
   v
Azure Functions
```

The backend must validate:

- Authentication
- Employee identity
- Authorization
- List ownership/assignment
- Request data
- Operation ID
- List status

Employees should only be able to access lists they are authorized to collect.

---

# 24. Secrets and Configuration

Secrets must not be stored in JavaScript source code.

Sensitive configuration should be stored using Azure Key Vault or appropriate managed application configuration.

Examples:

```text
Payment Engine credentials
Database credentials
External API keys
Service Bus connection information
```

The browser must never receive server-side secrets.

---

# 25. Monitoring and Observability

Application Insights and Azure Monitor should be used to monitor the application.

Important metrics include:

```text
API response time
API error rate
Queue length
Queue processing failures
Dead-letter messages
Synchronization failures
Payment failures
Function execution time
Database errors
```

Useful alerts include:

```text
Large queue backlog
Repeated payment failures
High API error rate
High synchronization failure rate
Dead-letter queue messages
Database connectivity problems
```

---

# 26. Error Handling

Errors should be handled at every layer.

## Frontend

The application should:

- Display an offline indicator
- Preserve local changes
- Retry synchronization
- Avoid losing employee actions
- Display synchronization errors

## Backend

The backend should:

- Validate all requests
- Return appropriate HTTP status codes
- Log errors
- Use idempotency
- Retry transient failures

## Queue

Service Bus should:

- Retry failed processing
- Use dead-letter queues
- Prevent message loss

## Payment

Payment processing should:

- Retry transient errors
- Track payment status
- Use idempotency
- Avoid duplicate payment requests

---

# 27. Failure Scenarios

## Internet connection lost

```text
Tablet
   |
   X Internet
   |
   v
IndexedDB
   |
   v
Employee continues working
```

When the connection returns:

```text
IndexedDB
   |
   v
Sync API
   |
   v
Azure SQL
```

---

## Backend temporarily unavailable

The tablet keeps collection operations in IndexedDB.

Synchronization is retried later.

---

## Payment engine unavailable

The completed collection remains stored.

The payment message remains in the payment queue and is retried.

---

## Database temporarily unavailable

The Service Bus message is not considered successfully processed.

The queue can retry the operation.

---

## Duplicate synchronization request

The `operationId` prevents the same operation from being applied twice.

---

# 28. Scalability

The expected workload is:

```text
200 concurrent users
10,000 lists/day
500 KB average list size
```

Azure Functions can scale according to incoming demand.

Azure Service Bus provides buffering during traffic bursts.

This means that a temporary increase in incoming shopping lists does not necessarily require the database or processing layer to process every message immediately.

The architecture therefore separates:

```text
Incoming workload
        |
        v
Queue
        |
        v
Processing capacity
```

---

# 29. High Availability

The requirement states that the desired SLA is the highest possible.

The architecture supports high availability through managed Azure services and redundancy/configuration appropriate to the selected Azure service tiers.

Important design practices include:

- Avoiding a single application server
- Using managed Azure services
- Asynchronous queue processing
- Automatic retries
- Dead-letter queues
- Database backups
- Offline tablet operation
- Monitoring and alerting
- Idempotent operations
- Separating payment processing from collection

The exact SLA depends on the Azure service tiers and deployment configuration selected.

---

# 30. Data Flow

## 30.1 Shopping List Arrival

```text
Customer System
      |
      v
Shopping List Queue
      |
      v
List Processor Function
      |
      v
Azure SQL
      |
      v
List available to employee
```

## 30.2 Employee Collection

```text
Employee
      |
      v
Tablet Web Application
      |
      v
IndexedDB
      |
      v
Sync API
      |
      v
Azure SQL
```

## 30.3 Collection Completion

```text
Employee
      |
      v
Complete Collection
      |
      v
Collection API
      |
      v
Azure SQL
      |
      v
Payment Queue
```

## 30.4 Payment

```text
Payment Queue
      |
      v
Payment Function
      |
      v
Payment Engine
      |
      v
Payment Result
      |
      v
Azure SQL
```

---

# 31. Frontend Project Structure

A suggested project structure is:

```text
spar-collection/
│
├── index.html
├── collection.html
├── manifest.json
├── service-worker.js
│
├── css/
│   └── styles.css
│
├── js/
│   ├── app.js
│   ├── auth.js
│   ├── api.js
│   ├── collection.js
│   ├── db.js
│   └── sync.js
│
└── tests/
    ├── collection.test.js
    ├── sync.test.js
    └── db.test.js
```

---

# 32. Backend Project Structure

A suggested Azure Functions structure is:

```text
backend/
│
├── functions/
│   ├── getLists/
│   ├── getList/
│   ├── updateItem/
│   ├── syncOperations/
│   ├── completeCollection/
│   ├── processShoppingList/
│   └── processPayment/
│
├── models/
│   ├── ShoppingList
│   ├── ShoppingListItem
│   ├── CollectionOperation
│   └── PaymentTransaction
│
├── services/
│   ├── database/
│   ├── queue/
│   └── payment/
│
└── tests/
```

---

# 33. Development with GitHub Copilot

GitHub Copilot and other generative AI tools can be used during implementation.

Recommended workflow:

```text
Requirement
     |
     v
Architecture
     |
     v
Developer creates task
     |
     v
Copilot generates initial code
     |
     v
Developer reviews code
     |
     v
Security/error handling review
     |
     v
Automated tests
     |
     v
Integration testing
     |
     v
Deployment
```

AI-generated code should always be reviewed and tested.

Particular attention should be given to:

- Authentication
- Authorization
- SQL queries
- Input validation
- Offline synchronization
- Error handling
- Payment integration
- Idempotency
- Secret management

---

# 34. Testing Strategy

## Functional testing

The following scenarios should be tested:

```text
Receive shopping list
Display shopping list
Mark item as collected
Mark item as unavailable
Complete shopping list
Transfer completed list to payment queue
Process payment
```

## Offline testing

```text
Open application offline
Load locally cached list
Mark item collected offline
Mark item unavailable offline
Close and reopen application
Verify changes remain
Restore network
Synchronize operations
Verify server state
```

## Failure testing

```text
Database unavailable
Service Bus unavailable
Payment engine unavailable
Network lost during synchronization
Network restored during synchronization
Duplicate operation submitted
Duplicate payment request submitted
Invalid shopping list
Unauthorized employee access
```

## Performance testing

The original optional test requirement suggests:

```text
10 concurrent users
100 lists/day
```

These can be used as a basic development test.

For a production-oriented validation, testing should also cover the stated target:

```text
200 concurrent users
10,000 lists/day
```

---

# 35. Example End-to-End Scenario

The following scenario demonstrates the complete architecture.

### Step 1 — List arrives

```text
Customer System
      |
      v
Shopping Queue
```

### Step 2 — Backend processes list

```text
Shopping Queue
      |
      v
List Processor
      |
      v
Azure SQL
```

### Step 3 — Tablet receives list

```text
Azure SQL
      |
      v
Collection API
      |
      v
Tablet
```

### Step 4 — Employee works offline

```text
Tablet
  |
  v
IndexedDB

Milk      -> COLLECTED
Bread     -> COLLECTED
Apples    -> UNAVAILABLE
Chicken   -> COLLECTED
```

### Step 5 — Network returns

```text
IndexedDB
    |
    v
Sync API
    |
    v
Azure SQL
```

### Step 6 — Employee completes collection

```text
Tablet
    |
    v
Complete API
    |
    v
Azure SQL
```

### Step 7 — Payment request created

```text
Azure SQL
    |
    v
Payment Queue
```

### Step 8 — Payment processed

```text
Payment Queue
    |
    v
Payment Function
    |
    v
Payment Engine
```

### Step 9 — Payment result recorded

```text
Payment Engine
    |
    v
Payment Function
    |
    v
Azure SQL
```

---

# 36. Architectural Decisions

| Decision | Reason |
|---|---|
| Vanilla HTML/CSS/JS | Matches project requirement and keeps frontend simple. |
| PWA approach | Provides browser-based offline capability. |
| IndexedDB | Provides persistent local storage for offline operations. |
| Azure Functions | Provides serverless APIs and event-driven processing. |
| Azure Service Bus | Provides reliable asynchronous communication and buffering. |
| Azure SQL | Provides transactional relational storage. |
| Separate payment queue | Prevents payment-engine problems from blocking collection. |
| Idempotent operations | Prevents duplicate updates after retries/offline synchronization. |
| Microsoft Entra ID | Provides employee authentication and authorization. |
| Key Vault | Protects sensitive credentials and configuration. |
| Application Insights | Provides monitoring and diagnostics. |

---

# 37. Technology Summary

```text
Frontend
    HTML
    CSS
    Vanilla JavaScript
    PWA
    Service Worker
    IndexedDB

Hosting
    Azure Static Web Apps

Backend
    Azure Functions

Messaging
    Azure Service Bus

Database
    Azure SQL Database

Authentication
    Microsoft Entra ID

Secrets
    Azure Key Vault

Monitoring
    Application Insights
    Azure Monitor

External Integration
    Payment Engine REST API
```

---

# 38. Summary

The proposed SPAR Collection Service uses a web-based, offline-first architecture.

The tablet application is intentionally lightweight and is implemented using basic HTML, CSS, and JavaScript. A Service Worker allows the application to load while offline, while IndexedDB stores shopping lists and collection operations locally.

Azure Functions provide the backend APIs and event-driven processing. Azure Service Bus provides reliable asynchronous communication for incoming shopping lists and completed payment requests. Azure SQL provides persistent transactional storage.

The key reliability mechanism is the combination of:

```text
Offline storage
+
Operation IDs
+
Idempotent APIs
+
Queue retries
+
Dead-letter queues
+
Asynchronous payment processing
```

This allows employees to continue collecting items during temporary connectivity problems while minimizing the risk of losing collection data or creating duplicate operations.

The architecture is sized for the stated assumptions of approximately **200 concurrent users**, **10,000 lists per day**, and **500 KB average list size**, while retaining a straightforward implementation suitable for a case-study project.
