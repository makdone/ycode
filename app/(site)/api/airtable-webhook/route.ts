import { NextRequest, NextResponse } from 'next/server';
import { processWebhookNotification } from '@/lib/apps/airtable/sync-service';
import { getTenantIdFromHeaders } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/airtable-webhook
 * Public endpoint for Airtable webhook notifications.
 * No authentication — Airtable sends POST with base.id and webhook.id.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const baseId = body?.base?.id;
    const webhookId = body?.webhook?.id;

    if (!baseId || !webhookId) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Capture tenant context while still in request scope — AsyncLocalStorage
    // may not survive the fire-and-forget boundary below.
    const tenantId = await getTenantIdFromHeaders();

    // Process async — don't block the webhook response
    processWebhookNotification(baseId, webhookId, tenantId).catch((err) => {
      console.error('[Airtable Webhook] Sync error:', err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Airtable Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
