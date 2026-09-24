/**
 * Mock 模式开关
 * - 构建时：VITE_USE_MOCK=true 编译进产物
 * - 运行时：localStorage.campus_mock = '1' 可随时打开（无需重编译）
 * 仅用于无 Supabase 环境下的全流程演示/测试，生产环境必须关闭。
 */
export const USE_MOCK: boolean =
  import.meta.env.VITE_USE_MOCK === 'true' ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('campus_mock') === '1')

/** 打开 mock（演示/测试用） */
export function enableMock() {
  localStorage.setItem('campus_mock', '1')
  location.reload()
}

/** 关闭 mock */
export function disableMock() {
  localStorage.removeItem('campus_mock')
  location.reload()
}
