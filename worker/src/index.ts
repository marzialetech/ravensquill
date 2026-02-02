// Cloudflare Worker API for Raven's Quill Bookstore
// Handles Square inventory sync, cart, and checkout

import {
  Env,
  getItemsFromKV,
  syncInventoryToKV,
  createOrder,
  createPayment,
  SquareItem,
} from './square';

// CORS headers
function corsHeaders(env: Env): HeadersInit {
  return {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data: unknown, env: Env, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env),
    },
  });
}

function errorResponse(message: string, env: Env, status = 500): Response {
  return jsonResponse({ error: message }, env, status);
}

// Route handlers
async function handleGetItems(env: Env): Promise<Response> {
  try {
    const items = await getItemsFromKV(env);

    // Check if we have cached items
    if (items.length === 0) {
      // No cached items, try to sync
      const freshItems = await syncInventoryToKV(env);
      return jsonResponse({ items: freshItems, synced: true }, env);
    }

    return jsonResponse({ items }, env);
  } catch (error) {
    console.error('Error fetching items:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch items',
      env
    );
  }
}

async function handleSync(env: Env): Promise<Response> {
  try {
    const items = await syncInventoryToKV(env);
    return jsonResponse({
      success: true,
      itemCount: items.length,
      syncedAt: new Date().toISOString(),
    }, env);
  } catch (error) {
    console.error('Sync error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Sync failed',
      env
    );
  }
}

interface WebhookEvent {
  type: string;
  data?: {
    object?: {
      catalog_object?: {
        catalog_object_id?: string;
      };
    };
  };
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.text();
    const event = JSON.parse(body) as WebhookEvent;

    console.log('Received webhook:', event.type);

    // Handle inventory and catalog update events
    if (
      event.type === 'inventory.count.updated' ||
      event.type === 'catalog.version.updated'
    ) {
      // Trigger a full sync when inventory changes
      await syncInventoryToKV(env);
      console.log('Inventory synced due to webhook');
    }

    return jsonResponse({ received: true }, env);
  } catch (error) {
    console.error('Webhook error:', error);
    return errorResponse('Webhook processing failed', env, 400);
  }
}

interface CartItem {
  variationId: string;
  quantity: number;
}

interface CartRequest {
  items: CartItem[];
}

async function handleCreateCart(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as CartRequest;

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return errorResponse('Invalid cart: items array required', env, 400);
    }

    // Validate items exist in inventory
    const cachedItems = await getItemsFromKV(env);
    const itemMap = new Map<string, SquareItem>();
    for (const item of cachedItems) {
      itemMap.set(item.variationId, item);
    }

    for (const cartItem of body.items) {
      if (!itemMap.has(cartItem.variationId)) {
        return errorResponse(`Item not found: ${cartItem.variationId}`, env, 400);
      }
    }

    // Create Square order
    const order = await createOrder(env, body.items);

    return jsonResponse({
      orderId: order.orderId,
      totalCents: order.total,
    }, env);
  } catch (error) {
    console.error('Cart error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to create order',
      env
    );
  }
}

interface PaymentRequest {
  orderId: string;
  sourceId: string;  // Payment token from Square Web Payments SDK
  amountCents: number;
}

async function handlePayment(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as PaymentRequest;

    if (!body.orderId || !body.sourceId || !body.amountCents) {
      return errorResponse('Missing required fields: orderId, sourceId, amountCents', env, 400);
    }

    const payment = await createPayment(
      env,
      body.orderId,
      body.sourceId,
      body.amountCents
    );

    return jsonResponse({
      success: payment.status === 'COMPLETED',
      paymentId: payment.paymentId,
      status: payment.status,
    }, env);
  } catch (error) {
    console.error('Payment error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Payment failed',
      env
    );
  }
}

// Health check endpoint
function handleHealth(env: Env): Response {
  return jsonResponse({
    status: 'ok',
    environment: env.SQUARE_ENVIRONMENT,
    timestamp: new Date().toISOString(),
  }, env);
}

// Main request handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env),
      });
    }

    // Route requests
    try {
      // GET /api/items - Get cached inventory
      if (method === 'GET' && path === '/api/items') {
        return handleGetItems(env);
      }

      // POST /api/sync - Manual sync trigger
      if (method === 'POST' && path === '/api/sync') {
        return handleSync(env);
      }

      // POST /api/webhook - Square webhook handler
      if (method === 'POST' && path === '/api/webhook') {
        return handleWebhook(request, env);
      }

      // POST /api/cart - Create order from cart
      if (method === 'POST' && path === '/api/cart') {
        return handleCreateCart(request, env);
      }

      // POST /api/payment - Process payment
      if (method === 'POST' && path === '/api/payment') {
        return handlePayment(request, env);
      }

      // GET /api/health - Health check
      if (method === 'GET' && (path === '/api/health' || path === '/')) {
        return handleHealth(env);
      }

      // 404 for unknown routes
      return errorResponse('Not found', env, 404);
    } catch (error) {
      console.error('Request error:', error);
      return errorResponse('Internal server error', env);
    }
  },
};
