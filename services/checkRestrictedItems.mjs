import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { getJwtToken } from './refreshJWTToken.mjs';  // Import only getJwtToken

// Load environment variables from .env file
dotenv.config();

// Set to store unique SKUs and their variants
let restrictedSKUs = new Set(); 

// Function to initialize and refresh restricted SKUs
export async function initializeRestrictedSKUs() {
    console.log('Starting to initialize restricted SKUs...');
    const knifeCategoryId = parseInt(process.env.CATEGORY_ID, 10);
    try {
        const fetchedSKUs = await fetchProductsByCategory(knifeCategoryId);

        if (!fetchedSKUs || fetchedSKUs.length === 0) {
            console.warn('No SKUs fetched for the category. Please check the GraphQL query and response.');
            return;
        }

        fetchedSKUs.forEach(({ baseSku, variantSkus }) => {
            if (baseSku) {
                restrictedSKUs.add(baseSku.trim().toUpperCase()); // Normalize SKUs when adding
            } else {
                console.warn('baseSku is undefined or null:', baseSku);
            }

            if (variantSkus && Array.isArray(variantSkus)) {
                variantSkus.forEach(sku => {
                    if (sku) {
                        restrictedSKUs.add(sku.trim().toUpperCase()); // Normalize SKUs when adding
                    } else {
                        console.warn('variantSku is undefined or null:', sku);
                    }
                });
            } else {
                console.warn('variantSkus is undefined, null, or not an array:', variantSkus);
            }
        });

        console.log('Restricted SKUs initialized:', Array.from(restrictedSKUs));
    } catch (error) {
        console.error('Error initializing restricted SKUs:', error);
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
            console.error('Error fetching cart items:', responseData);
            throw new Error(`Failed to fetch cart items: ${responseData.title}`);
        }

        const allCartItems = [
            ...responseData.data.line_items.physical_items,
            ...responseData.data.line_items.digital_items || [],
            ...responseData.data.line_items.gift_certificates || [],
            ...responseData.data.line_items.custom_items || []
        ];

        console.log(`Fetched all cart items: ${JSON.stringify(allCartItems)}`);
        return allCartItems;
    } catch (error) {
        console.error('Error fetching cart items:', error);
        throw error;
    }
}

// Function to fetch products by category ID using GraphQL with pagination
export async function fetchProductsByCategory(categoryId) {
    const storeHash = process.env.STORE_HASH;
    let hasNextPage = true;
    let endCursor = null;
    const allProducts = [];

    try {
        // Get the JWT token before making the request
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

// Call initializeRestrictedSKUs when this module is loaded
initializeRestrictedSKUs();

// Export the restricted SKUs set for use in other modules
export {
    restrictedSKUs
};
