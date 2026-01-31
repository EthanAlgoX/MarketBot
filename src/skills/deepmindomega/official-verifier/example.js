/**
 * 官方项目验证器技能 - 使用示例
 */

const OfficialVerifier = require('./verify.js');
const verifier = new OfficialVerifier();

// 示例1: 验证OpenClaw项目
console.log("=== 验证OpenClaw项目 ===");
const openclawResult = verifier.verify({
  starCount: 113470,
  hasOfficialBlog: true,
  hasDevInfo: true,
  devActivityLevel: 'high',
  hasClearHistory: true,
  hasReasonableChanges: true,
  isWellDocumented: true,
  hasHNPosts: true,
  hasTechMediaCoverage: true,
  hasCommunityDiscussions: true,
  recentCommits: 'high',
  issueResponse: 'high',
  versionUpdates: 'high',
  noSecurityWarnings: true,
  hasCodeReviews: true,
  responsiveToSecurityIssues: true
});

console.log(JSON.stringify(openclawResult, null, 2));

// 示例2: 验证一个小型项目
console.log("\n=== 验证小型项目 ===");
const smallProjectResult = verifier.verify({
  starCount: 45,
  hasOfficialBlog: false,
  hasDevInfo: true,
  devActivityLevel: 'medium',
  hasClearHistory: true,
  hasReasonableChanges: true,
  isWellDocumented: false,
  hasHNPosts: false,
  hasTechMediaCoverage: false,
  hasCommunityDiscussions: true,
  recentCommits: 'low',
  issueResponse: 'medium',
  versionUpdates: 'low',
  noSecurityWarnings: true,
  hasCodeReviews: false,
  responsiveToSecurityIssues: true
});

console.log(JSON.stringify(smallProjectResult, null, 2));

// 示例3: 验证一个可疑项目
console.log("\n=== 验证可疑项目 ===");
const suspiciousProjectResult = verifier.verify({
  starCount: 2,
  hasOfficialBlog: false,
  hasDevInfo: false,
  devActivityLevel: 'low',
  hasClearHistory: false,
  hasReasonableChanges: false,
  isWellDocumented: false,
  hasHNPosts: false,
  hasTechMediaCoverage: false,
  hasCommunityDiscussions: false,
  recentCommits: 'low',
  issueResponse: 'low',
  versionUpdates: 'low',
  noSecurityWarnings: false,
  hasCodeReviews: false,
  responsiveToSecurityIssues: false
});

console.log(JSON.stringify(suspiciousProjectResult, null, 2));