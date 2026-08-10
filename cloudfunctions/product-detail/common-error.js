// common-error.js — 统一错误模型与响应格式
// 业务异常用 AppError 抛出，wrap() 统一拦截，杜绝各处随意吞异常的陋习。

class AppError extends Error {
  constructor(message, code = 'BUSINESS_ERROR', status = 400) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
  }
}

function ok(data = {}, extra = {}) {
  return { success: true, ...data, ...extra }
}

function fail(message = '操作失败', code = 'ERROR', extra = {}) {
  return { success: false, message, code, ...extra }
}

// 包裹 handler：所有云函数入口统一走这里，异常自动收敛为 { success:false }
function wrap(handler) {
  return async (event, context) => {
    try {
      return await handler(event, context)
    } catch (err) {
      if (err instanceof AppError) {
        return fail(err.message, err.code)
      }
      // 未知异常：记录详情，对用户只暴露通用文案，避免泄漏内部信息
      console.error('[云函数] 未捕获异常:', err && (err.stack || err.message || err))
      return fail('服务异常，请稍后再试', 'INTERNAL_ERROR')
    }
  }
}

module.exports = { AppError, ok, fail, wrap }
