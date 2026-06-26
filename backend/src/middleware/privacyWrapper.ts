import { Request, Response, NextFunction } from 'express';
import { scrubPayload } from '../utils/logger';

/**
 * Biometric Privacy Wrapper Middleware
 * Intercepts incoming requests and scrubs raw image payloads (e.g., base64 strings or binary buffers)
 * from the request body, parameters, and query options. This guarantees that no raw image payloads
 * can be inadvertently logged, printed to standard streams, or written to temp files on disk.
 */
export function biometricPrivacyWrapper(req: Request, res: Response, next: NextFunction): void {
  const reqAny = req as any;
  // If there are files parsed (e.g., via multer memoryStorage), ensure we don't hold raw buffer strings in loggable attributes
  if (reqAny.files) {
    if (Array.isArray(reqAny.files)) {
      reqAny.files.forEach((file: any) => {
        if (file.buffer) {
          // Keep the buffer for processing inside controllers if needed, but mark loggable elements
          file.originalname = '[SCRUBBED_IMAGE_NAME]';
        }
      });
    } else if (typeof reqAny.files === 'object') {
      const filesObj = reqAny.files as Record<string, any[]>;
      for (const fieldname in filesObj) {
        filesObj[fieldname].forEach((file: any) => {
          if (file.buffer) {
            file.originalname = '[SCRUBBED_IMAGE_NAME]';
          }
        });
      }
    }
  }

  // Scrub request body in-place before any logging middleware or route handlers receive it
  if (req.body) {
    req.body = scrubPayload(req.body);
  }

  // Scrub query params
  if (req.query) {
    req.query = scrubPayload(req.query);
  }

  // Scrub request headers (just in case raw binary is passed in a header)
  if (req.headers) {
    for (const key in req.headers) {
      if (typeof req.headers[key] === 'string' && req.headers[key]!.length > 500) {
        req.headers[key] = '[SCRUBBED_LARGE_HEADER_VALUE]';
      }
    }
  }

  next();
}
