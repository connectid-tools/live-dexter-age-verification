export const config = {
    // Signing key ID (KID) from the environment variables
    signing_kid: process.env.SIGNING_KID,
    transport_kid: process.env.TRANSPORT_KID,
  
    // Redirect URI where users will be redirected after authentication
    application_redirect_uri: `https://${process.env.STORE_DOMAIN}/checkout`,
  
    // Client information from the environment variables
    client: {
      client_id: `https://${process.env.CLIENT_ID}`,
      organisation_id: process.env.ORGANISATION_ID,
      jwks_uri: process.env.JWKS_URI,
      redirect_uris: [
        `https://${process.env.STORE_DOMAIN}/checkout`
      ],
      scope: 'openid',
      grant_types: ['authorization_code'],
      response_types: ['code'],
      subject_type: 'pairwise',
    },
    // URIs for legal documents
    policy_uri: `https://${process.env.STORE_DOMAIN}/connect-id-policy`,
    terms_of_service_uri: `https://${process.env.STORE_DOMAIN}/connectid-terms-conditions`,
  
    // Logo URI from the environment variables
    logo_uri: process.env.LOGO_URI,
  
    // Logging level
    log_level: 'info',
    
    // Default purpose for the IDP consent screen
    purpose: 'Verifying your identity',
  
    // Claims being requested
    required_claims: ['txn', 'verified_claims'],
  
    // Enable TLS for compliance
    tls_client_certificate_bound_access_tokens: true,
    
    // Cache time for participants list
    cache_ttl: 600,
  };
  