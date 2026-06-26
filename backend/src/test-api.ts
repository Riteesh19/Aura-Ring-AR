import { encrypt, decrypt } from './utils/crypto';
import { scrubPayload, isBase64Image } from './utils/logger';
import app from './app';

function runCryptoTests() {
  console.log('\n--- Running Cryptographic Tests ---');
  const sizeData = JSON.stringify({ fingerSizeMm: 16.51, confidence: 0.95 });
  console.log(`Original Cleartext: ${sizeData}`);

  try {
    const encrypted = encrypt(sizeData);
    console.log('Encryption Successful!');
    console.log(`IV (hex): ${encrypted.iv}`);
    console.log(`Auth Tag (hex): ${encrypted.authTag}`);
    console.log(`Encrypted Ciphertext (hex): ${encrypted.encryptedData}`);

    const decrypted = decrypt(encrypted.encryptedData, encrypted.iv, encrypted.authTag);
    console.log(`Decryption Successful!`);
    console.log(`Decrypted Cleartext: ${decrypted}`);

    if (decrypted === sizeData) {
      console.log('✅ CRYPTO TEST PASSED: Decrypted output matches original cleartext.');
    } else {
      console.error('❌ CRYPTO TEST FAILED: Decrypted output mismatch.');
    }
  } catch (error) {
    console.error('❌ CRYPTO TEST FAILED with error:', error);
  }
}

function runPrivacyTests() {
  console.log('\n--- Running Biometric Privacy Tests ---');
  
  const testBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  console.log('Testing Base64 Detection...');
  const detected = isBase64Image(testBase64);
  console.log(`Is base64 image detected? ${detected}`);

  const dirtyPayload = {
    userId: 'user_123',
    scanImage: testBase64,
    someNestedObject: {
      biometricData: 'data:image/jpeg;base64,anotherfakeimagepayload...',
      normalField: 'This is fine'
    },
    items: [
      { id: 'ring_1', image: 'data:image/png;base64,abc...' },
      { id: 'ring_2', normalField: 42 }
    ]
  };

  console.log('Scrubbing Payload...');
  const cleanPayload = scrubPayload(dirtyPayload);
  console.log('Scrubbed Payload Result:', JSON.stringify(cleanPayload, null, 2));

  const cleanString = JSON.stringify(cleanPayload);
  if (
    !cleanString.includes('data:image') &&
    cleanPayload.scanImage === '[SCRUBBED_BIOMETRIC_DATA]' &&
    cleanPayload.someNestedObject.biometricData === '[SCRUBBED_BIOMETRIC_DATA]' &&
    cleanPayload.items[0].image === '[SCRUBBED_BIOMETRIC_DATA]'
  ) {
    console.log('✅ PRIVACY TEST PASSED: All biometric payloads successfully scrubbed.');
  } else {
    console.error('❌ PRIVACY TEST FAILED: Raw image payloads remain in the scrubbed output.');
  }
}

function runExpressConfigTests() {
  console.log('\n--- Running Express Security Configurations Checks ---');
  
  // Inspecting middleware stack of Express App
  const middlewareNames = app._router.stack
    .map((layer: any) => layer.name || (layer.handle ? layer.handle.name : 'unknown'))
    .filter((name: string) => name !== 'unknown');

  console.log('Registered Middlewares:', middlewareNames);

  // Check helmet
  const hasHelmet = middlewareNames.some((name: string) => name.toLowerCase().includes('helmet'));
  console.log(`Helmet (Security Headers) Integrated: ${hasHelmet ? '✅' : '❌'}`);

  // Check cors
  const hasCors = middlewareNames.some((name: string) => name.toLowerCase().includes('cors'));
  console.log(`CORS Middleware Integrated: ${hasCors ? '✅' : '❌'}`);

  // Check rate limiter
  const hasRateLimiter = app._router.stack.some((layer: any) => {
    return layer.regexp && String(layer.regexp).includes('api') && (layer.name === '<anonymous>' || layer.name === 'rateLimit' || layer.name.includes('limit'));
  });
  console.log(`Rate Limiting Integrated: ${hasRateLimiter ? '✅' : '❌'}`);

  // Check biometric wrapper
  const hasPrivacyWrapper = middlewareNames.some((name: string) => name.toLowerCase().includes('biometric'));
  console.log(`Biometric Privacy Wrapper Integrated: ${hasPrivacyWrapper ? '✅' : '❌'}`);

  if (hasHelmet && hasCors && hasRateLimiter && hasPrivacyWrapper) {
    console.log('✅ EXPRESS CONFIG TEST PASSED: All required security middlewares registered.');
  } else {
    console.error('❌ EXPRESS CONFIG TEST FAILED: Missing one or more required security middlewares.');
  }
}

// Run all tests
console.log('====================================');
console.log('  AURA RING AR BACKEND TEST SUITE  ');
console.log('====================================');
runCryptoTests();
runPrivacyTests();
runExpressConfigTests();
console.log('====================================\n');
