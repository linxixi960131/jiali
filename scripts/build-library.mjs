import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { posix as path, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { Marked } from "../vendor/marked.mjs";

const [option, pagesDirectory, ...extra] = process.argv.slice(2);
if (option !== undefined && (option !== "--pages-dir" || !pagesDirectory || extra.length)) {
  throw new Error("用法：node scripts/build-library.mjs [--pages-dir 临时空目录]");
}

const root = new URL("../", import.meta.url);
const title = "傅佳礼的文档库";
const categories = [
  ["reports", "工作汇报", /周报|日报|月报|季报|年报|weekly|daily|monthly/i],
  ["reviews", "复盘分析", /复盘|分析|调研|研究|评估|review|analysis/i],
  ["plans", "方案与建议", /方案|建议|策划|提案|规划|计划|proposal|plan/i],
  ["guides", "流程与规范", /流程|规范|指南|手册|sop|guide/i],
  ["tables", "数据表格", /台账|数据表|明细|清单|报表/],
  ["other", "其他文档", null],
];
const supported = new Set(["md", "txt", "pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx"]);
const publishable = new Set([...supported, "png", "jpg", "jpeg", "gif", "webp"]);
const fileOrder = ["md", "txt", "pdf", "docx", "doc", "xlsx", "xls", "csv", "pptx", "ppt"];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function filenameUrl(filename) {
  return filename.split("/").map(encodeURIComponent).join("/");
}

function fileUrl(filename) {
  return new URL(filenameUrl(filename), root);
}

function safeLink(href, source) {
  if (/^https:\/\//i.test(href)) {
    try {
      const target = new URL(href);
      return target.username || target.password ? null : target.href;
    } catch {
      return null;
    }
  }
  if (!href || /[:\\?#]/.test(href) || href.startsWith("/")) return null;
  try {
    const target = path.normalize(path.join(path.dirname(source), decodeURIComponent(href)));
    return target.startsWith("documents/") ? filenameUrl(target) : null;
  } catch {
    return null;
  }
}

function markdown(source, filename) {
  const parser = new Marked({
    gfm: true,
    renderer: {
      html(token) {
        return escapeHtml(token.text);
      },
      link(token) {
        const text = this.parser.parseInline(token.tokens);
        const href = safeLink(token.href, filename);
        if (!href) return text;
        const external = href.startsWith("https://") ? ' target="_blank" rel="noopener noreferrer"' : "";
        return '<a href="' + escapeHtml(href) + '"' + external + '>' + text + '</a>';
      },
      image(token) {
        const href = safeLink(token.href, filename);
        const alt = escapeHtml(token.text || "文档图片");
        if (!href || href.startsWith("https://")) return alt;
        return '<img loading="lazy" src="' + escapeHtml(href) + '" alt="' + alt + '">';
      },
      table(token) {
        const row = cells => cells.map(cell => {
          const tag = cell.header ? "th" : "td";
          const content = this.parser.parseInline(cell.tokens);
          return "<" + tag + ">" + content + "</" + tag + ">";
        }).join("");
        return '<div class="table-scroll" tabindex="0"><table><thead><tr>' + row(token.header)
          + "</tr></thead><tbody>" + token.rows.map(cells => "<tr>" + row(cells) + "</tr>").join("")
          + "</tbody></table></div>";
      },
    },
  });
  const body = source.replace(/^\uFEFF?#[ \t]+[^\r\n]+(?:\r?\n|$)/, "").trim();
  return parser.parse(body);
}

async function listFiles(directory) {
  const entries = await readdir(fileUrl(directory + "/"), { withFileTypes: true });
  const groups = await Promise.all(entries.map(entry => {
    if (entry.name.startsWith(".")) return [];
    const filename = directory + "/" + entry.name;
    if (entry.isDirectory()) return listFiles(filename);
    return entry.isFile() ? [filename] : [];
  }));
  return groups.flat();
}

function classify(document) {
  const rule = categories.find(([, , regex]) => regex?.test(document.title));
  if (rule) return rule[0];
  return document.files.some(({ extension }) => ["xlsx", "xls", "csv"].includes(extension)) ? "tables" : "other";
}

async function loadDocuments(filenames) {
  const docs = new Map();
  for (const filename of filenames) {
    const extension = path.extname(filename).slice(1).toLowerCase();
    if (!supported.has(extension)) continue;
    const basename = filename.slice(0, -(extension.length + 1));
    const document = docs.get(basename) || {
      id: "doc-" + createHash("sha256").update(basename).digest("hex").slice(0, 14),
      title: path.basename(basename),
      files: [],
    };
    document.files.push({ extension, filename });
    docs.set(basename, document);
  }

  const documents = [...docs.values()].sort((a, b) => a.title.localeCompare(b.title, "zh-CN") || a.id.localeCompare(b.id));
  return Promise.all(documents.map(async document => {
    document.files.sort((a, b) => fileOrder.indexOf(a.extension) - fileOrder.indexOf(b.extension));
    document.category = classify(document);
    const reading = document.files.find(f => ["md", "txt"].includes(f.extension));
    document.reading = reading?.filename;
    if (reading) {
      const source = await readFile(fileUrl(reading.filename), "utf8");
      document.body = reading.extension === "md"
        ? markdown(source, reading.filename)
        : '<pre class="plain-text">' + escapeHtml(source) + "</pre>";
    }
    return document;
  }));
}

const filenames = await listFiles("documents");
const documents = await loadDocuments(filenames);
const label = id => categories.find(([key]) => key === id)?.[1];
const linkFor = ({ filename, extension }) => '<a href="' + filenameUrl(filename) + '">'
  + (extension === "pdf" ? "PDF 归档件" : extension.toUpperCase() + " 原件") + '</a>';
const filterButton = (id, name, count) => '<button type="button" data-filter="' + id + '" aria-pressed="'
  + String(id === "all") + '"><span>' + name + '</span><small>' + count + '</small></button>';
const filters = [
  filterButton("all", "全部文档", documents.length),
  ...categories.map(([id, name]) => filterButton(id, name, documents.filter(doc => doc.category === id).length)),
].join("\n");
const list = documents.map(doc => '<li data-category="' + doc.category + '"><a href="#' + doc.id + '"><strong>'
  + escapeHtml(doc.title) + '</strong><small>' + label(doc.category) + ' · '
  + doc.files.map(f => f.extension.toUpperCase()).join(" / ") + '</small></a></li>').join("\n");
const articles = documents.map(doc => '<article class="document" id="' + doc.id + '" data-category="' + doc.category + '">'
  + '<header class="document-heading"><div class="category">' + label(doc.category) + '</div><h2 tabindex="-1">'
  + escapeHtml(doc.title) + '</h2><div class="attachments">' + doc.files.map(linkFor).join("")
  + '</div></header><div class="document-body">'
  + (doc.body || '<p>请选择上方文件打开原件。</p>') + "</div></article>").join("\n");

const [layout, style, script] = await Promise.all(
  ["web/template.html", "web/library.css", "web/library.js"].map(filename => readFile(fileUrl(filename), "utf8"))
);
const html = layout.replace(/<!-- (TITLE|STYLE|SCRIPT|FILTERS|LIST|ARTICLES) -->/g,
  (_, key) => ({ TITLE: title, STYLE: style, SCRIPT: script, FILTERS: filters, LIST: list, ARTICLES: articles })[key]);
const catalog = [
  "# " + title,
  "",
  `共 ${documents.length} 份文档。[网页文件](index.html) · [使用说明](README.md)`,
  "",
  ...categories.flatMap(([id, name]) => {
    const group = documents.filter(doc => doc.category === id);
    if (!group.length) return [];
    return ["## " + name, "", ...group.map(doc => {
      const preferred = doc.reading || doc.files[0].filename;
      const safeTitle = doc.title.replace(/[\\\[\]]/g, char => "\\" + char).replace(/\r?\n/g, " ");
      return "- [" + safeTitle + "](" + filenameUrl(preferred) + ")";
    }), ""];
  }),
].join("\n");
await Promise.all([
  writeFile(fileUrl("index.html"), html, "utf8"),
  writeFile(fileUrl("catalog.md"), catalog, "utf8"),
]);
if (pagesDirectory) {
  const destination = pathToFileURL(resolve(pagesDirectory) + sep);
  await mkdir(destination, { recursive: true });
  if ((await readdir(destination)).length) {
    throw new Error("Pages 发布目录必须为空。");
  }

  const assets = filenames.filter(filename => publishable.has(path.extname(filename).slice(1).toLowerCase()));
  await Promise.all(assets.map(async filename => {
    const output = new URL(filenameUrl(filename), destination);
    await mkdir(new URL(".", output), { recursive: true });
    await copyFile(fileUrl(filename), output);
  }));
  await writeFile(new URL("index.html", destination), html, "utf8");
  console.log(`已整理 ${assets.length} 个 Pages 附件。`);
}
console.log(`已按类型整理 ${documents.length} 份文档。`);
