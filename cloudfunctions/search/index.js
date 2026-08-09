// cloudfunctions/search/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const db = cloud.database()
  const { keyword, schoolId = 'HSFNC', page = 1, pageSize = 20 } = event
  
  if (!keyword || !keyword.trim()) {
    return { success: true, posts: [], products: [], guides: [] }
  }
  
  const reg = db.Regexp({ regexp: keyword.trim(), options: 'i' })
  
  try {
    // 并行搜索三个集合
    const [postsRes, productsRes, guidesRes] = await Promise.all([
      db.collection('posts')
        .where({ schoolId, status: 'normal', title: reg })
        .orderBy('createdAt', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get(),
      db.collection('products')
        .where({ schoolId, status: 'on_sale', title: reg })
        .orderBy('createdAt', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get(),
      db.collection('guides')
        .where({ schoolId, status: 'published', title: reg })
        .orderBy('createdAt', 'desc')
        .limit(pageSize)
        .get()
    ])
    
    return {
      success: true,
      posts: postsRes.data,
      products: productsRes.data,
      guides: guidesRes.data
    }
  } catch (err) {
    console.error('[search] error:', err)
    return { success: false, posts: [], products: [], guides: [] }
  }
}
