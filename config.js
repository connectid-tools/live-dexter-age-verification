import fs from 'fs';

export const config = {
  data: {
    // Set the signing Key Id based on what is contained in the JWKS
    signing_kid: process.env.SIGNING_KID,

    // The location of the transport certificate and key that are used for mutual TLS
    transport_key_content: process.env.TRANSPORT_KEY,
    transport_pem_content: process.env.TRANSPORT_PEM,

    // The location of the signing certificate and key that are used for signing purposes
   signing_key_content: process.env.SIGNING_KEY_CONTENT,
    signing_pem_content: process.env.SIGNING_PEM,

    // The location of the root certificate for the trust authority
    ca_pem: './certs/connectid-sandbox-ca.pem',

    // This is the URL that this application is running on and using for callbacks
    application_redirect_uri: `https://${process.env.STORE_DOMAIN}/checkout`,

    // The port that the rp-connector will listen on
    server_port: '443',

    // The interfaces the server will listen on. 0.0.0.0 will bind to all interfaces.
    listen_address: process.env.LISTEN_ADDRESS || '0.0.0.0',

    // The application logging level (info or debug)
    log_level: 'debug',

    // When running the OIDC FAPI compliance suite, this will auto call the user info endpoint
    enable_auto_compliance_verification: false,

    // The registry API endpoint that will list all participants with their auth server details
    registry_participants_uri: 'https://data.directory.sandbox.connectid.com.au/participants',

    // Whether to include uncertified participants
    include_uncertified_participants: true,

    // Configuring `required_participant_certifications` for filtering by certifications
    // required_participant_certifications: [
    //   { profileType: 'TDIF Accreditation', profileVariant: 'Identity Provider' }
    // ],

    // The list of claims that authorisation servers must support to be included in the list of participants
    // required_claims: ['name', 'given_name', 'family_name', 'phone_number', 'email', 'address', 'birthdate'],

    // The purpose to be displayed to the consumer
    purpose: process.env.PURPOSE || 'Verifying your identity',

    client: {
      // Update with your client specific metadata. The client_id and organisation_id can be found in the registry.
      client_id: `https://${process.env.CLIENT_ID}`,
      organisation_id: process.env.ORGANISATION_ID,
      jwks_uri: process.env.JWKS_URI,
      redirect_uris: [`https://${process.env.STORE_DOMAIN}/checkout`],
      organisation_name: process.env.ORGANISATION_NAME || 'My Organisation',
      organisation_number: process.env.ORGANISATION_NUMBER || 'ABN123123123',
      software_description: process.env.SOFTWARE_DESCRIPTION || 'App to demonstrate ConnectID flows.',
    },
  },
};
