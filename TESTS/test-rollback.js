#!/usr/bin/env node

/**
 * Rollback Logic Test Script
 *
 * This script tests the dual-write rollback mechanisms implemented in:
 * - POST /api/expenses (CREATE + rollback on Sheets failure)
 * - PATCH /api/expenses/[id] (UPDATE + rollback on Sheets failure)
 * - DELETE /api/expenses/[id] (DELETE + rollback on Sheets failure)
 *
 * It temporarily breaks the Google Sheets credentials to force API errors,
 * then verifies that PostgreSQL operations are rolled back correctly.
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function header(message) {
  console.log('');
  log('='.repeat(70), colors.cyan);
  log(message, colors.bright + colors.cyan);
  log('='.repeat(70), colors.cyan);
  console.log('');
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function warning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

// Database client (using same pattern as the app)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// API base URL
const API_BASE = 'http://localhost:3000/api';

// Helper to make API requests
async function apiRequest(method, endpoint, body = null) {
  const url = `${API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = response.ok ? await response.json() : null;

  return { response, data };
}

// Break Google Sheets credentials to force errors
function breakGoogleSheetsCredentials() {
  // Support both .env.local and .env
  let envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    envPath = path.join(__dirname, '.env');
  }

  if (!fs.existsSync(envPath)) {
    error('No .env or .env.local file found!');
    process.exit(1);
  }

  const envFileName = path.basename(envPath);
  const envContent = fs.readFileSync(envPath, 'utf8');

  // Back up the original file
  fs.writeFileSync(envPath + '.backup', envContent);
  success(`Backed up ${envFileName} to ${envFileName}.backup`);

  // Replace credentials with invalid ones
  const brokenContent = envContent.replace(
    /GOOGLE_SERVICE_ACCOUNT_CREDENTIALS=.*/,
    'GOOGLE_SERVICE_ACCOUNT_CREDENTIALS=\'{"invalid": "credentials"}\''
  );

  fs.writeFileSync(envPath, brokenContent);
  warning('Temporarily broke Google Sheets credentials');

  return envPath;
}

// Restore Google Sheets credentials
function restoreGoogleSheetsCredentials() {
  // Support both .env.local and .env
  let envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    envPath = path.join(__dirname, '.env');
  }

  const backupPath = envPath + '.backup';

  if (!fs.existsSync(backupPath)) {
    error('Backup file not found! Cannot restore credentials.');
    return false;
  }

  const envFileName = path.basename(envPath);
  const originalContent = fs.readFileSync(backupPath, 'utf8');
  fs.writeFileSync(envPath, originalContent);
  fs.unlinkSync(backupPath);
  success(`Restored Google Sheets credentials from backup (${envFileName})`);
  return true;
}

// Test CREATE rollback
async function testCreateRollback() {
  header('TEST 1: CREATE Operation Rollback');

  info('Creating a test expense (should fail at Sheets write)...');

  // Get a category ID
  const category = await prisma.category.findFirst();
  if (!category) {
    error('No categories found in database. Please seed the database first.');
    return false;
  }

  const testExpense = {
    description: 'TEST ROLLBACK - CREATE',
    amount: 99.99,
    date: new Date().toISOString(),
    categoryId: category.id,
    notes: 'This should be rolled back',
  };

  info(`Test expense: ${testExpense.description} - $${testExpense.amount}`);

  // Make the API request (should fail due to broken Sheets credentials)
  const { response } = await apiRequest('POST', '/expenses', testExpense);

  if (response.ok) {
    error('Expected API call to FAIL, but it succeeded!');
    return false;
  }

  warning(`API call failed as expected: ${response.status} ${response.statusText}`);

  // Verify we got the right error code (503 = Service Unavailable with retry exhausted)
  if (response.status === 503) {
    success('Received 503 Service Unavailable (correct error code for retry exhaustion)');
  } else {
    warning(`Expected 503, got ${response.status}`);
  }

  // Verify the expense was NOT persisted in PostgreSQL (rollback succeeded)
  info('Checking if expense was rolled back from PostgreSQL...');

  const expensesInDb = await prisma.expense.findMany({
    where: {
      description: testExpense.description,
    },
  });

  if (expensesInDb.length === 0) {
    success('✨ ROLLBACK SUCCESSFUL: Expense was NOT persisted to PostgreSQL');
    return true;
  } else {
    error('🔥 ROLLBACK FAILED: Expense still exists in PostgreSQL!');
    error(`Found ${expensesInDb.length} expense(s) with matching description`);
    // Clean up
    for (const expense of expensesInDb) {
      await prisma.expense.delete({ where: { id: expense.id } });
      info(`Cleaned up expense ${expense.id}`);
    }
    return false;
  }
}

// Test UPDATE rollback
async function testUpdateRollback() {
  header('TEST 2: UPDATE Operation Rollback');

  // First, create an expense directly in PostgreSQL (bypass Sheets)
  info('Creating a test expense directly in PostgreSQL...');

  const category = await prisma.category.findFirst();
  const originalExpense = await prisma.expense.create({
    data: {
      description: 'TEST ROLLBACK - UPDATE ORIGINAL',
      amount: 50.00,
      date: new Date(),
      categoryId: category.id,
      notes: 'Original value',
    },
  });

  success(`Created expense ${originalExpense.id} with amount: $${originalExpense.amount}`);

  // Now try to update it (should fail at Sheets and rollback)
  info('Attempting to update the expense (should fail at Sheets write)...');

  const update = {
    description: 'TEST ROLLBACK - UPDATE MODIFIED',
    amount: 999.99,
    notes: 'This change should be rolled back',
  };

  const { response } = await apiRequest('PATCH', `/expenses/${originalExpense.id}`, update);

  if (response.ok) {
    error('Expected API call to FAIL, but it succeeded!');
    await prisma.expense.delete({ where: { id: originalExpense.id } });
    return false;
  }

  warning(`API call failed as expected: ${response.status} ${response.statusText}`);

  // Verify we got 503
  if (response.status === 503) {
    success('Received 503 Service Unavailable (correct error code)');
  }

  // Verify the expense was rolled back to original values
  info('Checking if expense was rolled back to original values...');

  const expenseAfterRollback = await prisma.expense.findUnique({
    where: { id: originalExpense.id },
  });

  if (!expenseAfterRollback) {
    error('🔥 ROLLBACK FAILED: Expense was deleted!');
    return false;
  }

  if (
    expenseAfterRollback.description === originalExpense.description &&
    expenseAfterRollback.amount === originalExpense.amount &&
    expenseAfterRollback.notes === originalExpense.notes
  ) {
    success('✨ ROLLBACK SUCCESSFUL: Expense restored to original values');
    success(`  Description: ${expenseAfterRollback.description}`);
    success(`  Amount: $${expenseAfterRollback.amount}`);
    success(`  Notes: ${expenseAfterRollback.notes}`);

    // Clean up
    await prisma.expense.delete({ where: { id: originalExpense.id } });
    info('Cleaned up test expense');
    return true;
  } else {
    error('🔥 ROLLBACK FAILED: Expense values were not restored!');
    error(`  Expected description: "${originalExpense.description}"`);
    error(`  Actual description: "${expenseAfterRollback.description}"`);
    error(`  Expected amount: $${originalExpense.amount}`);
    error(`  Actual amount: $${expenseAfterRollback.amount}`);

    // Clean up
    await prisma.expense.delete({ where: { id: originalExpense.id } });
    return false;
  }
}

// Test DELETE rollback
async function testDeleteRollback() {
  header('TEST 3: DELETE Operation Rollback');

  // First, create an expense directly in PostgreSQL (bypass Sheets)
  info('Creating a test expense directly in PostgreSQL...');

  const category = await prisma.category.findFirst();
  const testExpense = await prisma.expense.create({
    data: {
      description: 'TEST ROLLBACK - DELETE',
      amount: 75.50,
      date: new Date(),
      categoryId: category.id,
      notes: 'This should be recreated after rollback',
    },
  });

  success(`Created expense ${testExpense.id} with amount: $${testExpense.amount}`);

  // Now try to delete it (should fail at Sheets and rollback by recreating)
  info('Attempting to delete the expense (should fail at Sheets and recreate)...');

  const { response } = await apiRequest('DELETE', `/expenses/${testExpense.id}`);

  if (response.ok) {
    error('Expected API call to FAIL, but it succeeded!');
    return false;
  }

  warning(`API call failed as expected: ${response.status} ${response.statusText}`);

  // Verify we got 503
  if (response.status === 503) {
    success('Received 503 Service Unavailable (correct error code)');
  }

  // Verify the expense was recreated in PostgreSQL (rollback succeeded)
  info('Checking if expense was recreated in PostgreSQL...');

  const expenseAfterRollback = await prisma.expense.findUnique({
    where: { id: testExpense.id },
  });

  if (!expenseAfterRollback) {
    error('🔥 ROLLBACK FAILED: Expense was not recreated!');
    return false;
  }

  if (
    expenseAfterRollback.description === testExpense.description &&
    expenseAfterRollback.amount === testExpense.amount &&
    expenseAfterRollback.categoryId === testExpense.categoryId
  ) {
    success('✨ ROLLBACK SUCCESSFUL: Expense was recreated after failed delete');
    success(`  ID: ${expenseAfterRollback.id}`);
    success(`  Description: ${expenseAfterRollback.description}`);
    success(`  Amount: $${expenseAfterRollback.amount}`);

    // Clean up
    await prisma.expense.delete({ where: { id: testExpense.id } });
    info('Cleaned up test expense');
    return true;
  } else {
    error('🔥 ROLLBACK FAILED: Recreated expense has different values!');

    // Clean up
    await prisma.expense.delete({ where: { id: testExpense.id } });
    return false;
  }
}

// Main test runner
async function main() {
  header('🧪 DUAL-WRITE ROLLBACK TEST SUITE');

  info('This script tests the rollback mechanisms for dual-write operations.');
  info('It will temporarily break Google Sheets credentials to force failures.');
  info('Each operation will retry 3 times before rolling back (expect retry logs).');
  console.log('');

  // Check if dev server is running
  try {
    const response = await fetch('http://localhost:3000/api/categories');
    if (!response.ok) {
      throw new Error('API not responding');
    }
  } catch (err) {
    error('Development server is not running!');
    error('Please start it with: npm run dev');
    process.exit(1);
  }

  success('Development server is running ✓');

  // Break credentials
  breakGoogleSheetsCredentials();

  warning('⏳ Waiting 2 seconds for Next.js to reload with broken credentials...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const results = {
    create: false,
    update: false,
    delete: false,
  };

  try {
    // Run tests
    results.create = await testCreateRollback();
    results.update = await testUpdateRollback();
    results.delete = await testDeleteRollback();

  } finally {
    // Always restore credentials
    header('🔄 CLEANUP');
    restoreGoogleSheetsCredentials();

    info('⏳ Waiting 2 seconds for Next.js to reload with correct credentials...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  header('📊 TEST SUMMARY');

  const allPassed = results.create && results.update && results.delete;

  console.log('');
  log(`CREATE Rollback:  ${results.create ? '✅ PASS' : '❌ FAIL'}`, results.create ? colors.green : colors.red);
  log(`UPDATE Rollback:  ${results.update ? '✅ PASS' : '❌ FAIL'}`, results.update ? colors.green : colors.red);
  log(`DELETE Rollback:  ${results.delete ? '✅ PASS' : '❌ FAIL'}`, results.delete ? colors.green : colors.red);
  console.log('');

  if (allPassed) {
    success('🎉 ALL TESTS PASSED! Rollback logic is working correctly.');
  } else {
    error('💥 SOME TESTS FAILED! Check the rollback implementation.');
  }

  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch(async (err) => {
  error('Unexpected error during test execution:');
  console.error(err);

  // Try to restore credentials even on error
  try {
    restoreGoogleSheetsCredentials();
  } catch (restoreErr) {
    error('Failed to restore credentials!');
    error('Please manually restore from .env.local.backup');
  }

  await prisma.$disconnect();
  process.exit(1);
});
