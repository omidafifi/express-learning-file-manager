// app.js (CommonJS)
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

const STORAGE_ROOT = path.join(__dirname, "storage");
const PUBLIC_DIR = path.join(__dirname, "public");
const VIEWS_DIR = path.join(__dirname, "views");
if (!fs.existsSync(STORAGE_ROOT))
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });

app.set("view engine", "ejs");
app.set("views", VIEWS_DIR);
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

//Helpers 
function resolveSafe(relative = "") {
  if (typeof relative !== "string") throw new Error("Invalid path");
  const rel = relative.replace(/\\/g, "/");
  if (rel.includes("..")) throw new Error("Invalid path: traversal");
  const full = path.normalize(path.join(STORAGE_ROOT, rel));
  if (!full.startsWith(STORAGE_ROOT)) throw new Error("Outside storage");
  return full;
}

function buildBreadcrumb(dirRel) {
  const parts = dirRel ? dirRel.split("/").filter(Boolean) : [];
  const crumbs = [{ name: "root", href: "/" }];
  let accum = "";
  for (const p of parts) {
    accum = accum ? `${accum}/${p}` : p;
    crumbs.push({ name: p, href: `/?dir=${encodeURIComponent(accum)}` });
  }
  return crumbs;
}

// Multer 50MB 
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Routes 

// 1) لیست فایل‌ها/فولدرها + breadcrumb
app.get("/", (req, res) => {
  try {
    const dirRel = (req.query.dir || "").toString().replace(/\\/g, "/");
    const currentDir = resolveSafe(dirRel);
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    const list = entries.map((ent) => {
      const abs = path.join(currentDir, ent.name);
      const rel = (dirRel ? dirRel + "/" : "") + ent.name;
      const isDir = ent.isDirectory();
      const stat = fs.statSync(abs);
      return {
        name: ent.name,
        rel,
        type: isDir ? "folder" : "file",
        size: isDir ? null : stat.size,
      };
    });

    res.render("index", {
      list,
      dirRel,
      crumbs: buildBreadcrumb(dirRel),
      message: req.query.msg ? String(req.query.msg) : null,
      error: req.query.err ? String(req.query.err) : null,
      encodeURIComponent,
    });
  } catch (e) {
    res.status(400).send("Error: " + e.message);
  }
});

// 2) ایجاد فایل جدید
app.post("/files/create", (req, res) => {
  try {
    const relativePath = (req.body.relativePath || "")
      .toString()
      .replace(/\\/g, "/");
    const content = (req.body.content || "").toString();
    if (!relativePath) throw new Error("relativePath is required");
    const abs = resolveSafe(relativePath);
    if (fs.existsSync(abs))
      throw new Error("A file/folder with this name already exists");
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
    const dirRel = path.posix.dirname(relativePath);
    res.redirect(
      `/?dir=${encodeURIComponent(
        dirRel === "." ? "" : dirRel
      )}&msg=${encodeURIComponent("File created.")}`
    );
  } catch (e) {
    res.redirect(`/?err=${encodeURIComponent(e.message)}`);
  }
});

// 3) حذف فایل
app.post("/files/delete", (req, res) => {
  try {
    const relativePath = (req.body.relativePath || "")
      .toString()
      .replace(/\\/g, "/");
    if (!relativePath) throw new Error("relativePath is required");
    const abs = resolveSafe(relativePath);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile())
      throw new Error("File not found");
    fs.unlinkSync(abs);
    const dirRel = path.posix.dirname(relativePath);
    res.redirect(
      `/?dir=${encodeURIComponent(
        dirRel === "." ? "" : dirRel
      )}&msg=${encodeURIComponent("File deleted.")}`
    );
  } catch (e) {
    res.redirect(`/?err=${encodeURIComponent(e.message)}`);
  }
});

// 4) آپلود فایل با اسم دلخواه
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) throw new Error("No file uploaded");
    const dir = (req.body.dir || "").toString().replace(/\\/g, "/");
    const customName = (req.body.customName || "").toString().trim();

    const targetDir = resolveSafe(dir);
    const orig = req.file.originalname;
    const origExt = path.extname(orig);

    let finalName = customName || path.parse(orig).name; // اگر نداد از اسم اصلی بدون پسوند
    if (!path.extname(finalName)) finalName = finalName + origExt; // اگر پسوند نداشت پسوند اصلی را اضافه کن

    const targetPath = path.join(targetDir, finalName);
    if (fs.existsSync(targetPath))
      throw new Error("A file/folder with this name already exists");

    fs.writeFileSync(targetPath, req.file.buffer);
    res.redirect(
      `/?dir=${encodeURIComponent(dir)}&msg=${encodeURIComponent(
        "File uploaded."
      )}`
    );
  } catch (e) {
    res.redirect(`/?err=${encodeURIComponent(e.message)}`);
  }
});

// 5)  creat فولدر
app.post("/folders/create", (req, res) => {
  try {
    const relativePath = (req.body.relativePath || "")
      .toString()
      .replace(/\\/g, "/");
    if (!relativePath) throw new Error("relativePath is required");
    const abs = resolveSafe(relativePath);
    if (fs.existsSync(abs))
      throw new Error("A file/folder with this name already exists");
    //پرنت ها  ساخته می‌شود ولی اسم نهایی اگر  باشه خطا می‌دهد
    fs.mkdirSync(abs, { recursive: true });
    const dirRel = path.posix.dirname(relativePath);
    res.redirect(
      `/?dir=${encodeURIComponent(
        dirRel === "." ? "" : dirRel
      )}&msg=${encodeURIComponent("Folder created.")}`
    );
  } catch (e) {
    res.redirect(`/?err=${encodeURIComponent(e.message)}`);
  }
});

// 6) کپی فایل
app.post("/files/copy", (req, res) => {
  try {
    const source = (req.body.source || "").toString().replace(/\\/g, "/");
    const target = (req.body.target || "").toString().replace(/\\/g, "/");
    if (!source || !target) throw new Error("source and target are required");

    const srcAbs = resolveSafe(source);
    const tgtAbs = resolveSafe(target);

    if (!fs.existsSync(srcAbs) || !fs.statSync(srcAbs).isFile())
      throw new Error("Source file not found");
    if (fs.existsSync(tgtAbs))
      throw new Error("A file/folder with the target name already exists");

    fs.mkdirSync(path.dirname(tgtAbs), { recursive: true });
    fs.copyFileSync(srcAbs, tgtAbs);

    const dirRel = path.posix.dirname(target);
    res.redirect(
      `/?dir=${encodeURIComponent(
        dirRel === "." ? "" : dirRel
      )}&msg=${encodeURIComponent("File copied.")}`
    );
  } catch (e) {
    res.redirect(`/?err=${encodeURIComponent(e.message)}`);
  }
});

// 7) انتقال فایل (کپی بعدش حذف)
app.post("/files/move", (req, res) => {
  try {
    const source = (req.body.source || "").toString().replace(/\\/g, "/");
    const target = (req.body.target || "").toString().replace(/\\/g, "/");
    if (!source || !target) throw new Error("source and target are required");

    const srcAbs = resolveSafe(source);
    const tgtAbs = resolveSafe(target);

    if (!fs.existsSync(srcAbs) || !fs.statSync(srcAbs).isFile())
      throw new Error("Source file not found");
    if (fs.existsSync(tgtAbs))
      throw new Error("A file/folder with the target name already exists");

    fs.mkdirSync(path.dirname(tgtAbs), { recursive: true });
    fs.copyFileSync(srcAbs, tgtAbs);
    fs.unlinkSync(srcAbs);

    const dirRel = path.posix.dirname(target);
    res.redirect(
      `/?dir=${encodeURIComponent(
        dirRel === "." ? "" : dirRel
      )}&msg=${encodeURIComponent("File moved.")}`
    );
  } catch (e) {
    res.redirect(`/?err=${encodeURIComponent(e.message)}`);
  }
});

app.listen(PORT, () => {
  console.log(`File Manager running at http://localhost:${PORT}`);
});
