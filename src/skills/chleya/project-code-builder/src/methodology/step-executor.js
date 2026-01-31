/**
 * 分步骤执行器 - 实现"分分任务，分分步骤来，小块小块执行"的方法
 * 
 * 核心功能：
 * 1. 任务分解和管理
 * 2. 步骤执行和控制
 * 3. 进度跟踪和报告
 * 4. 资源优化和监控
 */

export class StepExecutor {
  constructor(config = {}) {
    this.config = {
      maxStepTime: config.maxStepTime || 1800000, // 30分钟
      maxSubtasks: config.maxSubtasks || 5,
      tokenLimit: config.tokenLimit || 10000,
      enableProgressTracking: config.enableProgressTracking !== false,
      autoSaveState: config.autoSaveState !== false,
      ...config
    };

    // 任务状态
    this.state = {
      currentTask: null,
      currentStep: null,
      completedSteps: [],
      pendingSteps: [],
      stepHistory: [],
      resources: {
        tokensUsed: 0,
        startTime: Date.now(),
        memoryPeak: 0
      }
    };

    // 步骤注册表
    this.stepRegistry = new Map();
    
    // 进度监听器
    this.progressListeners = [];
  }

  /**
   * 注册步骤
   * @param {string} stepId - 步骤ID
   * @param {Object} stepDef - 步骤定义
   */
  registerStep(stepId, stepDef) {
    const step = {
      id: stepId,
      name: stepDef.name || stepId,
      description: stepDef.description || '',
      estimatedTime: stepDef.estimatedTime || 600000, // 10分钟
      tokenEstimate: stepDef.tokenEstimate || { input: 5000, output: 2000 },
      dependencies: stepDef.dependencies || [],
      subtasks: stepDef.subtasks || [],
      acceptanceCriteria: stepDef.acceptanceCriteria || [],
      execute: stepDef.execute,
      validate: stepDef.validate || (() => true),
      onStart: stepDef.onStart,
      onComplete: stepDef.onComplete,
      onError: stepDef.onError
    };

    this.stepRegistry.set(stepId, step);
    console.log(`📋 注册步骤: ${stepId} (${step.name})`);
  }

  /**
   * 定义任务
   * @param {string} taskId - 任务ID
   * @param {Array} steps - 步骤数组
   */
  defineTask(taskId, steps) {
    const task = {
      id: taskId,
      steps: steps.map(stepId => {
        const step = this.stepRegistry.get(stepId);
        if (!step) {
          throw new Error(`步骤未注册: ${stepId}`);
        }
        return step;
      }),
      createdAt: new Date().toISOString(),
      status: 'defined'
    };

    this.state.currentTask = task;
    this.state.pendingSteps = [...task.steps];
    
    console.log(`📝 定义任务: ${taskId} (${steps.length}个步骤)`);
    
    return task;
  }

  /**
   * 执行任务
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 执行结果
   */
  async executeTask(taskId) {
    if (!this.state.currentTask || this.state.currentTask.id !== taskId) {
      throw new Error(`任务未定义: ${taskId}`);
    }

    const task = this.state.currentTask;
    task.status = 'executing';
    task.startTime = Date.now();

    console.log(`🚀 开始执行任务: ${taskId}`);
    this.notifyProgress('task-start', { taskId });

    const results = [];
    
    try {
      // 按顺序执行每个步骤
      for (const step of task.steps) {
        const stepResult = await this.executeStep(step);
        results.push(stepResult);
        
        // 检查是否应该继续
        if (!stepResult.success && !stepResult.canContinue) {
          task.status = 'failed';
          task.endTime = Date.now();
          
          this.notifyProgress('task-failed', { 
            taskId, 
            step: step.id,
            error: stepResult.error
          });
          
          return {
            success: false,
            taskId,
            completedSteps: results.filter(r => r.success).length,
            totalSteps: task.steps.length,
            results,
            error: stepResult.error
          };
        }
      }

      // 所有步骤完成
      task.status = 'completed';
      task.endTime = Date.now();
      
      console.log(`✅ 任务完成: ${taskId}`);
      this.notifyProgress('task-completed', { 
        taskId, 
        duration: task.endTime - task.startTime,
        stepsCompleted: results.length
      });
      
      return {
        success: true,
        taskId,
        completedSteps: results.length,
        totalSteps: task.steps.length,
        results,
        duration: task.endTime - task.startTime,
        tokensUsed: this.state.resources.tokensUsed
      };
      
    } catch (error) {
      task.status = 'error';
      task.endTime = Date.now();
      task.error = error.message;
      
      console.error(`❌ 任务执行错误: ${taskId}`, error);
      this.notifyProgress('task-error', { taskId, error: error.message });
      
      return {
        success: false,
        taskId,
        completedSteps: results.length,
        totalSteps: task.steps.length,
        results,
        error: error.message
      };
    }
  }

  /**
   * 执行单个步骤
   * @param {Object} step - 步骤定义
   * @returns {Promise<Object>} 步骤结果
   */
  async executeStep(step) {
    this.state.currentStep = step;
    const stepStartTime = Date.now();
    
    console.log(`  ↳ 执行步骤: ${step.name} (${step.id})`);
    this.notifyProgress('step-start', { step: step.id });
    
    // 检查依赖
    const missingDeps = await this.checkDependencies(step);
    if (missingDeps.length > 0) {
      return {
        success: false,
        step: step.id,
        error: `缺少依赖: ${missingDeps.join(', ')}`,
        canContinue: false
      };
    }
    
    // 验证步骤
    if (step.validate && !step.validate()) {
      return {
        success: false,
        step: step.id,
        error: '步骤验证失败',
        canContinue: false
      };
    }
    
    // 开始回调
    if (step.onStart) {
      step.onStart();
    }
    
    try {
      // 执行步骤
      const result = await this.executeWithTimeout(
        step.execute,
        step.estimatedTime,
        step.name
      );
      
      // 完成回调
      if (step.onComplete) {
        step.onComplete(result);
      }
      
      // 记录步骤完成
      const stepResult = {
        success: true,
        step: step.id,
        result,
        duration: Date.now() - stepStartTime,
        timestamp: new Date().toISOString()
      };
      
      this.state.completedSteps.push(stepResult);
      this.state.stepHistory.push({
        ...stepResult,
        tokensUsed: this.estimateTokenUsage(step)
      });
      
      // 更新资源使用
      this.state.resources.tokensUsed += this.estimateTokenUsage(step);
      
      console.log(`    ✅ 步骤完成: ${step.name} (${stepResult.duration}ms)`);
      this.notifyProgress('step-completed', stepResult);
      
      return stepResult;
      
    } catch (error) {
      // 错误回调
      if (step.onError) {
        step.onError(error);
      }
      
      const stepResult = {
        success: false,
        step: step.id,
        error: error.message,
        duration: Date.now() - stepStartTime,
        timestamp: new Date().toISOString(),
        canContinue: this.canContinueAfterError(error, step)
      };
      
      console.error(`    ❌ 步骤失败: ${step.name} - ${error.message}`);
      this.notifyProgress('step-failed', stepResult);
      
      return stepResult;
    } finally {
      this.state.currentStep = null;
    }
  }

  /**
   * 带超时的执行
   */
  async executeWithTimeout(executeFn, timeout, stepName) {
    return Promise.race([
      executeFn(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`步骤执行超时: ${stepName} (${timeout}ms)`));
        }, timeout);
      })
    ]);
  }

  /**
   * 检查依赖
   */
  async checkDependencies(step) {
    const missing = [];
    
    for (const dep of step.dependencies) {
      // 检查步骤依赖是否已完成
      const depCompleted = this.state.completedSteps.some(
        s => s.step === dep && s.success
      );
      
      if (!depCompleted) {
        missing.push(dep);
      }
    }
    
    return missing;
  }

  /**
   * 错误后是否可以继续
   */
  canContinueAfterError(error, step) {
    // 某些错误类型允许继续
    const continueErrors = [
      'timeout',
      '资源不足',
      '网络错误'
    ];
    
    return continueErrors.some(pattern => 
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * 估算token使用
   */
  estimateTokenUsage(step) {
    if (step.tokenEstimate && typeof step.tokenEstimate === 'object') {
      return step.tokenEstimate.input + step.tokenEstimate.output;
    }
    return 7000; // 默认估计
  }

  /**
   * 分解大任务
   * @param {Object} bigTask - 大任务
   * @returns {Array} 分解后的小任务
   */
  decomposeTask(bigTask, maxSubtasks = null) {
    const limit = maxSubtasks || this.config.maxSubtasks;
    
    if (!bigTask.steps || bigTask.steps.length <= limit) {
      return [bigTask]; // 不需要分解
    }
    
    const subtasks = [];
    const stepGroups = this.chunkArray(bigTask.steps, limit);
    
    stepGroups.forEach((steps, index) => {
      const subtask = {
        id: `${bigTask.id}_part${index + 1}`,
        name: `${bigTask.name} - 部分${index + 1}`,
        steps: steps,
        parentTask: bigTask.id,
        order: index
      };
      
      subtasks.push(subtask);
    });
    
    console.log(`🔀 任务分解: ${bigTask.id} → ${subtasks.length}个子任务`);
    
    return subtasks;
  }

  /**
   * 数组分块
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 添加进度监听器
   */
  addProgressListener(listener) {
    this.progressListeners.push(listener);
  }

  /**
   * 通知进度更新
   */
  notifyProgress(event, data) {
    if (!this.config.enableProgressTracking) return;
    
    const progress = {
      event,
      timestamp: Date.now(),
      taskId: this.state.currentTask?.id,
      currentStep: this.state.currentStep?.id,
      ...data
    };
    
    this.progressListeners.forEach(listener => {
      try {
        listener(progress);
      } catch (error) {
        console.error('进度监听器错误:', error);
      }
    });
    
    // 自动保存状态
    if (this.config.autoSaveState) {
      this.saveState();
    }
  }

  /**
   * 保存状态
   */
  saveState() {
    const state = {
      task: this.state.currentTask,
      completedSteps: this.state.completedSteps,
      resources: this.state.resources,
      timestamp: new Date().toISOString()
    };
    
    // 这里应该保存到文件或数据库
    console.log('💾 保存执行状态');
    
    return state;
  }

  /**
   * 加载状态
   */
  loadState(state) {
    this.state = {
      ...this.state,
      ...state,
      currentStep: null // 重置当前步骤
    };
    
    console.log('📂 加载执行状态');
  }

  /**
   * 获取进度报告
   */
  getProgressReport() {
    const task = this.state.currentTask;
    if (!task) {
      return { status: 'no-active-task' };
    }
    
    const completed = this.state.completedSteps.length;
    const total = task.steps.length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    
    return {
      taskId: task.id,
      status: task.status,
      progress: Math.round(progress),
      completedSteps: completed,
      totalSteps: total,
      currentStep: this.state.currentStep?.name || '无',
      resources: this.state.resources,
      duration: task.startTime ? Date.now() - task.startTime : 0,
      estimatedRemaining: this.estimateRemainingTime(progress)
    };
  }

  /**
   * 估算剩余时间
   */
  estimateRemainingTime(progress) {
    if (progress >= 100 || !this.state.currentTask?.startTime) {
      return 0;
    }
    
    const elapsed = Date.now() - this.state.currentTask.startTime;
    const estimatedTotal = elapsed / (progress / 100);
    return Math.max(0, estimatedTotal - elapsed);
  }

  /**
   * 获取步骤历史
   */
  getStepHistory(limit = 20) {
    return this.state.stepHistory.slice(-limit).map(step => ({
      step: step.step,
      success: step.success,
      duration: step.duration,
      timestamp: step.timestamp,
      error: step.error
    }));
  }

  /**
   * 重置执行器
   */
  reset() {
    this.state = {
      currentTask: null,
      currentStep: null,
      completedSteps: [],
      pendingSteps: [],
      stepHistory: [],
      resources: {
        tokensUsed: 0,
        startTime: Date.now(),
        memoryPeak: 0
      }
    };
    
    console.log('🔄 执行器已重置');
    
    return { success: true };
  }
}