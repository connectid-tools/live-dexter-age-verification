export const tokenStore = new Map();

export function generateAndStoreToken(cartId) {
  const token = Math.random().toString(36).substring(2);
  const expiresAt = Date.now() + 3 * 60 * 1000;
  tokenStore.set(cartId, { token, expiresAt });
  console.log(`Token for cartId ${cartId} generated. Expires at ${new Date(expiresAt).toISOString()}. Token: ${token}`);
  return token;
}

export function clearExpiredTokens() {
  const now = Date.now();
  tokenStore.forEach((tokenData, cartId) => {
    if (tokenData.expiresAt < now) {
      console.log(`Removing expired token for cartId ${cartId}, token expired at ${new Date(tokenData.expiresAt).toISOString()}`);
      tokenStore.delete(cartId);
    }
  });
}