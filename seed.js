import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seed() {
  console.log('🌱 Seeding database...')

  try {
    // Clear existing data
    console.log('🗑️  Clearing existing data...')
    await prisma.auditLog.deleteMany()
    await prisma.task.deleteMany()
    await prisma.policy.deleteMany()
    await prisma.user.deleteMany()

    // Create Policies (approval limits)
    console.log('📋 Creating policies...')
    const policies = await Promise.all([
      prisma.policy.create({
        data: { role: 'employee', maxAmount: 500 }
      }),
      prisma.policy.create({
        data: { role: 'manager', maxAmount: 5000 }
      }),
      prisma.policy.create({
        data: { role: 'director', maxAmount: 50000 }
      }),
      prisma.policy.create({
        data: { role: 'ceo', maxAmount: 1000000 }
      })
    ])
    console.log(`✅ Created ${policies.length} policies`)

    // Create Users
    console.log('👤 Creating users...')
    const users = await Promise.all([
      prisma.user.create({
        data: { email: 'john@company.com', role: 'employee' }
      }),
      prisma.user.create({
        data: { email: 'sarah@company.com', role: 'manager' }
      }),
      prisma.user.create({
        data: { email: 'mike@company.com', role: 'director' }
      }),
      prisma.user.create({
        data: { email: 'ceo@company.com', role: 'ceo' }
      })
    ])
    console.log(`✅ Created ${users.length} users`)

    // Creates Tasks with different amounts and statuses
    console.log('📝 Creating tasks...')
    const tasks = await Promise.all([
      // Employee-level tasks
      prisma.task.create({
        data: { 
          title: 'Office supplies purchase', 
          amount: 250, 
          status: 'PENDING' 
        }
      }),
      prisma.task.create({
        data: { 
          title: 'Team lunch expense', 
          amount: 450, 
          status: 'PENDING' 
        }
      }),
      
      // Manager-level tasks
      prisma.task.create({
        data: { 
          title: 'New laptop for developer', 
          amount: 2500, 
          status: 'PENDING' 
        }
      }),
      prisma.task.create({
        data: { 
          title: 'Conference tickets (team of 3)', 
          amount: 4200, 
          status: 'PENDING' 
        }
      }),
      
      // Director-level tasks
      prisma.task.create({
        data: { 
          title: 'Q1 marketing campaign', 
          amount: 25000, 
          status: 'PENDING' 
        }
      }),
      prisma.task.create({
        data: { 
          title: 'Hire 2 senior engineers', 
          amount: 45000, 
          status: 'PENDING' 
        }
      }),
      
  
      prisma.task.create({
        data: { 
          title: 'Acquire competitor company', 
          amount: 500000, 
          status: 'PENDING' 
        }
      }),
      prisma.task.create({
        data: { 
          title: 'Open new office location', 
          amount: 250000, 
          status: 'PENDING' 
        }
      }),

      prisma.task.create({
        data: { 
          title: 'Software licenses renewal', 
          amount: 1200, 
          status: 'APPROVED' 
        }
      }),
      prisma.task.create({
        data: { 
          title: 'Emergency server repair', 
          amount: 8000, 
          status: 'APPROVED' 
        }
      })
    ])
    console.log(`✅ Created ${tasks.length} tasks`)

    console.log('📊 Creating audit logs...')
    const auditLogs = await Promise.all([
      prisma.auditLog.create({
        data: {
          action: 'Task approved by manager: Software licenses renewal',
          entityId: tasks[8].id
        }
      }),
      prisma.auditLog.create({
        data: {
          action: 'Task approved by director: Emergency server repair',
          entityId: tasks[9].id
        }
      }),
      prisma.auditLog.create({
        data: {
          action: 'Policy created: employee can approve up to $500',
          entityId: policies[0].id
        }
      })
    ])
    console.log(`✅ Created ${auditLogs.length} audit logs`)

    console.log('\n🎉 Database seeded successfully!')
    console.log('\n📊 Summary:')
    console.log(`   • ${policies.length} policies`)
    console.log(`   • ${users.length} users`)
    console.log(`   • ${tasks.length} tasks`)
    console.log(`   • ${auditLogs.length} audit logs`)
    console.log('\n💡 Try these scenarios:')
    console.log('   1. Employee approves $250 task → ✅ APPROVED')
    console.log('   2. Employee tries $2500 task → ❌ REJECTED')
    console.log('   3. Manager approves $4200 task → ✅ APPROVED')
    console.log('   4. Director approves $45000 task → ✅ APPROVED')

  } catch (error) {
    console.error('❌ Error seeding database:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seed()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
