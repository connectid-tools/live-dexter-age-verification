import dotenv from 'dotenv';
dotenv.config(); // Load environment variables at the very start

import cors from 'cors';
import express from 'express';
import logger from 'morgan';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.mjs';
import indexRouter from './routes/index.mjs';
import validateCartRouter from './routes/restrictItems.mjs';
import getRestrictedItemsRouter from './routes/getRestrictedItems.mjs';
import selectBankRouter from './routes/selectBank.mjs';
import retrieveTokensRouter from './routes/retrieveTokens.mjs';
import logOrderRouter from './routes/logTokenAndOrderId.mjs';
import cookieParser from 'cookie-parser';

const app = express();
const port = 3001;

// Allowed Origins

const allowedOrigins = [
  `https://${process.env.STORE_DOMAIN}`, // e.g., connectid-demo-k3.mybigcommerce.com
  // `https://${process.env.ENDPOINT_DOMAIN}.ondigitalocean.app`, // e.g., sh-checkout-validator-qud6t.ondigitalocean.app
];

// Allowed IPs
const allowedIps = (process.env.ALLOWED_IPS);



console.log('Allowed origins:', allowedOrigins.join(', '));
console.log('Allowed IPs:', allowedIps.join(', '));


// CORS config
export const corsOptions = {
  origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true); // Allow the request
      } else {
          console.error('CORS denied for origin:', origin);
          callback(new Error('Not allowed by CORS')); // Block the request
      }
  },
  credentials: true,
};

app.use(cors(corsOptions));



// Normalize IPs for IPv4/IPv6 compatibility
function normalizeIp(ip) {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}


// Middleware for IP Whitelisting
function ipWhitelist(req, res, next) {
  const clientIp = normalizeIp(req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress);
  if (!allowedIps.includes(clientIp)) {
      console.warn(`[${new Date().toISOString()}] Unauthorized IP: ${clientIp}`);
      return res.status(403).json({ error: 'Unauthorized IP address' });
  }
  next();
}

app.use(ipWhitelist); // Apply IP whitelisting



// Middleware setup
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// app.use(express.static(path.join(path.resolve(), 'public')));

// Apply CORS middleware with options before routes
app.use(cookieParser());  // Parse cookies for session handling

// Routes
app.use('/', indexRouter);
app.use('/validate-cart', validateCartRouter);
app.use('/restricted-items', getRestrictedItemsRouter);
app.use('/select-bank', selectBankRouter);
app.use('/retrieve-tokens', retrieveTokensRouter);
app.use('/log-order', logOrderRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export default app;
