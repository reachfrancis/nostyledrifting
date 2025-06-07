# Task 6: Diff Rendering (Terminal, JSON, HTML)

## Overview
Implement the rendering layer that transforms formatted diff results into different output formats (terminal with colors, JSON for programmatic consumption, and HTML for web viewing).

## Files to Create

### 1. `src/diff/diff-renderer.ts` - Main Renderer Interface
Core rendering orchestrator that delegates to specific format renderers.

### 2. `src/diff/renderers/terminal-renderer.ts` - Terminal Output
Rich terminal output with ANSI colors, syntax highlighting, and interactive features.

### 3. `src/diff/renderers/json-renderer.ts` - JSON Output  
Structured JSON output for programmatic consumption and API integration.

### 4. `src/diff/renderers/html-renderer.ts` - HTML Output
Web-friendly HTML output with CSS styling and responsive design.

### 5. `src/diff/renderers/base-renderer.ts` - Abstract Base
Shared rendering functionality and interface definition.

## Implementation Details

### Core Architecture
- **Renderer Interface**: Unified API for all output formats
- **Format Detection**: Automatic format selection based on options
- **Metadata Handling**: Consistent metadata across all formats
- **Error Handling**: Graceful degradation for rendering failures

### Terminal Renderer Features
- **ANSI Color Support**: Full color palette for different change types
- **Syntax Highlighting**: SCSS syntax highlighting within diffs
- **Progress Indicators**: Progress bars for large diff processing
- **Interactive Elements**: Expandable sections and navigation

### JSON Renderer Features
- **Schema Compliance**: Well-defined JSON schema for API consumption
- **Metadata Preservation**: Complete diff metadata in structured format
- **Compression Options**: Optional compression for large diffs
- **Validation**: Built-in JSON schema validation

### HTML Renderer Features
- **Responsive Design**: Mobile-friendly diff viewing
- **CSS Integration**: Embedded CSS for standalone HTML files
- **Accessibility**: WCAG compliant HTML structure
- **Print Support**: Print-friendly CSS for documentation

## Dependencies
- `chalk` - Terminal colors (existing)
- `ansi-escapes` - Terminal control sequences
- `highlight.js` - Syntax highlighting for HTML
- Built-in JSON support

## Testing Requirements
- Unit tests for each renderer format
- Integration tests with formatter output
- Visual regression tests for HTML output
- Performance tests for large diff rendering

## Integration Points
- Works with all three formatters from Task 5
- Integrates with CLI options for format selection
- Supports streaming output for large diffs
- Compatible with existing error handling system

## Success Criteria
- Clean, readable terminal output with proper colors
- Valid, well-structured JSON output
- Professional HTML output suitable for documentation
- Consistent metadata across all formats
- Performance optimization for large diffs
