# Muhammad Ghufran | Portfolio & Blog System

A personal portfolio built on Astro.js using a responsive, high-contrast Navy and Gold design system, now equipped with a SQLite-backed blog CMS and a separate Express administration dashboard.

## System Ports & Stack

* **Public Portfolio**: Astro.js running on `http://localhost:4321/`
* **Admin CMS Panel**: Node.js + Express running on `http://localhost:3001/`
* **Shared Database**: SQLite database file located at `data/blog.db`
* **Shared Uploads**: Dynamic covers and inline images stored inside `public/uploads/`

---

## Step-by-Step Launch Instructions

To get the entire stack running from scratch, follow these steps in order:

### Step 1: Initialize the Database
Open a terminal in the project root and run the DB build script:
```bash
node scripts/init-db.js
```
*This creates the SQLite data folder, builds the posts schema, and seeds a sample post.*

### Step 2: Start the Admin Panel
Open a separate terminal window, navigate to the `admin-panel/` directory, and run the developer command:
```bash
cd admin-panel
npm run dev
```
*Starts the CMS dashboard on `http://localhost:3001/`. Sign in using:*
* **Username**: `ghufran`
* **Password**: `ghufran-systems-2026`

### Step 3: Start the Astro Frontend
Open another terminal window at the project root and run the dev server:
```bash
npm run dev
```
*Starts the public portfolio on `http://localhost:4321/`. Click 'Blog' in the navigation bar to see the published posts.*

---

## Technical Features

* **Hybrid SSR Rendering**: Astro is configured with `output: 'hybrid'` and the `@astrojs/node` adapter. Static sections (About, Services, Journey, Projects) remain fully prerendered for SEO performance, while `/blog` and `/blog/[slug]` render dynamically on the server from SQLite.
* **Built-in Database Engine**: Utilizes Node's native `node:sqlite` module (available in Node.js 22.5+ / 24+), bypassing any native compilation C++ errors or peer conflicts.
* **TipTap Integration**: The EJS post editor loads TipTap dynamically using ESM browser modules, supporting heading tools, links, blockquotes, code markup, and inline image uploads.
* **Underline Growth Hover Effects**: Public links and navbar items animate using custom left-to-right CSS underlines.
* **Clean Git Repository**: `.gitignore` is configured to ignore local database binaries, environment configurations, and uploaded cover/inline media assets while keeping the folder skeletons.
