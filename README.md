# NoStyleDrifting - Git Branch Comparison Tool

A simplified CLI utility for comparing Angular styles between Git branches. This tool creates temporary directories with branch content to enable style analysis and comparison.

## Overview

NoStyleDrifting implements the simplified Git branch comparison approach described in Story 0.1. It runs inside your Angular project and creates temporary directories for each branch, eliminating the complexity of repository management while providing a solid foundation for SCSS analysis.

## Features

- 🌿 **Simple Branch Comparison**: Compare any two Git branches or commits
- 🏗️ **Local Repository Focus**: Works within your existing Angular project
- 🧹 **Automatic Cleanup**: Temporary directories are cleaned up automatically
- 🔍 **Verbose Mode**: Detailed output for debugging and monitoring
- 💾 **Preserve Option**: Keep temporary directories for manual inspection
- ⚡ **Fast Operations**: Efficient file copying for quick setup

## Installation

### Global Installation

```bash
npm install -g nostyledrifting
```

### Local Installation (Recommended)

```bash
# Add to your Angular project
npm install --save-dev nostyledrifting

# Add to package.json scripts
{
  "scripts": {
    "style:compare": "ng-style-compare"
  }
}
```

### Direct Usage with npx

```bash
# Run directly without installation
npx nostyledrifting main feature/new-ui
```

## Usage

### Basic Usage

```bash
# Compare two branches
ng-style-compare main feature/new-ui

# Compare with verbose output
ng-style-compare main develop --verbose

# Keep temporary directories for manual inspection
ng-style-compare main feature/styles --keep-temp

# Compare current branch with another
ng-style-compare HEAD feature/new-styles

# Compare tags or commits
ng-style-compare v1.0.0 v2.0.0
```

### Command Line Options

```
Usage: ng-style-compare [options] <branch1> <branch2>

Compare Angular styles between git branches

Arguments:
  branch1        First branch to compare
  branch2        Second branch to compare

Options:
  -V, --version  output the version number
  --keep-temp    Keep temporary directories after comparison
  --verbose      Show detailed output
  -h, --help     display help for command
```

## Requirements

- Node.js 16.0.0 or higher
- Git repository with the branches you want to compare
- Angular project (or any project with style files)

## How It Works

1. **Validation**: Checks that you're in a Git repository and both branches exist
2. **Branch Checkout**: Temporarily checks out each branch
3. **Directory Creation**: Creates temporary directories with branch content
4. **File Copying**: Copies project files (excluding node_modules, .git, dist)
5. **Cleanup**: Automatically removes temporary directories unless `--keep-temp` is used

## Examples

### Development Workflow

```bash
# Navigate to your Angular project
cd /path/to/your/angular-project

# Compare feature branch with main
ng-style-compare main feature/new-navigation

# Expected output:
# ✓ Branches ready for comparison:
#   main (a1b2c3d): /tmp/ng-style-compare/main-12345678
#   feature/new-navigation (e4f5g6h): /tmp/ng-style-compare/feature_new-navigation-87654321
# 🎉 Branch comparison setup complete!
```

### With Package.json Scripts

```json
{
  "scripts": {
    "style:compare": "ng-style-compare",
    "style:compare:verbose": "ng-style-compare --verbose",
    "style:compare:keep": "ng-style-compare --keep-temp"
  }
}
```

```bash
# Use via npm scripts
npm run style:compare main develop
npm run style:compare:verbose main feature/redesign
```

## API Reference

### GitBranchComparer Class

```typescript
import { GitBranchComparer } from 'nostyledrifting';

const comparer = new GitBranchComparer({
  keepTemp: false,
  verbose: true
});

const result = await comparer.compare('main', 'feature/new-ui');
console.log(result.branch1.path); // Temporary directory path
console.log(result.branch2.path); // Temporary directory path
```

### CompareResult Interface

```typescript
interface CompareResult {
  branch1: {
    name: string;    // Branch name
    path: string;    // Temporary directory path
    commit: string;  // Short commit hash
  };
  branch2: {
    name: string;
    path: string;
    commit: string;
  };
}
```

## Error Handling

The tool provides clear error messages for common issues:

- **Not a Git repository**: Ensures you're running in a Git project
- **Branch not found**: Validates branch existence (suggests `git fetch` for remote branches)
- **Same branch names**: Prevents comparing a branch with itself
- **Permission errors**: Handles file system permission issues

## Performance

- **Small projects** (< 100 files): ~2-5 seconds
- **Medium projects** (100-1000 files): ~5-15 seconds
- **Large projects** (1000+ files): ~15-60 seconds

Performance depends on:
- Project size and file count
- Disk I/O speed
- Git repository size

## Troubleshooting

### Common Issues

**"Branch not found" error**
```bash
# Fetch remote branches first
git fetch

# Then try the comparison
ng-style-compare main origin/feature-branch
```

**Permission denied errors**
```bash
# Check directory permissions
# Ensure temp directory is writable
```

**Out of disk space**
```bash
# Use --keep-temp to see temp directory size
ng-style-compare main develop --keep-temp --verbose

# Clean up manually if needed
```

### Debug Mode

```bash
# Enable verbose output for debugging
ng-style-compare main develop --verbose

# Keep temp directories for inspection
ng-style-compare main develop --keep-temp --verbose
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/nostyledrifting.git
cd nostyledrifting

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Test CLI locally
npm run dev -- main develop --verbose
```

## Roadmap

This tool implements Story 0.1 of the NoStyleDrifting project. Future enhancements will include:

- 📊 **SCSS Analysis Engine** (Story 1.x)
- 🎨 **Typography Analysis** (Story 2.x)  
- ♿ **Accessibility Impact Analysis** (Story 3.x)
- 🔍 **Change Detection & Classification** (Story 4.x)
- 📋 **Report Generation** (Story 5.x)

## License

ISC License - see LICENSE file for details.

## Support

- 📖 [Documentation](./documentation/)
- 🐛 [Issue Tracker](https://github.com/your-org/nostyledrifting/issues)
- 💬 [Discussions](https://github.com/your-org/nostyledrifting/discussions)

---

Built with ❤️ for Angular developers who care about style consistency and accessibility.
