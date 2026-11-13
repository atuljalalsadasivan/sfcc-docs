id: platform
title: Platform and architecture
icon: world
time: 8|5|20
summary: Realms, instances, sites, Business Manager and how code and data move.
source: Trailhead: Architecture of B2C Commerce (configuration) | https://trailhead.salesforce.com/content/learn/modules/architecture-of-commerce-cloud-digital/cc-digital-configuration
source: Trailhead: Explore continuous integration | https://trailhead.salesforce.com/content/learn/modules/b2c-build-processes-and-tests-for-technical-architects/b2c-explore-continuous-integration

=== easy
**SFCC (Salesforce B2C Commerce)** is a hosted platform for online shops. Salesforce runs the servers; you write the shop's code and manage its data.

Think of it like a **shopping mall that Salesforce owns**:
- The **realm** is your whole rented building.
- Inside it are several **instances**, like separate floors: one where developers build (sandbox), one where the shop team prepares products and prices (staging), one for final testing (development), and the real shop customers visit (production).
- Each instance can run several **sites** (shops), for example one per country or brand.
- **Business Manager** is the back-office web screen where you manage products, prices, promotions and settings.

Code goes from a developer's computer to a sandbox to try it, then to staging. From staging, both code and data are copied ("replicated") to production.

**Key words**
- **Realm:** everything one customer gets from Salesforce.
- **Instance:** one environment (sandbox, staging, development, production).
- **Site:** one storefront.
- **Business Manager (BM):** the admin tool.
- **Replication:** copying data or code from staging to development or production.

=== crash
- A **realm** = one customer's full setup. It has one **PIG** (primary instance group: staging, development, production) and one **SIG** (secondary group: sandboxes).
- **Staging** = where merchants edit data and where code is uploaded for release. Replication runs **from staging** to development or production.
- **Development** = test new code with real-like data before production.
- **Production** = live shop, behind the CDN.
- **Sandboxes** (on-demand sandboxes, ODS) = personal dev environments, created by API, most system jobs off.
- **Organization** = all sites on an instance. Some data is **organization-wide** (catalogs, price books, customer lists); some is **site-specific** (campaigns, content, site preferences).
- Sites in the same realm can share catalogs; different realms can't share data except by export/import.
- Code is uploaded as **code versions**; one version is **active** per instance.
- Uploading code to staging needs **two-factor authentication** with a client certificate.

=== standard
## Realm and instance groups
A **realm** is the top-level unit Salesforce provisions for a merchant: servers, databases, file storage and tools. Every realm has:
- a **primary instance group (PIG)** with **production**, **staging** and **development**, and
- a **secondary instance group (SIG)** with **sandboxes**. Today these are usually **on-demand sandboxes**, created and deleted through an API and billed by credits.

Inside an instance, a request passes a load balancer, a **web server** (which also holds the page cache), then an **application server** (which runs your JavaScript). All app servers share a database schema and a file system holding cartridges, images and logs.

## What each instance is for
| Instance | Who uses it | What happens there |
|---|---|---|
| Sandbox | Developers | Write and test code with a small data set. Most system jobs are off. |
| Staging | Merchandisers, release managers | Edit catalogs, prices, promotions, content. Upload release code. **Source of all replication.** |
| Development | QA, developers | Test new code with the latest staging data. |
| Production | Shoppers | Live sites behind the CDN. Feeds such as prices and stock are often imported here directly. |

## Organization vs site
An instance hosts one **organization** with one or more **sites**. Data lives at one of two levels:
- **Organization (global):** catalogs, price books, inventory lists, customer lists, system preferences.
- **Site:** campaigns and promotions, content libraries (unless shared), site preferences, payment and shipping settings.

This matters for imports, permissions, and replication tasks.

## Code versions
Code is deployed as **cartridges** inside a **code version** (a folder on the instance). You can keep several versions and switch the **active** one, which gives an instant rollback. Activating a version also clears custom caches.

## Business Manager
The admin UI. **Merchant Tools** holds per-site work (products, marketing, content, orders). **Administration** holds organization work (sites, jobs, replication, services, roles, quotas).

=== notes
- Staging is the only way to get code and merchant data into production in a controlled way. Don't edit live data directly on production unless it's a feed designed for that.
- "Global" vs "site" decides which import screen, which replication task and which permission you need.
- Never test with throwaway data on staging: replication can carry it to production.

=== q basic top
What is a realm, and what are the PIG and SIG?
---
A realm is everything Salesforce provisions for one customer. The primary instance group (PIG) holds production, staging and development. The secondary instance group (SIG) holds the sandboxes used for development.

=== q basic top
Why is staging so important?
---
Merchandisers edit data on staging and release code is uploaded there. Replication always runs from staging to development or production, so staging is the controlled source of everything that goes live.

=== q basic
What is Business Manager used for?
---
It's the web admin tool. Merchants manage catalogs, prices, promotions, content and orders under Merchant Tools; admins manage sites, jobs, replication, services, roles and quotas under Administration.

=== q mid top
Which data is organization-level and which is site-level? Give examples.
---
Organization: catalogs, price books, inventory lists, customer lists and global preferences. Site: campaigns and promotions, site preferences, content (unless a shared library), payment and shipping configuration. It affects which import screen, replication task and permission you use.

=== q mid
What is a code version and why keep more than one?
---
A code version is a named set of cartridges uploaded to an instance. Only one is active. Keeping the previous version lets you roll back instantly by activating it again.

=== q mid
How is an on-demand sandbox different from staging?
---
A sandbox is a personal, disposable development environment in the SIG with a small data set and most system jobs off. Staging is a permanent PIG instance holding real merchant data and acting as the replication source.

=== q adv
Two brands in Europe and Asia want separate teams and data. One realm or two?
---
Usually one realm with several sites is enough: sites can share catalogs and settings. Choose separate realms when teams, data ownership, compliance or release cycles must be fully separate. Data can then only be shared by exporting and importing.

=== p easy
Where does the change go?
---
A merchandiser wants to change a product's price for the live shop. On which instance should they make the change, and how does it reach shoppers?
---
On **staging**, in the price book. Then a **data replication** (price books task) copies it to production. Large daily price feeds are often imported directly into production as well, to stay in sync.

=== p std
Plan the path of a hot fix
---
A bug in checkout code must go live today. Describe the steps from your laptop to production.
---
1. Fix and test on your **sandbox**.
2. Merge, build, and upload the cartridges to **staging** as a new **code version** (client-certificate two-factor authentication is needed for staging).
3. Run a **code replication** to **development**, test checkout there.
4. Run a code replication to **production** and **activate** it.
5. Keep the previous code version so you can switch back if something breaks.
