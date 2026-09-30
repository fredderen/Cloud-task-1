# Azure Deployment Guide for the SPAR Collection Service

This document explains exactly what you need to do in Azure to turn the current web app into a working, production-style cloud deployment based on the architecture in `architecture.md`.

## 1. Goal

Deploy the SPAR Collection Service as a real Azure solution with:

- a frontend web app for employee tablets
- an API layer for list and collection operations
- an asynchronous queue for shopping list processing
- a payment processing flow after collection completion
- secure configuration and monitoring

The app you have built locally is the frontend prototype. To make it real in Azure, you need to deploy the frontend, add backend APIs, configure messaging, and set up database storage.

---

## 2. Required Azure services

You will need the following Azure resources:

- Azure Static Web Apps or Azure App Service
- Azure Functions
- Azure Service Bus
- Azure SQL Database
- Azure Key Vault
- Application Insights
- Microsoft Entra ID / authentication

---

## 3. Recommended Azure architecture

Use the following structure:

```text
Browser / Tablet
    |
    | HTTPS
    v
Azure Static Web Apps
    |
    | API calls
    v
Azure Functions
    |
    +--> Shopping list processing
    +--> Collection completion
    +--> Payment processing
    |
    +--> Azure Service Bus
    |
    +--> Azure SQL Database
```

The frontend never connects directly to SQL or Service Bus. It talks only to Azure Functions through HTTPS.

---

## 4. Step-by-step Azure setup

## Step 1: Create the GitHub repository

If your project is not already in GitHub, create a repo and push the local code.

Example repo name:

```text
cloud-assignment-11
```

Then connect the repo to Azure deployment if using Static Web Apps or Azure App Service.

---

## Step 2: Create the frontend hosting resource

### Option A: Azure Static Web Apps (recommended for this project)

1. Go to Azure Portal.
2. Select Create a resource.
3. Search for Azure Static Web Apps.
4. Click Create.
5. Fill in:
   - Subscription
   - Resource group
   - Name: `spar-collection-web`
   - Region
   - Deployment source: GitHub
   - Repository: your GitHub repo
   - Branch: `main`
6. Choose the app type:
   - App location: `/`
   - API location: `api`
   - Output location: `/`
7. Review and create.

This will deploy the frontend and automatically wire up the API folder if your repo has an `api` directory.

### Option B: Azure App Service

Use this if you want a simpler server-hosted approach.

1. Create a Web App resource.
2. Choose Node.js or a containerized runtime.
3. Deploy your frontend.
4. Use Azure Functions separately for API logic.

For this assignment, Static Web Apps is the better fit based on the architecture.

---

## Step 3: Create the Azure Functions backend

In the same or a separate resource group, create an Azure Function App.

Example settings:

```text
Name: spar-collection-functions
Runtime: Node.js (or Python if preferred)
Plan: Consumption
Region: same region as frontend
```

This is where the backend logic should live:

- `GET /api/lists`
- `GET /api/lists/{listId}`
- `POST /api/lists/{listId}/items/{itemId}`
- `POST /api/sync`
- `POST /api/lists/{listId}/complete`
- `POST /api/payments`

Your current `api/collections/index.js` file is a good model for the payment-accepting endpoint, but in the actual Azure deployment, you will create a proper Azure Functions project with these endpoints.

---

## Step 4: Create Azure SQL Database

Create a database that stores:

- shopping lists
- list items
- collection operations
- payment transaction records

### Recommended resources

- Azure SQL Database
- Server with admin username and password
- Firewall rules enabling access from Azure Functions

### Example tables

```sql
ShoppingLists
ShoppingListItems
CollectionOperations
PaymentTransactions
```

Use the schema described in `architecture.md`.

### Important

Do not store database credentials in the frontend. Only the Azure Function app should access the database.

---

## Step 5: Create Azure Service Bus

Create a Service Bus namespace and two queues:

- `shopping-list-queue`
- `payment-queue`

### Queue purpose

- `shopping-list-queue`: receives incoming shopping lists from the customer system
- `payment-queue`: receives completed collections that need payment processing

### Why this matters

This matches the architecture requirement to keep collection work separate from the payment engine.

---

## Step 6: Add Azure Functions for queue processing

Create Azure Functions that trigger on the Service Bus queues.

### Function 1: List Processor

Trigger: Service Bus queue `shopping-list-queue`

Responsibilities:

- read shopping list message
- validate payload
- store list in Azure SQL
- mark the list as received/active
- log processing status

### Function 2: Payment Processor

Trigger: Service Bus queue `payment-queue`

Responsibilities:

- read completed collection message
- call payment engine endpoint
- update payment status in Azure SQL
- handle retries and failures

---

## Step 7: Connect the frontend to the backend API

Update the frontend API URL in the app.

Current local value:

```javascript
const PAYMENT_API_ENDPOINT = "http://localhost:3001/api/collections";
```

In Azure, replace this with your deployed Function URL, such as:

```javascript
const PAYMENT_API_ENDPOINT = "https://<your-function-app>.azurewebsites.net/api/collections";
```

Your frontend should not talk directly to Azure SQL or Service Bus.

---

## Step 8: Set up authentication with Microsoft Entra ID

Follow the architecture requirement to secure employee access.

1. Create or use an Entra ID app registration.
2. Configure authentication in Azure Static Web Apps or App Service.
3. Restrict access so only authorized employees can view collection lists.
4. Use access tokens for protected API calls.

This is required because the architecture says the app is employee-facing and must authenticate using Microsoft Entra ID.

---

## Step 9: Store secrets in Azure Key Vault

Create a Key Vault and add secrets such as:

- database connection string
- Service Bus connection string
- payment engine credentials
- API keys

Then connect the Function app to Key Vault so secrets are not hardcoded in source files.

---

## Step 10: Enable monitoring

Create Application Insights and connect it to:

- Azure Static Web Apps
- Azure Functions
- Azure SQL
- the overall app resource group

Track:

- API latency
- API failure rate
- queue processing time
- dead-letter messages
- payment failures
- database queries and errors

---

## Step 11: Add offline support in the frontend

Your current prototype is already close to the required architecture.

To make it production-ready, add:

- service worker caching
- IndexedDB storage
- queue of pending operations
- automatic sync when connection is restored
- idempotent operation IDs

This is required because architecture.md explicitly says offline operation is a core requirement.

---

## Step 12: Implement idempotency

Every collection operation must have a unique ID.

Example:

```json
{
  "operationId": "550e8400-e29b-41d4-a716-446655440000",
  "listId": "LIST-12345",
  "itemId": "ITEM-001",
  "operation": "COLLECTED",
  "status": "PENDING"
}
```

The backend must prevent the same operation from being processed twice.

This is a crucial reliability requirement.

---

## Step 13: Handle payment-asynchronous processing properly

When a collection is completed:

1. mark the shopping list as completed
2. create a payment message for the queue
3. let the payment processor call the payment engine asynchronously
4. log status in the database
5. allow retries if payment fails

Do not block the employee workflow on payment-engine availability.

---

## Step 14: Deployment checklist

Before you consider the app complete in Azure, verify:

- [ ] frontend deployed to Azure Static Web Apps
- [ ] Azure Functions deployed successfully
- [ ] API endpoints respond correctly
- [ ] Azure SQL database created and connected
- [ ] Service Bus queues created successfully
- [ ] queue-triggered functions working
- [ ] payment queue works asynchronously
- [ ] frontend posts collection JSON to backend
- [ ] backend validates and stores requests
- [ ] secrets stored in Key Vault
- [ ] Entra ID configured for employee auth
- [ ] Application Insights configured
- [ ] offline behavior tested locally
- [ ] synchronization retry flow tested

---

## 15. Minimum Azure resource plan

A minimal working implementation would include:

- 1 Azure Static Web App
- 1 Azure Function App
- 1 Azure Service Bus namespace with 2 queues
- 1 Azure SQL Database
- 1 Azure Key Vault
- 1 Application Insights instance

That is enough to support a basic case-study deployment matching the architecture.

---

## 16. Final deployment goal

The final system should behave like this:

1. Customer list arrives in Service Bus.
2. Azure Function stores it in SQL.
3. Tablet app loads the list and lets employees collect items.
4. Offline actions are stored locally until sync.
5. Complete collection sends a JSON payload to the API.
6. The API validates the request and writes the result.
7. A payment message is queued.
8. The payment processor sends the final request to the payment engine.
9. Monitoring logs success and failure states.

---

## 17. Recommended next steps for this project

Your immediate Azure actions should be:

1. Create the Azure Static Web App using GitHub repo.
2. Create the Azure Functions app.
3. Add the `api` directory logic for collection and payment endpoints.
4. Create the Service Bus namespace and queues.
5. Create the Azure SQL database and tables.
6. Connect Key Vault for secrets.
7. Add Application Insights.
8. Configure Microsoft Entra ID auth.
9. Connect the frontend API URL to the Azure Functions endpoint.
10. Test end-to-end collection completion and payment queue flow.

---

## 18. Summary

To achieve the architecture in Azure, the real work is not just frontend creation. You need to deploy:

- a secure tablet frontend,
- a backend API layer,
- a database,
- a message queue,
- a payment flow,
- and monitoring.

The frontend you built is the employee-facing interface. The rest of the Azure work converts that prototype into the full SPAR Collection Service described in the architecture document.
