(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  /** Built-in category names always present in the category select. */
  const BUILTIN_CATEGORIES = ['Food', 'Transport', 'Fun'];

  /** Maximum number of user-defined custom categories allowed. */
  const MAX_CUSTOM_CATEGORIES = 20;

  /** Maximum allowed transaction amount (inclusive). */
  const AMOUNT_MAX = 999_999_999.99;

  /**
   * localStorage key names. The `ebv_` prefix avoids collisions with other
   * apps that may share the same origin.
   */
  const LS_KEYS = {
    transactions: 'ebv_transactions',
    categories:   'ebv_custom_categories',
    sortOption:   'ebv_sort_option',
  };

  // ---------------------------------------------------------------------------
  // In-memory application state
  // ---------------------------------------------------------------------------

  /**
   * Single source of truth for the lifetime of the page.
   *
   * @type {{
   *   transactions: Array<{id:string, name:string, amount:number, category:string, timestamp:number}>,
   *   categories:   string[],
   *   sortOption:   'amount-desc'|'amount-asc'|'category-asc',
   *   activeView:   'list'|'monthly'
   * }}
   */
  const state = {
    transactions: [],           // Transaction[]
    categories:   [],           // custom category names only
    sortOption:   'amount-desc',
    activeView:   'list',       // 'list' | 'monthly'
  };

  // ---------------------------------------------------------------------------
  // UUID generator
  // ---------------------------------------------------------------------------

  /**
   * Generate a unique identifier string.
   * Prefers the native `crypto.randomUUID()` when available; falls back to a
   * Math.random + timestamp composite for older browsers (Requirement 9.4).
   *
   * @returns {string}
   */
  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback: base-36 random + base-36 timestamp
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // ---------------------------------------------------------------------------
  // DOM error helpers
  // ---------------------------------------------------------------------------

  /**
   * Show a named error element (remove its `hidden` attribute).
   * @param {string} id - The element ID to un-hide.
   */
  function showError(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = false;
  }

  // ---------------------------------------------------------------------------
  // Transaction schema validator
  // ---------------------------------------------------------------------------

  /**
   * Validate a parsed object against the Transaction schema.
   *
   * Required fields: id (string), name (string, 1–100 chars), amount (finite
   * positive number, ≤ 2 decimal places, ≤ AMOUNT_MAX), category (non-empty
   * string), timestamp (finite number).
   *
   * @param {unknown} obj
   * @returns {boolean}
   */
  function isValidTransaction(obj) {
    if (obj === null || typeof obj !== 'object') return false;

    const { id, name, amount, category, timestamp } = obj;

    if (typeof id !== 'string' || id.length === 0) return false;
    if (typeof name !== 'string' || name.length < 1 || name.length > 100) return false;
    if (typeof category !== 'string' || category.length === 0) return false;
    if (typeof timestamp !== 'number' || !isFinite(timestamp)) return false;

    // amount: finite, positive, ≤ AMOUNT_MAX, at most 2 decimal places
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) return false;
    if (amount > AMOUNT_MAX) return false;
    // Check decimal places: multiply by 100 and verify it rounds to an integer
    if (Math.round(amount * 100) !== amount * 100) return false;

    return true;
  }

  // ---------------------------------------------------------------------------
  // localStorage read helpers
  // ---------------------------------------------------------------------------

  /**
   * Load all persisted state from localStorage into the in-memory `state`
   * object.  Called once during `init()`.
   *
   * - Reads `ebv_transactions`, validates each record, discards invalid ones.
   *   Shows `#load-error` if the JSON is corrupt or any record is invalid.
   * - Reads `ebv_custom_categories`; on failure shows `#load-error`.
   * - Reads `ebv_sort_option`; silently defaults to `'amount-desc'` if the key
   *   is absent or unreadable (Requirement 8.5 — no error shown).
   *
   * Requirements: 5.1, 5.2, 5.3, 8.4, 8.5
   */
  function loadFromStorage() {
    // --- Transactions ---
    try {
      const raw = localStorage.getItem(LS_KEYS.transactions);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          // Top-level value is not an array — treat as corrupt
          showError('load-error');
          state.transactions = [];
        } else {
          let hadInvalid = false;
          state.transactions = parsed.filter(function (item) {
            if (isValidTransaction(item)) {
              return true;
            }
            hadInvalid = true;
            return false;
          });
          if (hadInvalid) {
            showError('load-error');
          }
        }
      }
      // If raw === null there is simply no saved data; leave state.transactions as [].
    } catch (e) {
      // JSON.parse failure or localStorage access error
      showError('load-error');
      state.transactions = [];
    }

    // --- Custom categories ---
    try {
      const raw = localStorage.getItem(LS_KEYS.categories);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Keep only non-empty strings
          state.categories = parsed.filter(function (c) {
            return typeof c === 'string' && c.length > 0;
          });
        } else {
          showError('load-error');
          state.categories = [];
        }
      }
    } catch (e) {
      showError('load-error');
      state.categories = [];
    }

    // --- Sort option (silent default on any failure — Requirement 8.5) ---
    try {
      const raw = localStorage.getItem(LS_KEYS.sortOption);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        const validOptions = ['amount-desc', 'amount-asc', 'category-asc'];
        if (validOptions.indexOf(parsed) !== -1) {
          state.sortOption = parsed;
        }
        // Unknown value: keep default 'amount-desc', no error shown
      }
      // null means key absent: keep default 'amount-desc', no error shown
    } catch (e) {
      // Any error: silently keep default 'amount-desc'
      state.sortOption = 'amount-desc';
    }
  }

  // ---------------------------------------------------------------------------
  // localStorage write helpers
  // ---------------------------------------------------------------------------

  /**
   * Persist `state.transactions` to localStorage.
   * Shows `#storage-error` on failure (quota exceeded, private mode, etc.).
   *
   * Requirements: 5.1, 8.4
   */
  function saveTransactions() {
    try {
      localStorage.setItem(LS_KEYS.transactions, JSON.stringify(state.transactions));
    } catch (e) {
      showError('storage-error');
    }
  }

  /**
   * Persist `state.categories` (custom categories only) to localStorage.
   * Shows `#category-storage-error` on failure.
   *
   * Requirements: 6.2, 6.7
   */
  function saveCategories() {
    try {
      localStorage.setItem(LS_KEYS.categories, JSON.stringify(state.categories));
    } catch (e) {
      showError('category-storage-error');
    }
  }

  /**
   * Persist `state.sortOption` to localStorage.
   * Shows `#storage-error` on failure.
   *
   * Requirements: 8.4
   */
  function saveSortOption() {
    try {
      localStorage.setItem(LS_KEYS.sortOption, JSON.stringify(state.sortOption));
    } catch (e) {
      showError('storage-error');
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  /**
   * Re-render the Balance Display based on the current state.
   *
   * - Sums all `state.transactions` amounts.
   * - Formats the result as `$N.NN` (always exactly two decimal places).
   * - Updates `#balance-amount` text content.
   * - Toggles the `.balance--negative` class on `#balance-display` when the
   *   total is strictly negative; removes it when zero or positive.
   * - Shows `$0.00` when the transaction list is empty.
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   */
  function renderBalance() {
    var total = state.transactions.reduce(function (sum, tx) {
      return sum + tx.amount;
    }, 0);

    var formatted = '$' + Math.abs(total).toFixed(2);
    if (total < 0) {
      formatted = '-$' + Math.abs(total).toFixed(2);
    }

    var amountEl = document.getElementById('balance-amount');
    var displayEl = document.getElementById('balance-display');

    if (amountEl) {
      amountEl.textContent = formatted;
    }

    if (displayEl) {
      if (total < 0) {
        displayEl.classList.add('balance--negative');
      } else {
        displayEl.classList.remove('balance--negative');
      }
    }
  }


  // ---------------------------------------------------------------------------
  // Sort helper
  // ---------------------------------------------------------------------------

  /**
   * Return a new array of transactions sorted according to `state.sortOption`.
   * Does NOT mutate `state.transactions`.
   *
   * Sort options:
   *   'amount-desc'  → amount descending; tiebreaker: timestamp descending
   *   'amount-asc'   → amount ascending;  tiebreaker: timestamp descending
   *   'category-asc' → category A→Z;      tiebreaker: timestamp descending
   *
   * Requirements: 8.1, 8.2
   *
   * @returns {Array<{id:string, name:string, amount:number, category:string, timestamp:number}>}
   */
  function getSortedTransactions() {
    var sorted = state.transactions.slice(); // shallow copy — no mutation

    sorted.sort(function (a, b) {
      var primary;

      if (state.sortOption === 'amount-desc') {
        primary = b.amount - a.amount;
      } else if (state.sortOption === 'amount-asc') {
        primary = a.amount - b.amount;
      } else {
        // 'category-asc'
        var catA = a.category.toLowerCase();
        var catB = b.category.toLowerCase();
        if (catA < catB) {
          primary = -1;
        } else if (catA > catB) {
          primary = 1;
        } else {
          primary = 0;
        }
      }

      // Tiebreaker: timestamp descending (most recent first)
      if (primary !== 0) {
        return primary;
      }
      return b.timestamp - a.timestamp;
    });

    return sorted;
  }

  // ---------------------------------------------------------------------------
  // Transaction List renderer
  // ---------------------------------------------------------------------------

  /**
   * Re-render `#transaction-list` from the current state.
   *
   * - Clears the list entirely on each call.
   * - If `state.transactions` is empty: inserts a single
   *   `<li class="tx-empty">No transactions recorded yet.</li>`.
   * - Otherwise: inserts one `<li class="transaction-item" data-id="…">` per
   *   transaction in the order returned by `getSortedTransactions()`.
   *
   * Each item contains:
   *   <span class="tx-name">   — item name
   *   <span class="tx-category"> — category
   *   <span class="tx-amount"> — amount formatted as $N.NN
   *   <button class="btn-delete" aria-label="Delete transaction">✕</button>
   *
   * Requirements: 2.1, 2.2, 2.5, 2.6
   */
  function renderTransactionList() {
    var list = document.getElementById('transaction-list');
    if (!list) {
      return;
    }

    // Clear existing items
    list.innerHTML = '';

    if (state.transactions.length === 0) {
      var emptyItem = document.createElement('li');
      emptyItem.className = 'tx-empty';
      emptyItem.textContent = 'No transactions recorded yet.';
      list.appendChild(emptyItem);
      return;
    }

    var sorted = getSortedTransactions();

    sorted.forEach(function (tx) {
      var li = document.createElement('li');
      li.className = 'transaction-item';
      li.setAttribute('data-id', tx.id);

      var nameSpan = document.createElement('span');
      nameSpan.className = 'tx-name';
      nameSpan.textContent = tx.name;

      var categorySpan = document.createElement('span');
      categorySpan.className = 'tx-category';
      categorySpan.textContent = tx.category;

      var amountSpan = document.createElement('span');
      amountSpan.className = 'tx-amount';
      amountSpan.textContent = '$' + tx.amount.toFixed(2);

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.setAttribute('aria-label', 'Delete transaction');
      deleteBtn.textContent = '✕';

      li.appendChild(nameSpan);
      li.appendChild(categorySpan);
      li.appendChild(amountSpan);
      li.appendChild(deleteBtn);

      list.appendChild(li);
    });
  }

  // ---------------------------------------------------------------------------
  // Delete transaction
  // ---------------------------------------------------------------------------

  /**
   * Remove a transaction by id from `state.transactions`, persist the change,
   * and re-render.
   *
   * On `localStorage` failure:
   *   1. Revert the in-memory removal (restore the original array).
   *   2. Re-render the transaction list so the row reappears.
   *   3. Show `#delete-error`.
   *
   * Requirements: 2.3, 2.4
   *
   * @param {string} id - UUID of the transaction to remove.
   */
  function deleteTransaction(id) {
    // Find the transaction and remember its index for a potential revert
    var index = -1;
    var removed = null;

    for (var i = 0; i < state.transactions.length; i++) {
      if (state.transactions[i].id === id) {
        index = i;
        removed = state.transactions[i];
        break;
      }
    }

    if (index === -1) {
      // ID not found — nothing to do
      return;
    }

    // Remove from in-memory state
    state.transactions.splice(index, 1);

    // Attempt to persist; revert on failure
    try {
      saveTransactions();
    } catch (e) {
      // Revert: restore the removed transaction at its original position
      state.transactions.splice(index, 0, removed);
      renderTransactionList();
      showError('delete-error');
      return;
    }

    // Success — re-render all dependent components
    render();
  }

  // ---------------------------------------------------------------------------
  // Pie Chart renderer
  // ---------------------------------------------------------------------------

  /**
   * Closure variable holding the active Chart.js instance (or null when no
   * chart has been created yet, or after it has been destroyed).
   * @type {Chart|null}
   */
  var chartInstance = null;

  /**
   * Re-render the spending pie chart based on the current state.
   *
   * - If `state.transactions` is empty: destroy any existing chart, show
   *   `#chart-empty`, hide the canvas element, and return.
   * - Otherwise: aggregate positive-amount transactions by category into
   *   `labels[]` and `data[]` arrays. If a chart instance already exists,
   *   update its data in-place and call `chartInstance.update()`. If no
   *   instance exists, create a new `Chart` on `#spending-chart`.
   *
   * Each pie segment tooltip/label shows the category name and its share of
   * the total positive spending, rounded to one decimal place (Req 4.2).
   *
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 9.4
   */
  function renderChart() {
    var canvas = document.getElementById('spending-chart');
    var emptyMsg = document.getElementById('chart-empty');

    if (!canvas || !emptyMsg) {
      return;
    }

    // Filter to only positive-amount transactions (Requirement 4.1)
    var positiveTransactions = state.transactions.filter(function (tx) {
      return tx.amount > 0;
    });

    if (positiveTransactions.length === 0) {
      // Destroy existing chart if present
      if (chartInstance !== null) {
        chartInstance.destroy();
        chartInstance = null;
      }
      // Show empty state, hide canvas
      emptyMsg.hidden = false;
      canvas.hidden = true;
      return;
    }

    // Aggregate amounts by category
    var categoryTotals = {};
    positiveTransactions.forEach(function (tx) {
      if (categoryTotals[tx.category] === undefined) {
        categoryTotals[tx.category] = 0;
      }
      categoryTotals[tx.category] += tx.amount;
    });

    var labels = Object.keys(categoryTotals);
    var data = labels.map(function (cat) { return categoryTotals[cat]; });

    // Compute total for percentage labels (Requirement 4.2)
    var total = data.reduce(function (sum, v) { return sum + v; }, 0);

    // A fixed palette that cycles if there are more categories than colours
    var PALETTE = [
      '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
      '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16'
    ];
    var backgroundColors = labels.map(function (_, i) {
      return PALETTE[i % PALETTE.length];
    });

    // Hide empty state, show canvas
    emptyMsg.hidden = true;
    canvas.hidden = false;

    if (chartInstance !== null) {
      // Update existing chart in-place (avoids flicker)
      chartInstance.data.labels = labels;
      chartInstance.data.datasets[0].data = data;
      chartInstance.data.datasets[0].backgroundColor = backgroundColors;
      chartInstance.update();
    } else {
      // Guard: Chart.js may not be loaded (CDN failure)
      if (typeof Chart === 'undefined') {
        return;
      }

      chartInstance = new Chart(canvas, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: backgroundColors,
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                font: { size: 13 },
                padding: 16
              }
            },
            tooltip: {
              callbacks: {
                /**
                 * Show "CategoryName — $X.XX (Y.Z%)" in the tooltip.
                 * Requirement 4.2: percentage rounded to 1 decimal place.
                 */
                label: function (context) {
                  var value = context.parsed;
                  var pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                  return ' ' + context.label + ' — $' + value.toFixed(2) + ' (' + pct + '%)';
                }
              }
            },
            /**
             * Datalabels plugin is not loaded, so we rely on the legend and
             * tooltip for category + percentage display (Requirement 4.2).
             * If the datalabels plugin is later added, configure it here.
             */
          }
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Monthly Summary helpers
  // ---------------------------------------------------------------------------

  /**
   * Month names used to build the "Month YYYY" label.
   * @type {string[]}
   */
  var MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  /**
   * Group transactions by calendar month, sum amounts per group, and return
   * the results sorted descending by year then month (most recent first).
   *
   * Each entry in the returned array has the shape:
   *   { label: "January 2025", year: 2025, month: 0, total: 520.00 }
   *
   * Where `month` is a 0-based index (0 = January … 11 = December).
   *
   * Requirements: 7.2
   *
   * @param {Array<{timestamp: number, amount: number}>} transactions
   * @returns {Array<{label: string, year: number, month: number, total: number}>}
   */
  function getMonthlyTotals(transactions) {
    // Map of "YYYY-MM" key → accumulator object
    var groups = {};

    transactions.forEach(function (tx) {
      var date  = new Date(tx.timestamp);
      var year  = date.getFullYear();
      var month = date.getMonth(); // 0-based
      var key   = year + '-' + month;

      if (groups[key] === undefined) {
        groups[key] = {
          label: MONTH_NAMES[month] + ' ' + year,
          year:  year,
          month: month,
          total: 0
        };
      }
      groups[key].total += tx.amount;
    });

    // Convert to array and sort descending by year, then by month
    var result = Object.keys(groups).map(function (key) {
      return groups[key];
    });

    result.sort(function (a, b) {
      if (b.year !== a.year) {
        return b.year - a.year; // most recent year first
      }
      return b.month - a.month; // most recent month first within the same year
    });

    return result;
  }

  /**
   * Re-render `#monthly-list` from the current state.
   *
   * - If `state.transactions` is empty: hide `#monthly-list`, show
   *   `#monthly-empty` (Requirement 7.4).
   * - Otherwise: hide `#monthly-empty`, clear `#monthly-list`, and append one
   *   `<li class="month-item">` per group returned by `getMonthlyTotals()`.
   *   Adds the `month-item--negative` modifier class when the group total is
   *   strictly negative (Requirement 7.5).
   *
   * Each `<li>` contains two `<span>` elements:
   *   first  — the "Month YYYY" label
   *   second — the formatted total as `$N.NN`
   *
   * Requirements: 7.2, 7.4, 7.5
   */
  function renderMonthlySummary() {
    var list     = document.getElementById('monthly-list');
    var emptyMsg = document.getElementById('monthly-empty');

    if (!list || !emptyMsg) {
      return;
    }

    if (state.transactions.length === 0) {
      // Empty state (Requirement 7.4)
      list.hidden    = true;
      emptyMsg.hidden = false;
      return;
    }

    // Has transactions — show list, hide empty message
    list.hidden    = false;
    emptyMsg.hidden = true;

    // Clear and rebuild
    list.innerHTML = '';

    var totals = getMonthlyTotals(state.transactions);

    totals.forEach(function (entry) {
      var li = document.createElement('li');
      li.className = 'month-item';
      if (entry.total < 0) {
        li.className += ' month-item--negative'; // Requirement 7.5
      }

      var labelSpan = document.createElement('span');
      labelSpan.textContent = entry.label;

      var totalSpan = document.createElement('span');
      // Format as $N.NN; for negative totals show -$N.NN (Requirement 7.2)
      var absTotal = Math.abs(entry.total);
      totalSpan.textContent = (entry.total < 0 ? '-$' : '$') + absTotal.toFixed(2);

      li.appendChild(labelSpan);
      li.appendChild(totalSpan);
      list.appendChild(li);
    });
  }

  // ---------------------------------------------------------------------------
  // Central render function
  // ---------------------------------------------------------------------------

  /**
   * Re-draw every UI component from the current in-memory `state`.
   *
   * Calls each renderer in a fixed order so dependencies are always
   * satisfied (e.g. the balance is recalculated before the list is painted).
   *
   * Requirements: 3.2, 3.3, 4.3, 7.3, 8.2, 8.3
   */
  function render() {
    renderBalance();
    renderSortControl();
    renderTransactionList();
    renderChart();
    renderMonthlySummary();
    renderViewToggle();
    renderCategorySelect();
  }

  // ---------------------------------------------------------------------------
  // Add Transaction
  // ---------------------------------------------------------------------------

  /**
   * Create a new Transaction from validated field values, push it to
   * `state.transactions`, persist, re-render all components, and reset the
   * form fields to their initial values.
   *
   * Requirements: 1.3, 1.6
   *
   * @param {{ name: string, amount: number, category: string }} fields
   */
  function addTransaction(fields) {
    var transaction = {
      id:        generateId(),
      name:      fields.name,
      amount:    fields.amount,
      category:  fields.category,
      timestamp: Date.now(),
    };

    state.transactions.push(transaction);
    saveTransactions();

    // Re-draw every dependent UI component (balance, list, chart, etc.)
    render();

    // Reset form fields to their initial values (Requirement 1.6)
    var nameInput     = document.getElementById('input-name');
    var amountInput   = document.getElementById('input-amount');
    var categoryInput = document.getElementById('input-category');

    if (nameInput)     nameInput.value     = '';
    if (amountInput)   amountInput.value   = '';
    if (categoryInput) categoryInput.value = 'Food';
  }

  // ---------------------------------------------------------------------------
  // Form submit handler (attached by init())
  // ---------------------------------------------------------------------------

  /**
   * Handle the submit event on `#transaction-form`.
   *
   * Validation order (Requirements 1.4, 1.5):
   *   1. Name: trim; must be non-empty; must be ≤ 100 characters.
   *   2. Amount: must be non-empty; must parse as a finite number; must be
   *      > 0; must be ≤ AMOUNT_MAX; must have at most 2 decimal places.
   *   3. Category: trimmed value must be non-empty.
   *
   * On any failure: set `#form-error` text and return without adding a
   * transaction (Requirements 1.4, 1.5).
   *
   * On success: clear `#form-error` and call `addTransaction()`.
   *
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
   */
  function handleTransactionFormSubmit(event) {
    event.preventDefault();

    var formError     = document.getElementById('form-error');
    var nameInput     = document.getElementById('input-name');
    var amountInput   = document.getElementById('input-amount');
    var categoryInput = document.getElementById('input-category');

    var rawName     = nameInput     ? nameInput.value     : '';
    var rawAmount   = amountInput   ? amountInput.value   : '';
    var rawCategory = categoryInput ? categoryInput.value : '';

    // --- Name validation (Requirements 1.4) ---
    var trimmedName = rawName.trim();
    if (trimmedName.length === 0) {
      if (formError) formError.textContent = 'Item name is required.';
      return;
    }
    if (trimmedName.length > 100) {
      if (formError) formError.textContent = 'Item name must be 100 characters or fewer.';
      return;
    }

    // --- Amount validation (Requirements 1.5) ---
    if (rawAmount.trim() === '') {
      if (formError) formError.textContent = 'Amount is required.';
      return;
    }
    var parsedAmount = parseFloat(rawAmount);
    if (isNaN(parsedAmount) || !isFinite(parsedAmount)) {
      if (formError) formError.textContent = 'Amount must be a valid number.';
      return;
    }
    if (parsedAmount <= 0) {
      if (formError) formError.textContent = 'Amount must be greater than zero.';
      return;
    }
    if (parsedAmount > AMOUNT_MAX) {
      if (formError) formError.textContent = 'Amount must not exceed 999,999,999.99.';
      return;
    }
    // Check at most 2 decimal places: multiply by 100 and verify integer
    if (Math.round(parsedAmount * 100) !== parsedAmount * 100) {
      if (formError) formError.textContent = 'Amount must have at most 2 decimal places.';
      return;
    }

    // --- Category validation (Requirement 1.4) ---
    var trimmedCategory = rawCategory.trim();
    if (trimmedCategory.length === 0) {
      if (formError) formError.textContent = 'Please select a category.';
      return;
    }

    // --- All valid: clear error and add transaction ---
    if (formError) formError.textContent = '';

    addTransaction({
      name:     trimmedName,
      amount:   parsedAmount,
      category: trimmedCategory,
    });
  }

  // ---------------------------------------------------------------------------
  // Sort Control renderer
  // ---------------------------------------------------------------------------

  /**
   * Sync the `#sort-control` select element's displayed value with
   * `state.sortOption`.
   *
   * Called as part of the central `render()` cycle so the control always
   * reflects the current sort state (including the value restored from
   * localStorage on page load).
   *
   * Requirements: 8.4
   */
  function renderSortControl() {
    var sortControl = document.getElementById('sort-control');
    if (sortControl) {
      sortControl.value = state.sortOption;
    }
  }

  // ---------------------------------------------------------------------------
  // Delete and sort event handlers (attached by init())
  // ---------------------------------------------------------------------------

  /**
   * Handle delegated clicks on `.btn-delete` buttons inside `#transaction-list`.
   * Requirements: 2.3, 2.4
   */
  function handleTransactionListClick(event) {
    var target = event.target;
    if (target && target.classList.contains('btn-delete')) {
      var li = target.closest('li.transaction-item');
      if (li) {
        var id = li.getAttribute('data-id');
        if (id) {
          deleteTransaction(id);
        }
      }
    }
  }

  /**
   * Handle changes to the `#sort-control` select.
   * Updates `state.sortOption`, persists it, and re-renders.
   * Requirements: 8.1, 8.2, 8.3, 8.4
   */
  function handleSortControlChange() {
    var sortControl = document.getElementById('sort-control');
    if (!sortControl) return;
    var validOptions = ['amount-desc', 'amount-asc', 'category-asc'];
    var selected = sortControl.value;
    if (validOptions.indexOf(selected) !== -1) {
      state.sortOption = selected;
      saveSortOption();
      render();
    }
  }

  // ---------------------------------------------------------------------------
  // View Toggle renderer and listener
  // ---------------------------------------------------------------------------

  /**
   * Sync the visibility of `#transaction-list` and `#monthly-summary` with
   * `state.activeView`, and update the `#btn-toggle-view` button label.
   *
   * - When `state.activeView === 'list'`:
   *     • Show `#transaction-list` (remove `hidden`)
   *     • Hide `#monthly-summary` (set `hidden`)
   *     • Set button text to "View Monthly Summary"
   * - When `state.activeView === 'monthly'`:
   *     • Hide `#transaction-list` (set `hidden`)
   *     • Show `#monthly-summary` (remove `hidden`)
   *     • Set button text to "View Transaction List"
   *
   * Requirements: 7.1, 7.3
   */
  function renderViewToggle() {
    var txList       = document.getElementById('transaction-list');
    var monthlySummary = document.getElementById('monthly-summary');
    var toggleBtn    = document.getElementById('btn-toggle-view');

    if (!txList || !monthlySummary || !toggleBtn) {
      return;
    }

    if (state.activeView === 'list') {
      txList.hidden         = false;
      monthlySummary.hidden = true;
      toggleBtn.textContent = 'View Monthly Summary';
    } else {
      txList.hidden         = true;
      monthlySummary.hidden = false;
      toggleBtn.textContent = 'View Transaction List';
    }
  }

  /**
   * Handle clicks on `#btn-toggle-view`.
   * Toggles `state.activeView` and re-renders.
   * Requirements: 7.1, 7.3
   */
  function handleViewToggleClick() {
    state.activeView = (state.activeView === 'list') ? 'monthly' : 'list';
    render();
  }

  // ---------------------------------------------------------------------------
  // Custom Category — validation, renderer, and form handler
  // ---------------------------------------------------------------------------

  /**
   * Validate a proposed custom category name against the current state.
   *
   * Checks (in order):
   *   1. Non-empty after trimming (Requirement 6.3).
   *   2. Length ≤ 50 characters (Requirement 6.2).
   *   3. Case-insensitive uniqueness against built-in AND custom categories
   *      (Requirement 6.4).
   *   4. Total custom category count is below MAX_CUSTOM_CATEGORIES (Req 6.5).
   *
   * @param {string} name  - The raw category name entered by the user.
   * @param {{ categories: string[] }} appState - The current app state.
   * @returns {string|null} An error message string, or `null` when valid.
   */
  function validateCategoryName(name, appState) {
    var trimmed = name.trim();

    if (trimmed.length === 0) {
      return 'Category name is required.';
    }

    if (trimmed.length > 50) {
      return 'Category name must be 50 characters or fewer.';
    }

    var lowerTrimmed = trimmed.toLowerCase();

    // Check against built-in categories (case-insensitive)
    for (var b = 0; b < BUILTIN_CATEGORIES.length; b++) {
      if (BUILTIN_CATEGORIES[b].toLowerCase() === lowerTrimmed) {
        return 'That category already exists.';
      }
    }

    // Check against existing custom categories (case-insensitive)
    for (var c = 0; c < appState.categories.length; c++) {
      if (appState.categories[c].toLowerCase() === lowerTrimmed) {
        return 'That category already exists.';
      }
    }

    // Check custom category limit
    if (appState.categories.length >= MAX_CUSTOM_CATEGORIES) {
      return 'You have reached the maximum of ' + MAX_CUSTOM_CATEGORIES + ' custom categories.';
    }

    return null;
  }

  /**
   * Repopulate the `#input-category` select element with all categories:
   * the three built-in options first, followed by any custom categories stored
   * in `state.categories`.
   *
   * Called after a custom category is successfully added and during page init
   * (via the guard in `render()`) so the select always reflects current state.
   *
   * Requirements: 6.2, 6.6
   */
  function renderCategorySelect() {
    var select = document.getElementById('input-category');
    if (!select) {
      return;
    }

    // Remember the currently selected value so we can restore it after repopulating
    var currentValue = select.value;

    // Clear and repopulate
    select.innerHTML = '';

    // Built-in categories first
    BUILTIN_CATEGORIES.forEach(function (cat) {
      var option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      select.appendChild(option);
    });

    // Custom categories
    state.categories.forEach(function (cat) {
      var option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      select.appendChild(option);
    });

    // Restore the previous selection if it still exists; otherwise default to Food
    var matchExists = false;
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value === currentValue) {
        matchExists = true;
        break;
      }
    }
    select.value = matchExists ? currentValue : 'Food';
  }

  /**
   * Handle the submit event on `#category-form`.
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7
   */
  function handleCategoryFormSubmit(event) {
    event.preventDefault();

    var categoryError = document.getElementById('category-error');
    var nameInput     = document.getElementById('input-category-name');
    var rawName       = nameInput ? nameInput.value : '';

    var errorMsg = validateCategoryName(rawName, state);

    if (errorMsg !== null) {
      if (categoryError) categoryError.textContent = errorMsg;
      return;
    }

    // Valid — add the trimmed name to state
    var trimmedName = rawName.trim();
    state.categories.push(trimmedName);

    // Persist to localStorage (shows #category-storage-error on failure)
    saveCategories();

    // Update the category select in the transaction form
    renderCategorySelect();

    // Clear input and error
    if (nameInput)     nameInput.value = '';
    if (categoryError) categoryError.textContent = '';
  }

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  /**
   * Bootstrap the application.
   *
   * Execution order:
   *   1. `loadFromStorage()` — populate `state` from localStorage.
   *   2. `renderCategorySelect()` — restore custom categories into `#input-category`
   *      before the first full render (Requirement 6.6).
   *   3. `render()` — paint every UI component from the restored state.
   *   4. Attach all DOM event listeners in one place so there is exactly one
   *      handler per interaction, and the event wiring is easy to audit.
   *
   * Requirements: 5.1, 5.2, 5.3, 6.6, 8.4, 9.1, 9.4
   */
  function init() {
    // 1. Restore persisted state
    loadFromStorage();

    // 2. Populate category select with any saved custom categories
    renderCategorySelect();

    // 3. First full render
    render();

    // 4. Event listeners ---------------------------------------------------

    // Transaction form submit
    var transactionForm = document.getElementById('transaction-form');
    if (transactionForm) {
      transactionForm.addEventListener('submit', handleTransactionFormSubmit);
    }

    // Delegated delete clicks on the transaction list (Requirement 2.3)
    var transactionList = document.getElementById('transaction-list');
    if (transactionList) {
      transactionList.addEventListener('click', handleTransactionListClick);
    }

    // Sort control change (Requirements 8.1–8.4)
    var sortControl = document.getElementById('sort-control');
    if (sortControl) {
      sortControl.addEventListener('change', handleSortControlChange);
    }

    // Category form submit (Requirements 6.1–6.7)
    var categoryForm = document.getElementById('category-form');
    if (categoryForm) {
      categoryForm.addEventListener('submit', handleCategoryFormSubmit);
    }

    // View toggle click (Requirements 7.1, 7.3)
    var toggleBtn = document.getElementById('btn-toggle-view');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', handleViewToggleClick);
    }
  }

  // Single DOMContentLoaded listener — the sole entry point for the app.
  document.addEventListener('DOMContentLoaded', init);

})();
