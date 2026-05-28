'use server'

import { prisma } from '@/lib/db/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/actions/log-audit'

// ============================================
// LOYALTY PROGRAMS
// ============================================

export async function createLoyaltyProgram(
  programCode: string,
  programName: string,
  pointsPerRupiah: number,
  minimumPurchase: number,
  description?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const program = await prisma.loyalty_programs.create({
      data: {
        program_code: programCode,
        program_name: programName,
        points_per_rupiah: pointsPerRupiah,
        minimum_purchase: minimumPurchase,
        description,
      },
    })

    revalidatePath('/dashboard/toko/loyalty')
    return { success: true, data: program }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create program',
    }
  }
}

export async function getLoyaltyPrograms(isActive: boolean = true) {
  try {
    const programs = await prisma.loyalty_programs.findMany({
      where: { is_active: isActive },
      include: {
        _count: {
          select: {
            memberships: true,
          },
        },
      },
    })

    return { success: true, data: programs }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch programs',
    }
  }
}

// ============================================
// LOYALTY MEMBERSHIP
// ============================================

export async function enrollMemberToLoyaltyProgram(
  memberId: bigint,
  programId: bigint,
  membershipLevel: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze'
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const membership = await prisma.loyalty_memberships.upsert({
      where: {
        member_id_program_id: {
          member_id: memberId,
          program_id: programId,
        },
      },
      update: {
        membership_level: membershipLevel,
        last_activity: new Date(),
      },
      create: {
        member_id: memberId,
        program_id: programId,
        membership_level: membershipLevel,
        member_since: new Date(),
      },
      include: {
        members: true,
        loyalty_programs: true,
      },
    })

    revalidatePath('/dashboard/toko/loyalty')
    return { success: true, data: membership }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enroll member',
    }
  }
}

export async function addLoyaltyPoints(
  memberId: bigint,
  programId: bigint,
  points: number,
  reason: string = 'Purchase'
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const membership = await prisma.loyalty_memberships.findUnique({
      where: {
        member_id_program_id: {
          member_id: memberId,
          program_id: programId,
        },
      },
    })

    if (!membership) throw new Error('Membership not found')

    const updated = await prisma.loyalty_memberships.update({
      where: { id: membership.id },
      data: {
        total_points: { increment: points },
        points_available: { increment: points },
        last_activity: new Date(),
      },
      include: {
        members: true,
      },
    })

    await logAudit({
      action: 'UPDATE',
      modelType: 'loyalty_memberships',
      modelId: Number(membership.id),
      oldValues: { total_points: Number(membership.total_points), points_available: Number(membership.points_available) },
      newValues: { total_points: Number(membership.total_points) + points, points_available: Number(membership.points_available) + points, reason, added_points: points },
    })
    revalidatePath('/dashboard/toko/loyalty')
    return { success: true, data: updated }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add points',
    }
  }
}

export async function redeemLoyaltyPoints(
  memberId: bigint,
  programId: bigint,
  pointsToRedeem: number,
  orderId?: bigint
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const membership = await prisma.loyalty_memberships.findUnique({
      where: {
        member_id_program_id: {
          member_id: memberId,
          program_id: programId,
        },
      },
    })

    if (!membership) throw new Error('Membership not found')
    if (Number(membership.points_available) < pointsToRedeem) {
      throw new Error('Insufficient points')
    }

    const program = await prisma.loyalty_programs.findUnique({
      where: { id: programId },
    })

    if (!program) throw new Error('Program not found')

    // Assume 1 point = Rp 100
    const discountAmount = pointsToRedeem * 100

    const updated = await prisma.loyalty_memberships.update({
      where: { id: membership.id },
      data: {
        points_used: { increment: pointsToRedeem },
        points_available: { decrement: pointsToRedeem },
        last_activity: new Date(),
      },
    })

    // Create redemption record
    const redemption = await prisma.loyalty_redemptions.create({
      data: {
        membership_id: membership.id,
        program_id: programId,
        order_id: orderId,
        points_redeemed: pointsToRedeem,
        discount_amount: discountAmount,
        redemption_date: new Date(),
      },
    })

    await logAudit({
      action: 'UPDATE',
      modelType: 'loyalty_memberships',
      modelId: Number(membership.id),
      oldValues: { points_available: Number(membership.points_available), points_used: Number(membership.points_used) },
      newValues: { points_redeemed: pointsToRedeem, discount_amount: discountAmount, order_id: orderId ? Number(orderId) : null },
    })
    revalidatePath('/dashboard/toko/loyalty')
    return { success: true, data: { membership: updated, redemption, discountAmount } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to redeem points',
    }
  }
}

export async function getMembershipStatus(
  memberId: bigint,
  programId: bigint
) {
  try {
    const membership = await prisma.loyalty_memberships.findUnique({
      where: {
        member_id_program_id: {
          member_id: memberId,
          program_id: programId,
        },
      },
      include: {
        members: true,
        loyalty_programs: true,
      },
    })

    if (!membership) {
      return { success: false, error: 'Membership not found' }
    }

    return { success: true, data: membership }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch membership',
    }
  }
}

// ============================================
// PRICE TIERS (RETAIL/WHOLESALE/VIP)
// ============================================

export async function setPriceTier(
  productId: bigint,
  tierName: 'retail' | 'wholesale' | 'vip' | 'distributor',
  minQty: number,
  price: number,
  discountPct?: number
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const tier = await prisma.price_tiers.upsert({
      where: {
        product_id_tier_name_min_qty: {
          product_id: productId,
          tier_name: tierName,
          min_qty: minQty,
        },
      },
      update: {
        price,
        discount_pct: discountPct,
        updated_at: new Date(),
      },
      create: {
        product_id: productId,
        tier_name: tierName,
        min_qty: minQty,
        price,
        discount_pct: discountPct,
      },
      include: {
        products: true,
      },
    })

    revalidatePath('/dashboard/toko/pricing')
    return { success: true, data: tier }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set price tier',
    }
  }
}

export async function getPriceTiers(productId: bigint) {
  try {
    const tiers = await prisma.price_tiers.findMany({
      where: { product_id: productId, is_active: true },
      orderBy: [{ tier_name: 'asc' }, { min_qty: 'asc' }],
    })

    return { success: true, data: tiers }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tiers',
    }
  }
}

export async function getApplicablePriceTier(
  productId: bigint,
  qty: number,
  tierName: string
) {
  try {
    const tier = await prisma.price_tiers.findFirst({
      where: {
        product_id: productId,
        tier_name: tierName as any,
        min_qty: { lte: qty },
        is_active: true,
      },
      orderBy: { min_qty: 'desc' },
    })

    if (!tier) {
      // Return default product price if no tier match
      const product = await prisma.products.findUnique({
        where: { id: productId },
      })
      return { success: true, data: { price: product?.price, tier: null } }
    }

    return { success: true, data: tier }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch price',
    }
  }
}

// ============================================
// CUSTOMER SEGMENTATION
// ============================================

export async function createCustomerSegment(
  segmentCode: string,
  segmentName: string,
  minPurchaseAmt?: number,
  maxPurchaseAmt?: number,
  description?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const segment = await prisma.customer_segments.create({
      data: {
        segment_code: segmentCode,
        segment_name: segmentName,
        min_purchase_amt: minPurchaseAmt,
        max_purchase_amt: maxPurchaseAmt,
        description,
      },
    })

    revalidatePath('/dashboard/toko/segmentation')
    return { success: true, data: segment }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create segment',
    }
  }
}

export async function getCustomerSegments(isActive: boolean = true) {
  try {
    const segments = await prisma.customer_segments.findMany({
      where: { is_active: isActive },
      orderBy: { segment_name: 'asc' },
    })

    return { success: true, data: segments }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch segments',
    }
  }
}

// ============================================
// CUSTOMER PURCHASE HISTORY & ANALYTICS
// ============================================

export async function getMemberPurchaseHistory(
  memberId: bigint,
  limit: number = 30
) {
  try {
    const orders = await prisma.orders.findMany({
      where: { member_id: memberId },
      include: {
        order_items: {
          include: {
            products: true,
          },
        },
      },
      orderBy: { ordered_at: 'desc' },
      take: limit,
    })

    const totalSpent = orders.reduce((sum: any, o: any) => sum + Number(o.grand_total), 0)
    const avgOrderValue = totalSpent / (orders.length || 1)

    return {
      success: true,
      data: {
        orders,
        totalOrders: orders.length,
        totalSpent,
        avgOrderValue,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch history',
    }
  }
}

export async function getMemberLoyaltyStatus(memberId: bigint) {
  try {
    const memberships = await prisma.loyalty_memberships.findMany({
      where: { member_id: memberId },
      include: {
        loyalty_programs: true,
        members: true,
      },
    })

    const purchaseHistory = await prisma.orders.findMany({
      where: { member_id: memberId },
      orderBy: { ordered_at: 'desc' },
      take: 1,
    })

    return {
      success: true,
      data: {
        memberships,
        lastPurchase: purchaseHistory[0]?.ordered_at,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch status',
    }
  }
}
