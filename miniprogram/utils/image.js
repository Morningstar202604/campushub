// miniprogram/utils/image.js
// 上传前图片压缩（降本 C1）：长边压到 1280px、质量 80，
// 仅当文件 > 300KB 或长边超限时才压缩；GIF 跳过（保动画）；任何一步失败都回退原图。
const MAX_EDGE = 1280
const MIN_COMPRESS_SIZE = 300 * 1024
const QUALITY = 80

function getFileSize(filePath) {
  return new Promise((resolve) => {
    try {
      wx.getFileSystemManager().getFileInfo({
        filePath,
        success: (info) => resolve(info.size || 0),
        fail: () => resolve(0)
      })
    } catch (e) {
      resolve(0)
    }
  })
}

function getImageDimensions(filePath) {
  return new Promise((resolve) => {
    wx.getImageInfo({
      src: filePath,
      success: (r) => resolve({ width: r.width || 0, height: r.height || 0 }),
      fail: () => resolve(null)
    })
  })
}

function compress(src, options) {
  return new Promise((resolve) => {
    wx.compressImage({
      src,
      quality: options.quality,
      ...options.edge,
      success: (res) => resolve(res.tempFilePath || src),
      fail: () => resolve(src)
    })
  })
}

/**
 * 需要时压缩本地图片，返回可用于上传的文件路径（失败回退原图）
 * @param {string} filePath 本地临时文件路径
 * @returns {Promise<string>}
 */
async function compressForUpload(filePath) {
  if (!filePath) return filePath
  // gif 压缩会丢动画帧，直接跳过
  if (/\.gif($|\?)/i.test(filePath)) return filePath

  const size = await getFileSize(filePath)
  const dim = await getImageDimensions(filePath)
  const longEdge = dim ? Math.max(dim.width, dim.height) : 0

  // 小图不压：体积和尺寸都在阈值内则原样返回
  if ((!size || size < MIN_COMPRESS_SIZE) && longEdge <= MAX_EDGE) return filePath

  let edge = {}
  if (dim && longEdge > 0) {
    // 只传一个目标边，等比缩放；不放大（clamp 到原尺寸）
    if (dim.width >= dim.height) {
      edge.compressedWidth = Math.min(MAX_EDGE, dim.width)
    } else {
      edge.compressedHeight = Math.min(MAX_EDGE, dim.height)
    }
  }
  return compress(filePath, { quality: QUALITY, edge })
}

module.exports = {
  compressForUpload,
  MAX_EDGE,
  MIN_COMPRESS_SIZE
}
