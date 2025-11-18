import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create default categories
  const categories = [
    { name: 'Food & Dining', color: '#EF4444' },
    { name: 'Transportation', color: '#3B82F6' },
    { name: 'Shopping', color: '#8B5CF6' },
    { name: 'Entertainment', color: '#EC4899' },
    { name: 'Bills & Utilities', color: '#F59E0B' },
    { name: 'Healthcare', color: '#10B981' },
    { name: 'Travel', color: '#06B6D4' },
    { name: 'Other', color: '#6B7280' },
  ]

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    })
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
