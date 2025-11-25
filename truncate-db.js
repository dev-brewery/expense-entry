/**
 * Truncate all database tables
 * This will delete all expenses, categories, and audit records
 * Then reseed the default categories
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function truncateDatabase() {
  try {
    console.log('🗑️  Truncating database...\n');

    // Delete in order due to foreign key constraints
    console.log('Deleting ExpenseAuditRecords...');
    const auditResult = await prisma.expenseAuditRecords.deleteMany({});
    console.log(`   Deleted ${auditResult.count} audit records`);

    console.log('Deleting Expenses...');
    const expenseResult = await prisma.expense.deleteMany({});
    console.log(`   Deleted ${expenseResult.count} expenses`);

    console.log('Deleting Categories...');
    const categoryResult = await prisma.category.deleteMany({});
    console.log(`   Deleted ${categoryResult.count} categories\n`);

    // Reseed default categories
    console.log('🌱 Reseeding default categories...\n');

    const defaultCategories = [
      { name: 'Food & Dining', color: '#10B981' },
      { name: 'Transportation', color: '#3B82F6' },
      { name: 'Shopping', color: '#8B5CF6' },
      { name: 'Entertainment', color: '#EC4899' },
      { name: 'Bills & Utilities', color: '#F59E0B' },
      { name: 'Healthcare', color: '#EF4444' },
      { name: 'Other', color: '#6B7280' },
    ];

    for (const category of defaultCategories) {
      const created = await prisma.category.create({
        data: category,
      });
      console.log(`   Created: ${created.name} (${created.color})`);
    }

    console.log('\n✅ Database truncated and reseeded successfully!');
    console.log('💡 Restart your dev server and reload the expenses page to sync from Google Sheets');

  } catch (error) {
    console.error('❌ Error truncating database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

truncateDatabase();
