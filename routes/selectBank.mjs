import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);


router.post('/select-bank', async (req, res) => {
  const essentialClaims = req.body.essentialClaims || []
  const voluntaryClaims = req.body.voluntaryClaims || []
  const purpose = req.body.purpose || config.data.purpose
  const authServerId = req.body.authorisationServerId
  if (!authServerId) {
    const error = 'authorisationServerId parameter is required'
    logger.error(error)
    return res.status(400).json({ error })
  }

  try {
    logger.info(
      `Processing request to send PAR with authorisationServerId='${authServerId}' essentialClaims='${essentialClaims.join(
        ','
      )}' voluntaryClaims='${voluntaryClaims.join(',')}', purpose='${purpose}'`
    )
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,
      voluntaryClaims,
      purpose
    )

    const path = ''
    res.cookie('state', state, { path, sameSite: 'none', secure: true })
    res.cookie('nonce', nonce, { path, sameSite: 'none', secure: true })
    res.cookie('code_verifier', code_verifier, { path, sameSite: 'none', secure: true })
    res.cookie('authorisation_server_id', authServerId, { path, sameSite: 'none', secure: true })

    logger.info(
      `PAR sent to authorisationServerId='${authServerId}', returning url='${authUrl}', x-fapi-interaction-id='${xFapiInteractionId}'`
    )

    return res.json({ authUrl })
  } catch (error) {
    logger.error(error)
    return res.status(500).json({ error: error.toString() })
  }
})

export default router;
