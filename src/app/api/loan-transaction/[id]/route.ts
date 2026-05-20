import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await params;

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      include: { members: true }
    })

    if (!user?.members) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const loan = await prisma.loans.findFirst({
      where: {
        id: BigInt(resolvedParams.id),
        member_id: user.members.id
      },
      include: {
        loan_schedules: { orderBy: { due_date: "asc" } },
        loan_applications: { include: { loan_products: true } }
      }
    })

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    return NextResponse.json({
      id: Number(loan.id),
      loan_no: loan.loan_no,
      principal: Number(loan.principal),
      outstanding: Number(loan.outstanding_principal),
      monthly_installment: Number(loan.monthly_installment),
      tenor_months: loan.tenor_months,
      disbursed_at: loan.disbursed_at?.toISOString().split("T")[0],
      last_due_date: loan.last_due_date?.toISOString().split("T")[0],
      status: loan.status,
      repayment_method: loan.repayment_method,
      product: loan.loan_applications?.loan_products ? {
        name: loan.loan_applications.loan_products.name,
        code: loan.loan_applications.loan_products.code,
        interest_rate: Number(loan.loan_applications.loan_products.interest_rate),
        max_tenor: loan.loan_applications.loan_products.max_tenor,
      } : null,
      loan_schedules: loan.loan_schedules.map(s => ({
        id: Number(s.id),
        due_date: s.due_date,
        principal_payment: Number(s.principal_due),
        interest_payment: Number(s.interest_due),
        total_payment: Number(s.total_due),
        status: s.status,
      })),
    })
  } catch (error) {
    console.error("Error fetching loan transaction:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}