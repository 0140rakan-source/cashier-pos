#!/usr/bin/env node
/**
 * Offline Activation Code Generator
 * 
 * Usage:
 *   node generate-activation.js <REQUEST_CODE>
 * 
 * Example:
 *   node generate-activation.js TUZV-AMLY-DFLB-TWFU
 * 
 * This generates the activation code that the customer needs to enter.
 * Keep this tool SECRET — only you (the vendor) should have it.
 */

const crypto = require('crypto');

const ACTIVATION_SECRET = process.env.ACTIVATION_SECRET;
if (!ACTIVATION_SECRET) {
  console.error('ERROR: ACTIVATION_SECRET environment variable not set');
  console.error('Set it via: export ACTIVATION_SECRET="your-secret-here"');
  process.exit(1);
}

const requestCode = process.argv[2];

if (!requestCode) {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Cashier POS — Offline Activation Generator  ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log('Usage:  node generate-activation.js <REQUEST_CODE>');
  console.log('');
  console.log('Example:');
  console.log('  node generate-activation.js TUZV-AMLY-DFLB-TWFU');
  console.log('');
  console.log('The customer gives you their Request Code (shown in the app).');
  console.log('You run this tool and give them back the Activation Code.');
  console.log('');
  process.exit(1);
}

const cleanRequest = requestCode.toUpperCase().trim();

const code = crypto.createHmac('sha256', ACTIVATION_SECRET)
  .update(cleanRequest)
  .digest('hex')
  .slice(0, 16)
  .toUpperCase();

const formatted = code.match(/.{1,4}/g).join('-');

console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log('║  Cashier POS — Offline Activation Generator  ║');
console.log('╚══════════════════════════════════════════════╝');
console.log('');
console.log(`  Request Code:    ${cleanRequest}`);
console.log(`  Activation Code: ${formatted}`);
console.log('');
console.log('Give the Activation Code to the customer.');
console.log('They enter it in the app activation screen.');
console.log('');
