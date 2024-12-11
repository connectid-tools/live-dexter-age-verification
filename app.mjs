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
import { createClient } from 'redis';
import RedisStore from 'connect-redis';

// Ensure all environment variables are loaded
const {
    REDIS_HOST,
    REDIS_PORT,
    REDIS_PASSWORD,
    REDIS_TLS,
    SESSION_SECRET,
    STORE_DOMAIN,
} = process.env;

// Initialize Redis client
export const redisClient = createClient({
    socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        tls: REDIS_TLS === 'false',
    },
    password: REDIS_PASSWORD,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('ready', () => console.log('Redis client is ready.'));
redisClient.on('connect', () => console.log('Connected to Redis server.'));

await redisClient.connect();
console.log('Redis connected successfully.');

const app = express();
const port = 3001;

// Initialize RedisStore
const store = new RedisStore({ client: redisClient });

app.use(
    session({
        store,
        secret: SESSION_SECRET || 'default-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production', // Set true for HTTPS
            httpOnly: false, // Protect from client-side access
            sameSite: 'None', // Adjust for cross-origin cookies
            maxAge: 3600 * 1000, // 1 hour
        },
    })
);

// CORS Configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [`https://${STORE_DOMAIN}`];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
};

app.use(cors(corsOptions));

// app.use((req, res, next) => {
//     console.log('--- Incoming Request ---');
//     console.log('Path:', req.path);
//     console.log('Session ID:', req.sessionID);
//     console.log('Cart ID:', req.body?.cartId || req.cookies?.cartId || 'Cart ID not provided'); // Log cartId if available
//     console.log('Cookies:', req.cookies);
//     console.log('Session Data:', req.session);
//     next();
// });



// Middleware
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

app.use(async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    // Allow unauthenticated access for specific public routes
    if (!token) {
        if (['/', '/restricted-items', '/validate-cart', '/set-cart-id'].includes(req.path)) {
            return next();
        }
        return res.status(401).json({ error: 'Authorization token is required.' });
    }

    try {
        // Validate the JWT token
        const decoded = jwt.verify(token, JWT_SECRET || 'your-very-secret-key');
        req.sessionData = decoded;

        // Retrieve additional session data from Redis (if applicable)
        const redisKey = `session:${decoded.cartId}`;
        const redisSessionData = await redisClient.get(redisKey);

        if (!redisSessionData) {
            console.error('[JWT Validation] Session data not found in Redis.');
            return res.status(401).json({ error: 'Invalid or expired session.' });
        }

        req.redisSessionData = JSON.parse(redisSessionData); // Attach Redis data to request

        console.log(`[JWT Validation] Session valid. Redis data: ${redisSessionData}`);
        next();
    } catch (err) {
        console.error('[JWT Validation] Invalid or expired token:', err.message);
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
});

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
(async () => {
    try {
        // Ensure Redis is connected before starting the server
        await redisClient.ping();
        console.log('Redis connection validated.');

        // Start the Express server
        app.listen(port, () => {
            console.log(`Server listening on port ${port}`);
        });
    } catch (error) {
        console.error('Failed to start the server:', error);
        process.exit(1);
    }
})();

export default app;