import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Simula o tempo de um insert no banco de dados e dados mockados
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return NextResponse.json({ 
      success: true, 
      question: { 
        id: 'mock-id-123', 
        content: body.question,
        sender_name: body.name || 'Anônimo',
        price_paid: body.amount,
        status: 'pending',
        created_at: new Date().toISOString()
      } 
    })
  } catch (error: any) {
    console.error("API /questions error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
