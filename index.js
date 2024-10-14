const express = require('express');
const adminController = require('./adminController'); // Importing the admin controller
const { authAdminMiddleware } = require('./authMiddleware'); // Importing the auth middleware
const path = require('path'); // Import the path module
const cors = require('cors'); // Import the cors middleware

const app = express();

app.use(express.json()); // Middleware to parse JSON bodies
app.use(cors()); // Enable CORS for all routes
// Serve static files from the uploads/icons directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Admin Routes
app.post('/admin/login', adminController.adminLogin); // Admin login route
// Protected Route with Token Validation
app.get('/admin/test', authAdminMiddleware, (req, res) => {
    // If reached here, token is valid
    res.json({
        message: 'Access granted to protected route!',
        user: req.user, // User data attached by authMiddleware
    });
});
// Route to create a new category
app.post('/admin/categories', authAdminMiddleware, adminController.uploadIcon, adminController.createCategory);
// Route to read all categories
app.get('/admin/categories', adminController.getAllCategories);
// Route to update single category
app.put('/admin/categories/:id', authAdminMiddleware, adminController.uploadIcon, adminController.updateCategory);
// Route to delete a category
app.delete('/admin/categories/:id', authAdminMiddleware, adminController.deleteCategory);
// Create an item route
app.post('/admin/items', authAdminMiddleware, adminController.uploadItem, adminController.createItem);
// Update an item route
app.put('/admin/items/:id', authAdminMiddleware, adminController.uploadItem, adminController.updateItem);
// Delete an item route
app.delete('/admin/items/:id', authAdminMiddleware, adminController.deleteItem);




// Route to read all categories
app.get('/categories', adminController.getAllCategories);

// Basic root route to check server status
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({
        message: 'Something went wrong!',
    });
});

// Start server
const PORT = process.env.PORT || 3000; // Default to port 3000
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
