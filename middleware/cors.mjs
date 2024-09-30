import cors from 'cors';

const allowedOrigins = [
  `https://${process.env.STORE_DOMAIN}`,
  `https://${process.env.ENDPOINT_DOMAIN}.ondigitalocean.app`,
  `https://api.bigcommerce.com`
];

export const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN'],
  credentials: true
};

export const setCorsHeaders = (req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
};

export default cors(corsOptions);