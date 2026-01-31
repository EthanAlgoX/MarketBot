# Xiaohongshu Draft Creation Workflow

## Successful Process Summary

The following workflow was determined to be successful for creating and saving drafts on Xiaohongshu:

### Key Requirements Identified
1. Title must be under 20 characters
2. Use "暂存离开" (Save and Exit) button rather than other save options
3. Proper wait times between actions to allow page elements to load
4. Direct text input methods rather than complex selectors

### Optimized Steps
1. Navigate to Xiaohongshu creator home
2. Click "发布笔记" (Publish Note)
3. Click "上传图文" (Upload Image/Text)
4. Upload image file with sufficient wait time
5. Fill title with <20 characters (e.g., "Clawbot出道啦！")
6. Fill content with appropriate wait time
7. Click "暂存离开" (Save and Exit) button
8. Verify action completed

### Technical Implementation Notes
- Use Playwright's getByText() for more reliable element selection
- Include sufficient timeouts between operations
- Keep browser open after completion for verification
- Implement fallback selectors for different button types

## Recommended Improvements for the Skill

The original Xiaohongshu skill should be updated with these findings:

1. Add validation for title length (<20 characters)
2. Prioritize "暂存离开" button in the save process
3. Add proper timeout management between steps
4. Include fallback mechanisms when primary selectors fail
5. Add verification step to confirm draft was saved
6. Improve error handling and debugging screenshots

## Example Usage Pattern
```
1. Login (using existing login function)
2. Create draft with short title (<20 chars)
3. Upload image and content
4. Save using "暂存离开" button
5. Verify in drafts section
```

This workflow ensures reliable draft creation with both image and text content preserved.