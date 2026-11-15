"use strict";

const search = document.querySelector("#search");
const listTitle = document.querySelector("#list-title");
const results = document.querySelector("#results");
const empty = document.querySelector("#empty");
const filters = [...document.querySelectorAll("[data-filter]")];
const rows = [...document.querySelectorAll("#documents li")].map(item => {
  const link = item.querySelector("a");
  const article = document.getElementById(link.hash.slice(1));
  return { item, link, article, text: link.textContent.toLocaleLowerCase("zh-CN") };
});
let category = "all";
let selection = location.hash.slice(1);

function render() {
  const query = search.value.trim().toLocaleLowerCase("zh-CN");
  const visible = rows.filter(({ item, text }) =>
    (category === "all" || item.dataset.category === category) && text.includes(query)
  );
  const current = visible.find(row => row.article.id === selection) || visible[0];
  selection = current?.article.id || "";
  for (const row of rows) {
    row.item.hidden = !visible.includes(row);
    row.article.hidden = row !== current;
    if (row === current) row.link.setAttribute("aria-current", "page");
    else row.link.removeAttribute("aria-current");
  }
  for (const button of filters) button.setAttribute("aria-pressed", String(button.dataset.filter === category));
  listTitle.textContent = filters.find(button => button.dataset.filter === category).firstElementChild.textContent;
  results.textContent = "找到 " + visible.length + " 份文档";
  empty.hidden = Boolean(current);
}

search.addEventListener("input", render);
for (const button of filters) {
  button.addEventListener("click", () => {
    category = button.dataset.filter;
    render();
  });
}
for (const row of rows) {
  row.link.addEventListener("click", () => {
    selection = row.article.id;
    render();
  });
}
addEventListener("hashchange", () => {
  const requested = rows.find(row => "#" + row.article.id === location.hash);
  if (requested?.item.hidden) {
    category = "all";
    search.value = "";
  }
  selection = requested?.article.id || "";
  render();
});
render();
