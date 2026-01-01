# CDN Scripts

This directory contains scripts for managing CDN assets and indexes.

## Scripts

### `build-game-asset-index.js`

Builds searchable indexes for game asset images (`game-assets/images/`).

**Outputs:**
- `game-assets/images/image-index.json` - Main index (array format)
- `game-assets/images/image-search-index.json` - Search index (object format)

**Usage:**
```bash
# From CDN repository
npm run build:index

# With custom paths
node scripts/build-game-asset-index.js \
  --cdn-dir /path/to/images \
  --output-dir /path/to/output
```

**Automatic Execution:**
This script runs automatically via GitHub Actions (`.github/workflows/build-game-asset-index.yml`) when images are committed to `game-assets/images/**`.

### `generate-image-index.js`

Builds index for user-uploaded images (`user-content/images/`).

**Outputs:**
- `user-content/images/image-index.json` - User content index

**Usage:**
```bash
npm run build:user-index
```

**Automatic Execution:**
This script runs automatically via GitHub Actions (`.github/workflows/generate-image-index.yml`) when images are committed to `user-content/images/**`.

## Workflows

### Automatic Index Rebuilds

Both indexes are automatically rebuilt when their respective image directories are modified:

| Directory | Workflow | Triggers |
|-----------|----------|----------|
| `game-assets/images/**` | `build-game-asset-index.yml` | Push to main (image files) |
| `user-content/images/**` | `generate-image-index.yml` | Push to main (image/metadata files) |

**Workflow Features:**
- ✅ Automatic execution on image commits
- ✅ Prevents infinite loops with `[skip ci]` in commit messages
- ✅ Retry logic for concurrent workflow runs
- ✅ Detailed commit messages with statistics

## Dependencies

Install dependencies:
```bash
npm install
```

**Required packages:**
- `sharp` - Image processing and dimension extraction
- `glob` - File pattern matching (optional, used by generate-image-index.js)

## Troubleshooting

### Workflow not triggering

**Check:**
```bash
# View recent workflow runs
gh run list --limit 5

# View specific workflow runs
gh run list --workflow=build-game-asset-index.yml

# Manually trigger workflow
gh workflow run build-game-asset-index.yml
```

**Common causes:**
- Commit didn't modify image files in watched paths
- Commit message contains `[skip ci]` or `[skip actions]`
- Workflow permissions not set (requires `contents: write`)

### Indexes not updating

**Verify:**
1. Check if workflow ran: `gh run list`
2. View workflow logs: `gh run view <run-id> --log`
3. Check for errors in action output
4. Ensure `package.json` and dependencies are committed

### Manual rebuild

```bash
# Run script locally
npm run build:index

# Commit and push
git add game-assets/images/image-index.json game-assets/images/image-search-index.json
git commit -m "Manual index rebuild"
git push
```

## Development

### Testing locally

```bash
# Build indexes
npm run build:index

# Check output
cat game-assets/images/image-index.json | jq '.totalImages'
cat game-assets/images/image-search-index.json | jq '.totalImages'
```

### Adding new image directories

To watch additional directories:

1. Update workflow file (`.github/workflows/build-game-asset-index.yml`)
2. Add paths to `paths:` section:
   ```yaml
   paths:
     - 'game-assets/images/**/*.png'
     - 'new-directory/**/*.png'  # Add here
   ```
3. Commit and push workflow changes

## Documentation

For complete documentation, see:
- **Migration Guide:** `../wiki/.claude/image-index-cdn-migration.md` (in wiki repository)
- **Wiki Config:** `../wiki/wiki-config.json` → `features.gameAssets.cdn`
