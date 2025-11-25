
// Mock the client-side logic
function clientSideLogic(dateStr, timezoneOffset) {
    console.log(`\n--- Client Side (Timezone Offset: ${timezoneOffset}) ---`);
    console.log(`User Input: ${dateStr}`);

    // OLD WAY
    // const date = new Date(dateStr); // This defaults to UTC midnight
    // In Node, new Date("YYYY-MM-DD") is UTC.
    // But in Browser, new Date("YYYY-MM-DD") is usually UTC too (ES5 standard), 
    // BUT sometimes browsers behave differently or the user might be constructing it differently.
    // Actually, `new Date("2023-12-01")` is UTC midnight in ES5+.

    // Let's simulate what happens when we send "2023-12-01" to the server.
    // Server receives "2023-12-01".
    // Server does `new Date("2023-12-01")` -> UTC Midnight.
    const oldServerDate = new Date(dateStr);
    console.log(`Old Way - Server Date (UTC): ${oldServerDate.toISOString()}`);

    // Displaying this in Local Time (e.g. EST -5)
    // We can simulate this by manually adjusting the time
    const oldDisplayDate = new Date(oldServerDate.getTime() + (timezoneOffset * 60 * 60 * 1000));
    console.log(`Old Way - Displayed in Local Time: ${oldDisplayDate.toISOString().replace('Z', '')} (Simulated)`);

    // NEW WAY
    const [year, month, day] = dateStr.split('-').map(Number);
    // Create date at local midnight
    // We can't easily force the system timezone in Node, but we can simulate the offset.
    // We want a timestamp T such that T + Offset = YYYY-MM-DD 00:00:00.
    // So T = YYYY-MM-DD 00:00:00 - Offset.

    // In the browser code: `new Date(year, month-1, day)` uses the browser's local timezone.
    // Let's simulate that result.
    // If local is EST (-5), midnight local is 05:00 UTC.
    const newServerDate = new Date(Date.UTC(year, month - 1, day, -timezoneOffset, 0, 0));
    console.log(`New Way - Server Date (UTC): ${newServerDate.toISOString()}`);

    const newDisplayDate = new Date(newServerDate.getTime() + (timezoneOffset * 60 * 60 * 1000));
    console.log(`New Way - Displayed in Local Time: ${newDisplayDate.toISOString().replace('Z', '')} (Simulated)`);
}

// Simulate EST (-5)
clientSideLogic('2023-12-01', -5);

// Simulate PST (-8)
clientSideLogic('2023-12-01', -8);
