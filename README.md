# 傅佳礼的文档库

这里保存文档原件、网页代码和生成后的静态网页。

- 手机和电脑：[打开云端文档库](https://linxixi960131.github.io/jiali/)
- 离线网页：[index.html](index.html)
- GitHub 在线目录：[catalog.md](catalog.md)
- 文档文件：[documents/](documents/)

## 打开网页

手机和电脑都可以直接打开云端网址。这个仓库和网页可以公开访问，请只提交已获准公开的文档。

在 GitHub 仓库页面点击 **Code → Download ZIP**。解压后双击根目录的 `index.html`，用浏览器阅读。网页正文、搜索和分类直接在浏览器运行。保留解压目录里的 `documents/`，即可打开页面上的 PDF 或 Word 等原件。

也可以登录 GitHub 后，从上面的在线目录直接阅读 Markdown。

## 增加文档

把文件放到 `documents/`。同一文档的 Markdown 和 PDF 等版本使用同一文件名主体，网页会把它们合并为一条。网页用 Markdown 或纯文本展示正文，其他格式作为原件保留。

将新文档提交到 `main` 后，GitHub Actions 会重新分类、发布 GitHub Pages，再更新仓库里的网页和在线目录。可到 [Actions](https://github.com/linxixi960131/jiali/actions) 查看发布进度。

要在本机预览更新，运行以下命令按文件名重新分类并生成 `index.html` 和 `catalog.md`，然后一起提交。生成器需要 Node.js 22 或更新版本，直接打开网页只需要浏览器。

```bash
node scripts/build-library.mjs
```

标题关键词按工作汇报、复盘分析、方案与建议、流程与规范、数据表格的顺序匹配。没有匹配的文档归入其他文档。

试传文档的网页正文使用飞书 Markdown 导出。内嵌表格请通过正文中的飞书原文链接查看，PDF 保留飞书导出的排版和可见内容。
