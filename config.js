import fs from 'fs'
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

    registry_participants_uri: 'https://data.directory.sandbox.connectid.com.au/participants',
    include_uncertified_participants: true,

    purpose: 'Verifying you are over 18',

    client: {
      client_id: `https://${process.env.CLIENT_ID}`,
      organisation_id: process.env.ORGANISATION_ID,
      jwks_uri: process.env.JWKS_URI,
      token_endpoint_auth_method: 'private_key_jwt',
      redirect_uris: [`https://${process.env.STORE_DOMAIN}/checkout`],
      organisation_name: 'Sheldon and Hammond',
      software_description: 'App to verify age and restrict knives from checkout.',
    },
  },
};
