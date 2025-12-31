/**
 * Generate Image Index Script
 *
 * Scans user-content/images/ directory for uploaded images and generates
 * a searchable index file (image-index.json)
 *
 * Usage: node scripts/generate-image-index.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const glob = require('glob');

const BASE_PATH = 'user-content/images';
const OUTPUT_PATH = path.join(BASE_PATH, 'image-index.json');

async function generateIndex() {
  console.log('=== Image Index Generation ===');
  console.log(`Scanning ${BASE_PATH} for metadata files...`);

  // Find all metadata files
  const metadataFiles = glob.sync(`${BASE_PATH}/**/*-metadata.json`);
  console.log(`Found ${metadataFiles.length} metadata files`);

  if (metadataFiles.length === 0) {
    console.log('No images to index. Creating empty index...');
    const emptyIndex = {
      version: '1.0',
      totalImages: 0,
      generatedDate: new Date().toISOString(),
      images: [],
      byCategory: {}
    };
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(emptyIndex, null, 2));
    console.log(`✓ Empty index created at ${OUTPUT_PATH}`);
    return;
  }

  const images = [];
  let processed = 0;
  let errors = 0;

  for (const metaFile of metadataFiles) {
    try {
      // Read metadata
      const metadata = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      const imageId = path.basename(metaFile, '-metadata.json');
      const dir = path.dirname(metaFile);

      // Find original file (may have different extension)
      const originalFiles = glob.sync(`${dir}/${imageId}.{jpg,jpeg,png,gif,webp}`);
      const originalFile = originalFiles.find(f => !f.endsWith('.webp')) || originalFiles[0];
      const webpFile = path.join(dir, `${imageId}.webp`);

      // Extract dimensions if missing
      if (!metadata.dimensions || !metadata.dimensions.width || !metadata.dimensions.height) {
        const imgFile = originalFile || webpFile;
        if (imgFile && fs.existsSync(imgFile)) {
          try {
            const img = sharp(imgFile);
            const imgMeta = await img.metadata();
            metadata.dimensions = {
              width: imgMeta.width,
              height: imgMeta.height
            };
            console.log(`  Extracted dimensions for ${imageId}: ${imgMeta.width}x${imgMeta.height}`);
          } catch (error) {
            console.warn(`  Warning: Could not extract dimensions for ${imageId}:`, error.message);
            metadata.dimensions = { width: 0, height: 0 };
          }
        } else {
          console.warn(`  Warning: Image file not found for ${imageId}`);
          metadata.dimensions = { width: 0, height: 0 };
        }
      }

      // Build index entry
      const entry = {
        id: imageId,
        filename: metadata.filename || imageId,
        name: metadata.name || metadata.filename || imageId,
        description: metadata.description || '',
        path: originalFile ? originalFile.replace(/\\/g, '/') : null,
        webpPath: fs.existsSync(webpFile) ? webpFile.replace(/\\/g, '/') : null,
        category: metadata.category || 'other',
        tags: metadata.tags || [],
        dimensions: metadata.dimensions || { width: 0, height: 0 },
        filesize: originalFile && fs.existsSync(originalFile) ? fs.statSync(originalFile).size : 0,
        uploadedBy: metadata.uploadedBy || 'unknown',
        uploadDate: metadata.uploadDate || metadata.uploadedAt || new Date().toISOString(),
        format: metadata.format || (originalFile ? path.extname(originalFile).slice(1) : 'unknown')
      };

      images.push(entry);
      processed++;

      if (processed % 10 === 0) {
        console.log(`  Processed ${processed}/${metadataFiles.length} images...`);
      }
    } catch (error) {
      console.error(`✗ Error processing ${metaFile}:`, error.message);
      errors++;
    }
  }

  // Sort by upload date (newest first)
  images.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

  // Generate category index
  const byCategory = images.reduce((acc, img) => {
    if (!acc[img.category]) {
      acc[img.category] = [];
    }
    acc[img.category].push(img.id);
    return acc;
  }, {});

  // Generate final index
  const index = {
    version: '1.0',
    totalImages: images.length,
    generatedDate: new Date().toISOString(),
    images,
    byCategory
  };

  // Write index file
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2));

  console.log('\n=== Index Generation Complete ===');
  console.log(`✓ Generated index with ${images.length} images`);
  console.log(`✓ Categories: ${Object.keys(byCategory).join(', ')}`);
  console.log(`✓ Errors: ${errors}`);
  console.log(`✓ Output: ${OUTPUT_PATH}`);

  // Print category breakdown
  console.log('\n=== Category Breakdown ===');
  Object.entries(byCategory)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([category, ids]) => {
      console.log(`  ${category}: ${ids.length} images`);
    });
}

// Run the script
generateIndex().catch((error) => {
  console.error('✗ Fatal error:', error);
  process.exit(1);
});
