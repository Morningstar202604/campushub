const Layout = () => import("@/layout/index.vue");

/**
 * campushub 管理后台业务路由（静态注册，菜单随路由自动生成）
 * 数据全部直连 Supabase（RLS 已保证仅管理员可读写）
 */
export default [
  {
    path: "/content",
    name: "ContentAudit",
    component: Layout,
    redirect: "/content/posts",
    meta: {
      icon: "ep:document-checked",
      title: "内容审核",
      rank: 1
    },
    children: [
      {
        path: "/content/posts",
        name: "ContentPosts",
        component: () => import("@/views/content-audit/posts.vue"),
        meta: { title: "帖子审核" }
      },
      {
        path: "/content/products",
        name: "ContentProducts",
        component: () => import("@/views/content-audit/products.vue"),
        meta: { title: "商品审核" }
      },
      {
        path: "/content/comments",
        name: "ContentComments",
        component: () => import("@/views/content-audit/comments.vue"),
        meta: { title: "评论审核" }
      }
    ]
  },
  {
    path: "/reports",
    name: "Reports",
    component: Layout,
    redirect: "/reports/list",
    meta: {
      icon: "ep:warning",
      title: "举报处理",
      rank: 2
    },
    children: [
      {
        path: "/reports/list",
        name: "ReportsList",
        component: () => import("@/views/reports/index.vue"),
        meta: { title: "举报处理" }
      }
    ]
  },
  {
    path: "/users",
    name: "UserManage",
    component: Layout,
    redirect: "/users/list",
    meta: {
      icon: "ep:user",
      title: "用户管理",
      rank: 3
    },
    children: [
      {
        path: "/users/list",
        name: "UsersList",
        component: () => import("@/views/users/index.vue"),
        meta: { title: "用户管理" }
      }
    ]
  },
  {
    path: "/categories",
    name: "CategoryManage",
    component: Layout,
    redirect: "/categories/list",
    meta: {
      icon: "ep:collection-tag",
      title: "分类管理",
      rank: 4
    },
    children: [
      {
        path: "/categories/list",
        name: "CategoriesList",
        component: () => import("@/views/categories/index.vue"),
        meta: { title: "分类管理" }
      }
    ]
  },
  {
    path: "/announcements",
    name: "AnnouncementManage",
    component: Layout,
    redirect: "/announcements/list",
    meta: {
      icon: "ep:bell",
      title: "公告管理",
      rank: 5
    },
    children: [
      {
        path: "/announcements/list",
        name: "AnnouncementsList",
        component: () => import("@/views/announcements/index.vue"),
        meta: { title: "公告管理" }
      }
    ]
  },
  {
    path: "/guides",
    name: "GuideManage",
    component: Layout,
    redirect: "/guides/list",
    meta: {
      icon: "ep:reading",
      title: "指南管理",
      rank: 6
    },
    children: [
      {
        path: "/guides/list",
        name: "GuidesList",
        component: () => import("@/views/guides/index.vue"),
        meta: { title: "指南管理" }
      }
    ]
  },
  {
    path: "/feedbacks",
    name: "FeedbackManage",
    component: Layout,
    redirect: "/feedbacks/list",
    meta: {
      icon: "ep:chat-dot-square",
      title: "反馈管理",
      rank: 7
    },
    children: [
      {
        path: "/feedbacks/list",
        name: "FeedbacksList",
        component: () => import("@/views/feedbacks/index.vue"),
        meta: { title: "反馈管理" }
      }
    ]
  },
  {
    path: "/notifications",
    name: "NotificationManage",
    component: Layout,
    redirect: "/notifications/list",
    meta: {
      icon: "ep:promotion",
      title: "通知下发",
      rank: 8
    },
    children: [
      {
        path: "/notifications/list",
        name: "NotificationsList",
        component: () => import("@/views/notifications/index.vue"),
        meta: { title: "通知下发" }
      }
    ]
  },
  {
    path: "/admin-logs",
    name: "AdminLogs",
    component: Layout,
    redirect: "/admin-logs/list",
    meta: {
      icon: "ep:list",
      title: "操作审计",
      rank: 9
    },
    children: [
      {
        path: "/admin-logs/list",
        name: "AdminLogsList",
        component: () => import("@/views/admin-logs/index.vue"),
        meta: { title: "操作审计" }
      }
    ]
  }
] satisfies RouteConfigsTable;
