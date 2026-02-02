// Square API client wrapper for Cloudflare Workers

export interface Env {
  INVENTORY_KV: KVNamespace;
  SQUARE_ACCESS_TOKEN: string;
  SQUARE_APPLICATION_ID: string;
  SQUARE_LOCATION_ID: string;
  SQUARE_ENVIRONMENT: string;
  WEBHOOK_SIGNATURE_KEY?: string;
  CORS_ORIGIN: string;
}

export interface SquareItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  category?: string;
  inStock: boolean;
  quantity?: number;
  variationId: string;
}

export interface SquareCatalogObject {
  type: string;
  id: string;
  item_data?: {
    name: string;
    description?: string;
    category_id?: string;
    variations?: Array<{
      id: string;
      item_variation_data?: {
        name: string;
        price_money?: {
          amount: number;
          currency: string;
        };
      };
    }>;
  };
  image_data?: {
    url?: string;
  };
}

export interface SquareInventoryCount {
  catalog_object_id: string;
  quantity: string;
  state: string;
}

function getBaseUrl(env: Env): string {
  return env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

function getHeaders(env: Env): HeadersInit {
  return {
    'Authorization': `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Square-Version': '2024-01-18',
  };
}

export async function fetchCatalogItems(env: Env): Promise<SquareCatalogObject[]> {
  const baseUrl = getBaseUrl(env);
  const allItems: SquareCatalogObject[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(`${baseUrl}/v2/catalog/list`);
    url.searchParams.set('types', 'ITEM,IMAGE');
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: getHeaders(env),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Square API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      objects?: SquareCatalogObject[];
      cursor?: string;
    };

    if (data.objects) {
      allItems.push(...data.objects);
    }
    cursor = data.cursor;
  } while (cursor);

  return allItems;
}

export async function fetchInventoryCounts(env: Env, catalogObjectIds: string[]): Promise<Map<string, number>> {
  const baseUrl = getBaseUrl(env);
  const inventoryMap = new Map<string, number>();

  // Square API limits to 100 items per request
  const chunks = [];
  for (let i = 0; i < catalogObjectIds.length; i += 100) {
    chunks.push(catalogObjectIds.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const response = await fetch(`${baseUrl}/v2/inventory/counts/batch-retrieve`, {
      method: 'POST',
      headers: getHeaders(env),
      body: JSON.stringify({
        catalog_object_ids: chunk,
        location_ids: [env.SQUARE_LOCATION_ID],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Inventory fetch error: ${response.status} - ${error}`);
      continue;
    }

    const data = await response.json() as { counts?: SquareInventoryCount[] };

    if (data.counts) {
      for (const count of data.counts) {
        if (count.state === 'IN_STOCK') {
          const qty = parseInt(count.quantity, 10) || 0;
          inventoryMap.set(count.catalog_object_id, qty);
        }
      }
    }
  }

  return inventoryMap;
}

export async function syncInventoryToKV(env: Env): Promise<SquareItem[]> {
  // Fetch all catalog items
  const catalogObjects = await fetchCatalogItems(env);

  // Separate items and images
  const items = catalogObjects.filter(obj => obj.type === 'ITEM');
  const images = catalogObjects.filter(obj => obj.type === 'IMAGE');

  // Create image lookup map
  const imageMap = new Map<string, string>();
  for (const img of images) {
    if (img.image_data?.url) {
      imageMap.set(img.id, img.image_data.url);
    }
  }

  // Get all variation IDs for inventory lookup
  const variationIds: string[] = [];
  for (const item of items) {
    if (item.item_data?.variations) {
      for (const variation of item.item_data.variations) {
        variationIds.push(variation.id);
      }
    }
  }

  // Fetch inventory counts
  const inventoryCounts = await fetchInventoryCounts(env, variationIds);

  // Transform to our format
  const transformedItems: SquareItem[] = [];

  for (const item of items) {
    if (!item.item_data?.variations?.length) continue;

    // Use first variation for simplicity (can expand later for multi-variant items)
    const variation = item.item_data.variations[0];
    const variationData = variation.item_variation_data;

    if (!variationData) continue;

    const quantity = inventoryCounts.get(variation.id) ?? 0;

    transformedItems.push({
      id: item.id,
      variationId: variation.id,
      name: item.item_data.name,
      description: item.item_data.description,
      price: variationData.price_money?.amount ?? 0,
      currency: variationData.price_money?.currency ?? 'USD',
      category: item.item_data.category_id,
      inStock: quantity > 0,
      quantity: quantity,
    });
  }

  // Store in KV
  await env.INVENTORY_KV.put('items', JSON.stringify(transformedItems), {
    metadata: { lastSync: new Date().toISOString() },
  });

  // Also store individual items for quick lookup
  for (const item of transformedItems) {
    await env.INVENTORY_KV.put(`item:${item.id}`, JSON.stringify(item));
  }

  return transformedItems;
}

export async function getItemsFromKV(env: Env): Promise<SquareItem[]> {
  const data = await env.INVENTORY_KV.get('items');
  if (!data) {
    return [];
  }
  return JSON.parse(data) as SquareItem[];
}

export interface CreateOrderParams {
  items: Array<{ variationId: string; quantity: number }>;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export async function createOrder(env: Env, params: CreateOrderParams): Promise<{ orderId: string; total: number }> {
  const baseUrl = getBaseUrl(env);

  const lineItems = params.items.map(item => ({
    quantity: item.quantity.toString(),
    catalog_object_id: item.variationId,
  }));

  const metadata: Record<string, string> = {};
  if (params.customerName) metadata.customer_name = params.customerName;
  if (params.customerEmail) metadata.customer_email = params.customerEmail;
  if (params.customerPhone) metadata.customer_phone = params.customerPhone;
  metadata.fulfillment = 'pickup';

  const orderBody: Record<string, unknown> = {
    location_id: env.SQUARE_LOCATION_ID,
    line_items: lineItems,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };

  const response = await fetch(`${baseUrl}/v2/orders`, {
    method: 'POST',
    headers: getHeaders(env),
    body: JSON.stringify({
      order: orderBody,
      idempotency_key: crypto.randomUUID(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Create order failed: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    order: {
      id: string;
      total_money: { amount: number };
    };
  };

  return {
    orderId: data.order.id,
    total: data.order.total_money.amount,
  };
}

export async function createPayment(
  env: Env,
  orderId: string,
  sourceId: string,
  amountCents: number
): Promise<{ paymentId: string; status: string }> {
  const baseUrl = getBaseUrl(env);

  const response = await fetch(`${baseUrl}/v2/payments`, {
    method: 'POST',
    headers: getHeaders(env),
    body: JSON.stringify({
      source_id: sourceId,
      idempotency_key: crypto.randomUUID(),
      amount_money: {
        amount: amountCents,
        currency: 'USD',
      },
      order_id: orderId,
      location_id: env.SQUARE_LOCATION_ID,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Payment failed: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    payment: {
      id: string;
      status: string;
    };
  };

  return {
    paymentId: data.payment.id,
    status: data.payment.status,
  };
}

// Verify Square webhook signature
export function verifyWebhookSignature(
  body: string,
  signature: string,
  signatureKey: string,
  url: string
): boolean {
  // Square uses HMAC-SHA256 for webhook signatures
  // The signature is computed over: url + body
  // For now, we'll do a basic check - in production, use SubtleCrypto
  // This is a placeholder - proper implementation requires async crypto
  return signature.length > 0 && signatureKey.length > 0;
}
