import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(srcDir, destDir, options = {}) {
  const exclude = typeof options.exclude === "function" ? options.exclude : () => false;
  ensureDir(destDir);

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (exclude(srcPath, entry)) continue;

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, options);
      continue;
    }

    ensureDir(path.dirname(destPath));
    fs.copyFileSync(srcPath, destPath);
  }
}

function copyFileIfExists(relPath) {
  const srcPath = path.join(ROOT, relPath);
  if (!fs.existsSync(srcPath)) return;
  const destPath = path.join(PUBLIC_DIR, relPath);
  ensureDir(path.dirname(destPath));
  fs.copyFileSync(srcPath, destPath);
}

function writePublicFile(relPath, content) {
  const destPath = path.join(PUBLIC_DIR, relPath);
  ensureDir(path.dirname(destPath));
  fs.writeFileSync(destPath, content, "utf8");
}

function extractHeadStyles(rawHtml) {
  const headMatch = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headHtml = headMatch && headMatch[1] ? headMatch[1] : "";
  const styles = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRe.exec(headHtml))) {
    if (styleMatch[1]) styles.push(styleMatch[1].trim());
  }
  return styles.join("\n\n");
}

function extractBodyInner(rawHtml) {
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch && bodyMatch[1] ? bodyMatch[1] : "";
}

function collectBodyScripts(bodyHtml) {
  const scripts = [];
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRe.exec(bodyHtml))) {
    scripts.push({
      attrs: match[1] || "",
      content: match[2] || "",
      full: match[0],
    });
  }
  return scripts;
}

function stripBodyScripts(bodyHtml) {
  return bodyHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").trim();
}

function toAttrMap(attrsRaw) {
  const out = {};
  const attrRe = /(\w[\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = attrRe.exec(attrsRaw || ""))) {
    const key = String(match[1] || "").trim();
    if (!key) continue;
    out[key.toLowerCase()] = typeof match[2] === "string" ? match[2] : match[3] || "";
  }
  return out;
}

function writeMarkupLoader(relPath, rootId, html) {
  const script = `(function(){\n  var root = document.getElementById(${JSON.stringify(rootId)});\n  if (!root) return;\n  root.innerHTML = ${JSON.stringify(html)};\n})();\n`;
  writePublicFile(relPath, script);
}

function extractIndexAssets() {
  const indexHtmlPath = path.join(ROOT, "index.html");
  if (!fs.existsSync(indexHtmlPath)) return;

  const raw = fs.readFileSync(indexHtmlPath, "utf8");

  const indexStyles = extractHeadStyles(raw);
  if (indexStyles) {
    writePublicFile("index-inline.css", `${indexStyles}\n`);
  }

  const introScriptMatch = raw.match(/<script\s+src=["']assets\/js\/main\.js["']><\/script>\s*<script>([\s\S]*?)<\/script>\s*<script\s+id=["']ik-site-settings-js["']>/i);
  if (introScriptMatch && introScriptMatch[1]) {
    writePublicFile("index-intro.js", `${introScriptMatch[1].trim()}\n`);
  }

  const settingsScriptMatch = raw.match(/<script\s+id=["']ik-site-settings-js["']>([\s\S]*?)<\/script>/i);
  if (settingsScriptMatch && settingsScriptMatch[1]) {
    writePublicFile(path.join("js", "ik-site-settings-index.js"), `${settingsScriptMatch[1].trim()}\n`);
  }
}

function extractPlanningSettingsAssets() {
  const planningHtmlPath = path.join(ROOT, "crate", "planning", "planning.html");
  if (!fs.existsSync(planningHtmlPath)) return;

  const raw = fs.readFileSync(planningHtmlPath, "utf8");

  const cssMatch = raw.match(/<style\s+id=["']ik-site-settings-css["']>([\s\S]*?)<\/style>/i);
  if (cssMatch && cssMatch[1]) {
    writePublicFile(path.join("crate", "planning", "ik-site-settings.css"), `${cssMatch[1].trim()}\n`);
  }

  const jsMatch = raw.match(/<script\s+id=["']ik-site-settings-js["']>([\s\S]*?)<\/script>/i);
  if (jsMatch && jsMatch[1]) {
    writePublicFile(path.join("crate", "planning", "js", "ik-site-settings.js"), `${jsMatch[1].trim()}\n`);
  }
}

function extractWhispererAssets() {
  const whispererHtmlPath = path.join(ROOT, "crate", "whisperer", "whisperer.html");
  if (!fs.existsSync(whispererHtmlPath)) return;

  const raw = fs.readFileSync(whispererHtmlPath, "utf8");

  const headStyles = extractHeadStyles(raw);
  if (headStyles) {
    writePublicFile(path.join("crate", "whisperer", "whisperer-inline.css"), `${headStyles}\n`);
  }

  const modalStyleMatch = raw.match(/<div\s+class=["']modal["']\s+id=["']notesModal["'][\s\S]*?<\/div>\s*<style>([\s\S]*?)<\/style>\s*<script\s+src=["']\.\.\/\.\.\/assets\/js\/theme\.js["']><\/script>/i);
  if (modalStyleMatch && modalStyleMatch[1]) {
    writePublicFile(path.join("crate", "whisperer", "whisperer-modal.css"), `${modalStyleMatch[1].trim()}\n`);
  }

  const scriptsMatch = raw.match(/<script\s+src=["']\.\.\/\.\.\/assets\/js\/main\.js["']><\/script>\s*<script>([\s\S]*?)<\/script>\s*<script>([\s\S]*?)<\/script>\s*<script\s+id=["']ik-site-settings-js["']>([\s\S]*?)<\/script>/i);
  if (scriptsMatch) {
    if (scriptsMatch[1]) {
      writePublicFile(path.join("crate", "whisperer", "js", "whisperer-nav.js"), `${scriptsMatch[1].trim()}\n`);
    }
    if (scriptsMatch[2]) {
      writePublicFile(path.join("crate", "whisperer", "js", "whisperer-core.js"), `${scriptsMatch[2].trim()}\n`);
    }
    if (scriptsMatch[3]) {
      writePublicFile(path.join("crate", "whisperer", "js", "ik-site-settings.js"), `${scriptsMatch[3].trim()}\n`);
    }
  }
}

function extractStudentHelperAssets() {
  const htmlPath = path.join(ROOT, "crate", "student_helper", "student_helper.html");
  if (!fs.existsSync(htmlPath)) return;

  const raw = fs.readFileSync(htmlPath, "utf8");
  const body = extractBodyInner(raw);
  const bodyWithoutScripts = stripBodyScripts(body);
  const scripts = collectBodyScripts(body);

  const headStyles = extractHeadStyles(raw);
  if (headStyles) {
    writePublicFile(path.join("crate", "student_helper", "student-helper-inline.css"), `${headStyles}\n`);
  }

  if (bodyWithoutScripts) {
    writePublicFile(path.join("crate", "student_helper", "student-helper-body.html"), `${bodyWithoutScripts}\n`);
    writeMarkupLoader(path.join("crate", "student_helper", "js", "student-helper-markup.js"), "ik-student-helper-root", bodyWithoutScripts);
  }

  for (const script of scripts) {
    const attrs = toAttrMap(script.attrs);
    if (attrs.id === "ik-site-settings-js") {
      writePublicFile(path.join("crate", "student_helper", "js", "ik-site-settings.js"), `${script.content.trim()}\n`);
      continue;
    }

    if (attrs.src && /tabs\.js/i.test(attrs.src) && !attrs.type) {
      const idx = scripts.indexOf(script);
      if (idx >= 0 && scripts[idx + 1] && !toAttrMap(scripts[idx + 1].attrs).src) {
        writePublicFile(path.join("crate", "student_helper", "js", "student-helper-back-nav.js"), `${scripts[idx + 1].content.trim()}\n`);
      }
      continue;
    }

    if (attrs.src && /dictionary\.js/i.test(attrs.src)) {
      const idx = scripts.indexOf(script);
      if (idx >= 0 && scripts[idx + 1] && !toAttrMap(scripts[idx + 1].attrs).src) {
        writePublicFile(path.join("crate", "student_helper", "js", "student-helper-dict-fallback.js"), `${scripts[idx + 1].content.trim()}\n`);
      }
    }
  }
}

function studentHelperRedirectHtml(targetHref) {
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\" />",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `  <meta http-equiv=\"refresh\" content=\"0;url=${targetHref}\" />`,
    "  <title>Redirecting...</title>",
    "  <script>",
    "    (function(){",
    "      var search = String(window.location.search || \"\");",
    "      if (/(^|[?&])legacy=1(?:&|$)/i.test(search)) return;",
    "      var path = String(window.location.pathname || \"\");",
    "      if (!/\\/crate\\/student_helper\\/(?:student_helper\\.html|index\\.html)?\\/?$/i.test(path)) return;",
    "      var targetPath = path.replace(/(?:student_helper|index)\\.html\\/?$/i, \"\");",
    "      if (targetPath.charAt(0) !== \"/\") targetPath = \"/\" + targetPath;",
    "      if(!targetPath) targetPath = \"./\";",
    "      if(targetPath.charAt(targetPath.length - 1) !== \"/\") targetPath += \"/\";",
    "      var cleanSearch = search",
    "        .replace(/[?&]legacy=1(?=&|$)/gi, \"\")",
    "        .replace(/^&/, \"?\")",
    "        .replace(/[?&]$/, \"\");",
    "      var target = targetPath + cleanSearch + String(window.location.hash || \"\");",
    "      var current = path + search + String(window.location.hash || \"\");",
    "      if (target === current) return;",
    "      window.location.replace(target);",
    "    })();",
    "  </script>",
    "</head>",
    "<body>",
    "  <p>Redirecting to <a href=\"./\">the new Student Helper page</a>...</p>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function writeStudentHelperLegacyRedirect() {
  const html = studentHelperRedirectHtml("./");
  writePublicFile(path.join("crate", "student_helper", "student_helper.html"), html);
}

function extractOnoiNotesAssets() {
  const htmlPath = path.join(ROOT, "crate", "onoi_notes", "onoi_notes.html");
  if (!fs.existsSync(htmlPath)) return;

  const raw = fs.readFileSync(htmlPath, "utf8");
  const body = extractBodyInner(raw);
  const bodyWithoutScripts = stripBodyScripts(body);
  const scripts = collectBodyScripts(body);

  const headStyles = extractHeadStyles(raw);
  if (headStyles) {
    writePublicFile(path.join("crate", "onoi_notes", "onoi-notes-inline.css"), `${headStyles}\n`);
  }

  if (bodyWithoutScripts) {
    writePublicFile(path.join("crate", "onoi_notes", "onoi-notes-body.html"), `${bodyWithoutScripts}\n`);
    writeMarkupLoader(path.join("crate", "onoi_notes", "js", "onoi-notes-markup.js"), "ik-onoi-notes-root", bodyWithoutScripts);
  }

  if (scripts[1] && !toAttrMap(scripts[1].attrs).src) {
    writePublicFile(path.join("crate", "onoi_notes", "js", "onoi-notes-back-nav.js"), `${scripts[1].content.trim()}\n`);
  }

  const coreParts = [];
  if (scripts[2] && !toAttrMap(scripts[2].attrs).src) {
    coreParts.push(scripts[2].content.trim());
  }
  if (scripts[3] && !toAttrMap(scripts[3].attrs).src) {
    coreParts.push(scripts[3].content.trim());
  }
  if (coreParts.length) {
    writePublicFile(path.join("crate", "onoi_notes", "js", "onoi-notes-core.js"), `${coreParts.join("\n\n")}\n`);
  }

  for (const script of scripts) {
    const attrs = toAttrMap(script.attrs);
    if (attrs.id === "ik-site-settings-js") {
      writePublicFile(path.join("crate", "onoi_notes", "js", "ik-site-settings.js"), `${script.content.trim()}\n`);
      continue;
    }
  }

  if (scripts[7] && !toAttrMap(scripts[7].attrs).src) {
    writePublicFile(path.join("crate", "onoi_notes", "js", "onoi-notes-mobile.js"), `${scripts[7].content.trim()}\n`);
  }

  if (scripts[8] && !toAttrMap(scripts[8].attrs).src) {
    writePublicFile(path.join("crate", "onoi_notes", "js", "onoi-notes-fallback.js"), `${scripts[8].content.trim()}\n`);
  }
}

function main() {
  ensureDir(PUBLIC_DIR);

  copyDir(path.join(ROOT, "assets"), path.join(PUBLIC_DIR, "assets"));

  copyDir(path.join(ROOT, "crate"), path.join(PUBLIC_DIR, "crate"), {
    exclude: (srcPath, entry) => entry.isFile() && /\.html$/i.test(srcPath),
  });

  extractIndexAssets();
  extractPlanningSettingsAssets();
  extractWhispererAssets();
  extractStudentHelperAssets();
  writeStudentHelperLegacyRedirect();
  extractOnoiNotesAssets();

  copyFileIfExists("logo_item.png");
  copyFileIfExists("01.png");
  copyFileIfExists("02.png");
}

main();
