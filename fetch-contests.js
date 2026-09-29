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

  // 2️⃣ 提取"赛事动态"列表
  //    网站里每条动态的 HTML 长这样（结构很规整）：
  //    <div class="news-item">
  //      <span class="news-date">2026.09</span>
  //      <b>标题文字</b>
  //      <a href="..." class="news-tag">状态 →</a>
  //    </div>
  const contests = [];
  // 用正则把每一条 news-item 整块抠出来
  const itemRe = /<div class="news-item">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = itemRe.exec(html)) !== null) {
    const item = m[1];

    // 从这一块里，分别取出：日期、标题、链接、状态
    const date = (item.match(/news-date">([^<]+)/) || [])[1] || "";
    const title = (item.match(/<b>([\s\S]*?)<\/b>/) || [])[1] || "";
    const link = (item.match(/href="([^"]+)"/) || [])[1] || "";
    const status = (item.match(/news-tag">([^<]+)/) || [])[1] || "";

    contests.push({
      date: date.trim(),
      title: title.replace(/<[^>]+>/g, "").trim(), // 去掉标题里可能残留的标签
      status: status.replace("→", "").trim(),      // 去掉箭头符号
      link: link,
    });
  }

  // 3️⃣ 如果一条都没抓到 → 报错（GitHub Actions 会提示失败，好排查）
  if (contests.length === 0) {
    throw new Error("⚠️ 没有抓到赛事数据！网站结构可能改了，需要检查脚本");
  }

  // 4️⃣ 组装成最终数据（updated 记录"上次更新时间"）
  const result = {
    source: "赛链赛事官网（www.racelinksvc.cn）",
    updated: new Date().toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai", // 用北京时间
    }),
    contests: contests,
  };

  // 5️⃣ 写入 contests.json（GitHub Actions 会把它提交回仓库）
  const fs = await import("node:fs");
  fs.writeFileSync("contests.json", JSON.stringify(result, null, 2), "utf-8");
  console.log("📝 已写入 contests.json，共 " + contests.length + " 条赛事");
}

// 运行！出错了就让程序以失败状态退出（方便排查）
main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
