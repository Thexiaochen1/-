// ============================================================
// 🕸️ 赛链赛事信息 · 自动抓取脚本
// ------------------------------------------------------------
// 这个脚本平时【不用你手动运行】！
// 它由 GitHub Actions 每天定时在云端自动执行：
//   1. 去赛链官网抓取网页
//   2. 提取"赛事动态"（NEWS 板块）
//   3. 写成 contests.json 存进仓库
//   4. 你的网页读取 contests.json 就能显示最新赛事
//
// 你只需要在电脑上装好 Node.js 后，也可以手动测试：
//   node fetch-contests.js
// ============================================================

const SOURCE_URL = "https://www.racelinksvc.cn/"; // 要抓取的赛链官网

async function main() {
  console.log("🌐 开始抓取：" + SOURCE_URL);

  // 1️⃣ 抓取网页（Node 18 以上自带 fetch，不用装任何依赖）
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  const html = await res.text();
  console.log("✅ 抓到网页，长度：" + html.length);

  // 2️⃣ 提取"正在报名的赛事"（首页轮播 #fstack 里的卡片）
  //    每张卡片 HTML 长这样：
  //    <article class="fcard">
  //      <span class="fc-status">报名进行中</span><span class="fc-year">2026 · 全国</span>
  //      <h3>赛事名</h3><p class="fc-host">主办方</p>
  //      <div class="fc-stats">报名人数...</div><a class="fc-cta" href="...">...</a>
  //    </article>
  const contests = [];
  const fcardRe = /class="fcard[\s\S]*?<\/article>/g;
  let m;
  while ((m = fcardRe.exec(html)) !== null) {
    const card = m[0];
    contests.push({
      status: ((card.match(/fc-status[^>]*>([^<]+)/) || [])[1] || "").trim(),
      year: ((card.match(/fc-year">([^<]+)/) || [])[1] || "").trim(),
      title: ((card.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1] || "")
        .replace(/<[^>]+>/g, "")
        .trim(),
      host: ((card.match(/fc-host">([^<]+)/) || [])[1] || "").trim(),
      stats: ((card.match(/fc-stats">([\s\S]*?)<\/div>/) || [])[1] || "")
        .replace(/<[^>]+>/g, "")
        .trim(),
      link: ((card.match(/fc-cta" href="([^"]+)"/) || [])[1] || "").trim(),
    });
  }

  // 3️⃣ 提取"赛事动态"（NEWS 板块的 news-item）
  //    每条长这样：<div class="news-item"><span class="news-date">2026.09</span>
  //      <b>标题</b><a href="..." class="news-tag">状态 →</a></div>
  const news = [];
  const itemRe = /<div class="news-item">([\s\S]*?)<\/div>/g;
  while ((m = itemRe.exec(html)) !== null) {
    const item = m[1];
    news.push({
      date: ((item.match(/news-date">([^<]+)/) || [])[1] || "").trim(),
      title: ((item.match(/<b>([\s\S]*?)<\/b>/) || [])[1] || "")
        .replace(/<[^>]+>/g, "")
        .trim(),
      status: ((item.match(/news-tag">([^<]+)/) || [])[1] || "")
        .replace("→", "")
        .trim(),
      link: ((item.match(/href="([^"]+)"/) || [])[1] || "").trim(),
    });
  }

  // 4️⃣ 提取"往届标杆案例"（CASES 板块的 case-card）
  //    每张长这样：<article class="case-card"><p class="title">赛事名</p>
  //      <p>描述</p><div class="case-meta"><span class="lvl">类型</span><span>年份</span></div></article>
  const cases = [];
  const caseRe = /class="case-card[\s\S]*?<\/article>/g;
  while ((m = caseRe.exec(html)) !== null) {
    const card = m[0];
    cases.push({
      title: ((card.match(/class="title">([^<]+)/) || [])[1] || "").trim(),
      level: ((card.match(/class="lvl[^"]*">([^<]+)/) || [])[1] || "").trim(),
      meta: ((card.match(/<\/span><span>([^<]+)<\/span>/) || [])[1] || "").trim(),
    });
  }

  // 5️⃣ 过滤：我们只保留"重庆 + 全国性"的赛事
  //    （咱们是重庆学生，其他省份的地方赛事就不收录了）
  function isWanted(text) {
    // 出现这些词 → 是别省/市的地方赛事 → 不要
    const localWords = ["湖北", "武汉", "京津冀", "粤港澳", "市级", "省赛"];
    for (const w of localWords) {
      if (text.includes(w)) return false;
    }
    // 出现这些词 → 是全国性或重庆的 → 要！
    const wantedWords = ["全国", "国家级", "重庆", "中国国际大学生创新大赛"];
    for (const w of wantedWords) {
      if (text.includes(w)) return true;
    }
    return false; // 都不是 → 不收录
  }

  // 把三个板块各自过滤一遍
  const filteredContests = contests.filter(function (c) {
    return isWanted(c.title + c.status + c.host);
  });
  const filteredNews = news.filter(function (n) {
    return isWanted(n.title + n.status);
  });
  const filteredCases = cases.filter(function (c) {
    return isWanted(c.title + c.level + c.meta);
  });

  // 6️⃣ 如果关键的"正在报名"一条都没抓到 → 报错（GitHub Actions 会提示失败，好排查）
  if (filteredContests.length === 0) {
    throw new Error("⚠️ 过滤后没有赛事了！可能需要更新过滤关键词");
  }

  // 7️⃣ 组装成最终数据（updated 记录"上次更新时间"）
  const result = {
    source: "赛链赛事官网（www.racelinksvc.cn）· 仅收录重庆与全国性赛事",
    updated: new Date().toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai", // 用北京时间
    }),
    contests: filteredContests, // 正在报名/筹备的赛事
    news: filteredNews,         // 赛事动态
    cases: filteredCases,       // 往届标杆案例
  };

  // 8️⃣ 写入 contests.json（GitHub Actions 会把它提交回仓库）
  const fs = await import("node:fs");
  fs.writeFileSync("contests.json", JSON.stringify(result, null, 2), "utf-8");
  console.log(
    "📝 已写入 contests.json：" +
      filteredContests.length + " 个报名中赛事、" +
      filteredNews.length + " 条动态、" +
      filteredCases.length + " 个案例"
  );
}

// 运行！出错了就让程序以失败状态退出（方便排查）
main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
