# Publishing Guide

This guide walks through publishing `@yangyifei/mcp-discord-stream` to npm.

## Prerequisites

1. **npm Account**
   - Create account at https://www.npmjs.com/signup
   - Verify your email address

2. **Two-Factor Authentication (Recommended)**
   - Enable 2FA in npm account settings
   - Use authenticator app (Google Authenticator, Authy, etc.)

3. **Scoped Package Access**
   - The package name `@yangyifei/mcp-discord-stream` uses the `@yangyifei` scope
   - You need to be logged in as user `yangyifei` OR have permission to publish to this scope
   - If you want to use a different scope, update `package.json` name field

## Pre-Publishing Checklist

Before publishing, ensure:

- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Manual testing completed (see [TESTING.md](./TESTING.md))
- [ ] Version number is correct in `package.json`
- [ ] README.md is complete and accurate
- [ ] LICENSE file exists
- [ ] `.npmignore` or `files` field properly configured
- [ ] No sensitive data in code or git history
- [ ] Git working directory is clean (all changes committed)
- [ ] You're on the correct branch (usually `master` or `main`)

## Step-by-Step Publishing

### 1. Login to npm

```bash
npm login
```

Enter your npm credentials:
- Username: `yangyifei` (or your npm username)
- Password: (your npm password)
- Email: (your npm email)
- One-time password (if 2FA enabled)

Verify login:
```bash
npm whoami
```

Should output: `yangyifei` (or your username)

### 2. Verify Package Contents

Preview what will be published:

```bash
npm pack --dry-run
```

This shows:
- Which files will be included
- Package size
- Any warnings or errors

Check that:
- `build/` directory is included
- `src/` directory is NOT included (source files aren't needed)
- `tests/` directory is NOT included
- `node_modules/` is NOT included
- README.md, LICENSE, package.json ARE included

### 3. Test Local Installation

Before publishing, test the package locally:

```bash
# Pack the package
npm pack

# This creates a .tgz file like: yangyifei-mcp-discord-stream-1.4.0.tgz

# Install it globally to test
npm install -g ./yangyifei-mcp-discord-stream-1.4.0.tgz

# Test the CLI
mcp-discord-stream --help
```

### 4. Publish to npm

**First-Time Publishing (if package doesn't exist on npm yet):**

```bash
npm publish --access public
```

> **Note:** Scoped packages (`@username/package`) are private by default. Use `--access public` to make it public.

**Updating Existing Package:**

```bash
# Make sure version number in package.json is bumped!
npm publish
```

### 5. Verify Publication

Check that your package is live:

1. Visit: https://www.npmjs.com/package/@yangyifei/mcp-discord-stream
2. Install it globally: `npm install -g @yangyifei/mcp-discord-stream`
3. Test it: `mcp-discord-stream --config YOUR_TOKEN`

## Version Management

Follow [Semantic Versioning](https://semver.org/):

- **Major version** (e.g., 1.0.0 → 2.0.0): Breaking changes
- **Minor version** (e.g., 1.4.0 → 1.5.0): New features, backward-compatible
- **Patch version** (e.g., 1.4.0 → 1.4.1): Bug fixes, backward-compatible

Update version before publishing:

```bash
# Manually edit package.json version field
# OR use npm version command:

npm version patch   # 1.4.0 → 1.4.1 (bug fixes)
npm version minor   # 1.4.0 → 1.5.0 (new features)
npm version major   # 1.4.0 → 2.0.0 (breaking changes)
```

The `npm version` command also:
- Updates package.json
- Creates a git commit
- Creates a git tag (e.g., `v1.4.1`)

## Package Configuration

### files Field in package.json

The `files` field specifies what gets published:

```json
{
  "files": [
    "build/",
    "README.md",
    "LICENSE"
  ]
}
```

This ensures:
- Only built JavaScript files are published (not TypeScript source)
- Documentation is included
- Test files and development configs are excluded

### .npmignore (Alternative)

If you prefer `.npmignore` over `files` field:

```
# .npmignore
src/
tests/
*.test.ts
*.spec.ts
tsconfig.json
jest.config.js
.env
.env.*
node_modules/
```

> **Recommendation:** Use `files` field (already configured in package.json) - it's more explicit and safer.

## Publishing Workflow

### Regular Release Process

1. **Make changes**
   ```bash
   git checkout -b feature/new-tool
   # ... make changes ...
   git add .
   git commit -m "feat: add new tool"
   git push origin feature/new-tool
   ```

2. **Merge to main**
   ```bash
   git checkout master
   git merge feature/new-tool
   ```

3. **Run tests**
   ```bash
   npm test
   npm run build
   ```

4. **Bump version**
   ```bash
   npm version minor  # or patch/major
   ```

5. **Publish**
   ```bash
   npm publish --access public
   ```

6. **Push tags**
   ```bash
   git push origin master --tags
   ```

## Troubleshooting

### Error: "You must be logged in to publish packages"

**Solution:** Run `npm login` and enter your credentials.

### Error: "You do not have permission to publish"

**Solutions:**
1. Check you're logged in as the correct user: `npm whoami`
2. If using scoped package (`@yangyifei/...`), ensure you have permission to publish to that scope
3. Or change package name to unscoped: `"name": "mcp-discord-stream"` (check availability first!)

### Error: "Cannot publish over existing version"

**Solution:** You forgot to bump the version number. Update `package.json` version field or run `npm version patch`.

### Error: "402 Payment Required"

**Solution:** Private scoped packages require a paid npm account. Use `--access public` flag.

### Warning: "This package name is too similar to existing packages"

**Solution:** npm warns about confusingly similar names. If intentional (e.g., fork), ignore the warning. Otherwise, choose a more unique name.

### Package Size Too Large

**Solution:**
- Ensure `node_modules/` isn't being published
- Check `files` field only includes necessary files
- Remove unnecessary assets from `build/` directory

## Post-Publishing

### 1. Create GitHub Release

After publishing to npm:

1. Go to: https://github.com/yangyifei/mcp-discord-stream/releases/new
2. Create a new tag: `v1.4.0` (match npm version)
3. Release title: "v1.4.0 - Streaming Features"
4. Description: Copy relevant sections from README.md
5. Publish release

### 2. Update Documentation Sites

If your package is listed on:
- [Smithery](https://smithery.ai/) - Submit your package
- [MCP Servers](https://mcpservers.org/) - Add listing

### 3. Announce Release

Share on:
- Twitter/X: `"Just released @yangyifei/mcp-discord-stream v1.4.0 with unlimited message streaming! 🚀"`
- Discord servers: Relevant Discord/MCP communities
- GitHub Discussions: Start a discussion about the release

## Unpublishing (Emergency Only)

⚠️ **Use with extreme caution!** Unpublishing can break existing users.

```bash
# Unpublish a specific version (within 72 hours of publishing)
npm unpublish @yangyifei/mcp-discord-stream@1.4.0

# Unpublish entire package (NOT RECOMMENDED)
npm unpublish @yangyifei/mcp-discord-stream --force
```

**Better alternatives to unpublishing:**
1. Publish a bug-fix version immediately (e.g., 1.4.1)
2. Deprecate the version: `npm deprecate @yangyifei/mcp-discord-stream@1.4.0 "Broken, use 1.4.1+"`

## Continuous Publishing (Future)

For automated releases, consider:

1. **GitHub Actions** - Auto-publish on git tag
2. **Semantic Release** - Auto-versioning based on commit messages
3. **Changesets** - Manage versions and changelogs

Example GitHub Actions workflow (`.github/workflows/publish.yml`):

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Support

If you encounter issues:

1. Check [npm documentation](https://docs.npmjs.com/)
2. Search [npm support forum](https://github.com/npm/feedback/discussions)
3. Contact npm support: support@npmjs.com

---

**Ready to publish?** Follow the checklist at the top of this document! 🚀
