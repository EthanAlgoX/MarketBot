# Xiaohongshu Upload Skill for Clawdbot

This skill integrates Xiaohongshu (Little Red Book) publishing capabilities into Clawdbot using a local MCP server.

## Features
- **Smart Login**: Automates login session persistence. Just scan the QR code once.
- **Auto-Upload**: Supports uploading images with titles and descriptions via natural language commands.
- **Title Validation**: Automatically validates and trims titles to under 20 characters to ensure proper saving.
- **Enhanced Save Functionality**: Uses "暂存离开" (Save and Exit) button for more reliable draft saving.
- **Browser Automation**: Leveraging Playwright for robust interaction with the Creator Platform.
- **Improved Error Handling**: Better fallback mechanisms and error reporting.

## Version 1.1.0 Updates
- Added title length validation (automatically truncates to 20 characters if needed)
- Prioritized "暂存离开" (Save and Exit) button for more reliable draft saving
- Improved timing between operations to prevent failures
- Enhanced error handling with multiple fallback selectors
- Better success verification after saving

## Installation
See `SKILL.md` for detailed setup instructions.