#!/usr/bin/env node

/**
 * Official Project Verifier Tool
 * 执行官方项目验证的主要入口点
 */

const fs = require('fs');
const path = require('path');

// 引入验证器类
let OfficialVerifier;
try {
  OfficialVerifier = require('./verify.js');
} catch (error) {
  console.error('Failed to load verify.js:', error.message);
  process.exit(1);
}

function parseArguments() {
  const args = process.argv.slice(2);
  const params = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1];
      
      if (value && !value.startsWith('--')) {
        i++; // 跳过下一个参数，因为它已被使用
        
        // 尝试转换数值和布尔值
        if (value === 'true') params[key] = true;
        else if (value === 'false') params[key] = false;
        else if (!isNaN(Number(value))) params[key] = Number(value);
        else params[key] = value;
      } else {
        // 如果没有提供值，则视为布尔标志
        params[key] = true;
      }
    }
  }

  return params;
}

function main() {
  const inputData = parseArguments();
  
  // 如果没有提供URL，但有其他参数，仍然可以运行
  if (!inputData.projectUrl && Object.keys(inputData).length === 0) {
    console.log('Usage: node verify-official-project.js --projectUrl <URL> [--starCount <number>] [--hasOfficialBlog <boolean>] ...');
    console.log('');
    console.log('Available options:');
    console.log('  --projectUrl <url>                    项目URL（必需）');
    console.log('  --starCount <number>                  GitHub star数量');
    console.log('  --hasOfficialBlog <boolean>           是否有官方博客');
    console.log('  --hasDevInfo <boolean>                是否有明确的开发者信息');
    console.log('  --devActivityLevel <high|medium|low>  开发者活跃度');
    console.log('  --hasClearHistory <boolean>           项目历史是否清晰');
    console.log('  --hasReasonableChanges <boolean>      名称变更是否合理');
    console.log('  --isWellDocumented <boolean>          文档是否完善');
    console.log('  --hasHNPosts <boolean>                是否有Hacker News报道');
    console.log('  --hasTechMediaCoverage <boolean>      是否有技术媒体报道');
    console.log('  --hasCommunityDiscussions <boolean>   社区讨论是否活跃');
    console.log('  --recentCommits <high|medium|low>     最近提交频率');
    console.log('  --issueResponse <high|medium|low>     Issue响应速度');
    console.log('  --versionUpdates <high|medium|low>    版本更新频率');
    console.log('  --noSecurityWarnings <boolean>        是否无安全警告');
    console.log('  --hasCodeReviews <boolean>            是否有代码审查');
    console.log('  --responsiveToSecurityIssues <boolean> 是否对安全问题响应及时');
    process.exit(1);
  }

  // 如果提供了projectUrl，将其设为必需参数
  if (inputData.projectUrl) {
    inputData.projectUrl = inputData.projectUrl;
  }

  try {
    const verifier = new OfficialVerifier();
    const result = verifier.verify(inputData);
    
    // 输出结果为JSON格式
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Verification failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}