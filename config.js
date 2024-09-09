import fs from 'fs'
import dotenv from 'dotenv';
dotenv.config();


export const config = {
  data: {
    // Set the signing Key Id based on what is contained in the JWKS
    signing_kid: process.env.SIGNING_KID,

    // Use the environment variables for the certificates and keys directly
    transport_key_content: fs.readFileSync('./certs/transport.key').toString(),
    transport_pem_content: fs.readFileSync('./certs/transport.pem').toString(),
    
    signing_key_content: fs.readFileSync('./certs/signing.key').toString(),
    signing_pem_content: fs.readFileSync('./certs/signing.pem').toString(),

    // The location of the root certificate for the trust authority
    ca_pem_content: fs.readFileSync('./certs/connectid-sandbox-ca.pem').toString(),

    // Application callback URL
    application_redirect_uri: `https://${process.env.STORE_DOMAIN}/checkout`,

    // Server details
    server_port: '443',
    listen_address: '0.0.0.0',
    log_level: 'debug',
    enable_auto_compliance_verification: false,

    registry_participants_uri: 'https://data.directory.sandbox.connectid.com.au/participants',
    include_uncertified_participants: true,

    purpose: process.env.PURPOSE || 'Verifying your identity',

    client: {
      client_id: `https://${process.env.CLIENT_ID}`,
      organisation_id: process.env.ORGANISATION_ID,
      jwks_uri: process.env.JWKS_URI,
      redirect_uris: [`https://${process.env.STORE_DOMAIN}/checkout`],
      organisation_name: process.env.ORGANISATION_NAME || 'My Organisation',
      software_description: process.env.SOFTWARE_DESCRIPTION || 'App to demonstrate ConnectID flows.',
    },
  },
};
