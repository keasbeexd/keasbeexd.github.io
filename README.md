# keasbeexd.github.io

Personal site, served by GitHub Pages: the home page, and Cloudroll's page, privacy policy and support page. Plain HTML and CSS with two small scripts, no build step and no libraries: `assets/ide.js` makes the home page's IDE work (File, Compile, Window and Help menus, windows, F-keys, Make with live GitHub data, a DOS shell, a CRT effect that is on by default) and `cloudroll/demo.js` drives the phone mockup on the Cloudroll page. Both pages read fine without them.

CSS and JS are linked with a `?v=` stamp so a page and its assets update together (GitHub Pages lets browsers cache each file for 10 minutes). After changing a `.css` or `.js` file, bump the stamp in every page that links it.
