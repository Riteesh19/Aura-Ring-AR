import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { generalLimiter } from './middleware/rateLimiter';
import { biometricPrivacyWrapper } from './middleware/privacyWrapper';
import { logger } from './utils/logger';

import authRoutes from './routes/authRoutes';
import sizeRoutes from './routes/sizeRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import orderRoutes from './routes/orderRoutes';

const app = express();

// Trust reverse proxy (e.g., AWS ALB, Heroku) to correctly parse secure cookies
app.set('trust proxy', 1);

// 1. Configure Secure HTTP Headers (Helmet.js)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'https://cdn.jsdelivr.net']
      }
    },
    xFrameOptions: { action: 'deny' } // Prevent Clickjacking
  })
);

// 2. Enable CORS
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(
  cors({
    origin: corsOrigin,
    credentials: true, // Allow JWT HttpOnly cookie sharing
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// 3. Parser Middlewares
app.use(express.json({ limit: '10mb' })); // Limit body payload sizes
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 4. Rate Limiting protection for all API endpoints
app.use('/api', generalLimiter);

// 5. Biometric Privacy Wrapper: Ensure no raw image payloads propagate to logs/disk
app.use(biometricPrivacyWrapper);

// 6. Base Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// 7. Route Handlers
app.use('/api/auth', authRoutes);
app.use('/api/sizes', sizeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);

// 8. 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ status: 404, message: 'Resource not found' });
});

// 9. Global Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Use safety logger which scrubs error messages of biometric strings
  logger.error('Unhandled request error', err);
  
  res.status(err.status || 500).json({
    status: err.status || 500,
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

export default app;
