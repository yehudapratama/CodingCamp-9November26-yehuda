# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application built with HTML, CSS, and Vanilla JavaScript. It allows users to track personal expenses by adding transactions with a name, amount, and category. The app stores all data in the browser's Local Storage, displays a live total balance, renders a pie chart of spending by category, and provides tools to delete, sort, and filter transactions. It also supports custom categories and a monthly summary view. No backend server or build toolchain is required.

## Glossary

- **App**: The Expense & Budget Visualizer single-page web application.
- **Transaction**: A single expense record consisting of an item name, a numeric amount, a category, and a creation timestamp.
- **Category**: A label that groups transactions. Built-in categories are Food, Transport, and Fun. Users may also define Custom_Categories.
- **Custom_Category**: A user-defined category name added at runtime and persisted in Local Storage.
- **Transaction_List**: The scrollable UI component that displays all stored transactions.
- **Balance_Display**: The UI element at the top of the page showing the sum of all transaction amounts.
- **Pie_Chart**: The visual chart component that shows spending distribution across categories.
- **Local_Storage**: The browser's `localStorage` API used as the sole persistence layer.
- **Input_Form**: The HTML form through which users enter item name, amount, and category.
- **Monthly_Summary**: A view that groups and totals transactions by calendar month.
- **Sort_Control**: The UI control that reorders the Transaction_List by amount or category.

## Requirements

### Requirement 1: Add a Transaction

**User Story:** As a user, I want to fill in a form with an item name, amount, and category so that I can record a new expense.

#### Acceptance Criteria

1. THE Input_Form SHALL contain three fields: item name (text, 1–100 characters), amount (number), and category (select).
2. THE Input_Form category select SHALL include the built-in options: Food, Transport, and Fun, plus any Custom_Categories the user has added.
3. WHEN the user submits the Input_Form with all fields filled and an amount that is a number between 0.01 and 999,999,999.99 with at most 2 decimal places, THE App SHALL add the Transaction to the Transaction_List and persist it to Local_Storage.
4. WHEN the user submits the Input_Form with one or more empty fields, THE App SHALL display a validation error message indicating which field is empty and SHALL NOT add a Transaction.
5. WHEN the user submits the Input_Form with an amount that is non-numeric, zero, negative, greater than 999,999,999.99, or has more than 2 decimal places, THE App SHALL display a validation error message indicating the amount constraint that was violated and SHALL NOT add a Transaction.
6. WHEN a Transaction is successfully added, THE App SHALL reset the item name field to empty, the amount field to empty, and the category field to the first built-in option (Food).

---

### Requirement 2: Display and Delete Transactions

**User Story:** As a user, I want to see all my recorded transactions in a list and remove ones I no longer need so that I can keep my records accurate.

#### Acceptance Criteria

1. THE Transaction_List SHALL display every stored Transaction, each showing the item name, the amount formatted as a currency symbol followed by a value with exactly two decimal places, and the category.
2. THE Transaction_List SHALL be scrollable when the number of items exceeds the visible area.
3. WHEN the user clicks the delete control for a Transaction, THE App SHALL remove that Transaction from the Transaction_List and update Local_Storage to reflect the removal within 300 milliseconds.
4. IF Local_Storage cannot be updated after a delete action, THEN THE App SHALL retain the Transaction in the Transaction_List and display an error message indicating the deletion could not be completed.
5. WHEN the Transaction_List is empty, THE App SHALL display an empty-state message indicating no transactions have been recorded.
6. THE Transaction_List SHALL display Transactions in reverse chronological order by default, with the most recently added Transaction appearing first.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending balance at the top of the page so that I always know how much I have spent overall.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all Transaction amounts formatted with a currency symbol prefix and exactly two decimal places.
2. WHEN a Transaction is added, THE Balance_Display SHALL update to reflect the new total without requiring a page reload.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update to reflect the new total without requiring a page reload.
4. WHEN no Transactions exist, THE Balance_Display SHALL show a zero value formatted as the currency symbol followed by 0.00.
5. IF the total of all Transaction amounts is negative, THEN THE Balance_Display SHALL display the negative total in a visually distinct style to differentiate it from a positive total.
6. THE Balance_Display SHALL be visible without scrolling on any viewport width of 320 pixels or wider.

---

### Requirement 4: Spending Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand where my money is going.

#### Acceptance Criteria

1. THE Pie_Chart SHALL render one segment per category that has at least one Transaction, sized proportionally to that category's total positive Transaction amount.
2. THE Pie_Chart SHALL label each segment with the category name and its percentage of total spending, rounded to one decimal place.
3. WHEN a Transaction is added or deleted, THE Pie_Chart SHALL update to reflect the current data within 1 second and without requiring a page reload.
4. WHEN no Transactions exist, THE Pie_Chart SHALL display an empty state containing a text message indicating that no spending data is available.
5. THE App SHALL load the charting library (Chart.js or equivalent) from a CDN so that no local build step is required.

---

### Requirement 5: Persistent Data on Page Load

**User Story:** As a user, I want my transactions to still be there when I reopen the app so that I do not lose my expense history.

#### Acceptance Criteria

1. WHEN the App initialises, THE App SHALL read all previously stored Transactions from Local_Storage, populate the Transaction_List with those Transactions, and recalculate the Balance_Display and Pie_Chart from the restored Transaction_List.
2. WHEN the App initialises and Local_Storage contains no Transaction data, THE App SHALL initialise with an empty Transaction_List and display a zero balance on the Balance_Display and an empty state on the Pie_Chart.
3. IF Local_Storage contains data that cannot be parsed as valid JSON or does not conform to the expected Transaction structure (missing required fields such as name, amount, category, or timestamp, or containing non-numeric values where numeric values are required), THEN THE App SHALL discard that data, initialise with an empty Transaction_List, and display an error message indicating that saved data could not be loaded.

---

### Requirement 6: Custom Categories

**User Story:** As a user, I want to add my own expense categories so that I can track spending types that are not covered by the built-in options.

#### Acceptance Criteria

1. WHEN the user submits a new Custom_Category name, THE App SHALL validate the name and attempt to save it.
2. WHEN the user saves a Custom_Category with a non-empty, unique name of 1–50 characters, THE App SHALL add it to the category select in the Input_Form and persist it to Local_Storage, up to a maximum of 20 Custom_Categories.
3. WHEN the user attempts to save a Custom_Category with an empty name, THE App SHALL display a validation error indicating the name is required and SHALL NOT add the category.
4. WHEN the user attempts to save a Custom_Category whose name matches an existing category (case-insensitive), THE App SHALL display a duplicate error indicating the category already exists and SHALL NOT add the category.
5. WHEN the user attempts to save a Custom_Category and the total number of saved Custom_Categories has reached 20, THE App SHALL display an error indicating the limit has been reached and SHALL NOT add the category.
6. WHEN the App initialises, THE App SHALL restore all previously saved Custom_Categories into the Input_Form category select.
7. IF Local_Storage is unavailable when saving or restoring Custom_Categories, THEN THE App SHALL display an error indicating categories cannot be saved and SHALL continue operating with the in-memory category list only.

---

### Requirement 7: Monthly Summary View

**User Story:** As a user, I want to see a summary of my expenses grouped by month so that I can review my spending trends over time.

#### Acceptance Criteria

1. THE App SHALL provide a toggle or navigation control that switches the view between the full Transaction_List and the Monthly_Summary.
2. WHEN the Monthly_Summary is active, THE App SHALL display each calendar month that contains at least one Transaction, showing the month label formatted as "Month YYYY" (e.g., "January 2025") and the total amount for that month rounded to 2 decimal places, sorted in descending chronological order with the most recent month first.
3. WHEN the Monthly_Summary is active and a Transaction is added or deleted, THE App SHALL update the Monthly_Summary totals within 1 second without requiring a page reload.
4. WHEN the Monthly_Summary is active and no Transactions exist, THE App SHALL display an empty-state message indicating that no transactions are available.
5. IF the Monthly_Summary total for any month is negative, THEN THE App SHALL display that month's total in a visually distinct style to differentiate it from positive totals.

---

### Requirement 8: Sort Transactions

**User Story:** As a user, I want to sort my transaction list by amount or by category so that I can find and analyse my expenses more easily.

#### Acceptance Criteria

1. THE Sort_Control SHALL offer the following sort options: amount ascending, amount descending, and category alphabetical ascending; transactions sharing the same sort key SHALL be ordered by date descending as a tiebreaker.
2. WHEN the user selects a sort option, THE App SHALL reorder the Transaction_List according to the selected option within 100 milliseconds.
3. WHILE a sort option is active, WHEN a new Transaction is added, THE App SHALL insert the new Transaction in the position determined by the active sort option and tiebreaker rule without reloading the page.
4. THE Sort_Control SHALL persist the user's selected sort option in Local_Storage and restore it on page load; if no persisted value exists, THE Sort_Control SHALL default to amount descending.
5. IF the Sort_Control cannot read the persisted sort option from Local_Storage, THEN THE App SHALL default to amount descending and continue operating without displaying an error to the user.

---

### Requirement 9: Single-File Constraints and Browser Compatibility

**User Story:** As a developer, I want the project to follow a strict single-file-per-type structure so that the codebase remains simple and maintainable.

#### Acceptance Criteria

1. THE App SHALL be structured with exactly one HTML file, one CSS file located in the `css/` directory, and one JavaScript file located in the `js/` directory.
2. THE App SHALL render all UI elements visibly and remain fully interactive, with no uncaught JavaScript exceptions thrown, in the current stable releases of Chrome, Firefox, Edge, and Safari without polyfills or transpilation.
3. THE App SHALL become fully interactive (all inputs enabled and charts rendered) within 2 seconds on a connection speed of 25 Mbps or higher, excluding CDN library load time.
4. WHEN the App is opened as a local file (using the `file://` protocol), THE App SHALL function with no uncaught JavaScript exceptions thrown in the browser console.
