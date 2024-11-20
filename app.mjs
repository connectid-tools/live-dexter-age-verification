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

// Allowed Origin
const allowedOrigins = [`https://${process.env.STORE_DOMAIN}`];
console.log('Allowed origins:', allowedOrigins.join(', '));

// Single Allowed IP
const allowedIp = process.env.ALLOWED_IPS || ''; // Load single allowed IP
console.log('Allowed IP:', allowedIp);

// CORS Config
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

// Normalize IP for IPv4/IPv6 compatibility
function normalizeIp(ip) {
    if (!ip) return '';
    return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

// Middleware for IP Whitelisting
function ipWhitelist(req, res, next) {
    const clientIp = normalizeIp(req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress);

    if (clientIp !== allowedIp) {
        console.warn(`[${new Date().toISOString()}] Unauthorized IP: ${clientIp}`);
        return res.status(403).json({ error: 'Unauthorized IP address' });
    }

    next(); // Allow the request if the IP matches
}

// Apply IP Whitelisting Globally
app.use(ipWhitelist);

// Middleware setup
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Routes
app.use('/', indexRouter);
app.use('/validate-cart', validateCartRouter);
app.use('/restricted-items', getRestrictedItemsRouter);
app.use('/select-bank', selectBankRouter);
app.use('/retrieve-tokens', retrieveTokensRouter);
app.use('/log-order', logOrderRouter);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

export default app;
