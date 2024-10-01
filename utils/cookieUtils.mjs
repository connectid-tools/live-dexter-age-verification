import express from 'express';
const router = express.Router();

// Named export for clearCookies function
export const clearCookies = (res) => {
    const cookieOptions = { secure: true, sameSite: 'None', httpOnly: true };    
    res.clearCookie('state', cookieOptions);
    res.clearCookie('nonce', cookieOptions);
    res.clearCookie('code_verifier', cookieOptions);
    // res.clearCookie('authorisation_server_id', cookieOptions);
};

// Default export for the router
export default router;
