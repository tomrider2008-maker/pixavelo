/* global document */
import { chromium } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.PIXAVELO_CAPTURE_URL ?? 'http://127.0.0.1:4180';
const outputDirectory = resolve('docs/qa');
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();
try {
  await capture('phase8-privacy-desktop.jpg', { width: 1536, height: 1024 });
  await capture('phase8-privacy-mobile.jpg', {
    width: 426,
    height: 923,
    isMobile: true,
    hasTouch: true
  });
} finally {
  await browser.close();
}

async function capture(filename, viewport) {
  const context = await browser.newContext({ viewport, colorScheme: 'light' });
  const page = await context.newPage();
  const consoleIssues = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  await page.goto(`${baseUrl}/privacy`);
  const source = await metadataBearingJpeg(page);
  await page.locator('[data-image-input]').setInputFiles({
    name: 'private-travel-photo.jpg',
    mimeType: 'image/jpeg',
    buffer: source
  });
  await page.getByRole('heading', { name: 'Private information' }).waitFor({ state: 'visible' });
  await page.screenshot({
    path: resolve(outputDirectory, filename),
    type: 'jpeg',
    quality: 92,
    fullPage: false
  });
  if (consoleIssues.length > 0) {
    throw new Error(`${filename} logged console issues:\n${consoleIssues.join('\n')}`);
  }
  await context.close();
}

async function metadataBearingJpeg(page) {
  const pixels = Buffer.from(
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable.');
      context.fillStyle = '#d8e8ff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#315992';
      context.beginPath();
      context.moveTo(0, canvas.height);
      context.lineTo(canvas.width * 0.34, canvas.height * 0.31);
      context.lineTo(canvas.width * 0.64, canvas.height);
      context.fill();
      context.fillStyle = '#17345e';
      context.beginPath();
      context.moveTo(canvas.width * 0.28, canvas.height);
      context.lineTo(canvas.width * 0.72, canvas.height * 0.2);
      context.lineTo(canvas.width, canvas.height);
      context.fill();
      context.fillStyle = '#f8fbff';
      context.beginPath();
      context.moveTo(canvas.width * 0.61, canvas.height * 0.4);
      context.lineTo(canvas.width * 0.72, canvas.height * 0.2);
      context.lineTo(canvas.width * 0.81, canvas.height * 0.38);
      context.fill();
      const blob = await new Promise((resolveBlob, reject) =>
        canvas.toBlob(
          (output) => (output ? resolveBlob(output) : reject(new Error('JPEG encode failed.'))),
          'image/jpeg',
          0.91
        )
      );
      return [...new Uint8Array(await blob.arrayBuffer())];
    })
  );
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), buildExifTiff()]);
  const xmp = Buffer.from(
    'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><rdf:Description photoshop:City="Yangon" xmp:CreatorTool="Pixavelo Test"/></x:xmpmeta>',
    'binary'
  );
  const iptc = Buffer.from([0x1c, 0x02, 0x5a, 0x00, 0x06, ...Buffer.from('Yangon')]);
  return Buffer.concat([
    pixels.subarray(0, 2),
    jpegSegment(0xe1, exif),
    jpegSegment(0xe1, xmp),
    jpegSegment(0xe2, Buffer.from('ICC_PROFILE\0test-profile', 'binary')),
    jpegSegment(0xed, iptc),
    pixels.subarray(2)
  ]);
}

function buildExifTiff() {
  const bytes = Buffer.alloc(320);
  bytes.write('II', 0, 'ascii');
  bytes.writeUInt16LE(42, 2);
  bytes.writeUInt32LE(8, 4);
  writeIfd(bytes, 8, [
    [0x010f, 2, 5, 100],
    [0x0110, 2, 8, 108],
    [0x0131, 2, 13, 120],
    [0x013b, 2, 10, 136],
    [0x8769, 4, 1, 160],
    [0x8825, 4, 1, 190]
  ]);
  bytes.write('ACME\0', 100, 'binary');
  bytes.write('CAM-100\0', 108, 'binary');
  bytes.write('Studio 4.2\0', 120, 'binary');
  bytes.write('Test User\0', 136, 'binary');
  writeIfd(bytes, 160, [[0x9003, 2, 20, 296]]);
  bytes.write('2026:08:25 10:30:00\0', 296, 'binary');
  bytes.writeUInt16LE(4, 190);
  writeEntry(bytes, 192, 0x0001, 2, 2, 0x004e);
  writeEntry(bytes, 204, 0x0002, 5, 3, 248);
  writeEntry(bytes, 216, 0x0003, 2, 2, 0x0045);
  writeEntry(bytes, 228, 0x0004, 5, 3, 272);
  bytes.writeUInt32LE(0, 240);
  writeRationals(bytes, 248, [
    [37, 1],
    [48, 1],
    [30, 1]
  ]);
  writeRationals(bytes, 272, [
    [96, 1],
    [9, 1],
    [0, 1]
  ]);
  return bytes;
}

function writeIfd(bytes, offset, entries) {
  bytes.writeUInt16LE(entries.length, offset);
  entries.forEach((entry, index) => writeEntry(bytes, offset + 2 + index * 12, ...entry));
  bytes.writeUInt32LE(0, offset + 2 + entries.length * 12);
}

function writeEntry(bytes, offset, tag = 0, type = 0, count = 0, value = 0) {
  bytes.writeUInt16LE(tag, offset);
  bytes.writeUInt16LE(type, offset + 2);
  bytes.writeUInt32LE(count, offset + 4);
  bytes.writeUInt32LE(value, offset + 8);
}

function writeRationals(bytes, offset, values) {
  values.forEach(([numerator = 0, denominator = 1], index) => {
    bytes.writeUInt32LE(numerator, offset + index * 8);
    bytes.writeUInt32LE(denominator, offset + index * 8 + 4);
  });
}

function jpegSegment(marker, payload) {
  const header = Buffer.from([
    0xff,
    marker,
    ((payload.length + 2) >>> 8) & 0xff,
    (payload.length + 2) & 0xff
  ]);
  return Buffer.concat([header, payload]);
}
