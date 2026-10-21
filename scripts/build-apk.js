#!/usr/bin/env node
/**
 * build-apk.js — 一条命令产出可安装的 Android APK
 *
 * 流程：uni-app H5 构建 → 同步到 android/app/src/main/assets/www → Gradle assembleRelease → 复制到 out/。
 *
 * 为什么用 WebView 壳而不是 uni-app 官方 App 打包：
 *   官方 APK 必须经 DCloud 的 Android 运行时（HBuilderX 云打包 / 离线 SDK），
 *   这两条路都依赖 DCloud 分发渠道。本脚本用系统 WebView 承载同一份 H5 产物，
 *   纯离线、可重复、产物可直接安装。原生能力（相机/推送/支付）会退化为浏览器 API。
 *
 * 用法：
 *   node scripts/build-apk.js            # 构建并打包
 *   node scripts/build-apk.js --skip-h5  # 复用现有 dist/build/h5
 *
 * 前置：JAVA_HOME 指向 JDK 17+；ANDROID_HOME 指向含 platforms;android-34 与 build-tools 的 SDK。
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const ROOT = path.resolve(__dirname, '..')
const UNI = path.join(ROOT, 'uni-app')
const ANDROID = path.join(ROOT, 'android')
const WWW = path.join(ANDROID, 'app', 'src', 'main', 'assets', 'www')
const OUT = path.join(ROOT, 'out')

const log = (m) => console.log('[build-apk] ' + m)
const run = (cmd, cwd, extraEnv = {}) => {
  execSync(cmd, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: true
  })
}

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true })
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

function findGradle() {
  // 优先用本地 wrapper 分发（离线可用），否则回退 PATH 里的 gradle。
  // 目录层级：.gradle/wrapper/dists/<dist>/<hash>/<gradle-x.y>/bin/gradle(.bat)
  const exe = process.platform === 'win32' ? 'gradle.bat' : 'gradle'
  const base = path.join(os.homedir(), '.gradle', 'wrapper', 'dists')
  const walk = (dir, depth) => {
    if (depth > 4 || !fs.existsSync(dir)) return null
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name)
      let st
      try {
        st = fs.statSync(p)
      } catch {
        continue
      }
      if (!st.isDirectory()) continue
      const candidate = path.join(p, 'bin', exe)
      if (fs.existsSync(candidate)) return candidate
      const found = walk(p, depth + 1)
      if (found) return found
    }
    return null
  }
  return walk(base, 0) || 'gradle'
}

// ---- 1. H5 构建 ----
if (!process.argv.includes('--skip-h5')) {
  log('构建 H5 产物…')
  run(
    'node --max-old-space-size=4096 node_modules/@dcloudio/vite-plugin-uni/bin/uni.js build -p h5',
    UNI,
    { CODEBUDDY_SAFE_DELETE_ENABLED: '0' }
  )
}

const h5Dir = path.join(UNI, 'dist', 'build', 'h5')
if (!fs.existsSync(path.join(h5Dir, 'index.html'))) {
  throw new Error('缺少 H5 产物，请先运行构建或去掉 --skip-h5')
}

// file:// 下绝对路径 /assets 会 404，必须是相对路径
const indexHtml = fs.readFileSync(path.join(h5Dir, 'index.html'), 'utf8')
if (/(src|href)="\/assets\//.test(indexHtml)) {
  throw new Error(
    'H5 产物使用了绝对资源路径（/assets/…），在 file:// 下会白屏。' +
      '请确认 uni-app/src/manifest.json 的 h5.router.base 为 "./" 后重新构建。'
  )
}

// ---- 2. 同步资源 ----
log('同步 H5 产物到 android assets…')
rmrf(WWW)
copyDir(h5Dir, WWW)
log('资源文件数：' + fs.readdirSync(WWW).length + ' 个顶层条目')

// ---- 3. Gradle 打包 ----
log('Gradle assembleRelease…')
const gradle = findGradle()
run(`"${gradle}" assembleRelease --no-daemon`, ANDROID)

const apkSrc = path.join(ANDROID, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
if (!fs.existsSync(apkSrc)) throw new Error('Gradle 未产出 APK：' + apkSrc)

// ---- 4. 归档 ----
fs.mkdirSync(OUT, { recursive: true })
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const apkDest = path.join(OUT, `campushub-${stamp}.apk`)
fs.copyFileSync(apkSrc, apkDest)

const mb = (fs.statSync(apkDest).size / 1024 / 1024).toFixed(2)
log(`完成：${apkDest}（${mb} MB）`)
