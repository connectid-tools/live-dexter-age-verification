import express from 'express';
const router = express.Router();

// Define a route for the root URL ('/') without dynamic data
router.get('/', (req, res) => {
  // render the index page
  res.render('index'); 
});

export default router;
