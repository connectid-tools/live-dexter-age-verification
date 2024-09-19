import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

router.post('/log-order', async (req, res) => {
    const { orderId, authToken } = req.body;

    if (!orderId || !authToken) {
        return res.status(400).json({ error: 'Missing orderId or authToken' });
    }

    try {
        // Define the path to the log file in a 'logs' directory
        const logFilePath = path.join(process.cwd(), '../logs', 'txnLogs.txt');

        // Create a log entry as a new line
        const logEntry = `Order ID: ${orderId}, Auth Token: ${authToken}, Timestamp: ${new Date().toISOString()}\n`;

        // Append the log entry to the file (this creates the file if it doesn't exist)
        await fs.appendFile(logFilePath, logEntry);

        // Send a success response
        res.status(200).json({ message: 'Order ID and auth token logged successfully' });
    } catch (error) {
        console.error('Error logging order and token:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
