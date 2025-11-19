# Initial UI/UX Enhancements Plan

## Overall Goal
Enhance the application's UI/UX by implementing a dark mode theme and making the existing expense entry form the primary landing page experience, **without modifying the logic of the existing success page, and without adding a user toggle for the theme.**

---

## A) Dark Mode Theme

**Current Status:**
*   Partially implemented. The `src/app/globals.css` already defines `--background` and `--foreground` CSS variables for `prefers-color-scheme: dark`, which handles automatic dark mode based on system preference.
*   Many existing components (e.g., inputs in the expense entry form) already utilize `dark:` Tailwind classes for specific styling in dark mode.

**Tasks:**
1.  **Audit Components:** Review all relevant UI components and pages (including the new landing page and success page) to ensure all elements (text, backgrounds, borders, icons) properly adapt to dark mode using either the defined CSS variables or `dark:` Tailwind classes. **No user toggle for theme selection will be added.**

---

## B) Landing Page Experience

**Goal:** The existing expense entry form (originally at `/expenses/new`) should become the application's landing page (`/`). A link to the `/expenses` list page should be available from this new landing page. The existing behavior for expense creation and redirection to its success page should be maintained, with *only path updates*.

**Tasks:**
1.  **Move Expense Entry Page:**
    *   Rename `src/app/expenses/new/page.tsx` to `src/app/page.tsx`. This action makes the existing expense entry form the content for the root route (`/`).
    *   Delete the now-empty directory `src/app/expenses/new/`.
2.  **Adjust Redirect Path in New Landing Page (`src/app/page.tsx`):**
    *   Locate the `redirect` call within the `createExpense` server action (which will now be in `src/app/page.tsx`).
    *   Change the redirect target from `/expenses/new/success?...` to `/success?...` to reflect the new, cleaner URL structure for the success page.
3.  **Move Expense Success Page:**
    *   Rename `src/app/expenses/new/success/page.tsx` to `src/app/success/page.tsx`. This places the success page directly under the `src/app/` directory, corresponding to the updated redirect path.
    *   Delete the now-empty directory `src/app/expenses/new/success/`.
4.  **Ensure Link to /expenses:**
    *   Verify that the "Cancel" link within the newly moved expense entry form (now `src/app/page.tsx`) correctly points to `/expenses`. This maintains easy navigation to the list of all expenses.

---

## C) Monthly Total Display on Success Page

**Goal:** The existing `src/app/expenses/new/success/page.tsx` (which will be moved to `src/app/success/page.tsx`) already correctly retrieves and displays the monthly total for the entered category. **No logic modifications are required for this page.**

**Tasks:**
*   No tasks. The existing functionality is already in place and will be preserved after the route change.

---

## D) Other Enhancements (As Previously Identified):

*   **Improved Form UI Consistency:** Ensure all forms across the application are visually consistent, user-friendly, and responsive, leveraging the existing Tailwind CSS setup.
*   **Consistent Toast Notifications:** Implement a consistent and non-intrusive toast notification system to provide immediate feedback to the user for actions like successful expense creation, data synchronization, or errors.
*   **Clear Loading States:** Provide clear visual indicators (e.g., spinners, skeleton loaders) when data is being fetched, submitted, or processed, enhancing the perceived responsiveness of the application.
*   **Robust Error Handling:** Implement user-friendly error messages for API failures, validation issues, and other unexpected events, guiding the user on how to resolve them.
*   **Accessibility:** Ensure the new features and existing UI elements are accessible (e.g., proper ARIA attributes, keyboard navigation).