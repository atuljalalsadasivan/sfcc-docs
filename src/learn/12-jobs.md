id: jobs
title: Jobs, import/export and replication
icon: refresh
time: 8|4|20
summary: The job framework, custom steps (task and chunk), IMPEX and WebDAV, and how data reaches production.
source: Salesforce developers: Create custom job step types | https://developer.salesforce.com/docs/commerce/sfra/guide/b2c-custom-job-steps.html
source: Trailhead: Create custom job steps | https://trailhead.salesforce.com/content/learn/modules/b2c-admin-create-and-manage-jobs/b2c-admin-create-custom-job-steps
source: Trailhead: System job steps | https://trailhead.salesforce.com/content/learn/modules/b2c-admin-create-and-manage-jobs/b2c-admin-explore-system-job-steps

=== easy
A **job** is a background task SFCC runs on a schedule or on demand: importing prices every night, exporting orders every 15 minutes, rebuilding the search index.

A job is made of **steps**. Some are ready-made (**system steps** like ImportCatalog), and some you write yourself (**custom steps**).

Custom steps come in two styles:
- **Task-oriented:** one function does the whole job. Simple.
- **Chunk-oriented:** read one item, process it, and write items in batches (chunks). Best for thousands of products or orders, and shows progress.

Files to import go into a server folder called **IMPEX** (usually `IMPEX/src`), uploaded with **WebDAV** or SFTP.

=== crash
- Jobs: Administration › Operations › Jobs. Flows (sequential or parallel sibling flows), schedules, triggers, failure handling, job resources (locks), job history.
- Scope: **organization** or **site** context per step.
- Custom steps: CommonJS module + **steptypes.json** in the cartridge **root** (one per cartridge), cartridge on the path of the Business Manager site / job context.
- Task-oriented: `"module": "...", "function": "execute"`; returns `dw.system.Status`; can define custom exit statuses.
- Chunk-oriented: `read-function`, `process-function`, `write-function`, optional `before-step-function`, `after-step-function`, `total-count-function`, `before-chunk-function`, `after-chunk-function`; `chunk-size`. `read` returns one item or nothing; `process` returns item or nothing (filters); `write` gets a list. Finishes OK or ERROR only (no custom exit status).
- Step parameters defined in steptypes.json (`@type`, `@required`, `enum-values`…), read via `parameters.Name`.
- File paths: `File.IMPEX + '/src/…'`, `dw.io.File`, readers/writers (`XMLStreamWriter`, `CSVStreamWriter`).
- System steps: ImportCatalog, ImportPriceBook, ImportInventoryLists, ImportSiteArchive, SearchReindex, ExportOrders, SiteExport, Execute/Undo replication processes, IncludeStepsFromJob.
- Replication: staging → development/production; data or code; transfer + publish; scheduled or as job step.

=== standard
## steptypes.json
```json
{
  "step-types": {
    "script-module-step": [{
      "@type-id": "custom.ExportNewsletter",
      "@supports-site-context": "true",
      "@supports-organization-context": "false",
      "module": "int_newsletter/cartridge/scripts/steps/exportNewsletter.js",
      "function": "execute",
      "parameters": { "parameter": [ { "@name": "FileName", "@type": "string", "@required": "true" } ] },
      "status-codes": { "status": [ { "@code": "OK" }, { "@code": "ERROR" }, { "@code": "NO_DATA" } ] }
    }],
    "chunk-script-module-step": [{
      "@type-id": "custom.DeactivateOldProducts",
      "@supports-site-context": "true",
      "@supports-organization-context": "false",
      "module": "app_custom/cartridge/scripts/steps/deactivate.js",
      "before-step-function": "beforeStep",
      "read-function": "read",
      "process-function": "process",
      "write-function": "write",
      "after-step-function": "afterStep",
      "total-count-function": "getTotalCount",
      "chunk-size": 100
    }]
  }
}
```
Only one steptypes.json (or steptypes.xml) per cartridge, in its root. Errors in it are logged and the steps are not registered.

## Chunk module
```js
var ProductMgr = require('dw/catalog/ProductMgr');
var Transaction = require('dw/system/Transaction');
var products;
exports.beforeStep = function (params, stepExecution) { products = ProductMgr.queryAllSiteProducts(); };
exports.getTotalCount = function () { return products.count; };
exports.read = function () { return products.hasNext() ? products.next() : undefined; };
exports.process = function (p) { return isOld(p) ? p : undefined; };     // undefined = skip
exports.write = function (lines) {
    Transaction.wrap(function () { lines.toArray().forEach(function (p) { p.setOnlineFlag(false); }); });
};
exports.afterStep = function (success) { products.close(); };
```
Each chunk is written (and committed) separately, so one failure doesn't roll back hours of work, and progress is visible in job history.

## Task module
```js
var Status = require('dw/system/Status');
exports.execute = function (params, stepExecution) {
    var file = new (require('dw/io/File'))(require('dw/io/File').IMPEX + '/src/newsletter/' + params.FileName);
    // … write CSV …
    return new Status(Status.OK);         // or new Status(Status.OK, 'NO_DATA')
};
```

## Files: IMPEX and WebDAV
- WebDAV root folders: Impex (`/on/demandware.servlet/webdav/Sites/Impex`), Cartridges, Logs, Catalogs, Libraries, Static.
- Imports read from `IMPEX/src/...`; system steps archive processed files.
- Use streaming readers/writers for big files; don't read whole files into memory.

## Replication
Data and code are replicated from staging. Configure processes in Administration › Replication (data or code), pick tasks (global and site), choose transfer and publish, run now, schedule, or call from a job with ExecutePreconfiguredDataReplicationProcess.

=== notes
- Use chunk-oriented steps for large data sets: smaller transactions, progress, restartability.
- Put steptypes.json in the cartridge root and the cartridge on the right cartridge path.
- Close iterators (`SeekableIterator.close()`) when done.

=== q basic top
What is the difference between task-oriented and chunk-oriented job steps?
---
A task step runs one `execute` function for the whole work. A chunk step reads, processes and writes items in batches of a set size, which suits large data, gives progress tracking and commits per chunk.

=== q basic top
Where do you define custom job steps?
---
In steptypes.json (or steptypes.xml) in the root of a cartridge: step type ID, module, functions, parameters, contexts and status codes.

=== q mid top
What functions does a chunk-oriented step module provide?
---
Required read, process and write; optional beforeStep, afterStep, getTotalCount, beforeChunk and afterChunk. read returns the next item or nothing, process transforms or filters, write receives the chunk's list.

=== q mid
Can a chunk step return a custom exit status?
---
No, chunk-oriented steps end with OK or ERROR. Use a task-oriented step if you need custom exit codes for flow control.

=== q mid
How do files get into an import job?
---
External systems upload them via WebDAV or SFTP into IMPEX/src (a subfolder per feed), and the job step reads them from there with a file name pattern.

=== q adv
A nightly job updating 300 000 products takes hours and sometimes fails at the end, losing all work. Fix it.
---
Convert it to a chunk-oriented step with a sensible chunk size so each chunk commits separately; stream input; avoid per-item expensive lookups; close iterators; consider splitting by site or category in parallel flows; and use system import steps if it's plain data loading.

=== p easy
Pick a step
---
You need to load a price book XML every night from IMPEX/src/prices. Custom or system step?
---
**System step ImportPriceBook**, with WorkingFolder `prices`, a FileNamePattern and Merge mode. No code needed.

=== p std
Write the steptypes entry
---
Register a task step `custom.CleanSignups` (deletes old newsletter sign-up objects) with an integer parameter `Days`, site context only.
---
```json
{ "step-types": { "script-module-step": [ {
  "@type-id": "custom.CleanSignups",
  "@supports-site-context": "true",
  "@supports-organization-context": "false",
  "module": "app_custom/cartridge/scripts/steps/cleanSignups.js",
  "function": "execute",
  "parameters": { "parameter": [ { "@name": "Days", "@type": "long", "@required": "true" } ] }
} ] } }
```
