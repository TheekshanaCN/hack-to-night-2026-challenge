export async function GET() {
  return Response.json(
    { ok: false, message: 'Forbidden. Admin authentication required.' },
    { status: 403 }
  )
}
