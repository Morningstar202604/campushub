#!/usr/bin/env bash
# 演示数据重建（幂等）：注册/登录兜底 + 帖子/商品/互动/签到均先查重再插入
# 用法：bash apps/server/scripts/make-demo.sh （需后端已启动）
set -euo pipefail

API="${API:-http://localhost:3000/api}"
B='-H Content-Type:application/json'
TODAY="$(TZ=Asia/Shanghai date +%F)"

login() { # $1=email $2=pass -> accessToken
  curl -s -X POST "$API/auth/login" $B -d "{\"email\":\"$1\",\"password\":\"$2\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))"
}
register() {
  curl -s -X POST "$API/auth/register" $B -d "{\"email\":\"$1\",\"password\":\"$2\",\"nickname\":\"$3\"}" >/dev/null
}
tok() { # $1=email $2=pass -> token（注册兜底）
  local T; T="$(login "$1" "$2")"
  if [ -z "$T" ]; then register "$1" "$2" "$3"; T="$(login "$1" "$2")"; fi
  echo "$T"
}
listlen() { # $1=token $2=path -> 数组或 {list} 的长度
  curl -s "$API$2" -H "Authorization: Bearer $1" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('list', d) if isinstance(d,dict) else d))"
}

XMT="$(tok xiaoming@campus.dev demo123456 小明)"
XHT="$(tok xiaohong@campus.dev demo123456 小红)"
echo "tokens ok"

# ---- 帖子（查重：xiaoming 的帖子数 < 4 才补种）----
if [ "$(listlen "$XMT" /posts/me)" -lt 4 ]; then
  curl -s -X POST "$API/posts" $B -H "Authorization: Bearer $XMT" -d '{"categoryId":"cat_idle","kind":"post","title":"出二手高数课本 微积分上下册","content":"微积分上下册，九成新，无笔记，20 出，校内自提。","tags":["教材","高数"],"location":"东区宿舍"}' >/dev/null
  curl -s -X POST "$API/posts" $B -H "Authorization: Bearer $XMT" -d '{"categoryId":"cat_lost","kind":"lost","title":"东区食堂捡到校园卡一张","content":"今天中午在东区食堂二楼捡到一张校园卡，失主请联系我。","location":"东区食堂"}' >/dev/null
  curl -s -X POST "$API/posts" $B -H "Authorization: Bearer $XMT" -d '{"categoryId":"cat_activity","kind":"post","title":"周末东山湖露营求搭子","content":"周六早上出发，周日回，自带帐篷，AA 车费，已有 3 人，再找 2 个。","tags":["露营","周末"],"location":"校门口集合"}' >/dev/null
  curl -s -X POST "$API/posts" $B -H "Authorization: Bearer $XMT" -d '{"categoryId":"cat_parttime","kind":"task","title":"求代取快递 3 件","content":"菜鸟驿站到 5 栋，3 件小件，5 块钱，今天下午 5 点前。","location":"5 栋","expireAt":"'$(date -u -d "+2 days" +%Y-%m-%dT%H:%M:%S.%3NZ)'"}' >/dev/null
fi
echo "posts ok"

# ---- 互动：小红对露营帖点赞+收藏+评论（露营帖取最近一条 activity 帖）----
CAMP="$(curl -s "$API/posts?kind=post&pageSize=20" | python3 -c "import sys,json;d=json.load(sys.stdin);print(next((p['id'] for p in d['list'] if '露营' in (p.get('title') or '')),''))")"
if [ -n "$CAMP" ]; then
  curl -s -X POST "$API/posts/$CAMP/like" $B -H "Authorization: Bearer $XHT" >/dev/null
  curl -s -X POST "$API/posts/$CAMP/collect" $B -H "Authorization: Bearer $XHT" >/dev/null
  curl -s -X POST "$API/posts/$CAMP/comments" $B -H "Authorization: Bearer $XHT" -d '{"content":"蹲一个，还在吗？"}' >/dev/null
  echo "interaction ok (camping post: $CAMP)"
else
  echo "interaction skip (no camping post)"
fi

# ---- 签到（今日未签才签）----
CHK1="$(curl -s "$API/checkins?limit=1" -H "Authorization: Bearer $XMT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['date'] if d else '')")"
if [ "$CHK1" != "$TODAY" ]; then curl -s -X POST "$API/checkins" -H "Authorization: Bearer $XMT" >/dev/null; fi
CHK2="$(curl -s "$API/checkins?limit=1" -H "Authorization: Bearer $XHT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['date'] if d else '')")"
if [ "$CHK2" != "$TODAY" ]; then curl -s -X POST "$API/checkins" -H "Authorization: Bearer $XHT" >/dev/null; fi
echo "checkin ok"

# ---- 商品（查重：products/me 数量 < 2 才补种）----
if [ "$(listlen "$XMT" /products/me)" -lt 2 ]; then
  curl -s -X POST "$API/products" $B -H "Authorization: Bearer $XMT" -d '{"categoryId":"cat_idle","title":"九成新机械键盘 青轴","description":"用了半年，键帽无打油，青轴手感清脆。","price":89,"originalPrice":159,"condition":"almost_new","tradeType":"校内自提","location":"东区宿舍","contactInfo":"微信 abc123"}' >/dev/null
  curl -s -X POST "$API/products" $B -H "Authorization: Bearer $XMT" -d '{"categoryId":"cat_idle","title":"瑜伽垫 加厚防滑","description":"10mm 加厚款，用了三个月，无破损，附收纳绑带。","price":25,"condition":"good","tradeType":"校内自提","location":"东区宿舍","contactInfo":"微信 abc123"}' >/dev/null
fi
if [ "$(listlen "$XHT" /products/me)" -lt 1 ]; then
  curl -s -X POST "$API/products" $B -H "Authorization: Bearer $XHT" -d '{"categoryId":"cat_idle","title":"索尼 WH-1000XM4 降噪耳机","description":"国行在保，箱说全，通勤学习都合适。","price":699,"originalPrice":1999,"condition":"almost_new","tradeType":"校内自提","location":"图书馆附近","contactInfo":"QQ 88886666"}' >/dev/null
fi
echo "products ok"
echo "DEMO_DONE"
