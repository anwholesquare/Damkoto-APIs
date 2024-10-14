const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto'); // For generating unique session tokens
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient({
    log: [
        {
            emit: "event",
            level: "query",
        },
    ],
});

// prisma.$on("query", async (e) => {
//     console.log(`${e.query} ${e.params}`)
// });


// Set up multer for file uploads
const storageIcon = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads', 'icons');
        fs.existsSync(dir) || fs.mkdirSync(dir, { recursive: true }); // Create the directory if it doesn't exist
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Use the original filename or generate a unique name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

// Set up multer for file uploads
const storageItem = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads', 'items');
        fs.existsSync(dir) || fs.mkdirSync(dir, { recursive: true }); // Create the directory if it doesn't exist
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Use the original filename or generate a unique name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

const uploadIcon = multer({ storage: storageIcon }).single('file'); // Expect the file to be in 'file' field
const uploadItem = multer({ storage: storageItem }).array('image_link');

// Admin Login
const adminLogin = async (req, res) => {
    const { username, password } = req.body;
    try {
        // Find user with role admin
        const adminUser = await prisma.users.findFirst({
            where: {
                name: username,
                role: 'admin',
            },
        });

        if (!adminUser) {
            return res.status(401).json({
                error: 'Invalid credentials or unauthorized access',
            });
        }

        // Check if the password matches
        const isPasswordValid = await bcrypt.compare(password, adminUser.data); // Assuming password is stored hashed in `data`

        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Invalid credentials or unauthorized access',
            });
        }

        // Create a unique session token for saving in the Users_session table
        const sessionToken = crypto.randomBytes(64).toString('hex');

        // Automatically find the IP address: check for 'x-forwarded-for' header for proxies, fallback to req.ip
        const ipAddress = req.headers['x-forwarded-for'] || req.ip || 'unknown';

        // Set session expiration to 90 days (in milliseconds: 90 * 24 * 60 * 60 * 1000)
        const sessionExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        // Save the session to Users_session table
        await prisma.users_session.create({
            data: {
                user_id: adminUser.id,
                session_token: sessionToken,
                ip_address: ipAddress, // Store the IP address from request
                user_agent: req.headers['user-agent'] || 'unknown', // Store user agent from headers
                expires_at: sessionExpiry, // Set expiration to 90 days from now
            },
        });

        // Respond with session token and success message
        res.status(200).json({
            token: sessionToken,
            expires_at: sessionExpiry,
            message: 'Login successful',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Something went wrong',
        });
    }
};

// Create Category
const createCategory = async (req, res) => {
    const { name, slug } = req.body;
    const file = req.file;

    // Validate inputs
    if (!name || !slug || !file) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        // Save the category to the database
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const newCategory = await prisma.category.create({
            data: {
                name: name,
                slug: slug,
                icon: `${baseUrl}/uploads/icons/${file.filename}`, // Save the full URL of the uploaded file
            },
        });

        res.status(201).json(newCategory);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Slug must be unique' });
    }
};

const getAllCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany(); // Fetch all categories from the database

        // Return the categories
        res.status(200).json(categories);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

// Function to update a category
const updateCategory = async (req, res) => {
    const { id } = req.params; // Extract category ID from URL
    const { name, slug } = req.body; // Extract fields from body
    let icon;

    try {
        // Check if the category exists
        const existingCategory = await prisma.category.findUnique({
            where: { id: Number(id) }, // Find category by ID
        });

        if (!existingCategory) {
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`Error deleting file: ${err}`);
                } else {
                    console.log('File deleted successfully');
                }
            });
            return res.status(404).json({ error: 'Category not found' });
        }

        // Prepare an object to hold update data
        const updateData = {};

        // Only add fields that are present in the request body
        if (name) {
            updateData.name = name;
        }

        if (slug) {
            updateData.slug = slug;
        }

        // Handle file upload only if a new file is provided
        if (req.file) {
            const file = req.file; // Get the uploaded file
            const iconFileName = `${Date.now()}_${file.originalname}`; // Create a unique file name
            const uploadPath = path.join(__dirname, 'uploads', 'icons', iconFileName);

            // If there's an existing icon, delete it
            if (existingCategory.icon) {
                const oldIconPath = path.join(__dirname, 'uploads', 'icons', existingCategory.icon.split('/').pop());
                if (fs.existsSync(oldIconPath)) {
                    fs.unlinkSync(oldIconPath); // Delete the old file
                }
            }

            // Move the new file to the desired directory
            fs.renameSync(file.path, uploadPath);
            icon = `/uploads/icons/${iconFileName}`; // Set the new icon URL
            updateData.icon = icon; // Add icon to update data
        }

        // Update category in the database
        const updatedCategory = await prisma.category.update({
            where: { id: Number(id) }, // Find category by ID
            data: updateData, // Use the dynamic update data object
        });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        updatedCategory.icon = `${baseUrl}${icon}`; // Update the icon URL with full path

        res.status(200).json(updatedCategory); // Return the updated category
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};


const deleteCategory = async (req, res) => {
    const { id } = req.params; // Extract category ID from URL

    try {
        // Find the category by ID
        const category = await prisma.category.findUnique({
            where: { id: Number(id) }, // Find category by ID
        });

        // Check if the category exists
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Delete the category
        await prisma.category.delete({
            where: { id: Number(id) }, // Delete by ID
        });

        // If there's an associated icon, delete it from the file system
        if (category.icon) {
            const iconFilePath = path.join(__dirname, 'uploads', 'icons', category.icon.split('/').pop());
            if (fs.existsSync(iconFilePath)) {
                fs.unlinkSync(iconFilePath); // Delete the file
            }
        }

        res.status(200).json({ message: 'Category deleted successfully' }); // Success response
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};


const createItem = async (req, res) => {
    let { name, description, unit, slug, category_ids, price } = req.body;
    const files = req.files; // Get the uploaded files

    if (price && typeof price === 'string')
        price = JSON.parse(price); // Parse the price data as an array

    try {
        // Validate required fields
        if (!name || !description || !unit || !slug || !category_ids || !files || files.length === 0) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        if (typeof category_ids === 'string') {
            category_ids = JSON.parse(category_ids);
        }
        // Create item
        const newItem = await prisma.items.create({
            data: {
                name,
                description,
                unit,
                slug,
                // Link multiple images to Items_image table
                Items_image: {
                    create: files.map(file => ({ image_link: `/uploads/items/${file.filename}` })),
                },
                // Link multiple categories to Items_category table
                Items_category: {
                    create: category_ids.map(category_id => ({
                        category_id: parseInt(category_id, 10), // Cast to int
                    })),
                },
            },
        });

        // Handle price updates
        if (Array.isArray(price)) {
            await Promise.all(
                price.map(async (priceEntry) => {
                    const { min_price, max_price, division, date } = priceEntry;
                    // Create a new price entry
                    await prisma.items_price.create({
                        data: {
                            item_id: parseInt(newItem.id, 10),
                            min_price: parseFloat(min_price),
                            max_price: parseFloat(max_price),
                            division: division,
                            date: new Date(date),
                        },
                    });

                })
            );
        }

        // Respond with the created item
        res.status(201).json(newItem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};


const deleteItem = async (req, res) => {
    const { id } = req.params; // Get the item ID from the request parameters

    try {
        // Check if the item exists
        const item = await prisma.items.findUnique({
            where: { id: parseInt(id, 10) }, // Cast to int
            include: {
                Items_image: true, // Include associated images for deletion
                Items_price: true, // Include associated price for deletion
                Items_category: true, // Include associated categories for deletion
            },
        });

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Delete images from the filesystem if necessary
        for (const image of item.Items_image) {
            try {
                const filePath = `./uploads/items/${image.image_link.split('/').pop()}`; // Assuming the link is like /uploads/items/abc.png
                fs.unlinkSync(filePath); // Delete the file from the filesystem
            } catch (e) { }
        }

        // Delete the item and all associated data
        await prisma.items.delete({
            where: { id: parseInt(id, 10) },
        });

        // Respond with a success message
        res.status(200).json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};



const updateItem = async (req, res) => {
    const { id } = req.params; // Get the item ID from the request parameters
    let { name, description, unit, slug, category_ids, price } = req.body;

    if (category_ids && typeof category_ids === 'string')
        category_ids = JSON.parse(category_ids); // Parse the category IDs as an array

    if (price && typeof price === 'string')
        price = JSON.parse(price); // Parse the price data as an array

    try {
        // Check if the item exists
        const item = await prisma.items.findUnique({
            where: { id: parseInt(id, 10) },
            include: {
                Items_image: true, // Include associated images
                Items_price: true,  // Include associated prices
                Items_category: true, // Include associated categories
            },
        });

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Update item details
        await prisma.items.update({
            where: { id: parseInt(id, 10) },
            data: {
                name: name || item.name, // Update if provided, else retain old value
                description: description || item.description,
                unit: unit || item.unit,
                slug: slug || item.slug,
            },
        });

        // Handle category updates
        if (Array.isArray(category_ids)) {
            await prisma.items_category.deleteMany({
                where: { item_id: parseInt(id, 10) },
            });

            // Create new category associations
            await Promise.all(
                category_ids.map(async (categoryId) => {
                    await prisma.items_category.create({
                        data: {
                            item_id: parseInt(id, 10),
                            category_id: parseInt(categoryId, 10),
                        },
                    });
                })
            );
        }

        // Handle price updates
        if (Array.isArray(price)) {
            await Promise.all(
                price.map(async (priceEntry) => {
                    const { min_price, max_price, division, date } = priceEntry;

                    const deletePrices = await prisma.$executeRaw`
                        DELETE FROM items_price
                        WHERE item_id = ${parseInt(id, 10)}
                        AND DATE(date) = ${new Date(date).toISOString().split('T')[0]}
                        AND division = ${division}
                    `;



                    // Create a new price entry
                    await prisma.items_price.create({
                        data: {
                            item_id: parseInt(id, 10),
                            min_price: parseFloat(min_price),
                            max_price: parseFloat(max_price),
                            division: division,
                            date: new Date(date),
                        },
                    });

                })
            );
        }
        // Handle image uploads
        if (req.files) {
            // Delete existing images from filesystem
            for (const image of item.Items_image) {
                try {
                    const filePath = path.join(__dirname, `./uploads/items/${image.image_link.split('/').pop()}`);
                    fs.unlinkSync(filePath);
                } catch (e) { }
            }

            // Delete existing images from the database
            await prisma.items_image.deleteMany({
                where: { item_id: parseInt(id, 10) },
            });

            await Promise.all(
                req.files.map(async (file) => {
                    const imageLink = `/uploads/items/${file.filename}`; // Assuming multer saves files with this structure

                    await prisma.items_image.create({
                        data: {
                            item_id: parseInt(id, 10),
                            image_link: imageLink,
                        },
                    });
                })
            );

        }

        // Respond with a success message
        res.status(200).json({ message: 'Item updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};


module.exports = {
    adminLogin,
    createCategory,
    uploadIcon,
    getAllCategories,
    updateCategory,
    deleteCategory,
    createItem,
    uploadItem,
    updateItem,
    deleteItem
};