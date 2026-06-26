/**
 * Custom Logger Utility
 * Ensures that no raw image payloads, base64 strings, or binary data
 * are printed to stdout, console logs, or files.
 */

// Simple helper to check if a string is a potential base64 image payload
export function isBase64Image(str: string): boolean {
  if (typeof str !== 'string') return false;
  // Matches "data:image/png;base64,..."
  if (str.startsWith('data:image/')) return true;
  // Matches raw base64 that is very long (over 1000 chars) and conforms to base64 encoding pattern
  if (str.length > 500 && /^[a-zA-Z0-9+/=]+$/.test(str.substring(0, 100).replace(/\s/g, ''))) {
    return true;
  }
  return false;
}

// Recursively traverse and scrub objects
export function scrubPayload(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    if (isBase64Image(obj)) {
      return '[SCRUBBED_BIOMETRIC_DATA]';
    }
    return obj;
  }

  if (Buffer.isBuffer(obj)) {
    return '[SCRUBBED_BINARY_BUFFER]';
  }

  if (Array.isArray(obj)) {
    return obj.map(item => scrubPayload(item));
  }

  if (typeof obj === 'object') {
    const scrubbedObj: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Double check key names indicating biometric data
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('image') ||
          lowerKey.includes('biometric') ||
          lowerKey.includes('scan') ||
          lowerKey.includes('photo')
        ) {
          if (typeof obj[key] === 'string' && isBase64Image(obj[key])) {
            scrubbedObj[key] = '[SCRUBBED_BIOMETRIC_DATA]';
            continue;
          }
        }
        scrubbedObj[key] = scrubPayload(obj[key]);
      }
    }
    return scrubbedObj;
  }

  return obj;
}

export const logger = {
  info: (message: string, meta?: any) => {
    const scrubbedMeta = meta ? scrubPayload(meta) : '';
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, scrubbedMeta ? JSON.stringify(scrubbedMeta) : '');
  },
  error: (message: string, error?: any) => {
    const scrubbedError = error ? scrubPayload(error) : '';
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, scrubbedError);
  },
  warn: (message: string, meta?: any) => {
    const scrubbedMeta = meta ? scrubPayload(meta) : '';
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, scrubbedMeta ? JSON.stringify(scrubbedMeta) : '');
  }
};
