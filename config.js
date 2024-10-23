import dotenv from 'dotenv';
dotenv.config();


export const config = {
  data: {
    signing_kid: process.env.SIGNING_KID,
    transport_key_content: process.env.TRANSPORT_KEY,
    transport_pem_content: process.env.TRANSPORT_PEM,
    signing_key_content: process.env.SIGNING_KEY,
    signing_pem_content: process.env.SIGNING_PEM,
    ca_pem_content: process.env.CA_PEM,
    
    // Server details
    server_port: '443',
    listen_address: '0.0.0.0',
    log_level: 'info',
    
    application_redirect_uri: `https://${process.env.STORE_DOMAIN}/checkout`,
    registry_participants_uri: 'https://data.directory.sandbox.connectid.com.au/participants',

    purpose: 'Your details will be shared for the purpose of verifying you are over 18 to prevent sale of knives to minors this information is shared with Sheldon and Hammond',
    include_uncertified_participants: false,
    enable_auto_compliance_verification: false,

    client: {
      client_id: `https://${process.env.CLIENT_ID}`,
      organisation_id: process.env.ORGANISATION_ID,
      jwks_uri: process.env.JWKS_URI,
      redirect_uris: [`https://${process.env.STORE_DOMAIN}/checkout`],
      organisation_name: 'Sheldon and Hammond',
      software_description: 'verifying you are over 18 to prevent sale of knives to minors',
      application_type: 'web',
      grant_types: ['client_credentials', 'authorization_code', 'implicit'],
      id_token_signed_response_alg: 'PS256',
      post_logout_redirect_uris: [],
      require_auth_time: false,
      response_types: ['code id_token', 'code'],
      subject_type: 'public',
      token_endpoint_auth_method: 'private_key_jwt',
      token_endpoint_auth_signing_alg: 'PS256',
      introspection_endpoint_auth_method: 'private_key_jwt',
      revocation_endpoint_auth_method: 'private_key_jwt',
      request_object_signing_alg: 'PS256',
      require_signed_request_object: true,
      require_pushed_authorization_requests: true,
      authorization_signed_response_alg: 'PS256',
      tls_client_certificate_bound_access_tokens: true,
      backchannel_user_code_parameter: false,
      scope: 'openid',
      software_roles: ['RP-CORE'],
    },
  },
};