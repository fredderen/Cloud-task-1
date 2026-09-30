const PAYMENT_API_ENDPOINT = "http://localhost:3001/api/collections";

const appState = {
  isOnline: true,
  selectedListId: "LIST-1042",
  lists: [
    {
      id: "LIST-1042",
      customer: "Mr. Larsen",
      eta: "18 min",
      status: "In progress",
      items: [
        { id: "A1", name: "Whole Milk", qty: 2, category: "Dairy", status: "pending" },
        { id: "A2", name: "Brown Bread", qty: 1, category: "Bakery", status: "pending" },
        { id: "A3", name: "Free Range Eggs", qty: 1, category: "Fresh", status: "pending" },
        { id: "A4", name: "Apples", qty: 4, category: "Fruit", status: "pending" },
        { id: "A5", name: "Pasta", qty: 3, category: "Pantry", status: "pending" },
        { id: "A6", name: "Tomato Sauce", qty: 1, category: "Pantry", status: "pending" },
        { id: "A7", name: "Baby Spinach", qty: 2, category: "Fresh", status: "pending" },
        { id: "A8", name: "Laundry Detergent", qty: 1, category: "Household", status: "pending" }
      ]
    },
    {
      id: "LIST-1097",
      customer: "The Patel Family",
      eta: "26 min",
      status: "Queued",
      items: [
        { id: "B1", name: "Chicken Breast", qty: 2, category: "Meat", status: "pending" },
        { id: "B2", name: "Rice", qty: 2, category: "Pantry", status: "pending" },
        { id: "B3", name: "Orange Juice", qty: 2, category: "Drinks", status: "pending" },
        { id: "B4", name: "Cucumber", qty: 3, category: "Fresh", status: "pending" }
      ]
    },
    {
      id: "LIST-1193",
      customer: "Emma J.",
      eta: "32 min",
      status: "Queued",
      items: [
        { id: "C1", name: "Shampoo", qty: 1, category: "Beauty", status: "pending" },
        { id: "C2", name: "Toothpaste", qty: 1, category: "Health", status: "pending" },
        { id: "C3", name: "Almond Milk", qty: 2, category: "Dairy", status: "pending" },
        { id: "C4", name: "Granola", qty: 1, category: "Bakery", status: "pending" },
        { id: "C5", name: "Bananas", qty: 4, category: "Fruit", status: "pending" }
      ]
    }
  ]
};

const listOverviewEl = document.getElementById("listOverview");
const itemTableBodyEl = document.getElementById("itemTableBody");
const connectionBadgeEl = document.getElementById("connectionBadge");
const syncBadgeEl = document.getElementById("syncBadge");
const offlineBannerEl = document.getElementById("offlineBanner");
const activeListTitleEl = document.getElementById("activeListTitle");
const listSubheadingEl = document.getElementById("listSubheading");
const listCountBadgeEl = document.getElementById("listCountBadge");
const metricTotalEl = document.getElementById("metricTotal");
const metricCollectedEl = document.getElementById("metricCollected");
const metricUnavailableEl = document.getElementById("metricUnavailable");
const metricPendingSyncEl = document.getElementById("metricPendingSync");
const progressBarEl = document.getElementById("progressBar");
const progressPercentEl = document.getElementById("progressPercent");
const toggleConnectionBtn = document.getElementById("toggleConnectionBtn");
const completeCollectionBtn = document.getElementById("completeCollectionBtn");

function getSelectedList() {
  return appState.lists.find((list) => list.id === appState.selectedListId) || appState.lists[0];
}

function computeMetrics(list) {
  const total = list.items.length;
  const collected = list.items.filter((item) => item.status === "collected").length;
  const unavailable = list.items.filter((item) => item.status === "unavailable").length;
  const pendingSync = list.items.filter((item) => item.status !== "pending").length;

  return { total, collected, unavailable, pendingSync };
}

function renderListOverview() {
  listOverviewEl.innerHTML = "";
  listCountBadgeEl.textContent = String(appState.lists.length);

  appState.lists.forEach((list) => {
    const itemCount = list.items.length;
    const selected = list.id === appState.selectedListId;
    const collectedCount = list.items.filter((item) => item.status === "collected").length;

    const card = document.createElement("button");
    card.type = "button";
    card.className = `list-card ${selected ? "active" : ""}`;
    card.innerHTML = `
      <div class="list-card-header">
        <h4>${list.customer}</h4>
        <span class="tag">${list.status}</span>
      </div>
      <div class="meta">
        <span>${itemCount} items</span>
        <span>${collectedCount} collected</span>
      </div>
      <div class="meta">
        <span>ETA</span>
        <strong>${list.eta}</strong>
      </div>
    `;

    card.addEventListener("click", () => {
      appState.selectedListId = list.id;
      render();
    });

    listOverviewEl.appendChild(card);
  });
}

function getStatusLabel(status) {
  switch (status) {
    case "collected":
      return "Collected";
    case "unavailable":
      return "Unavailable";
    default:
      return "Pending";
  }
}

function renderItems() {
  const list = getSelectedList();
  itemTableBodyEl.innerHTML = "";

  list.items.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="item-name">
          <strong>${item.name}</strong>
          <small>SKU ${item.id}</small>
        </div>
      </td>
      <td class="item-qty">${item.qty}</td>
      <td><span class="category-tag">${item.category}</span></td>
      <td><span class="status-badge ${item.status}">${getStatusLabel(item.status)}</span></td>
      <td>
        <div class="table-actions">
          <button class="item-action primary" data-action="collected" data-id="${item.id}" type="button">Collected</button>
          <button class="item-action danger" data-action="unavailable" data-id="${item.id}" type="button">Unavailable</button>
        </div>
      </td>
    `;

    itemTableBodyEl.appendChild(row);
  });

  itemTableBodyEl.querySelectorAll(".item-action").forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = button.dataset.id;
      const action = button.dataset.action;
      const list = getSelectedList();
      const item = list.items.find((entry) => entry.id === itemId);
      if (item) {
        item.status = action;
        render();
      }
    });
  });
}

function renderSummary() {
  const list = getSelectedList();
  const metrics = computeMetrics(list);

  activeListTitleEl.textContent = `${list.customer} · ${list.eta}`;
  listSubheadingEl.textContent = `${list.customer}'s shopping list`;

  metricTotalEl.textContent = String(metrics.total);
  metricCollectedEl.textContent = String(metrics.collected);
  metricUnavailableEl.textContent = String(metrics.unavailable);
  metricPendingSyncEl.textContent = String(metrics.pendingSync);

  const progress = metrics.total === 0 ? 0 : Math.round((metrics.collected / metrics.total) * 100);
  progressBarEl.style.width = `${progress}%`;
  progressPercentEl.textContent = `${progress}%`;
}

function renderConnectionState() {
  if (appState.isOnline) {
    connectionBadgeEl.textContent = "Online";
    connectionBadgeEl.className = "status-pill online";
    offlineBannerEl.classList.add("hidden");
    toggleConnectionBtn.textContent = "Set offline";
    syncBadgeEl.textContent = "Synced";
    syncBadgeEl.className = "status-pill synced";
  } else {
    connectionBadgeEl.textContent = "Offline";
    connectionBadgeEl.className = "status-pill offline";
    offlineBannerEl.classList.remove("hidden");
    toggleConnectionBtn.textContent = "Set online";
    syncBadgeEl.textContent = "Pending sync";
    syncBadgeEl.className = "status-pill pending";
  }
}

function buildPaymentPayload(list) {
  const submittedAt = new Date().toISOString();
  const items = list.items.map((item) => ({
    itemId: item.id,
    productName: item.name,
    productCategory: item.category,
    quantity: item.qty,
    status: item.status,
    recordedAt: submittedAt
  }));

  const collectedCount = items.filter((item) => item.status === "collected").length;
  const unavailableCount = items.filter((item) => item.status === "unavailable").length;

  return {
    eventType: "collection.completed",
    version: 1,
    correlationId:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `collection-${Date.now()}`,
    listId: list.id,
    customerName: list.customer,
    submittedAt,
    status: "COMPLETED",
    summary: {
      totalItems: items.length,
      collectedCount,
      unavailableCount,
      completionPercent: Math.round((collectedCount / Math.max(items.length, 1)) * 100)
    },
    items
  };
}

async function sendCompletedCollectionToPaymentEngine(list) {
  const payload = buildPaymentPayload(list);

  const response = await fetch(PAYMENT_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Payment API request failed (${response.status}): ${errorText}`);
  }

  try {
    return await response.json();
  } catch (error) {
    return { accepted: true, message: "Payment accepted" };
  }
}

function render() {
  renderListOverview();
  renderSummary();
  renderItems();
  renderConnectionState();
}

toggleConnectionBtn.addEventListener("click", () => {
  appState.isOnline = !appState.isOnline;
  renderConnectionState();
});

completeCollectionBtn.addEventListener("click", async () => {
  const list = getSelectedList();

  if (!list.items.length) {
    return;
  }

  syncBadgeEl.textContent = "Sending to payment";
  syncBadgeEl.className = "status-pill pending";
  completeCollectionBtn.disabled = true;
  completeCollectionBtn.textContent = "Sending...";

  try {
    await sendCompletedCollectionToPaymentEngine(list);

    list.status = "Sent to payment";
    const activeList = appState.lists.find((entry) => entry.id === list.id);
    if (activeList) {
      activeList.status = "Sent to payment";
    }

    syncBadgeEl.textContent = "Payment sent";
    syncBadgeEl.className = "status-pill synced";
    completeCollectionBtn.textContent = "Completed";
    renderListOverview();
  } catch (error) {
    console.error("Payment submission failed:", error);
    syncBadgeEl.textContent = "Payment failed";
    syncBadgeEl.className = "status-pill pending";
    completeCollectionBtn.textContent = "Retry send";
  } finally {
    completeCollectionBtn.disabled = false;
  }
});

render();
