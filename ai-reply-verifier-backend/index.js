const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Dynamically load API routes from the 'api' directory
console.log('--- Loading API routes ---');
const apiDirectory = path.join(__dirname, 'api');

function registerRoutes(directory, prefix = '') {
    fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
        const fullPath = path.join(directory, entry.name);
        const routePath = `${prefix}/${entry.name.replace('.js', '')}`;
        
        if (entry.isDirectory()) {
            // Recurse into subdirectories (e.g., /api/admin)
            registerRoutes(fullPath, routePath);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            try {
                const routeHandler = require(fullPath);
                // Vercel serverless functions often export a default function
                if (routeHandler.default && typeof routeHandler.default === 'function') {
                    const finalRoute = `/api${routePath}`;
                    console.log(`Registering route: ${finalRoute}`);
                    // Use app.all to handle any HTTP method
                    app.all(finalRoute, routeHandler.default);
                } else {
                     console.warn(`! Could not register ${fullPath}. No default export function found.`);
                }
            } catch (error) {
                console.error(`x Error loading route ${fullPath}:`, error);
            }
        }
    });
}

registerRoutes(apiDirectory);
console.log('--- API routes loaded ---');

// Add a catch-all for the admin UI to handle client-side routing
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running successfully on http://localhost:${port}`);
}); 