import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Policy Engine - Determines if a task can be approved based on role and amount
 * This is the core business logic that enforces approval rules
 */
class PolicyEngine {
  /**
   * Check if a user with given role can approve a task
   * @param {string} role - User's role (e.g., 'employee', 'manager', 'director')
   * @param {number} amount - Task amount to approve
   * @returns {Promise<{allowed: boolean, policy: object|null, reason: string}>}
   */
  async canApprove(role, amount) {
    try {
      // Find the policy for this role
      const policy = await prisma.policy.findFirst({
        where: { role: role }
      })

      // No policy found for this role
      if (!policy) {
        return {
          allowed: false,
          policy: null,
          reason: `No policy found for role: ${role}`
        }
      }

      // Check if amount is within policy limit
      const allowed = amount <= policy.maxAmount

      return {
        allowed,
        policy,
        reason: allowed 
          ? `Approved: ${role} can approve up to $${policy.maxAmount}`
          : `Rejected: ${role} can only approve up to $${policy.maxAmount}, but task requires $${amount}`
      }
    } catch (error) {
      console.error('Policy engine error:', error)
      return {
        allowed: false,
        policy: null,
        reason: `Error checking policy: ${error.message}`
      }
    }
  }

  /**
   * Get all policies
   * @returns {Promise<Array>}
   */
  async getAllPolicies() {
    return await prisma.policy.findMany({
      orderBy: { maxAmount: 'asc' }
    })
  }

  /**
   * Create or update a policy
   * @param {string} role - Role name
   * @param {number} maxAmount - Maximum amount this role can approve
   * @returns {Promise<object>}
   */
  async setPolicy(role, maxAmount) {
    // Check if policy exists
    const existing = await prisma.policy.findFirst({
      where: { role }
    })

    if (existing) {
      // Update existing policy
      return await prisma.policy.update({
        where: { id: existing.id },
        data: { maxAmount }
      })
    } else {
      // Create new policy
      return await prisma.policy.create({
        data: { role, maxAmount }
      })
    }
  }
}

export default new PolicyEngine()
