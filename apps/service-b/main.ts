import express from 'express';
import { indexHandler, healthHandler, extractTracingHeaders } from './handler.js';

const app = express();
const port = parseInt(process.env.PORT || '8080');

// Middleware to parse JSON bodies
app.use(express.json());

// Routes
app.get('/', indexHandler);
app.get('/health', healthHandler);

// 404 handler
app.use((req: any, res: any) => {
    res.status(404).send('Page not found');
});

app.listen(port, () => {
    console.log(`HTTP webserver running. Access it at: http://localhost:${port}/`);
});
