/* Makes the IDE screen work: pull-down menus, window controls, function keys, a Make
   dialog with live GitHub data, a DOS shell and an optional CRT effect.
   Without this script the page is the same, minus the toys. */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const h = (tag, props = {}, ...kids) => {
    const el = Object.assign(document.createElement(tag), props);
    el.append(...kids.filter((k) => k != null));
    return el;
  };
  // Storage can be blocked (private windows, site data off); everything works without it.
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const root = document.documentElement;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  root.classList.add("js");

  /* ---------- Socials: read from SOCIALS.DIR for the shell's SOCIALS command ---------- */

  // Read from SOCIALS.DIR, so the page is the one list: [name, handle, url].
  // Entries without a link (Discord, Epic Games) have no public profile pages.
  const socials = $$(".links li").map((li) => {
    const a = $("a", li);
    const name = (a || $(".nolink", li)).textContent;
    return [name, (a && a.dataset.handle) || "keasbeexd", a ? a.href : null];
  });

  /* ---------- Projects, read from the table ---------- */

  const projects = $$(".files tbody tr").map((row) => {
    const link = $(".name a", row);
    const href = link.getAttribute("href");
    const what = $(".what", row).cloneNode(true);
    $$("code", what).forEach((c) => c.remove());
    return {
      row,
      name: link.textContent,
      key: link.textContent.toLowerCase().replace(/[^a-z]/g, ""),
      url: link.href,
      repo: href.startsWith("/cloudroll") ? "cloudroll" : href.split("/").pop(),
      plugin: /^keasbeexd\./.test($(".what code", row)?.textContent || ""),
      runs: $(".runs", row).textContent,
      what: what.textContent.trim(),
    };
  });
  // DOS 8.3 file names: CLOUDROL.PAS, KEEPWELL.PAS ...
  const dosName = (p) => p.key.slice(0, 8).toUpperCase();
  const findProject = (arg) => {
    const k = arg.toLowerCase().replace(/\.(pas|exe|dir)$/, "").replace(/[^a-z]/g, "");
    return k && projects.find((p) => p.key.startsWith(k) || k.startsWith(dosName(p).toLowerCase()));
  };

  /* ---------- Live GitHub data ---------- */

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const ago = (iso) => {
    const s = (new Date(iso) - Date.now()) / 1000;
    for (const [unit, n] of [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]]) {
      if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit);
    }
    return "just now";
  };
  const CACHE = "keasbeexd.github.v1";
  let github = null; // { repo: { pushed, stars, version? } }

  async function loadGitHub() {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE));
      if (c && Date.now() - c.t < 30 * 60e3) return c.d;
    } catch {}
    const res = await fetch("https://api.github.com/users/keasbeexd/repos?per_page=100");
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const repos = await res.json();
    const d = {};
    await Promise.all(projects.map(async (p) => {
      const r = repos.find((x) => x.name === p.repo);
      if (!r) return;
      d[p.repo] = { pushed: r.pushed_at, stars: r.stargazers_count };
      if (!p.plugin) return;
      try {
        const m = await fetch(`https://raw.githubusercontent.com/keasbeexd/${p.repo}/${r.default_branch}/manifest.json`);
        if (m.ok) d[p.repo].version = (await m.json()).version;
      } catch {}
    }));
    try { sessionStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), d })); } catch {}
    return d;
  }

  const liveText = (p) => {
    const g = github && github[p.repo];
    if (!g) return "";
    const parts = [];
    if (g.version) parts.push(`v${g.version}`);
    parts.push(`updated ${ago(g.pushed)}`);
    if (g.stars) parts.push(`${g.stars} star${g.stars === 1 ? "" : "s"}`);
    return parts.join(" \u00b7 ");
  };

  const githubReady = loadGitHub().then((d) => {
    github = d;
    for (const p of projects) {
      const text = liveText(p);
      if (text) $(".what", p.row).append(h("span", { className: "live", textContent: text }));
    }
  }).catch(() => {});

  /* ---------- Windows ---------- */

  const wins = $$(".win");
  const title = (w) => $("h2", w).textContent;
  let active = $(".win.active") || wins[0];

  function activate(w, focus) {
    if (!w) return;
    w.hidden = false;
    wins.forEach((x) => x.classList.toggle("active", x === w));
    active = w;
    if (focus) {
      wins.forEach((x) => { if (x !== w) unzoom(x); });
      w.scrollIntoView({ block: "nearest", behavior: reduceMotion.matches ? "auto" : "smooth" });
      w.focus({ preventScroll: true });
    }
  }
  function closeWin(w) {
    if (!w) return;
    unzoom(w);
    w.hidden = true;
    activate(wins.find((x) => !x.hidden));
  }
  function zoom(w) {
    if (!w || w.hidden) return;
    if (w.classList.contains("zoomed")) return unzoom(w);
    root.style.setProperty("--bar-h", `${$(".menubar").getBoundingClientRect().bottom}px`);
    root.style.setProperty("--foot-h", `${$(".foot").offsetHeight}px`);
    w.classList.add("zoomed");
    activate(w, true);
  }
  function unzoom(w) { if (w) w.classList.remove("zoomed"); }
  function resetWindows() {
    wins.forEach((w) => { w.hidden = false; w.style.translate = ""; unzoom(w); });
    activate(wins[0]);
  }

  for (const w of wins) {
    w.tabIndex = -1;
    const close = h("button", { className: "wbox wclose", type: "button", ariaLabel: `Close ${title(w)}`, title: "Close (Alt+F3)", textContent: "[\u25a0]" });
    const zoomBox = h("button", { className: "wbox wzoom", type: "button", ariaLabel: `Zoom ${title(w)}`, title: "Zoom", textContent: "[\u2195]" });
    close.addEventListener("click", () => closeWin(w));
    zoomBox.addEventListener("click", () => zoom(w));
    w.prepend(close, zoomBox);
    w.addEventListener("pointerdown", () => activate(w));
    w.addEventListener("focusin", () => activate(w));

    // Drag by the title, on a mouse or trackpad
    const bar = $("h2", w);
    bar.addEventListener("dblclick", () => zoom(w));
    bar.addEventListener("pointerdown", (e) => {
      if (!finePointer.matches || e.button !== 0 || w.classList.contains("zoomed")) return;
      e.preventDefault();
      const [x0, y0] = (w.style.translate || "0px 0px").split(" ").map(parseFloat);
      const sx = e.clientX, sy = e.clientY;
      bar.setPointerCapture(e.pointerId);
      w.classList.add("dragging");
      const move = (ev) => { w.style.translate = `${x0 + ev.clientX - sx}px ${y0 + ev.clientY - sy}px`; };
      const up = () => {
        w.classList.remove("dragging");
        bar.removeEventListener("pointermove", move);
        bar.removeEventListener("pointerup", up);
        bar.removeEventListener("pointercancel", up);
      };
      bar.addEventListener("pointermove", move);
      bar.addEventListener("pointerup", up);
      bar.addEventListener("pointercancel", up);
    });
  }

  // File > About, Projects, Support and Socials open their window, even after it was closed
  function openWin(id) {
    activate(wins.find((x) => x.id === id), true);
    history.replaceState(null, "", `#${id}`);
  }

  /* ---------- Dialogs ---------- */

  function dialog(cls, heading, ...body) {
    const d = h("dialog", { className: `dlg ${cls}` }, h("h2", { textContent: heading }), ...body);
    d.addEventListener("close", () => d.remove());
    // A click on the backdrop closes it
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    document.body.append(d);
    d.showModal();
    return d;
  }
  const okButton = (d) => {
    const b = h("button", { className: "btn", type: "button" }, h("span", { className: "hot", textContent: "O" }), "K");
    b.addEventListener("click", () => d.close());
    return h("div", { className: "buttons" }, b);
  };

  function showHelp() {
    const rows = [
      ["F1", "This help"],
      ["F9", "Make: a pretend build that shows each project's latest GitHub info"],
      ["F10", "Menu bar"],
      ["Alt+F", "File menu"],
      ["Alt+C", "Compile menu"],
      ["Alt+W", "Window menu"],
      ["Alt+H", "Help menu"],
      ["Alt+F3", "Close the active window"],
      ["`", "DOS shell"],
      ["Esc", "Close a menu, dialog or zoom"],
    ];
    const dl = h("dl", { className: "keys-list" }, ...rows.flatMap(([k, v]) => [h("dt", { textContent: k }), h("dd", { textContent: v })]));
    const d = dialog("help", "Help", dl, h("p", { textContent: "Drag a window by its title. Double-click the title to zoom it." }));
    d.append(okButton(d));
    $("button", d.lastChild).focus();
  }

  async function make() {
    const log = h("pre", { className: "log", role: "log" });
    const status = h("span", { textContent: "KEASBEEX.PAS" });
    const count = h("span", { textContent: "0" });
    const done = h("p", { className: "done", hidden: true });
    const info = h("dl", { className: "make-info" },
      h("dt", { textContent: "Main file:" }), h("dd", { textContent: "KEASBEEX.PAS" }),
      h("dt", { textContent: "Compiling:" }), h("dd", {}, status),
      h("dt", { textContent: "Destination:" }), h("dd", { textContent: "GitHub Pages" }),
      h("dt", { textContent: "Units:" }), h("dd", {}, count, ` of ${projects.length}`),
      h("dt", { textContent: "Free memory:" }), h("dd", { textContent: "640K" }));
    const note = h("p", { className: "note", textContent: "Just for fun: nothing is compiled. The versions, dates and stars are real, read from GitHub." });
    const d = dialog("make", "Compiling", info, log, done, note);
    let open = true;
    d.addEventListener("close", () => { open = false; });
    const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion.matches ? 0 : ms));

    await Promise.race([githubReady, wait(1500)]);
    for (const [i, p] of projects.entries()) {
      if (!open) return;
      status.textContent = `${dosName(p)}.PAS`;
      count.textContent = i + 1;
      log.append(`${(dosName(p) + ".PAS").padEnd(14)}${p.runs.padEnd(9)}${liveText(p) || "(offline)"}\n`);
      await wait(320);
    }
    if (!open) return;
    status.textContent = "Done";
    done.hidden = false;
    done.append(h("strong", { textContent: "Make successful: " }), h("span", { className: "blink", textContent: "Press any key" }));
    // Any key closes it, as in the IDE
    const anyKey = (e) => { if (e.key !== "Tab") { e.preventDefault(); d.close(); } };
    d.addEventListener("keydown", anyKey);
  }

  function showAbout() {
    const d = dialog("help", "About",
      h("p", { textContent: "keasbeexd, version 2026.10" }),
      h("p", { textContent: "Plain HTML, CSS and one small script, served by GitHub Pages. Colors from keylimesoda's Turbo Pascal theme for Omarchy." }),
      h("p", { textContent: "No cookies, no tracking." }));
    d.append(okButton(d));
    $("button", d.lastChild).focus();
  }

  function showInfo() {
    // Real numbers from the browser's own timing data for this visit
    const nav = performance.getEntriesByType("navigation")[0];
    const res = performance.getEntriesByType("resource");
    const own = res.filter((e) => new URL(e.name).origin === location.origin);
    const size = [nav, ...own].reduce((n, e) => n + (e ? e.decodedBodySize || 0 : 0), 0);
    const cookies = document.cookie ? document.cookie.split(";").length : 0;
    const rows = [
      ["Site files", `${own.length + 1}, ${(size / 1024).toFixed(1)}K`],
      ["GitHub requests", `${res.length - own.length}, for live project info`],
      ["Load time", nav ? `${Math.round(nav.loadEventEnd || nav.domComplete)} ms` : "n/a"],
      ["Cookies", String(cookies)],
      ["Trackers", "none"],
    ];
    const dl = h("dl", { className: "keys-list" }, ...rows.flatMap(([k, v]) => [h("dt", { textContent: k }), h("dd", { textContent: v })]));
    const d = dialog("help", "Information", dl,
      h("p", { className: "note", textContent: "Measured by your browser for this visit. If GitHub info was cached earlier in this session, there are no GitHub requests." }));
    d.append(okButton(d));
    $("button", d.lastChild).focus();
  }

  /* ---------- CRT effect ---------- */

  function setCrt(on, animate) {
    root.classList.toggle("crt", on);
    store.set("keasbeexd.crt", on ? "1" : "0");
    if (on && animate && !reduceMotion.matches) {
      root.classList.remove("crt-on");
      void root.offsetWidth;
      root.classList.add("crt-on");
    }
    $$("[data-crt]").forEach((b) => b.setAttribute("aria-checked", String(on)));
  }
  // On by default; the menu or the shell's CRT command turns it off, and that sticks
  if (store.get("keasbeexd.crt") !== "0") root.classList.add("crt");

  /* ---------- DOS shell ---------- */

  function shell(initial) {
    const out = h("div", { className: "out", role: "log", ariaLive: "polite" });
    const input = h("input", { type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: false, ariaLabel: "Command" });
    const prompt = h("label", { className: "line" }, h("span", { textContent: "C:\\KEASBEEXD>" }), input);
    const d = dialog("shell", "DOS shell", out, prompt);
    const print = (...lines) => { out.append(...lines.map((l) => (typeof l === "string" ? h("div", { textContent: l || "\u00a0" }) : l))); d.scrollTop = d.scrollHeight; };
    const link = (text, href) => h("div", {}, h("a", { href, textContent: text }));
    const history = [];
    let hi = 0;

    print("Type HELP for a list of commands, EXIT to return to the IDE.", "");

    const cmds = {
      help: () => print(
        "DIR             List projects",
        "TYPE <name>     Show what a project does (TYPE ABOUT.PAS for me)",
        "CD <name>       Open a project's page",
        "SOCIALS         Where else to find me",
        "SPONSOR, KOFI   Support my work",
        "MAKE            Pretend build with live GitHub info",
        "CRT             Turn the CRT effect on or off",
        "VER, DATE, CLS, WHOAMI, ECHO, EXIT"),
      dir: () => {
        print(" Directory of C:\\KEASBEEXD", "");
        for (const p of projects) {
          const g = github && github[p.repo];
          const date = g ? new Date(g.pushed).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }) : "        ";
          print(`${dosName(p).padEnd(9)}PAS  ${p.runs.padEnd(8)}${date}  ${p.name}`);
        }
        print(`${String(projects.length).padStart(9)} file(s)`, "");
      },
      type: (arg) => {
        if (/^about/i.test(arg)) return print($(".about .comment").textContent.replace(/[{}]/g, "").trim().replace(/\s+/g, " "), "");
        if (/^support/i.test(arg)) return print($(".support .text").textContent.trim(), "");
        if (/^socials/i.test(arg)) return cmds.socials();
        const p = findProject(arg);
        if (!p) return print(arg ? "File not found" : "Required parameter missing", "");
        print(`${p.name} (${p.runs})`, p.what);
        const live = liveText(p);
        if (live) print(live);
        print(link(p.url.replace(/^https?:\/\//, ""), p.url), "");
      },
      cd: (arg) => {
        const p = findProject(arg);
        if (!p) return print(arg ? "Invalid directory" : "C:\\KEASBEEXD", "");
        print(`Opening ${p.name}...`);
        location.href = p.url;
      },
      socials: () => {
        for (const [name, handle, url] of socials) {
          print(url ? h("div", {}, `${name.padEnd(12)}`, h("a", { href: url, textContent: handle })) : `${name.padEnd(12)}${handle}`);
        }
        print("");
      },
      sponsor: () => { print("Opening GitHub Sponsors..."); location.href = "https://github.com/sponsors/keasbeexd"; },
      kofi: () => { print("Opening Ko-fi..."); location.href = "https://ko-fi.com/keasbeexd"; },
      make: () => { d.close(); make(); },
      crt: () => { setCrt(!root.classList.contains("crt"), true); print(`CRT effect ${root.classList.contains("crt") ? "on" : "off"}.`, ""); },
      ver: () => print("", "keasbeexd site version 2026.10, plain HTML with one small script.", ""),
      date: () => print(`Current date is ${new Date().toDateString()}`, ""),
      time: () => print(`Current time is ${new Date().toLocaleTimeString()}`, ""),
      cls: () => out.replaceChildren(),
      whoami: () => print("keasbeexd", ""),
      echo: (arg) => print(arg || "ECHO is on.", ""),
      sudo: () => print("keasbeexd is not in the sudoers file. This incident will be reported.", ""),
      semper: () => print("Fi.", ""),
      exit: () => d.close(),
    };
    Object.assign(cmds, { ls: cmds.dir, cat: cmds.type, open: cmds.cd, clear: cmds.cls, "ko-fi": cmds.kofi, quit: cmds.exit });

    function run(line) {
      print(`C:\\KEASBEEXD>${line}`);
      if (!line) return;
      history.push(line);
      hi = history.length;
      const [cmd, ...rest] = line.split(/\s+/);
      const fn = cmds[cmd.toLowerCase()];
      fn ? fn(rest.join(" ")) : print("Bad command or file name", "");
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const line = input.value.trim();
        input.value = "";
        run(line);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        hi = Math.max(0, Math.min(history.length, hi + (e.key === "ArrowUp" ? -1 : 1)));
        input.value = history[hi] || "";
      } else if (e.key === "Tab") {
        // Complete a project name
        const m = input.value.match(/^(\S+\s+)(\S*)$/);
        const p = m && m[2] && projects.find((x) => dosName(x).toLowerCase().startsWith(m[2].toLowerCase()));
        if (p) { e.preventDefault(); input.value = m[1] + dosName(p); }
      }
    });
    d.addEventListener("click", () => { if (!getSelection().toString()) input.focus(); });
    if (initial) run(initial);
    input.focus();
  }

  /* ---------- Menus ---------- */

  const menubar = $(".menubar");
  const menuDefs = [
    { id: "sys", label: [h("span", { textContent: "\u2261" })], aria: "System", items: () => [
      ["About this site...", "", showAbout],
      ["CRT effect", "", () => setCrt(!root.classList.contains("crt"), true), "crt"],
    ] },
    // A string in place of a function is a link
    { id: "file", key: "f", label: [h("span", { className: "hot", textContent: "F" }), "ile"], items: () => [
      ["About", "", () => openWin("about")],
      ["Projects", "", () => openWin("projects")],
      ["Support", "", () => openWin("support")],
      ["Socials", "", () => openWin("socials")],
      "-",
      ["DOS shell", "`", () => shell()],
    ] },
    { id: "compile", key: "c", label: [h("span", { className: "hot", textContent: "C" }), "ompile"], items: () => [
      ["Make", "F9", make],
      ["Information...", "", showInfo],
    ] },
    { id: "window", key: "w", label: [h("span", { className: "hot", textContent: "W" }), "indow"], items: () => [
      ...[...wins].sort((x, y) => x.dataset.n - y.dataset.n).map((w) => [`${w.dataset.n} ${title(w)}`, w.hidden ? "closed" : "", () => activate(w, true)]),
      "-",
      ["Zoom", "", () => zoom(active)],
      ["Close", "Alt+F3", () => closeWin(active)],
      ["Reset windows", "", resetWindows],
    ] },
    { id: "help", key: "h", label: [h("span", { className: "hot", textContent: "H" }), "elp"], items: () => [
      ["Keyboard help", "F1", showHelp],
      ["Shell commands", "", () => shell("help")],
    ] },
  ];
  let openMenu = null;

  function buildMenu(def) {
    const btn = h("button", { type: "button", className: "mbtn", ariaHasPopup: "menu", ariaExpanded: "false" }, ...def.label);
    if (def.aria) btn.ariaLabel = def.aria;
    const list = h("div", { className: "menu", role: "menu", hidden: true });
    const wrap = h("span", { className: "mb" }, btn, list);
    def.btn = btn;
    def.list = list;

    def.open = (focusFirst) => {
      if (openMenu && openMenu !== def) openMenu.close();
      list.replaceChildren(...def.items().map((it) => {
        if (it === "-") return h("hr", { role: "separator" });
        const [text, keys, fn, flag] = it;
        const label = [h("span", { textContent: text }), h("span", { className: "k", textContent: keys })];
        const item = typeof fn === "string"
          ? h("a", { href: fn, role: "menuitem", className: "mitem" }, ...label)
          : h("button", { type: "button", role: flag ? "menuitemcheckbox" : "menuitem", className: "mitem" }, ...label);
        if (flag === "crt") { item.dataset.crt = ""; item.setAttribute("aria-checked", String(root.classList.contains("crt"))); }
        item.addEventListener("click", () => { def.close(); if (typeof fn === "function") fn(); });
        return item;
      }));
      list.hidden = false;
      btn.ariaExpanded = "true";
      openMenu = def;
      if (focusFirst) $(".mitem", list).focus();
    };
    def.close = (refocus) => {
      list.hidden = true;
      btn.ariaExpanded = "false";
      if (openMenu === def) openMenu = null;
      if (refocus) btn.focus();
    };
    btn.addEventListener("click", () => (openMenu === def ? def.close() : def.open(false)));
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") { e.preventDefault(); def.open(true); }
    });
    // Switch menus by hovering while one is open, like a desktop menu bar
    btn.addEventListener("pointerenter", () => { if (openMenu && openMenu !== def && finePointer.matches) def.open(false); });
    list.addEventListener("keydown", (e) => {
      const items = $$(".mitem", list);
      const i = items.indexOf(document.activeElement);
      const go = (n) => items[(n + items.length) % items.length].focus();
      const side = (dir) => { const j = menuDefs.indexOf(def); menuDefs[(j + dir + menuDefs.length) % menuDefs.length].open(true); };
      if (e.key === "ArrowDown") go(i + 1);
      else if (e.key === "ArrowUp") go(i - 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(-1);
      else if (e.key === "ArrowRight") side(1);
      else if (e.key === "ArrowLeft") side(-1);
      else if (e.key === "Escape") def.close(true);
      else if (e.key === "Tab") def.close();
      else return;
      e.preventDefault();
      e.stopPropagation();
    });
    return wrap;
  }

  // The plain links stay for visitors without the script; with it, they live in File
  $$("a", menubar).forEach((a) => a.remove());
  $(".sys", menubar).replaceWith(buildMenu(menuDefs[0]));
  $(".who", menubar).before(...menuDefs.slice(1).map(buildMenu));
  document.addEventListener("pointerdown", (e) => { if (openMenu && !e.target.closest(".mb")) openMenu.close(); });

  /* ---------- Status line ---------- */

  const keys = h("span", { className: "keys" });
  for (const [k, label, fn] of [["F1", "Help", showHelp], ["F9", "Make", make], ["F10", "Menu", () => menuDefs[1].open(true)], ["`", "Shell", () => shell()]]) {
    const b = h("button", { type: "button" }, h("span", { className: "hot", textContent: k }), ` ${label}`);
    b.addEventListener("click", fn);
    keys.append(b);
  }
  $(".foot").prepend(keys);

  /* ---------- Keyboard ---------- */

  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || $("dialog[open]")) return;
    const typing = e.target.closest("input, textarea, select, [contenteditable]");
    const k = e.key;
    if (k === "F1") { e.preventDefault(); showHelp(); }
    else if (k === "F9" && !e.ctrlKey) { e.preventDefault(); make(); }
    else if (k === "F10") { e.preventDefault(); openMenu ? openMenu.close(true) : menuDefs[1].open(true); }
    else if (k === "F3" && e.altKey) { e.preventDefault(); closeWin(active); }
    else if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const def = menuDefs.find((m) => m.key && m.key === k.toLowerCase());
      if (def) { e.preventDefault(); def.open(true); }
    }
    else if (k === "`" && !typing && !e.ctrlKey && !e.metaKey) { e.preventDefault(); shell(); }
    else if (k === "Escape") {
      if (openMenu) openMenu.close(true);
      else if (active && active.classList.contains("zoomed")) unzoom(active);
    }
  });
})();
