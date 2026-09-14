/**
 * 工作区根目录：插件的产物（轮次档案、导出文件等）默认落在这里。
 *
 * 定位顺序：
 *   1. GUGU_WORKSPACE 环境变量（显式指定，测试与多实例隔离用）
 *   2. 应用目录（开发态就是仓库根；打包后是 asar，不可写）
 *   3. 用户数据目录（兜底，保证插件永远有地方可写）
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

export function resolveWorkspaceRoot(): string {
  const fromEnv = process.env.GUGU_WORKSPACE
  if (fromEnv) return fromEnv

  const appPath = app.getAppPath()
  const isPacked = appPath.includes('app.asar')
  if (!isPacked && existsSync(join(appPath, 'package.json'))) return appPath

  return join(app.getPath('userData'), 'workspace')
}
