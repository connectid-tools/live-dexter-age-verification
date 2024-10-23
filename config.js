import dotenv from 'dotenv';
dotenv.config();


export const config = {
  data: {
    // Set the signing Key Id based on what is contained in the JWKS
    signing_kid: process.env.SIGNING_KID,

    // Use the environment variables for the certificates and keys directly
    transport_key_content: process.env.TRANSPORT_KEY,
    transport_pem_content: process.env.TRANSPORT_PEM,
    
    signing_key_content: process.env.SIGNING_KEY,
    signing_pem_content: process.env.SIGNING_PEM,

    // The location of the root certificate for the trust authority
    ca_pem_content: process.env.CA_PEM,

    // Application callback URL 
    application_redirect_uri: `https://${process.env.STORE_DOMAIN}/checkout`,

    // Server details
    server_port: '443',
    listen_address: '0.0.0.0',
    log_level: 'debug',
    enable_auto_compliance_verification: false,
    //registry_participants_uri: 'https://api.sandbox.connectid.com.au/oidf-conformance/participants?alias=a/sheldonandhammond',
    registry_participants_uri: 'https://data.directory.sandbox.connectid.com.au/participants',
    include_uncertified_participants: false,

    purpose: 'verifying you are over 18',

    client: {
      client_id: `${process.env.CLIENT_ID}`,
      organisation_id: process.env.ORGANISATION_ID,
      jwks_uri: process.env.JWKS_URI,
      redirect_uris: [`https://${process.env.STORE_DOMAIN}/checkout`],
      organisation_name: `${process.env.ORGANISATION_NAME}`,
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

console.log("Config Data:");
console.log(JSON.stringify(config, null, 2));