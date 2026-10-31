/* The phone mockup on Cloudroll's page: tabs, a tab bar that shrinks while you scroll
   down, the timeline source menu, a slight tilt toward the pointer and, in Chromium,
   refraction at the edges of the glass. Without it the mockup is a static timeline. */
(() => {
  "use strict";

  const phone = document.querySelector(".demo .phone");
  if (!phone) return;
  const $ = (s, el = phone) => el.querySelector(s);
  const $$ = (s, el = phone) => [...el.querySelectorAll(s)];
  const screen = $(".screen");
  const scroller = $(".scroller");
  const tabbar = $(".tabbar");
  const tabs = $$(".tabbar button");
  const title = $(".pill .title");
  const source = $(".source");
  const menu = $(".source-menu");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

  /* ---------- Tabs ---------- */

  const scrollPos = {};
  let lastY = 0;

  function setCompact(on) { screen.classList.toggle("compact", on); }

  function selectTab(btn) {
    const cur = $("[aria-current]", tabbar);
    if (btn === cur) {
      // Like iOS: a tap on the current tab expands the bar, a second one scrolls to the top
      if (screen.classList.contains("compact")) setCompact(false);
      else scroller.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
      return;
    }
    scrollPos[cur.dataset.tab] = scroller.scrollTop;
    cur.removeAttribute("aria-current");
    btn.setAttribute("aria-current", "page");
    tabbar.style.setProperty("--i", tabs.indexOf(btn));
    $$(".panel").forEach((p) => { p.hidden = p.dataset.panel !== btn.dataset.tab; });
    title.textContent = btn.textContent.trim();
    scroller.scrollTop = lastY = scrollPos[btn.dataset.tab] || 0;
    setCompact(false);
  }
  tabs.forEach((b) => b.addEventListener("click", () => selectTab(b)));

  scroller.addEventListener("scroll", () => {
    const y = scroller.scrollTop;
    if (y > lastY + 4 && y > 60) setCompact(true);
    else if (y < lastY - 4 || y < 30) setCompact(false);
    lastY = y;
    closeMenu();
  }, { passive: true });

  /* ---------- Timeline source ---------- */

  const sourceTitles = { all: "All photos", cloud: "Nextcloud only", phone: "This iPhone only" };

  function openMenu() {
    menu.hidden = false;
    source.setAttribute("aria-expanded", "true");
    $("[aria-checked='true']", menu).focus();
  }
  function closeMenu(refocus) {
    if (menu.hidden) return;
    menu.hidden = true;
    source.setAttribute("aria-expanded", "false");
    if (refocus) source.focus();
  }
  function setSource(f) {
    $$("button", menu).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.source === f)));
    $("use", source).setAttribute("href", `#i-${f === "all" ? "all" : f}`);
    source.classList.toggle("filtered", f !== "all");
    source.setAttribute("aria-label", `Timeline shows ${sourceTitles[f]}`);
    // Photos on both the phone and the server show in every view
    $$(".ph").forEach((ph) => { ph.hidden = !(f === "all" || ph.dataset.src === f || ph.dataset.src === "both"); });
    $$(".day").forEach((d) => { d.hidden = !$$(".ph", d).some((ph) => !ph.hidden); });
  }

  source.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu(true)));
  $$("button", menu).forEach((b) => b.addEventListener("click", () => {
    setSource(b.dataset.source);
    closeMenu(true);
    if ($("[aria-current]", tabbar).dataset.tab !== "timeline") selectTab(tabs[0]);
  }));
  menu.addEventListener("keydown", (e) => {
    const items = $$("button", menu);
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") items[(i + 1) % items.length].focus();
    else if (e.key === "ArrowUp") items[(i - 1 + items.length) % items.length].focus();
    else if (e.key === "Escape") closeMenu(true);
    else return;
    e.preventDefault();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".source-menu, .source")) closeMenu();
  });

  /* ---------- Tilt toward the pointer ---------- */

  const demo = phone.closest(".demo");
  demo.addEventListener("pointermove", (e) => {
    if (!finePointer.matches || reduceMotion.matches) return;
    const r = phone.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 1.5)));
    const y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height)));
    phone.classList.add("tracking");
    phone.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
    phone.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
  });
  demo.addEventListener("pointerleave", () => {
    phone.classList.remove("tracking");
    phone.style.removeProperty("--ry");
    phone.style.removeProperty("--rx");
  });

  /* ---------- Refraction (Chromium only) ---------- */

  // Only Chromium applies SVG filters in backdrop-filter; elsewhere the declaration
  // would drop the blur too, so the glass keeps its plain CSS blur.
  const chromium = navigator.userAgentData && navigator.userAgentData.brands.some((b) => b.brand === "Chromium");
  if (!chromium) return;

  const NS = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(NS, "svg");
  defs.setAttribute("aria-hidden", "true");
  defs.style.cssText = "position:absolute;width:0;height:0";
  document.body.append(defs);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Displacement map for a capsule: neutral grey in the middle, pushing outward along
  // the edge normal near the rim, so the glass bends what is behind its edges.
  function capsuleMap(w, h) {
    canvas.width = w;
    canvas.height = h;
    const img = ctx.createImageData(w, h);
    const r = Math.min(w, h) / 2;
    const bezel = Math.min(r * 0.9, 16);
    const horizontal = w >= h;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x + 0.5, py = y + 0.5;
        const cx = horizontal ? Math.max(r, Math.min(w - r, px)) : r;
        const cy = horizontal ? r : Math.max(r, Math.min(h - r, py));
        const vx = px - cx, vy = py - cy;
        const len = Math.hypot(vx, vy) || 1;
        const depth = r - len;
        let dx = 0, dy = 0;
        if (depth < bezel) {
          const t = 1 - Math.max(0, depth) / bezel;
          const mag = t * t;
          dx = (vx / len) * mag;
          dy = (vy / len) * mag;
        }
        const i = (y * w + x) * 4;
        img.data[i] = 128 + dx * 127;
        img.data[i + 1] = 128 + dy * 127;
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }

  $$("[data-glass]").forEach((el, n) => {
    const id = `cr-glass-${n}`;
    const filter = document.createElementNS(NS, "filter");
    filter.id = id;
    for (const [k, v] of Object.entries({ x: 0, y: 0, filterUnits: "userSpaceOnUse", primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" })) filter.setAttribute(k, v);
    filter.innerHTML = `<feImage x="0" y="0" preserveAspectRatio="none" result="map"/>
      <feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" result="bent"/>
      <feGaussianBlur in="bent" stdDeviation="3" result="soft"/>
      <feColorMatrix in="soft" type="saturate" values="1.8"/>`;
    defs.append(filter);
    const image = filter.querySelector("feImage");
    const disp = filter.querySelector("feDisplacementMap");
    let size = "";

    new ResizeObserver(() => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (!w || !h || `${w}x${h}` === size) return;
      size = `${w}x${h}`;
      filter.setAttribute("width", w);
      filter.setAttribute("height", h);
      image.setAttribute("width", w);
      image.setAttribute("height", h);
      image.setAttribute("href", capsuleMap(w, h));
      disp.setAttribute("scale", Math.min(36, Math.min(w, h) / 2));
      el.style.backdropFilter = `url(#${id})`;
    }).observe(el);
  });
})();
