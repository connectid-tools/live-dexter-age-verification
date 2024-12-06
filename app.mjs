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
import setCartId from './routes/setCartId.mjs';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import Redis from 'ioredis';
import connectRedis from 'connect-redis';
import * as connectRedis from 'connect-redis';

const app = express();
const port = 3001;

// Allowed Origin
const allowedOrigins = [`https://${process.env.STORE_DOMAIN}`];
console.log('Allowed origins:', allowedOrigins.join(', '));

// Redis configuration
const redisClient = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
});

// Use connect-redis with express-session
const RedisStore = connectRedis.default(session);

// Single Allowed IP
// const allowedIps = (process.env.ALLOWED_IPS || '').split(',').map(ip => ip.trim()).map(normalizeIp);
// console.log('Allowed IPs:', allowedIps.join(', '));



app.use(cors(corsOptions));

// // Normalize IPs for IPv4/IPv6 compatibility
// function normalizeIp(ip) {
//     if (!ip) return '';
//     return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
// }

// // Middleware for IP Whitelisting
// function ipWhitelist(req, res, next) {
//   const clientIp =
//       req.headers['cf-connecting-ip'] || // Cloudflare
//       req.headers['x-forwarded-for']?.split(',')[0] || // Standard proxy header
//       req.connection.remoteAddress; // Fallback to direct connection IP

//   const normalizedClientIp = normalizeIp(clientIp);

//   // Debugging log
//   console.log(`Normalized Client IP: "${normalizedClientIp}"`);
//   console.log(`Allowed IPs: ${allowedIps.join(', ')}`);

//   // Check if the client IP is in the list of allowed IPs
//   if (!allowedIps.includes(normalizedClientIp)) {
//       console.warn(`[${new Date().toISOString()}] Unauthorized IP: ${normalizedClientIp}`);
//       return res.status(403).json({ error: 'Unauthorized IP address' });
//   }

//   next(); // Allow the request if the IP matches
// } 
// Apply IP Whitelisting Globally
// app.use(ipWhitelist);

// Apply session middleware globally

app.use(
    session({
        store: new RedisStore({ client: redisClient }),
        secret: process.env.SESSION_SECRET || 'default-secret',
        resave: false,
        saveUninitialized: false, // Avoid creating unnecessary sessions
        cookie: {
            secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
            httpOnly: true, // Prevent client-side access to cookies
            sameSite: 'None', // Allow cross-origin cookies
            maxAge: 3600 * 1000, // 1 hour
        },
    })
);



app.use((req, res, next) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session Data:', req.session);
    next();
});

// CORS Config
export const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [`https://${process.env.STORE_DOMAIN}`];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Required for cookies to be sent
};

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
app.use('/set-cart-id', setCartId);


// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

export default app;
