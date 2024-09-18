import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from './cookieUtils.js';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

router.get('/retrieve-tokens', async (req, res) => {
  // If the callback url was requested without a code token, just clear any
  // stale cookies and load the default landing page
  if (!req.query.code) {
    clearCookies(res)
    return res.status(400).json({ error: 'No code parameter in query string' })
  }

  try {
    const tokenSet = await rpClient.retrieveTokens(
      req.cookies.authorisation_server_id,
      req.query,
      req.cookies.code_verifier,
      req.cookies.state,
      req.cookies.nonce
    )
    const claims = tokenSet.claims()
    const token = {
      decoded: JSON.stringify(jwtDecode(tokenSet.id_token), null, 2),
      raw: tokenSet.id_token,
    }

    console.info(`Returned claims: ${JSON.stringify(claims, null, 2)}`)
    console.info(`Returned raw id_token: ${token.raw}`)
    console.info(`Returned decoded id_token: ${token.decoded}`)
    console.info(`Returned xFapiInteractionId: ${tokenSet.xFapiInteractionId}`)

    return res.json({ claims, token, xFapiInteractionId: tokenSet.xFapiInteractionId })
  } catch (error) {
    console.error('Error retrieving tokenset: ' + error)
    return res.status(500).json({ error: error.toString() })
  }
})


export default router;
