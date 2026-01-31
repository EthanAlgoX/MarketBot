#!/usr/bin/env node

/**
 * Official Project Verifier Skill
 * 用于判断网站或项目仓库是否为官方项目的工具
 */

class OfficialVerifier {
  constructor() {
    // 验证维度及其权重
    this.weights = {
      github_stars: 0.25,
      developer_verification: 0.20,
      information_consistency: 0.20,
      third_party_references: 0.15,
      project_activity: 0.10,
      security_indicators: 0.10
    };
  }

  /**
   * 评估GitHub star数量得分
   */
  evaluateStars(starCount) {
    if (starCount >= 100000) return 100;
    if (starCount >= 50000) return 90;
    if (starCount >= 10000) return 75;
    if (starCount >= 1000) return 50;
    if (starCount >= 100) return 25;
    return 10;
  }

  /**
   * 评估开发者认证得分
   */
  evaluateDeveloperVerification(hasOfficialBlog, hasDevInfo, activityLevel) {
    let score = 0;
    
    if (hasOfficialBlog) score += 40;
    if (hasDevInfo) score += 35;
    
    switch(activityLevel) {
      case 'high':
        score += 25;
        break;
      case 'medium':
        score += 15;
        break;
      case 'low':
        score += 5;
        break;
      default:
        score += 0;
    }
    
    return Math.min(score, 100);
  }

  /**
   * 评估信息一致性得分
   */
  evaluateConsistency(hasClearHistory, hasReasonableChanges, isWellDocumented) {
    let score = 0;
    
    if (hasClearHistory) score += 40;
    if (hasReasonableChanges) score += 35;
    if (isWellDocumented) score += 25;
    
    return Math.min(score, 100);
  }

  /**
   * 评估第三方引用得分
   */
  evaluateThirdPartyReferences(hasHNPosts, hasTechMediaCoverage, hasCommunityDiscussions) {
    let score = 0;
    
    if (hasHNPosts) score += 50;
    if (hasTechMediaCoverage) score += 30;
    if (hasCommunityDiscussions) score += 20;
    
    return Math.min(score, 100);
  }

  /**
   * 评估项目活跃度得分
   */
  evaluateProjectActivity(recentCommits, issueResponse, versionUpdates) {
    let score = 0;
    
    if (recentCommits === 'high') score += 40;
    else if (recentCommits === 'medium') score += 25;
    else if (recentCommits === 'low') score += 10;
    
    if (issueResponse === 'high') score += 35;
    else if (issueResponse === 'medium') score += 20;
    else if (issueResponse === 'low') score += 5;
    
    if (versionUpdates === 'high') score += 25;
    else if (versionUpdates === 'medium') score += 15;
    else if (versionUpdates === 'low') score += 5;
    
    return Math.min(score, 100);
  }

  /**
   * 评估安全指标得分
   */
  evaluateSecurityIndicators(noWarnings, hasReviews, responsiveToIssues) {
    let score = 0;
    
    if (noWarnings) score += 40;
    if (hasReviews) score += 35;
    if (responsiveToIssues) score += 25;
    
    return Math.min(score, 100);
  }

  /**
   * 主验证函数
   */
  verify(inputData) {
    // 输入数据解构
    const {
      starCount = 0,
      hasOfficialBlog = false,
      hasDevInfo = false,
      devActivityLevel = 'low',
      hasClearHistory = false,
      hasReasonableChanges = false,
      isWellDocumented = false,
      hasHNPosts = false,
      hasTechMediaCoverage = false,
      hasCommunityDiscussions = false,
      recentCommits = 'low',
      issueResponse = 'low',
      versionUpdates = 'low',
      noSecurityWarnings = false,
      hasCodeReviews = false,
      responsiveToSecurityIssues = false
    } = inputData;

    // 计算各维度得分
    const scores = {
      github_stars: this.evaluateStars(starCount),
      developer_verification: this.evaluateDeveloperVerification(
        hasOfficialBlog, hasDevInfo, devActivityLevel
      ),
      information_consistency: this.evaluateConsistency(
        hasClearHistory, hasReasonableChanges, isWellDocumented
      ),
      third_party_references: this.evaluateThirdPartyReferences(
        hasHNPosts, hasTechMediaCoverage, hasCommunityDiscussions
      ),
      project_activity: this.evaluateProjectActivity(
        recentCommits, issueResponse, versionUpdates
      ),
      security_indicators: this.evaluateSecurityIndicators(
        noSecurityWarnings, hasCodeReviews, responsiveToSecurityIssues
      )
    };

    // 计算加权总分
    let totalProbability = 0;
    for (const [dimension, score] of Object.entries(scores)) {
      totalProbability += score * this.weights[dimension];
    }

    // 确定置信度等级
    let confidence;
    if (totalProbability >= 85) confidence = 'very_high';
    else if (totalProbability >= 70) confidence = 'high';
    else if (totalProbability >= 50) confidence = 'medium';
    else if (totalProbability >= 30) confidence = 'low';
    else confidence = 'very_low';

    // 生成理由
    const reasons = [];
    if (starCount >= 10000) reasons.push(`GitHub仓库有${starCount.toLocaleString()}个stars`);
    if (hasOfficialBlog) reasons.push('有官方博客详细说明');
    if (hasDevInfo) reasons.push('开发者信息明确');
    if (hasClearHistory) reasons.push('项目历史清晰可追溯');
    if (hasHNPosts) reasons.push('在技术社区有广泛讨论');
    if (devActivityLevel === 'high') reasons.push('开发者活跃度高');
    if (recentCommits === 'high') reasons.push('项目更新频繁');

    // 生成警告
    const warnings = [];
    if (starCount < 100) warnings.push('GitHub star数量较少');
    if (!hasOfficialBlog) warnings.push('缺乏官方博客或文档');
    if (devActivityLevel === 'low') warnings.push('开发者活跃度较低');
    if (recentCommits === 'low') warnings.push('项目更新缓慢');

    return {
      probability: Math.round(totalProbability),
      confidence,
      reasons,
      warnings,
      score_breakdown: scores
    };
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const verifier = new OfficialVerifier();
  
  // 示例输入 - 这里可以修改为实际要验证的项目数据
  const exampleInput = {
    starCount: 113470, // 以OpenClaw为例
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
  };

  const result = verifier.verify(exampleInput);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = OfficialVerifier;