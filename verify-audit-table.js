const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyAuditTable() {
  try {
    // Try to query the ExpenseAuditRecords table
    const count = await prisma.expenseAuditRecords.count();
    console.log('✓ ExpenseAuditRecords table exists!');
    console.log(`  Current record count: ${count}`);

    // Check if we can create a test record (then delete it)
    const testRecord = await prisma.expenseAuditRecords.create({
      data: {
        expenseId: 'test-id',
        amount: 100.00,
        description: 'Test audit record',
        date: new Date(),
        categoryId: 'test-category',
        categoryName: 'Test',
        categoryColor: '#000000',
        sheetName: 'Test Sheet',
        rowIndex: 0,
      }
    });
    console.log('✓ Successfully created test record');

    // Delete the test record
    await prisma.expenseAuditRecords.delete({
      where: { id: testRecord.id }
    });
    console.log('✓ Successfully deleted test record');
    console.log('\n✅ Database schema verification complete - all operations work!');
  } catch (error) {
    console.error('❌ Error verifying audit table:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAuditTable();
