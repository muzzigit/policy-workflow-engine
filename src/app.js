import express from 'express'
import { PrismaClient } from '@prisma/client'
import policyEngine from './services/policyEngine.js'
import auditService from './services/auditService.js'
import 'dotenv/config'

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`)
  next()
})

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'workflow-engine',
    timestamp: new Date().toISOString()
  })
})

// ============================================
// TASK ENDPOINTS
// ============================================

/**
 * GET /tasks - Get all tasks
 */
app.get('/tasks', async (req, res) => {
  try {
    const { status } = req.query
    
    const tasks = await prisma.task.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' }
    })

    res.json({ success: true, count: tasks.length, tasks })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch tasks',
      message: error.message 
    })
  }
})

/**
 * GET /tasks/:id - Get a specific task
 */
app.get('/tasks/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id)
    
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    })

    if (!task) {
      return res.status(404).json({ 
        success: false, 
        error: 'Task not found' 
      })
    }

    // Get audit logs for this task
    const logs = await auditService.getLogsForEntity(taskId)

    res.json({ success: true, task, auditLogs: logs })
  } catch (error) {
    console.error('Error fetching task:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch task',
      message: error.message 
    })
  }
})

/**
 * POST /tasks - Create a new task
 * Body: { title, amount }
 */
app.post('/tasks', async (req, res) => {
  try {
    const { title, amount } = req.body

    // Validation
    if (!title || title.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'Title is required' 
      })
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Amount must be a positive number' 
      })
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        amount: parseInt(amount),
        status: 'PENDING'
      }
    })

    // Log to audit trail
    await auditService.log(
      `Task created: "${title}" for $${amount}`,
      task.id,
      { title, amount }
    )

    res.status(201).json({ 
      success: true, 
      task,
      message: 'Task created successfully'
    })
  } catch (error) {
    console.error('Error creating task:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create task',
      message: error.message 
    })
  }
})

/**
 * POST /tasks/:id/approve - Attempt to approve a task
 * Body: { userRole }
 */
app.post('/tasks/:id/approve', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id)
    const { userRole } = req.body

    // Validation
    if (!userRole || userRole.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'userRole is required' 
      })
    }

    // Get the task
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    })

    if (!task) {
      return res.status(404).json({ 
        success: false, 
        error: 'Task not found' 
      })
    }

    // Check if already approved
    if (task.status === 'APPROVED') {
      return res.status(400).json({ 
        success: false, 
        error: 'Task is already approved' 
      })
    }

    // Check if already rejected
    if (task.status === 'REJECTED') {
      return res.status(400).json({ 
        success: false, 
        error: 'Task is already rejected' 
      })
    }

    // Check policy
    const policyCheck = await policyEngine.canApprove(userRole, task.amount)

    if (policyCheck.allowed) {
      // APPROVE THE TASK
      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: { status: 'APPROVED' }
      })

      // Log approval
      await auditService.log(
        `Task approved by ${userRole}: "${task.title}"`,
        taskId,
        { userRole, amount: task.amount, policy: policyCheck.policy }
      )

      res.json({ 
        success: true,
        approved: true,
        task: updatedTask,
        message: policyCheck.reason
      })
    } else {
      // REJECT THE TASK
      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: { status: 'REJECTED' }
      })

      // Log rejection
      await auditService.log(
        `Task rejected - insufficient authority: ${userRole} attempted to approve "${task.title}"`,
        taskId,
        { userRole, amount: task.amount, reason: policyCheck.reason }
      )

      res.json({ 
        success: true,
        approved: false,
        task: updatedTask,
        message: policyCheck.reason
      })
    }
  } catch (error) {
    console.error('Error approving task:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process approval',
      message: error.message 
    })
  }
})

// ============================================
// POLICY ENDPOINTS
// ============================================

/**
 * GET /policies - Get all policies
 */
app.get('/policies', async (req, res) => {
  try {
    const policies = await policyEngine.getAllPolicies()
    res.json({ success: true, count: policies.length, policies })
  } catch (error) {
    console.error('Error fetching policies:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch policies',
      message: error.message 
    })
  }
})

/**
 * POST /policies - Create or update a policy
 * Body: { role, maxAmount }
 */
app.post('/policies', async (req, res) => {
  try {
    const { role, maxAmount } = req.body

    // Validation
    if (!role || role.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'Role is required' 
      })
    }

    if (!maxAmount || maxAmount < 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'maxAmount must be a non-negative number' 
      })
    }

    const policy = await policyEngine.setPolicy(role.trim(), parseInt(maxAmount))

    // Log policy change
    await auditService.log(
      `Policy set: ${role} can approve up to $${maxAmount}`,
      policy.id,
      { role, maxAmount }
    )

    res.status(201).json({ 
      success: true, 
      policy,
      message: 'Policy created/updated successfully'
    })
  } catch (error) {
    console.error('Error setting policy:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to set policy',
      message: error.message 
    })
  }
})

// ============================================
// AUDIT LOG ENDPOINTS
// ============================================

/**
 * GET /audit - Get recent audit logs
 */
app.get('/audit', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const logs = await auditService.getRecentLogs(limit)
    
    res.json({ success: true, count: logs.length, logs })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch audit logs',
      message: error.message 
    })
  }
})

/**
 * GET /audit/:entityId - Get audit logs for a specific entity
 */
app.get('/audit/:entityId', async (req, res) => {
  try {
    const entityId = parseInt(req.params.entityId)
    const logs = await auditService.getLogsForEntity(entityId)
    
    res.json({ success: true, count: logs.length, entityId, logs })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch audit logs',
      message: error.message 
    })
  }
})

// ============================================
// USER ENDPOINTS (Basic CRUD)
// ============================================

/**
 * GET /users - Get all users
 */
app.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { id: 'asc' }
    })
    res.json({ success: true, count: users.length, users })
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch users',
      message: error.message 
    })
  }
})

/**
 * POST /users - Create a new user
 * Body: { email, role }
 */
app.post('/users', async (req, res) => {
  try {
    const { email, role } = req.body

    // Validation
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid email is required' 
      })
    }

    if (!role || role.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'Role is required' 
      })
    }

    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        role: role.trim()
      }
    })

    // Log user creation
    await auditService.log(
      `User created: ${email} with role ${role}`,
      user.id,
      { email, role }
    )

    res.status(201).json({ 
      success: true, 
      user,
      message: 'User created successfully'
    })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already exists' 
      })
    }
    
    console.error('Error creating user:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create user',
      message: error.message 
    })
  }
})

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found',
    path: req.path
  })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: err.message 
  })
})

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('========================================')
  console.log('🚀 Workflow Engine API')
  console.log(`📡 Server running on http://localhost:${PORT}`)
  console.log('========================================')
  console.log('Available endpoints:')
  console.log('  GET    /health')
  console.log('  GET    /tasks')
  console.log('  POST   /tasks')
  console.log('  GET    /tasks/:id')
  console.log('  POST   /tasks/:id/approve')
  console.log('  GET    /policies')
  console.log('  POST   /policies')
  console.log('  GET    /audit')
  console.log('  GET    /users')
  console.log('  POST   /users')
  console.log('========================================')
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  await prisma.$disconnect()
  process.exit(0)
})