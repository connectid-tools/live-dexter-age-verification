export const tokenStore = new Map();

// Generate and store token for a cartId
export function generateAndStoreToken(cartId) {
  const token = Math.random().toString(36).substring(2);
  const expiresAt = Date.now() + 10 * 60 * 1000;  // 10 minutes expiry
  tokenStore.set(cartId, { token, expiresAt });
  console.log(`Token for cartId ${cartId} generated. Expires at ${new Date(expiresAt).toISOString()}. Token: ${token}`);
  return token;
}

// Clear expired tokens from tokenStore
export function clearExpiredTokens() {
  const now = Date.now();
  tokenStore.forEach((tokenData, cartId) => {
    if (tokenData.expiresAt < now) {
      console.log(`Removing expired token for cartId ${cartId}, token expired at ${new Date(tokenData.expiresAt).toISOString()}`);
      tokenStore.delete(cartId);
    }
  });
}

// Set interval to clear expired tokens every minute
setInterval(clearExpiredTokens, 60 * 1000);  // Call every minute

// Check if token is valid for a given cartId
export function isTokenValid(cartId) {
  const tokenData = tokenStore.get(cartId);
  if (tokenData) {
    if (tokenData.expiresAt > Date.now()) {
      return true;
    } else {
      console.log(`Token for cartId ${cartId} has expired.`);
      tokenStore.delete(cartId);  // Clean up expired token
    }
  } else {
    console.log(`No token found for cartId ${cartId}.`);
  }
  return false;
}
