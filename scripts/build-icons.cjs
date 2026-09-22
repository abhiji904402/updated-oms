const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function createOptimizedIcons() {
  const publicDir = path.join(__dirname, '../public');
  const svgPath = path.join(publicDir, 'app-icon.svg');
  const svgContent = fs.readFileSync(svgPath);

  // Standard 192 & 512
  await sharp(svgContent).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'));
  await sharp(svgContent).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png'));
  await sharp(svgContent).resize(512, 512).png().toFile(path.join(publicDir, 'app-icon.png'));
  await sharp(svgContent).resize(512, 512).png().toFile(path.join(publicDir, 'logo.png'));

  // Maskable padded 512x512
  const paddedSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="#0284c7" />
      <g transform="translate(51, 51) scale(0.8)">
        ${svgContent.toString().replace(/<svg[^>]*>/, '').replace('</svg>', '')}
      </g>
    </svg>
  `);
  await sharp(paddedSvg).resize(512, 512).png().toFile(path.join(publicDir, 'maskable-512.png'));

  // Apple Touch Icon
  await sharp(svgContent).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(svgContent).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon-precomposed.png'));

  // Favicons
  await sharp(svgContent).resize(16, 16).png().toFile(path.join(publicDir, 'favicon-16x16.png'));
  await sharp(svgContent).resize(32, 32).png().toFile(path.join(publicDir, 'favicon-32x32.png'));
  await sharp(svgContent).resize(48, 48).png().toFile(path.join(publicDir, 'favicon-48x48.png'));

  // Create valid multi-size ICO
  const p16 = await sharp(svgContent).resize(16, 16).png().toBuffer();
  const p32 = await sharp(svgContent).resize(32, 32).png().toBuffer();
  const p48 = await sharp(svgContent).resize(48, 48).png().toBuffer();

  const numImages = 3;
  const headerSize = 6 + (16 * numImages);
  const p16Offset = headerSize;
  const p32Offset = p16Offset + p16.length;
  const p48Offset = p32Offset + p32.length;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // ICO format
  header.writeUInt16LE(numImages, 4);

  // Image 1: 16x16
  header.writeUInt8(16, 6);
  header.writeUInt8(16, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(p16.length, 14);
  header.writeUInt32LE(p16Offset, 18);

  // Image 2: 32x32
  header.writeUInt8(32, 22);
  header.writeUInt8(32, 23);
  header.writeUInt8(0, 24);
  header.writeUInt8(0, 25);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(32, 28);
  header.writeUInt32LE(p32.length, 30);
  header.writeUInt32LE(p32Offset, 34);

  // Image 3: 48x48
  header.writeUInt8(48, 38);
  header.writeUInt8(48, 39);
  header.writeUInt8(0, 40);
  header.writeUInt8(0, 41);
  header.writeUInt16LE(1, 42);
  header.writeUInt16LE(32, 44);
  header.writeUInt32LE(p48.length, 46);
  header.writeUInt32LE(p48Offset, 50);

  const ico = Buffer.concat([header, p16, p32, p48]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico);

  console.log('✅ All icons generated perfectly in /public!');
}

createOptimizedIcons().catch((err) => {
  console.warn('Icon generation skipped/warning:', err?.message || err);
  process.exit(0);
});
