/**
 * 工作流协调器 - 具体工作流实现
 * 
 * 连接WorkflowOrchestrator和具体工作流实现
 */

import { WorkflowOrchestrator } from '../core/workflow-orchestrator.js';
import { ProjectInitWorkflow } from './project-init.js';
import { CodeGenerationWorkflow } from './code-generation.js';
import { TestingWorkflow } from './testing.js';
import { CodeReviewWorkflow } from './code-review.js';
import { PRCreationWorkflow } from './pr-creation.js';

export class WorkflowOrchestratorImpl extends WorkflowOrchestrator {
  constructor(config = {}) {
    super(config);
    
    // 注册具体工作流实现
    this.registerConcreteWorkflows();
  }

  /**
   * 注册具体工作流实现
   */
  registerConcreteWorkflows() {
    // 项目初始化工作流
    this.registerWorkflow('project-init', new ProjectInitWorkflow().getDefinition());
    
    // 代码生成工作流
    this.registerWorkflow('code-generation', new CodeGenerationWorkflow().getDefinition());
    
    // 测试工作流
    this.registerWorkflow('testing', new TestingWorkflow().getDefinition());
    
    // 代码审查工作流
    this.registerWorkflow('code-review', new CodeReviewWorkflow().getDefinition());
    
    // PR创建工作流
    this.registerWorkflow('pr-creation', new PRCreationWorkflow().getDefinition());
  }

  /**
   * 执行工作流（增强版）
   */
  async executeEnhanced(workflowId, params = {}) {
    const startTime = Date.now();
    
    try {
      // 1. 验证参数
      this.validateParams(workflowId, params);
      
      // 2. 准备执行环境
      const executionEnv = await this.prepareExecutionEnvironment(workflowId, params);
      
      // 3. 执行工作流
      const result = await super.execute(workflowId, {
        ...params,
        executionEnv
      });
      
      // 4. 记录执行指标
      await this.recordExecutionMetrics(workflowId, result, startTime);
      
      return result;
      
    } catch (error) {
      // 错误处理和恢复
      return await this.handleExecutionError(workflowId, error, params, startTime);
    }
  }

  /**
   * 验证参数
   */
  validateParams(workflowId, params) {
    const workflow = this.workflowRegistry.get(workflowId);
    if (!workflow) {
      throw new Error(`工作流未注册: ${workflowId}`);
    }
    
    // 调用工作流的验证函数
    if (workflow.validate && typeof workflow.validate === 'function') {
      const isValid = workflow.validate(params);
      if (!isValid) {
        throw new Error(`参数验证失败: ${workflowId}`);
      }
    }
  }

  /**
   * 准备执行环境
   */
  async prepareExecutionEnvironment(workflowId, params) {
    const env = {
      workflowId,
      startTime: Date.now(),
      tempResources: [],
      cleanupTasks: []
    };
    
    // 创建工作目录
    if (params.projectId) {
      env.workDir = await this.createWorkDirectory(params.projectId);
      env.cleanupTasks.push(() => this.cleanupWorkDirectory(env.workDir));
    }
    
    // 初始化token跟踪
    env.tokenTracker = {
      total: 0,
      byStep: {},
      startTime: Date.now()
    };
    
    return env;
  }

  /**
   * 创建工作目录
   */
  async createWorkDirectory(projectId) {
    // 这里应该创建实际的工作目录
    // 暂时返回模拟路径
    return `/tmp/project-code-builder/${projectId}_${Date.now()}`;
  }

  /**
   * 清理工作目录
   */
  async cleanupWorkDirectory(workDir) {
    // 这里应该清理工作目录
    console.log(`🧹 清理工作目录: ${workDir}`);
  }

  /**
   * 记录执行指标
   */
  async recordExecutionMetrics(workflowId, result, startTime) {
    const duration = Date.now() - startTime;
    
    const metrics = {
      workflowId,
      executionId: result.executionId,
      duration,
      success: result.success,
      timestamp: new Date().toISOString()
    };
    
    // 这里应该保存指标到数据库或文件
    console.log(`📊 执行指标:`, metrics);
    
    return metrics;
  }

  /**
   * 处理执行错误
   */
  async handleExecutionError(workflowId, error, params, startTime) {
    console.error(`❌ 工作流执行错误: ${workflowId}`, error);
    
    // 创建错误报告
    const errorReport = {
      workflowId,
      error: error.message,
      stack: error.stack,
      params: this.sanitizeParams(params),
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime
    };
    
    // 保存错误报告
    await this.saveErrorReport(errorReport);
    
    // 尝试恢复
    const recoveryResult = await this.attemptRecovery(workflowId, error, params);
    
    return {
      success: false,
      error: error.message,
      errorReport,
      recoveryAttempted: recoveryResult.attempted,
      recoverySuccess: recoveryResult.success
    };
  }

  /**
   * 清理参数（移除敏感信息）
   */
  sanitizeParams(params) {
    const sanitized = { ...params };
    
    // 移除可能的敏感信息
    const sensitiveKeys = ['token', 'password', 'secret', 'key', 'auth'];
    
    for (const key in sanitized) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '***REDACTED***';
      }
    }
    
    return sanitized;
  }

  /**
   * 保存错误报告
   */
  async saveErrorReport(errorReport) {
    // 这里应该保存到文件或数据库
    console.log(`📝 错误报告:`, errorReport);
  }

  /**
   * 尝试恢复
   */
  async attemptRecovery(workflowId, error, params) {
    // 简单的恢复策略：如果是超时错误，可以重试
    if (error.message.includes('超时')) {
      console.log(`🔄 尝试恢复: 检测到超时错误，准备重试`);
      
      try {
        // 等待一段时间后重试
        await this.sleep(5000);
        
        // 重试执行
        const retryResult = await this.execute(workflowId, params);
        
        return {
          attempted: true,
          success: retryResult.success,
          result: retryResult
        };
      } catch (retryError) {
        return {
          attempted: true,
          success: false,
          error: retryError.message
        };
      }
    }
    
    return {
      attempted: false,
      success: false
    };
  }

  /**
   * 睡眠函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 批量执行工作流
   */
  async executeBatch(workflows) {
    const results = [];
    
    for (const workflow of workflows) {
      try {
        const result = await this.executeEnhanced(workflow.id, workflow.params);
        results.push({
          workflow: workflow.id,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          workflow: workflow.id,
          success: false,
          error: error.message
        });
      }
      
      // 避免同时执行太多工作流
      if (this.executionState.activeWorkflows.size >= this.config.maxConcurrentWorkflows) {
        await this.sleep(1000);
      }
    }
    
    return results;
  }

  /**
   * 获取工作流统计
   */
  getWorkflowStatistics() {
    const stats = {
      totalWorkflows: this.workflowRegistry.size,
      totalExecutions: this.executionState.metrics.totalExecutions,
      successRate: this.executionState.metrics.successfulExecutions / 
                  this.executionState.metrics.totalExecutions * 100,
      averageDuration: this.executionState.metrics.averageDuration,
      activeWorkflows: this.executionState.activeWorkflows.size
    };
    
    // 按工作流类型统计
    stats.byWorkflow = {};
    
    for (const [workflowId, workflow] of this.workflowRegistry.entries()) {
      const completed = this.executionState.completedWorkflows.filter(
        exec => exec.workflowId === workflowId
      );
      
      const failed = this.executionState.failedWorkflows.filter(
        exec => exec.workflowId === workflowId
      );
      
      stats.byWorkflow[workflowId] = {
        name: workflow.name,
        completed: completed.length,
        failed: failed.length,
        total: completed.length + failed.length,
        successRate: completed.length / (completed.length + failed.length) * 100 || 0
      };
    }
    
    return stats;
  }

  /**
   * 导出执行历史
   */
  exportExecutionHistory(format = 'json') {
    const history = {
      completed: this.executionState.completedWorkflows.map(exec => ({
        id: exec.id,
        workflow: exec.workflowName,
        startTime: new Date(exec.metrics.startTime).toISOString(),
        duration: exec.metrics.duration,
        steps: exec.metrics.stepsCompleted,
        tokens: exec.metrics.tokensUsed || 0
      })),
      
      failed: this.executionState.failedWorkflows.map(exec => ({
        id: exec.id,
        workflow: exec.workflowName,
        startTime: new Date(exec.metrics.startTime).toISOString(),
        duration: exec.metrics.duration,
        error: exec.error?.message,
        stepsCompleted: exec.state.completedSteps.length
      })),
      
      metrics: this.executionState.metrics
    };
    
    if (format === 'csv') {
      // 转换为CSV格式
      return this.convertToCSV(history);
    }
    
    return history;
  }

  /**
   * 转换为CSV格式
   */
  convertToCSV(history) {
    // 简单的CSV转换
    const rows = [];
    
    // 表头
    rows.push('id,workflow,start_time,duration_ms,steps,tokens,status');
    
    // 完成的工作流
    for (const exec of history.completed) {
      rows.push(`${exec.id},${exec.workflow},${exec.startTime},${exec.duration},${exec.steps},${exec.tokens},completed`);
    }
    
    // 失败的工作流
    for (const exec of history.failed) {
      rows.push(`${exec.id},${exec.workflow},${exec.startTime},${exec.duration},${exec.stepsCompleted},0,failed`);
    }
    
    return rows.join('\n');
  }
}