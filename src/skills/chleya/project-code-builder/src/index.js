/**
 * 项目代码编制 Skill - 主入口文件
 * 
 * 实现从idea到PR的全流程自动化代码编制
 * 优化方向：低token消耗 + 高质量输出
 */

import { ProjectBuilder } from './core/project-builder.js';
import { TokenOptimizer } from './utils/token-optimizer.js';
import { SessionManager } from './core/session-manager.js';
import { WorkflowOrchestrator } from './workflows/orchestrator.js';

export class ProjectCodeBuilder {
  /**
   * 初始化项目代码编制器
   * @param {Object} config - 配置对象
   */
  constructor(config = {}) {
    this.config = {
      model: config.model || 'deepseek/deepseek-coder-v2',
      thinking: config.thinking || 'minimal',
      autoCompact: config.autoCompact !== false,
      maxTokensPerStep: config.maxTokensPerStep || 5000,
      enableMemory: config.enableMemory !== false,
      ...config
    };

    // 初始化核心组件
    this.projectBuilder = new ProjectBuilder(this.config);
    this.tokenOptimizer = new TokenOptimizer(this.config);
    this.sessionManager = new SessionManager(this.config);
    this.workflowOrchestrator = new WorkflowOrchestrator(this.config);

    // 状态跟踪
    this.state = {
      currentProject: null,
      currentSession: null,
      tokenUsage: {
        total: 0,
        steps: [],
        lastReset: Date.now()
      },
      workflowProgress: {
        stage: 'idle',
        completedSteps: 0,
        totalSteps: 0
      }
    };
  }

  /**
   * 执行完整的工作流
   * @param {string} workflowType - 工作流类型
   * @param {Object} params - 工作流参数
   * @returns {Promise<Object>} 执行结果
   */
  async executeWorkflow(workflowType, params = {}) {
    console.log(`🚀 开始执行工作流: ${workflowType}`);
    
    try {
      // 1. 创建工作流session
      const sessionId = await this.sessionManager.createSession(workflowType, params);
      this.state.currentSession = sessionId;
      
      // 2. 执行工作流
      const result = await this.workflowOrchestrator.execute(workflowType, {
        ...params,
        sessionId,
        tokenOptimizer: this.tokenOptimizer
      });
      
      // 3. 更新状态
      this.state.workflowProgress = {
        stage: 'completed',
        completedSteps: result.stepsCompleted,
        totalSteps: result.totalSteps
      };
      
      // 4. 记录token使用
      this.state.tokenUsage.total += result.tokenUsage;
      this.state.tokenUsage.steps.push({
        workflow: workflowType,
        tokens: result.tokenUsage,
        timestamp: Date.now()
      });
      
      console.log(`✅ 工作流完成: ${workflowType}`);
      console.log(`📊 Token使用: ${result.tokenUsage}`);
      console.log(`⏱️  耗时: ${result.duration}ms`);
      
      return {
        success: true,
        sessionId,
        result,
        tokenUsage: result.tokenUsage,
        duration: result.duration
      };
      
    } catch (error) {
      console.error(`❌ 工作流执行失败: ${error.message}`);
      
      // 错误恢复：尝试保存当前状态
      await this.sessionManager.saveRecoveryPoint(this.state.currentSession);
      
      return {
        success: false,
        error: error.message,
        recoveryPoint: this.state.currentSession
      };
    }
  }

  /**
   * 初始化新项目
   * @param {Object} projectSpec - 项目规格
   * @returns {Promise<Object>} 初始化结果
   */
  async initProject(projectSpec) {
    const workflowParams = {
      action: 'init',
      projectName: projectSpec.name,
      description: projectSpec.description,
      language: projectSpec.language || 'python',
      template: projectSpec.template || 'basic'
    };
    
    return await this.executeWorkflow('project-init', workflowParams);
  }

  /**
   * 规划项目结构
   * @param {Object} requirements - 项目需求
   * @returns {Promise<Object>} 规划结果
   */
  async planProject(requirements) {
    const workflowParams = {
      action: 'plan',
      requirements,
      outputFormat: 'json', // 优化：只输出JSON减少token
      includeExplanations: false // 优化：不包含解释
    };
    
    return await this.executeWorkflow('project-planning', workflowParams);
  }

  /**
   * 生成代码模块
   * @param {string} moduleName - 模块名称
   * @param {Object} spec - 模块规格
   * @returns {Promise<Object>} 生成结果
   */
  async generateModule(moduleName, spec) {
    const workflowParams = {
      action: 'generate',
      moduleName,
      spec,
      maxIterations: 3, // 优化：限制迭代次数
      outputStyle: 'code-only' // 优化：只输出代码
    };
    
    return await this.executeWorkflow('code-generation', workflowParams);
  }

  /**
   * 运行测试
   * @param {Object} testConfig - 测试配置
   * @returns {Promise<Object>} 测试结果
   */
  async runTests(testConfig) {
    const workflowParams = {
      action: 'test',
      ...testConfig,
      outputSummary: true, // 优化：只输出摘要
      isolateSession: true // 优化：隔离session
    };
    
    return await this.executeWorkflow('testing', workflowParams);
  }

  /**
   * 代码审查
   * @param {Object} reviewConfig - 审查配置
   * @returns {Promise<Object>} 审查结果
   */
  async reviewCode(reviewConfig) {
    const workflowParams = {
      action: 'review',
      ...reviewConfig,
      outputFormat: 'bullet-points', // 优化：简洁输出
      useCache: true // 优化：使用缓存减少diff
    };
    
    return await this.executeWorkflow('code-review', workflowParams);
  }

  /**
   * 创建Pull Request
   * @param {Object} prConfig - PR配置
   * @returns {Promise<Object>} PR创建结果
   */
  async createPullRequest(prConfig) {
    const workflowParams = {
      action: 'create-pr',
      ...prConfig,
      autoGenerateChangelog: true,
      conciseDescription: true
    };
    
    return await this.executeWorkflow('pr-creation', workflowParams);
  }

  /**
   * 获取状态信息
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      state: this.state,
      config: this.config,
      tokenUsage: this.state.tokenUsage,
      workflowProgress: this.state.workflowProgress,
      currentSession: this.state.currentSession
    };
  }

  /**
   * 压缩上下文以节省token
   * @param {string} mode - 压缩模式
   * @returns {Promise<Object>} 压缩结果
   */
  async compactContext(mode = 'normal') {
    const result = await this.tokenOptimizer.compact(mode);
    
    // 更新token使用记录
    this.state.tokenUsage.lastReset = Date.now();
    
    return result;
  }

  /**
   * 重置当前状态
   * @param {boolean} keepMemory - 是否保留记忆
   * @returns {Promise<Object>} 重置结果
   */
  async reset(keepMemory = false) {
    if (!keepMemory) {
      this.state = {
        currentProject: null,
        currentSession: null,
        tokenUsage: {
          total: 0,
          steps: [],
          lastReset: Date.now()
        },
        workflowProgress: {
          stage: 'idle',
          completedSteps: 0,
          totalSteps: 0
        }
      };
    }
    
    await this.sessionManager.cleanup();
    
    return {
      success: true,
      message: '状态已重置',
      memoryKept: keepMemory
    };
  }
}

// 导出工具函数
export { TokenOptimizer } from './utils/token-optimizer.js';
export { SessionManager } from './core/session-manager.js';
export { WorkflowOrchestrator } from './workflows/orchestrator.js';

// 默认导出
export default ProjectCodeBuilder;