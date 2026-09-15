import fs from 'node:fs';

const lambdaPath = 'integrations/alexa/lambda/index.mjs';
const text = fs.readFileSync(lambdaPath, 'utf8');

// The Alexa dashboard is now rendered entirely with native APL Frames,
// Containers and Text in lambda/index.mjs. Keeping the UI vector/native
// avoids the pixelation and scaling artifacts caused by the old JPEG
// screenshot background on Echo Show / Hub landscape displays.
//
// This script intentionally does not inject dashboard-bg.b64 anymore.
// It only validates that the native dashboard is present, so running the
// historical "polish" step can never regress the production layout back
// to a low-resolution raster mockup.
if (!text.includes('const HASSOUN_DASHBOARD = {')) {
  throw new Error('Native Alexa dashboard not found in lambda/index.mjs');
}

if (text.includes('data:image/jpeg;base64')) {
  throw new Error('Raster-backed Alexa dashboard detected. Remove the embedded JPEG before deployment.');
}

console.log('Alexa dashboard already uses native APL rendering; no raster background applied.');
