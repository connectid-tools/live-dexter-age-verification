import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { getJwtToken } from './refreshJWTToken.mjs';  // Import only getJwtToken
import { getLogger } from '../utils/logger.mjs'; // Import the logger
const logger = getLogger('info');  // Create a logger instance with the desired log level

// Load environment variables from .env file
dotenv.config();

// Set to store unique SKUs and their variants
let restrictedSKUs = new Set(); 

// Function to initialize and refresh restricted SKUs
export async function initializeRestrictedSKUs() {
    logger.info('Starting to initialize restricted SKUs...');
    const knifeCategoryId = parseInt(process.env.CATEGORY_ID, 10);
    try {
        const fetchedSKUs = await fetchProductsByCategory(knifeCategoryId);

        if (!fetchedSKUs || fetchedSKUs.length === 0) {
            logger.warn('No SKUs fetched for the category. Please check the GraphQL query and response.');
            return;
        }

        fetchedSKUs.forEach(({ baseSku, variantSkus }) => {
            if (baseSku) {
                restrictedSKUs.add(baseSku.trim().toUpperCase()); // Normalize SKUs when adding
            } else {
                logger.warn('baseSku is undefined or null:', baseSku);
            }

            if (variantSkus && Array.isArray(variantSkus)) {
                variantSkus.forEach(sku => {
                    if (sku) {
                        restrictedSKUs.add(sku.trim().toUpperCase()); // Normalize SKUs when adding
                    } else {
                        logger.warn('variantSku is undefined or null:', sku);
                    }
                });
            } else {
                logger.warn('variantSkus is undefined, null, or not an array:', variantSkus);
            }
        });

        logger.info('Restricted SKUs initialized:', Array.from(restrictedSKUs));
    } catch (error) {
        logger.error('Error initializing restricted SKUs:', error);
    }
}

// Function to fetch cart items
export async function fetchCartItems(cartId) {
    const storeHash = process.env.STORE_HASH;
    const accessToken = process.env.ACCESS_TOKEN;
    const cartUrl = `https://api.bigcommerce.com/stores/${storeHash}/v3/carts/${cartId}`;

    try {
        const response = await fetch(cartUrl, {
            method: 'GET',
            headers: {
                'X-Auth-Token': accessToken,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
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
            ...responseData.data.line_items.custom_items || []
        ];

        logger.info(`Fetched all cart items: ${JSON.stringify(allCartItems)}`);
        return allCartItems;
    } catch (error) {
        logger.error('Error fetching cart items:', error);
        throw error;
    }
}

// Function to handle the restricted-items endpoint
export async function handleRestrictedItemsRequest(req, res) {
    const { cartId } = req.body;
    
    try {
        if (!restrictedSKUs || restrictedSKUs.size === 0) {
            await initializeRestrictedSKUs();
        }

        const cartItems = await fetchCartItems(cartId);
        const cartSKUs = cartItems.map(item => item.sku.toUpperCase());  // Normalize cart SKUs

        const restrictedItemsInCart = cartSKUs.filter(sku => restrictedSKUs.has(sku));

        if (restrictedItemsInCart.length > 0) {
            res.status(200).json({ restrictedItems: restrictedItemsInCart });
        } else {
            res.status(200).json({ restrictedItems: [] });
        }
    } catch (error) {
        logger.error('Error handling restricted items request:', error);
        res.status(500).json({ error: 'Failed to retrieve restricted items' });
    }
}

// Function to fetch products by category ID using GraphQL with pagination
export async function fetchProductsByCategory(categoryId) {
    const storeHash = process.env.STORE_HASH;
    let hasNextPage = true;
    let endCursor = null;
    const allProducts = [];

    try {
        const jwtToken = await getJwtToken();

        while (hasNextPage) {
            const response = await fetch(`https://store-${storeHash}.mybigcommerce.com/graphql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwtToken}`,
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
            logger.info('Full response for category fetch:', responseBody);

            if (!response.ok) {
                if (response.status === 401 && responseBody.includes('JWT is expired')) {
                    logger.error('JWT expired. Attempting to refresh token...');
                    await refreshJWTToken();
                    return fetchProductsByCategory(categoryId);
                }
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

// Call initializeRestrictedSKUs when this module is loaded
initializeRestrictedSKUs();

// Export the restricted SKUs set for use in other modules
export {
    restrictedSKUs,
};
