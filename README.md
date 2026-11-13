# SFCC Docs

An offline reference and study app for Salesforce B2C Commerce (SFCC) in a single HTML file. Open `SFCC Docs.html` in Chrome or Edge. It doesn't include any Salesforce material; it reads the official files you put in your own docs folder.

## How it works

Open `SFCC Docs.html` in Chrome or Edge and pick a **docs folder**. Keep this separate from your notes folder. The app ships with no Salesforce content; it reads the official files you put in that folder.

- **Schemas:** put the official `.xsd` files, or the schema `.zip` (read without unpacking), in the folder. They're grouped by area (catalog and pricing, promotions, customers, site configuration, metadata…). Each schema shows:
  - the element tree **in the required order**, with numbers
  - required / optional / repeatable for every element
  - attributes, allowed values, length limits and patterns, in plain words
  - the schema's own documentation notes, and deprecated items struck through
  - every type, with **Used by** to see where it's used
  - the highlighted source
- **XML skeleton:** builds an empty example file for any schema, either required elements only or every element, in the correct order. Copy or download it. Checked against all 20 schemas you sent: all 76 skeletons validate.
- **Versions:** put each release in its own subfolder (for example `26.1`, `26.2`) and switch between them on the schema page.
- **Script API:** save a class page from the official site with Ctrl/Cmd+S ("Webpage, HTML only") into the folder. It's grouped by package (`dw.catalog`…) and shown as clean text with a table of contents. Scripts, images and outside links are removed; links to other saved pages work.
- **Guides:** 7 built-in guides, written by Claude in its own words (not copied from Salesforce or Trailhead), each listing its official sources to read more:
  - import modes
  - where each file is imported, and the job steps
  - catalogs
  - price books
  - campaigns, promotions and coupons
  - replication
  - a pre-import checklist

  Your own `.md` or `.txt` files appear under Guides too.
- **Search** (press `/`) across element names, types, allowed values, documentation, Script API pages and their sections, guides and notes.
- **Bookmarks** (star on any page) are saved in `.sfcc-docs.json` in the docs folder. **Notes** are Markdown files in `Notes/`.
- **Official links** are shown as text with Copy buttons, never as live links, because the app doesn't go online.

### Look, badges and source of content
- Opens in **dark mode** by default (sun button switches to light; Folder Viewer and Compare keep their own setting).
- Every page carries a badge:
  - **Official:** an unchanged Salesforce file you added.
  - **Rephrased by Claude:** built-in guides and Learn SFCC lessons, written in Claude's own words and not official.
  - **Generated from schema:** XML skeletons.
  - **Your entry / Your file:** your own content.

### Learn SFCC
- 18 topics, from platform basics to an interview playbook, with 112 interview questions and answers and 37 worked problems.
- **One learning-mode switch** (Easy, Crash course, Standard) changes how every topic is shown:
  - **Easy:** plain explanations and beginner questions.
  - **Crash course:** must-know points and the most-asked questions.
  - **Standard:** full lessons with code, important notes, every question and all problems.
- Answers stay hidden until you tap Show. "I know this" and "Mark topic as done" track progress (saved in `.sfcc-docs.json`). **Practice questions** shows random questions, unknown ones first.
- Each topic lists its sources (Trailhead, Salesforce developer docs) as copyable text.

### My entries
On any topic (or General) add an interview question with answer, a feature you built, a test case, a code snippet or a note. Code can be pasted or loaded from a file. Saved as Markdown in `My learning/<topic>/`. Practice includes your own questions.

### Requests (report or request more)
- **Report or request more** on every Learn topic, on Learn SFCC itself and on every guide opens a text box.
- Pick a kind: add more on this, more interview questions, wrong or unclear, or other. The page and learning mode are recorded automatically.
- The **Requests** page (side menu) lists them with Open, Done and All filters. You can edit, copy one, mark as done or delete.
- **Copy** or **Download** all open requests as one ready-to-paste list, for example to ask Claude to add the content.
- Stored in `.sfcc-docs.json` in the docs folder.

### Solution notes (renamable section)
- One folder per feature you built: `Solution notes/<name>/note.md` plus `code/`.
- Sections: requirement, approach, tests, outcome and talking points.
- Upload code files, create, **edit** (code editor with line numbers, Tab indenting, Ctrl/Cmd+S), rename or remove them.
- Each file shows lines, size, language, date, functions/routes and `require`s.
- **Export** one note or all of them as one Markdown file or JSON, choosing the sections, with an option to **remove code comments**. Single files can also be downloaded as they are or without comments.
- Rename the section from its page; only the menu label changes.

## Security (for IT review)

- **No network access.** The file carries a Content-Security-Policy (`default-src 'none'`) that makes the browser block every network request. There are no CDNs, fonts, analytics or update checks.
- **No installation, no server, no third-party code.** Plain HTML, CSS and JavaScript, all inside the file, readable in any text editor.
- **No AI**, and no data is sent anywhere.
- **Reads only the folder you pick.** Saved web pages are turned into plain text: their scripts never run, and their images and outside links are dropped. Salesforce addresses are shown as copyable text, not links.
- **Built-in guides and lessons** are summaries written by Claude in its own words (marked "Rephrased by Claude"), not copied Salesforce text.
- **The code contains no company or client data.**

## Building from source

The HTML file is generated from `src/` with Python 3 (no packages needed):

```
python3 build.py
```

This repository has no GitHub Actions workflows, so pushing doesn't run any builds.

Never commit your docs folder (it holds your notes, entries and downloaded Salesforce files).
