# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a zero-dependency, single-page expense tracker as three files (`index.html`, `css/style.css`, `js/app.js`) using plain HTML, CSS, and Vanilla JavaScript. All logic lives inside a single IIFE in `js/app.js`. A central `render()` function redraws every UI component on every state change. `localStorage` is the sole persistence layer.

## Tasks

- [x] 1. Scaffold HTML structure (`index.html`)
  - [x] 1.1 Create `index.html` at the project root with the complete semantic markup
    - Add `<head>` with charset, viewport meta, title, and `<link>` to `css/style.css`
    - Add `<script>` tag loading Chart.js 4 UMD from jsDelivr CDN with an `onerror` handler attribute
    - Add `<script src="js/app.js" defer></script>`
    - Add `#balance-display` section containing `#balance-amount`
    - Add `#transaction-form` with `#input-name`, `#input-amount`, `#input-category` select (built-in options: Food, Transport, Fun), `#btn-add`, and `#form-error`
    - Add `#sort-control` select with the three sort options (amount-desc, amount-asc, category-asc)
    - Add `#btn-toggle-view` button
    - Add `<ul id="transaction-list" aria-label="Transactions">`
    - Add `#monthly-summary` div (hidden) containing `<ul id="monthly-list">` and `#monthly-empty`
    - Add `#chart-container` with `<canvas id="spending-chart" aria-label="Spending by category">` and `#chart-empty`
    - Add `#category-form` with `#input-category-name`, submit button, and `#category-error`
    - Add all named error containers: `#storage-error`, `#load-error`, `#delete-error`, `#category-storage-error`; all initially `hidden`
    - Ensure every interactive control has an `aria-label` or associated `<label for>`
    - _Requirements: 9.1, 1.1, 2.1, 3.1, 4.1, 6.1, 7.1_

- [x] 2. Write CSS (`css/style.css`)
  - [x] 2.1 Implement layout, typography, and component styles
    - Base reset and typography; body min-width 320 px; fluid container
    - Card/section styling for form, balance, chart, and list areas
    - `#balance-display` always visible without scrolling (sticky or top-of-flow); `.balance--negative` rule applies a visually distinct colour
    - `#transaction-list` with `overflow-y: auto` and a max-height for scrollability
    - `.transaction-item` layout: name, category, amount, delete button in a row
    - `.tx-empty` and `#monthly-empty` empty-state text styles
    - `.month-item` layout; `.month-item--negative` rule applies a visually distinct colour
    - `#chart-container` sizing so the canvas renders clearly
    - Hidden utility: `[hidden] { display: none !important; }`
    - Responsive breakpoints ensuring usability at 320 px, 768 px, and wider
    - _Requirements: 2.2, 3.5, 3.6, 7.5, 9.2_

- [x] 3. Bootstrap `js/app.js` — IIFE shell, constants, and state
  - [x] 3.1 Create `js/app.js` with the top-level IIFE and core constants
    - Wrap everything in `(function () { 'use strict'; … })();`
    - Declare `BUILTIN_CATEGORIES`, `MAX_CUSTOM_CATEGORIES`, `AMOUNT_MAX`, and `LS_KEYS` constants
    - Declare the in-memory `state` object: `{ transactions: [], categories: [], sortOption: 'amount-desc', activeView: 'list' }`
    - Add UUID generator with `crypto.randomUUID` / `Math.random` fallback
    - _Requirements: 9.1, 9.4_

- [x] 4. Implement `localStorage` read/write helpers
  - [x] 4.1 Write `loadFromStorage()` and `saveToStorage()` utility functions
    - `loadFromStorage()`: read and JSON-parse each of the three `ebv_*` keys inside `try/catch`; validate each parsed transaction object (required fields: id, name, amount, category, timestamp; amount must be a finite positive number); discard invalid records; show `#load-error` if any parse or schema error occurs; default sort option to `'amount-desc'` when key is absent or unreadable (no error shown per Requirement 8.5)
    - `saveTransactions()`, `saveCategories()`, `saveSortOption()`: each wraps `localStorage.setItem` in `try/catch` and shows `#storage-error` or `#category-storage-error` on failure
    - _Requirements: 5.1, 5.2, 5.3, 8.4, 8.5_

  - [ ]* 4.2 Write property test for localStorage persistence round-trip
    - **Property 3: Transaction persistence round-trip**
    - **Validates: Requirements 5.1, 5.2**
    - Use fast-check `fc.array(validTransactionArb)` to generate arbitrary transaction lists, serialize via `JSON.stringify`, parse back, and assert field-level equality for `id`, `name`, `amount`, `category`, `timestamp`

  - [ ]* 4.3 Write property test for corrupt localStorage initialises clean
    - **Property 10: Corrupt localStorage initialises clean**
    - **Validates: Requirements 5.3**
    - Use `fc.oneof(fc.string(), fc.jsonValue().filter(v => !isValidSchema(v)))` to inject invalid data; assert that `loadFromStorage()` returns an empty transaction list and that `#load-error` is shown

- [x] 5. Implement Balance Display
  - [x] 5.1 Write `renderBalance()` function
    - Sum all `state.transactions` amounts; format as `$N.NN` (always two decimal places)
    - Set `#balance-amount` text content to the formatted value
    - Toggle `.balance--negative` on `#balance-display` when the sum is negative
    - Show `$0.00` when the list is empty
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.2 Write property test for balance equals sum of amounts
    - **Property 4: Balance equals sum of amounts**
    - **Validates: Requirements 3.1, 3.4**
    - Use `fc.array(validTransactionArb)` to build state; call `renderBalance()` against a stub DOM node; assert displayed value equals `$` + `sum.toFixed(2)`

- [x] 6. Implement Transaction List rendering and deletion
  - [x] 6.1 Write `renderTransactionList()` and `deleteTransaction()`
    - `getSortedTransactions()`: apply `state.sortOption` comparator (amount-desc, amount-asc, category-asc) with timestamp-desc tiebreaker; return new sorted array without mutating `state.transactions`
    - `renderTransactionList()`: clear `#transaction-list`; if empty show `.tx-empty` item; otherwise render one `<li class="transaction-item" data-id="…">` per transaction with name, category, `$N.NN`-formatted amount, and a `.btn-delete` button
    - `deleteTransaction(id)`: remove from `state.transactions`; call `saveTransactions()` inside `try/catch`; on failure revert removal, re-render list, show `#delete-error`; on success call `render()`
    - Attach a single delegated `click` listener on `#transaction-list` to handle `.btn-delete` clicks within 300 ms
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 6.2 Write property test for sort stability and correctness
    - **Property 6: Sort stability and correctness**
    - **Validates: Requirements 8.1, 8.2**
    - Use `fc.array(validTransactionArb)` × `fc.constantFrom('amount-desc', 'amount-asc', 'category-asc')`; call `getSortedTransactions()`; assert same length, all original IDs present, and every adjacent pair satisfies the comparator

  - [ ]* 6.3 Write property test for delete removes exactly one transaction
    - **Property 5: Delete removes exactly one transaction**
    - **Validates: Requirements 2.3**
    - Use `fc.array(validTransactionArb, { minLength: 1 })` and `fc.integer()` to pick an index; call `deleteTransaction(id)`; assert list length is exactly one less and the deleted ID is absent

- [x] 7. Implement Pie Chart (`renderChart()`)
  - [x] 7.1 Integrate Chart.js and write `renderChart()`
    - Declare a closure variable `chartInstance` (initially `null`)
    - If `state.transactions` is empty: destroy `chartInstance` if it exists, set `chartInstance = null`, show `#chart-empty`, hide canvas; return
    - Otherwise: group positive-amount transactions by category → `labels[]` and `data[]` arrays
    - If `chartInstance` exists: update `.data.labels`, `.data.datasets[0].data`, call `chartInstance.update()`
    - If `chartInstance` is null: create new `Chart(canvas, { type: 'pie', … })`
    - Assign `window.onerror`-style fallback on the CDN `<script>` tag (already in HTML): hide `#chart-container`, show static "Chart unavailable – chart library could not be loaded." message
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 9.4_

- [x] 8. Implement Sort Control
  - [x] 8.1 Write `renderSortControl()` and sort change handler
    - `renderSortControl()`: set `#sort-control` value to `state.sortOption`
    - Attach `change` listener on `#sort-control`: update `state.sortOption`, call `saveSortOption()`, call `render()`; reorder is reflected within 100 ms
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 9. Implement Input Form — validation and `addTransaction()`
  - [x] 9.1 Write form validation and `addTransaction()`
    - On `#transaction-form` submit: prevent default; trim name; validate name (non-empty, 1–100 chars); validate amount (numeric, 0.01–999999999.99, ≤ 2 dp); validate category (non-empty); on any failure set `#form-error` text and return
    - `addTransaction({ name, amount, category })`: create a Transaction object with UUID, `Date.now()` timestamp; push to `state.transactions`; call `saveTransactions()`; call `render()`; reset form (name → `""`, amount → `""`, category → `"Food"`)
    - Clear `#form-error` on successful submission
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 9.2 Write property test for transaction addition grows the list
    - **Property 1: Transaction addition grows the list**
    - **Validates: Requirements 1.3**
    - Use `fc.record({ name: fc.string({minLength:1,maxLength:100}).filter(s=>s.trim()!==''), amount: fc.float({min:0.01,max:999999999.99}), category: fc.constantFrom(...BUILTIN_CATEGORIES) })` to generate valid inputs; assert list length increases by exactly 1 and new transaction is present

  - [ ]* 9.3 Write property test for whitespace and invalid amounts are rejected
    - **Property 2: Whitespace and invalid amounts are rejected**
    - **Validates: Requirements 1.4, 1.5**
    - Use `fc.oneof` with blank/whitespace names, zero, negative, too-large, and >2 dp amounts; call `addTransaction()` via the validation path; assert list length is unchanged

- [x] 10. Checkpoint — core transaction flow complete
  - Ensure all tests pass. Verify in a browser that adding, sorting, deleting, and balance display work end-to-end. Ask the user if any questions arise.

- [x] 11. Implement Custom Category Form
  - [x] 11.1 Write `addCategory()` and `renderCategorySelect()`
    - `validateCategoryName(name, state)`: return error string or `null`; checks: non-empty, ≤ 50 chars, case-insensitive uniqueness against built-in + custom lists, total custom count < `MAX_CUSTOM_CATEGORIES`
    - On `#category-form` submit: validate; on failure set `#category-error` and return; on success push to `state.categories`, call `saveCategories()`, call `renderCategorySelect()`, clear `#input-category-name`
    - `renderCategorySelect()`: repopulate `#input-category` options with `BUILTIN_CATEGORIES` + `state.categories`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 11.2 Write property test for custom category uniqueness
    - **Property 7: Custom category uniqueness**
    - **Validates: Requirements 6.4**
    - Use `fc.array(fc.string({minLength:1,maxLength:50}))` with case variation; call `validateCategoryName()` for each; assert that attempting to add an existing name (any casing) returns an error and leaves the list unchanged

  - [ ]* 11.3 Write property test for custom category persistence round-trip
    - **Property 8: Custom category persistence round-trip**
    - **Validates: Requirements 6.6**
    - Use `fc.array(fc.string({minLength:1,maxLength:50}), { maxLength: 20 })`; serialize and deserialize via `saveCategories()` / `loadFromStorage()`; assert restored list contains all and only the original custom names plus built-ins

- [x] 12. Implement Monthly Summary
  - [x] 12.1 Write `getMonthlyTotals()` and `renderMonthlySummary()`
    - `getMonthlyTotals(transactions)`: group by `"Month YYYY"` label derived from each transaction's `timestamp`; sum amounts per group; sort descending by year then month
    - `renderMonthlySummary()`: if no transactions show `#monthly-empty`; otherwise render `<li class="month-item [month-item--negative]">` items with label and `$N.NN`-formatted total
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 12.2 Write property test for monthly summary totals correctness
    - **Property 9: Monthly summary totals correctness**
    - **Validates: Requirements 7.2**
    - Use `fc.array(validTransactionArb)` to generate arbitrary transaction lists; call `getMonthlyTotals()`; for each returned month group re-filter the input array by calendar month and assert the totals match

- [x] 13. Implement View Toggle
  - [x] 13.1 Wire `#btn-toggle-view` and write `renderViewToggle()`
    - `renderViewToggle()`: if `state.activeView === 'list'` show `#transaction-list`, hide `#monthly-summary`, set button text to "View Monthly Summary"; otherwise reverse
    - Attach `click` listener on `#btn-toggle-view`: toggle `state.activeView`, call `render()`
    - _Requirements: 7.1, 7.3_

- [x] 14. Wire `render()` and `init()`
  - [x] 14.1 Compose the central `render()` function and call `init()` on `DOMContentLoaded`
    - `render()` calls in order: `renderBalance()`, `renderSortControl()`, `renderTransactionList()`, `renderChart()`, `renderMonthlySummary()`, `renderViewToggle()`, `renderCategorySelect()`
    - `init()`: call `loadFromStorage()` to populate `state`; call `renderCategorySelect()` to restore custom categories into the select; call `render()`; attach all event listeners (form submit, delete delegation, sort change, category form submit, view toggle click)
    - Attach `DOMContentLoaded` listener that calls `init()`
    - _Requirements: 5.1, 5.2, 5.3, 6.6, 8.4, 9.1, 9.4_

  - [ ]* 14.2 Write integration test for full add → render → delete flow
    - Use a stub/mock DOM (or jsdom); call `init()`, simulate a valid form submission, assert transaction appears in `state.transactions` and `#transaction-list`, assert `#balance-amount` reflects the new total, then simulate a delete, assert list length returns to 0 and balance is `$0.00`
    - _Requirements: 1.3, 2.3, 3.2, 3.3_

- [ ] 15. Final checkpoint — full application wired
  - Ensure all tests pass. Open `index.html` via `file://` in Chrome and Firefox; verify no console errors, chart renders after first transaction, reload preserves data. Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- The `*`-marked property-based tests use [fast-check](https://github.com/dubzzz/fast-check); run them with a Node test runner (e.g. `node --test` or Vitest `--run`)
- Checkpoints (tasks 10 and 15) are manual validation gates, not coded steps
- The design's Correctness Properties section maps directly to the `*`-marked PBT sub-tasks
- All code stays inside the single IIFE in `js/app.js`; no ES module syntax

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1"] },
    { "id": 1, "tasks": ["2.1", "4.1"] },
    { "id": 2, "tasks": ["4.2", "4.3", "5.1", "6.1", "7.1", "8.1"] },
    { "id": 3, "tasks": ["5.2", "6.2", "6.3", "9.1"] },
    { "id": 4, "tasks": ["9.2", "9.3", "11.1", "12.1"] },
    { "id": 5, "tasks": ["11.2", "11.3", "12.2", "13.1"] },
    { "id": 6, "tasks": ["14.1"] },
    { "id": 7, "tasks": ["14.2"] }
  ]
}
```
