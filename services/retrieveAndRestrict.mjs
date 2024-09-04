import dotenv from 'dotenv';
import fetch from 'node-fetch';

import { refreshJWTToken } from './refreshJWTToken.mjs';

dotenv.config();

let restrictedSKUs = new Set(); // Use a Set to store unique SKUs and their variants

async function initializeRestrictedSKUs() {
  const knifeCategoryId = 24;
  const fetchedSKUs = await fetchProductsByCategory(knifeCategoryId);

  fetchedSKUs.forEach(({ baseSku, variantSkus }) => {
    restrictedSKUs.add(baseSku);
    variantSkus.forEach(sku => restrictedSKUs.add(sku));
  });

  console.log('Restricted SKUs initialized:', Array.from(restrictedSKUs));
}

async function fetchProductsByCategory(categoryId) {
  const storeHash = process.env.STORE_HASH;
  let hasNextPage = true;
  let endCursor = null;
  const allProducts = [];

  try {
    while (hasNextPage) {
      const response = await fetch(`https://store-${storeHash}.mybigcommerce.com/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.TOKEN}`,
        },
        body: JSON.stringify({
          query: `query ProductsInCategory($categoryId: Int!, $after: String) {
            site {
              category(entityId: $categoryId) {
                name
                products(first: 50, after: $after) {
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                  edges {
                    node {
                      sku
                      variants {
                        edges {
                          node {
                            sku
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }`,
          variables: {
            categoryId,
            after: endCursor,
          },
        }),
      });

      const responseBody = await response.text();
      console.log('Full response for category fetch:', responseBody);

      if (!response.ok) {
        if (response.status === 401 && responseBody.includes('JWT is expired')) {
          console.error('JWT expired. Attempting to refresh token...');
          await refreshJWTToken();
          return fetchProductsByCategory(categoryId);
        }
        throw new Error(`HTTP error! status: ${response.status} Response: ${responseBody}`);
      }

      const data = JSON.parse(responseBody);

      if (data.errors && data.errors.length > 0) {
        console.error('GraphQL errors:', data.errors);
        throw new Error(`GraphQL error: ${data.errors.map(error => error.message).join(', ')}`);
      }

      if (!data.data.site.category) {
        console.warn(`Category with ID ${categoryId} not found.`);
        return [];
      }

      const products = data.data.site.category.products;
      if (!products || products.edges.length === 0) {
        console.warn(`No products found for category ID ${categoryId}.`);
        return [];
      }

      products.edges.forEach(edge => {
        const baseSku = edge.node.sku;
        const variantSkus = edge.node.variants.edges.map(variantEdge => variantEdge.node.sku);
        allProducts.push({ baseSku, variantSkus });
      });

      hasNextPage = products.pageInfo.hasNextPage;
      endCursor = products.pageInfo.endCursor || null;
    }

    return allProducts;
  } catch (error) {
    console.error('Error fetching products by category:', error.message);
    throw error;
  }
}


async function checkAndRemoveRestrictedItems(cartId) {
  const cartItems = await fetchCartItems(cartId);
  let removedItems = [];

  if (!cartItems || cartItems.length === 0) {
    console.error('No items found in cart or error fetching cart.');
    return { message: 'No items found in cart or error fetching cart.', removedItems };
  }

  console.log('Checking for restricted items...');

  for (const item of cartItems) {
    console.log(`Checking item SKU: ${item.sku}`);
    try {
      if (restrictedSKUs.has(item.sku)) {
        console.log(`Restricted item detected (SKU: ${item.sku}, Name: ${item.name}). Removing from cart.`);
        await removeItemFromCart(cartId, item.id);
        removedItems.push({ sku: item.sku, name: item.name });
      } else {
        console.log(`Item SKU: ${item.sku} is allowed.`);
      }
    } catch (error) {
      console.error(`Error processing item with SKU ${item.sku}:`, error);
    }
  }

  console.log('Cart checked for restricted items.');
  console.log('Removed Items:', removedItems);

  return { message: 'Cart checked and updated for restricted items.', removedItems };
}


async function fetchCartItems(cartId) {
  const storeHash = process.env.STORE_HASH;
  const accessToken = process.env.ACCESS_TOKEN;
  const cartUrl = `https://api.bigcommerce.com/stores/${storeHash}/v3/carts/${cartId}`;

  try {
    const response = await fetch(cartUrl, {
      method: 'GET',
      headers: {
        'X-Auth-Token': accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    const responseData = await response.json();
    if (!response.ok) {
      console.error('Error fetching cart items:', responseData);
      throw new Error(`Failed to fetch cart items: ${responseData.title}`);
    }

    const allCartItems = [
      ...responseData.data.line_items.physical_items,
      ...responseData.data.line_items.digital_items || [],
      ...responseData.data.line_items.gift_certificates || [],
      ...responseData.data.line_items.custom_items || [],
    ];

    console.log(`Fetched all cart items: ${JSON.stringify(allCartItems)}`);
    return allCartItems;
  } catch (error) {
    console.error('Error fetching cart items:', error);
    throw error;
  }
}

async function removeItemFromCart(cartId, itemId) {
  const storeHash = process.env.STORE_HASH;
  const accessToken = process.env.ACCESS_TOKEN;
  const cartUrl = `https://api.bigcommerce.com/stores/${storeHash}/v3/carts/${cartId}/items/${itemId}`;

  try {
    const response = await fetch(cartUrl, {
      method: 'DELETE',
      headers: {
        'X-Auth-Token': accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to remove item from cart:', errorData);
      throw new Error(`Failed to remove item from cart: ${errorData.title}`);
    }

    console.log(`Item with ID ${itemId} removed from cart ${cartId} successfully.`);
  } catch (error) {
    console.error('Error removing item from cart:', error);
    throw error;
  }
}

const endpoint_domain = process.env.ENDPOINT_DOMAIN;

async function validateCart(cartId) {

  const validateCartUrl = `https://${endpoint_domain}.ondigitalocean.app/`;

  try {
    const removedItems = await checkAndRemoveRestrictedItems(cartId);

    const response = await fetch(validateCartUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cartId: cartId,
        restrictedSKUs: Array.from(restrictedSKUs),
        removedItems: removedItems,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to validate cart: ${errorData.message}`);
    }

    const responseData = await response.json();
    console.log('Cart validated successfully:', responseData);

    responseData.removedItems = removedItems;
    return responseData;
  } catch (error) {
    console.error('Error validating cart:', error);
    throw error;
  }
}

initializeRestrictedSKUs();

export default {
  initializeRestrictedSKUs,
  checkAndRemoveRestrictedItems,
  fetchCartItems,
  removeItemFromCart,
  validateCart,
};