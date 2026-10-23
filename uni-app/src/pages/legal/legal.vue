<template>
  <view class="lg-page">
    <view class="lg-head">
      <text class="lg-kicker">{{ doc.kicker }}</text>
      <text class="lg-title">{{ doc.title }}</text>
      <text class="lg-meta tabular-nums">更新日期：{{ doc.updated }}</text>
    </view>

    <view class="lg-body">
      <view v-for="(sec, i) in doc.sections" :key="i" class="lg-section">
        <text class="lg-h">{{ sec.h }}</text>
        <text v-for="(p, j) in sec.p" :key="j" class="lg-p">{{ p }}</text>
      </view>
    </view>

    <view class="lg-foot">
      <text class="lg-foot-text">{{ doc.footer }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import schoolConfig from '@/config/school.config.js'

type LegalType = 'agreement' | 'privacy'

const type = ref<LegalType>('agreement')

/**
 * 运营方信息一律读 school.config.js 的 operator 段，不在正文里硬编码。
 * 未配置时正文显示「未配置（部署方需填写）」而不是假装已有主体 ——
 * 占位文案冒充真实主体会让协议在审核时被判定为虚假信息。
 */
const operatorName = (schoolConfig as any).operator?.name || '未配置（部署方需在 school.config.js 填写）'
const operatorContact =
  (schoolConfig as any).operator?.contact || '未配置（部署方需在 school.config.js 填写）'
const operatorRegion = (schoolConfig as any).operator?.region || '中国境内'

/**
 * 协议正文。
 *
 * 为什么写在这里而不是服务端：小程序审核要求「用户协议 / 隐私政策」在首次使用前可见可查，
 * 且不能依赖网络（审核员可能断网查看）。静态文本最可靠。
 */
const DOCS: Record<LegalType, any> = {
  agreement: {
    kicker: 'USER AGREEMENT',
    title: '用户协议',
    updated: '2026-10-22',
    footer: `如对本协议有疑问，可通过「设置 → 意见反馈」联系我们；运营方联系方式：${operatorContact}`,
    sections: [
      {
        h: '一、协议范围',
        p: [
          `本协议是你与 ${operatorName}（以下简称"运营方"）之间关于使用本服务所订立的协议。`,
          '你注册、登录或使用本服务，即视为已阅读并同意本协议全部内容。若不同意，请停止使用。'
        ]
      },
      {
        h: '二、账号与身份',
        p: [
          '本服务通过微信授权获取你的唯一标识（openid）用于识别账号，不获取你的微信密码。',
          '你应保证注册信息真实、准确。校园认证需提交学生证或校园卡照片，仅用于人工审核，审核通过后照片不会被公开展示。',
          '账号仅限本人使用，不得出借、转让或出售。'
        ]
      },
      {
        h: '三、内容规范',
        p: [
          '你发布的内容（帖子、评论、商品信息、图片）须遵守法律法规，不得包含违法、色情、暴力、诈骗、侵犯他人隐私或知识产权的内容。',
          '所有内容在发布前会经过微信内容安全接口检测；检测不通过将被拒绝发布。',
          '你对自己发布的内容负责。平台有权对违规内容进行删除、隐藏，并对违规账号采取限制措施。'
        ]
      },
      {
        h: '四、二手交易',
        p: [
          '平台仅提供信息发布与联系渠道，不参与交易、不担保商品质量、不承担交易纠纷责任。',
          '请在线下交易时注意人身与财产安全，优先选择校内公共场所当面验货。',
          '禁止发布违禁品、假冒商品、涉及人身安全的危险物品。'
        ]
      },
      {
        h: '五、内容授权',
        p: [
          '你发布的内容著作权归你所有。你授予平台在本服务范围内展示、存储、分发的非独占许可。',
          '你删除内容后，平台将停止展示，但因备份、缓存导致的技术性延迟除外。'
        ]
      },
      {
        h: '六、服务变更与终止',
        p: [
          '平台可能因运营需要调整功能或终止服务，重大变更会提前在应用内公告。',
          '你若违反本协议，平台可限制或终止你的账号使用。'
        ]
      },
      {
        h: '七、免责与责任限制',
        p: [
          '因不可抗力、网络故障、第三方服务（如微信云开发）异常导致的服务中断，平台不承担责任，但会尽力恢复。',
          '平台对用户之间自行发生的交易、纠纷不承担直接责任。'
        ]
      },
      {
        h: '八、协议更新',
        p: ['本协议更新后会在应用内公告。继续使用即视为接受更新后的协议。']
      }
    ]
  },
  privacy: {
    kicker: 'PRIVACY POLICY',
    title: '隐私政策',
    updated: '2026-10-22',
    footer: `如需查询、更正或删除你的个人信息，请通过「设置 → 意见反馈」联系我们；运营方联系方式：${operatorContact}`,
    sections: [
      {
        h: '一、我们收集哪些信息',
        p: [
          '账号信息：微信 openid（用于识别账号）、昵称、头像。openid 仅存储在服务端，不会下发给客户端。',
          '资料信息：你主动填写的学校、学院、专业、年级、简介、标签、性别。均为选填。',
          '认证信息：校园认证时提交的学校、学号、证件照片。仅管理员在审核时可见，审核通过后不公开展示。',
          '内容信息：你发布的帖子、评论、图片、商品信息。',
          '使用信息：浏览计数（按天去重）、签到记录、积分流水。'
        ]
      },
      {
        h: '二、我们如何使用这些信息',
        p: [
          '提供核心功能：展示内容、识别作者、支持评论点赞关注、积分与签到。',
          '内容安全：发布前通过微信内容安全接口检测文本与图片，防范违规内容。',
          '校园认证：人工核验学生身份，认证后内容展示「已认证」标识。',
          '我们不将你的信息用于广告推送、用户画像或出售给第三方。'
        ]
      },
      {
        h: '三、信息存储与保护',
        p: [
          '数据存储于腾讯云开发（CloudBase）位于中国境内的服务器。',
          `数据存储地域：${operatorRegion}。`,
          '传输全程使用 HTTPS；客户端不持有 openid，身份由服务端从微信上下文获取，无法伪造。',
          '数据库访问受云函数鉴权保护，客户端无法直连数据库。',
          '密码类凭据不由本服务保存（登录依赖微信授权）。'
        ]
      },
      {
        h: '四、信息共享',
        p: [
          '除以下情形外，不向第三方共享你的个人信息：',
          '① 你发布的内容本身是公开的，其他用户可见；匿名内容不展示作者身份。',
          '② 应法律法规、司法或行政机关的强制要求。',
          '③ 为完成内容安全检测，文本与图片会提交至微信内容安全接口。'
        ]
      },
      {
        h: '五、你的权利',
        p: [
          '查询与更正：在「设置 → 个人资料」中查看和修改你的资料。',
          '删除：可删除自己发布的内容；账号注销可通过意见反馈申请。',
          '撤回同意：停止使用本服务即视为撤回，但已发布内容的删除需手动操作。',
          '导出：可联系运营方申请导出你的个人数据。'
        ]
      },
      {
        h: '六、未成年人保护',
        p: [
          '本服务面向在校学生。未满 14 周岁的用户应在监护人同意下使用。',
          '若发现未成年人未经同意提供个人信息，我们将删除相关数据。'
        ]
      },
      {
        h: '七、Cookie 与本地存储',
        p: [
          '客户端使用本地存储保存登录态、主题偏好、搜索历史，不含敏感凭据。',
          '你可通过「设置 → 清理缓存」清除这些数据。'
        ]
      },
      {
        h: '八、政策更新',
        p: ['本政策更新后会在应用内公告。重大变更会再次征得你的同意。']
      }
    ]
  }
}

const doc = computed(() => DOCS[type.value])

onLoad((q: any) => {
  const t = String(q?.type || 'agreement')
  type.value = t === 'privacy' ? 'privacy' : 'agreement'
  uni.setNavigationBarTitle({ title: type.value === 'privacy' ? '隐私政策' : '用户协议' })
})
</script>

<style lang="scss" scoped>
.lg-page {
  min-height: 100vh;
  /* #ifdef H5 */
  min-height: calc(100vh - var(--window-top));
  /* #endif */
  background: var(--bg-page);
  padding: 32rpx 40rpx 80rpx;
  box-sizing: border-box;
}
.lg-head {
  margin-bottom: 40rpx;
}
.lg-kicker {
  display: block;
  font-size: 20rpx;
  letter-spacing: 4rpx;
  color: var(--text-tertiary);
  font-weight: var(--fw-title);
}
.lg-title {
  display: block;
  margin-top: 8rpx;
  font-size: 44rpx;
  font-weight: var(--fw-title);
  color: var(--text-primary);
}
.lg-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: var(--text-tertiary);
}

.lg-section {
  margin-bottom: 36rpx;
}
.lg-h {
  display: block;
  margin-bottom: 12rpx;
  font-size: 28rpx;
  font-weight: var(--fw-title);
  color: var(--text-primary);
}
.lg-p {
  display: block;
  margin-bottom: 10rpx;
  font-size: 26rpx;
  line-height: 1.75;
  color: var(--text-body);
}

.lg-foot {
  margin-top: 48rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid var(--border);
}
.lg-foot-text {
  font-size: 22rpx;
  color: var(--text-tertiary);
  line-height: 1.6;
}
</style>
