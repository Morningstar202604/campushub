// utils/request.js — 云函数调用封装

/**
 * 调用云函数（Promise 封装）
 * @param {string} name 云函数名
 * @param {object} data 参数
 * @returns {Promise<object>}
 */
function callFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success(res) {
        resolve(res.result)
      },
      fail(err) {
        console.error(`[云函数:${name}] 调用失败`, err)
        reject(err)
      }
    })
  })
}

/**
 * 上传图片到云存储
 * @param {string} filePath 本地文件路径
 * @param {string} folder 存储文件夹
 * @returns {Promise<string>} fileID
 */
// 从临时路径推断真实扩展名，避免一律存成 .jpg 导致 png/webp 等扩展名错位
function getImageExt(filePath) {
  const m = String(filePath || '').match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/)
  const ext = m ? m[1].toLowerCase() : 'jpg'
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif'].includes(ext) ? ext : 'jpg'
}

function uploadImage(filePath, folder = 'posts') {
  const ext = getImageExt(filePath)
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 8)
  const cloudPath = `${folder}/${timestamp}_${random}.${ext}`
  
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success(res) {
        resolve(res.fileID)
      },
      fail(err) {
        console.error('[上传图片] 失败', err)
        reject(new Error('图片上传失败，请重试'))
      }
    })
  })
}

/**
 * 批量上传图片
 * @param {string[]} filePaths 本地文件路径数组
 * @param {string} folder 存储文件夹
 * @returns {Promise<string[]>} fileID 数组
 */
async function uploadImages(filePaths, folder = 'posts') {
  const tasks = filePaths.map(path => uploadImage(path, folder))
  return Promise.all(tasks)
}

/**
 * 批量删除云存储文件
 * @param {string[]} fileIDs
 */
function deleteFiles(fileIDs) {
  return new Promise((resolve, reject) => {
    wx.cloud.deleteFile({
      fileList: fileIDs,
      success(res) {
        resolve(res)
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

module.exports = {
  callFunction,
  uploadImage,
  uploadImages,
  deleteFiles
}
