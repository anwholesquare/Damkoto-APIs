const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authAdminMiddleware = async (req, res, next) => {

    const token = req.headers['authorization']?.split(' ')[1] || req.body.token; // Get token from Authorization header or request body

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        // Check if the session token exists in the Users_session table
        const session = await prisma.users_session.findUnique({
            where: {
                session_token: token,
            },
        });

        // Check if the session is expired
        if (session && new Date(session.expires_at) < new Date()) {
            return res.status(401).json({ error: 'This session has been expired' });
        }

        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Optionally: Attach user info to request object for further use in the route
        const user = await prisma.users.findUnique({
            where: {
                id: session.user_id,
            },
        });

        req.user = user; // Attach user data to request object
        if (req.user.role !== 'admin') {
            return res.status(401).json({ error: 'User is not an admin' });
        }
        next(); // Call the next middleware/route handler
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const authUserMiddleware = async (req, res, next) => {

    const token = req.headers['authorization']?.split(' ')[1] || req.body.token; // Get token from Authorization header or request body

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        // Check if the session token exists in the Users_session table
        const session = await prisma.users_session.findUnique({
            where: {
                session_token: token,
            },
        });

        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Check if the session is expired
        if (session && new Date(session.expires_at) < new Date()) {
            return res.status(401).json({ error: 'This session has been expired' });
        }

        // Optionally: Attach user info to request object for further use in the route
        const user = await prisma.users.findUnique({
            where: {
                id: session.user_id,
            },
        });

        req.user = user; // Attach user data to request object
        next(); // Call the next middleware/route handler
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    authAdminMiddleware,
    authUserMiddleware
};
