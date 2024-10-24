import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { getJwtToken } from './refreshJWTToken.mjs';  // Import only getJwtToken
import { getLogger } from '../utils/logger.mjs'; // Import the logger
const logger = getLogger('info');  // Create a logger instance with the desired log level

dotenv.config();

let restrictedSKUs = new Set(); // Use a Set to store unique SKUs and their variants

async function initializeRestrictedSKUs() {
  const knifeCategoryId = parseInt(process.env.CATEGORY_ID, 10);
  const fetchedSKUs = await fetchProductsByCategory(knifeCategoryId);

  fetchedSKUs.forEach(({ baseSku, variantSkus }) => {
    if (baseSku) {
      restrictedSKUs.add(baseSku.trim().toUpperCase()); // Ensure SKU is normalized
    }
    if (variantSkus && Array.isArray(variantSkus)) {
      variantSkus.forEach(sku => {
        if (sku) {
          restrictedSKUs.add(sku.trim().toUpperCase());
        }
      });
    }
  });

  // logger.info('Restricted SKUs initialized:', Array.from(restrictedSKUs));
}

async function fetchProductsByCategory(categoryId) {
  const storeHash = process.env.STORE_HASH;
  let hasNextPage = true;
  let endCursor = null;
  const allProducts = [];

  try {
    // Ensure the JWT token is valid before making the API call
    const jwtToken = await getJwtToken();

    while (hasNextPage) {
      const response = await fetch(`https://store-${storeHash}.mybigcommerce.com/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtToken}`, // Use the valid JWT token
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
      // logger.info('Full response for category fetch:', responseBody);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} Response: ${responseBody}`);
      }

      const data = JSON.parse(responseBody);

      if (data.errors && data.errors.length > 0) {
        logger.error('GraphQL errors:', data.errors);
        throw new Error(`GraphQL error: ${data.errors.map(error => error.message).join(', ')}`);
      }

      if (!data.data.site.category) {
        logger.warn(`Category with ID ${categoryId} not found.`);
        return [];
      }

      const products = data.data.site.category.products;
      if (!products || products.edges.length === 0) {
        logger.warn(`No products found for category ID ${categoryId}.`);
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
    logger.error('Error fetching products by category:', error.message);
    throw error;
  }
}

// Assuming fetchCartItems and removeItemFromCart are correct
async function checkAndRemoveRestrictedItems(cartId) {
  const cartItems = await fetchCartItems(cartId);
  let removedItems = [];

  if (!cartItems || cartItems.length === 0) {
      logger.error('No items found in cart or error fetching cart.');
      return { message: 'No items found in cart or error fetching cart.', removedItems };
  }

  logger.info('Checking for restricted items...');

  for (const item of cartItems) {
      logger.info(`Checking item SKU: ${item.sku}`);
      try {
          if (restrictedSKUs.has(item.sku.trim().toUpperCase())) {
              logger.info(`Restricted item detected (SKU: ${item.sku}, Name: ${item.name}). Removing from cart.`);
              await removeItemFromCart(cartId, item.id);
              removedItems.push({ sku: item.sku, name: item.name });  // Ensure 'name' is included
          } else {
              logger.info(`Item SKU: ${item.sku} is allowed.`);
          }
      } catch (error) {
          logger.error(`Error processing item with SKU ${item.sku}:`, error);
      }
  }

  logger.info('Cart checked for restricted items.');
  logger.info('Removed Items:', removedItems);

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
      logger.error('Error fetching cart items:', responseData);
      throw new Error(`Failed to fetch cart items: ${responseData.title}`);
    }

    const allCartItems = [
      ...responseData.data.line_items.physical_items,
      ...responseData.data.line_items.digital_items || [],
      ...responseData.data.line_items.gift_certificates || [],
      ...responseData.data.line_items.custom_items || [],
    ];

    logger.info(`Fetched all cart items: ${JSON.stringify(allCartItems)}`);
    return allCartItems;
  } catch (error) {
    logger.error('Error fetching cart items:', error);
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
      logger.error('Failed to remove item from cart:', errorData);
      throw new Error(`Failed to remove item from cart: ${errorData.title}`);
    }

    logger.info(`Item with ID ${itemId} removed from cart ${cartId} successfully.`);
  } catch (error) {
    logger.error('Error removing item from cart:', error);
    throw error;
  }
}

async function validateCart(cartId) {
  try {
    const removedItems = await checkAndRemoveRestrictedItems(cartId);

    // Fetch the updated cart after removing restricted items
    const updatedCartItems = await fetchCartItems(cartId);

    logger.info('Cart validated successfully:', { removedItems, updatedCartItems });
    return { removedItems, updatedCartItems };  // Return both removed items and updated cart items
  } catch (error) {
    logger.error('Error validating cart:', error);
    throw error;
  }
}

// Initialize restricted SKUs when the module is loaded
initializeRestrictedSKUs();

export default {
  initializeRestrictedSKUs,
  checkAndRemoveRestrictedItems,
  fetchCartItems,
  removeItemFromCart,
  validateCart,
};
