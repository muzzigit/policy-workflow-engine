import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Audit Service - Records all important system actions
 * Critical for compliance, debugging, and accountability
 */
class AuditService {
  /**
   * Log an action to the audit trail
   * @param {string} action - Description of what happened
   * @param {number} entityId - ID of the affected entity (task, user, etc.)
   * @param {object} metadata - Additional context (optional)
   * @returns {Promise<object>}
   */
  async log(action, entityId, metadata = {}) {
    try {
      const auditLog = await prisma.auditLog.create({
        data: {
          action,
          entityId,
          timestamp: new Date()
        }
      })

      // Also log to console for development
      console.log(`[AUDIT] ${action} | Entity: ${entityId} |`, metadata)

      return auditLog
    } catch (error) {
      console.error('Failed to create audit log:', error)
      // Don't throw - audit failure shouldn't break the main operation
      return null
    }
  }

  /**
   * Get audit logs for a specific entity
   * @param {number} entityId - Entity ID to query
   * @returns {Promise<Array>}
   */
  async getLogsForEntity(entityId) {
    return await prisma.auditLog.findMany({
      where: { entityId },
      orderBy: { timestamp: 'desc' }
    })
  }

  /**
   * Get recent audit logs
   * @param {number} limit - Number of logs to return
   * @returns {Promise<Array>}
   */
  async getRecentLogs(limit = 50) {
    return await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit
    })
  }

  /**
   * Get audit logs within a time range
   * @param {Date} startDate 
   * @param {Date} endDate 
   * @returns {Promise<Array>}
   */
  async getLogsByDateRange(startDate, endDate) {
    return await prisma.auditLog.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { timestamp: 'desc' }
    })
  }
}

export default new AuditService()
