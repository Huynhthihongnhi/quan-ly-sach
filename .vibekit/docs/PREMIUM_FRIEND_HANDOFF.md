# Give a friend Premium: coupon, download, install and update

Tiếng Việt: [Tặng bạn bè, coupon, thanh toán và cài đặt](PREMIUM_DELIVERY.vi.md). Documentation status: [current guides and historical records](DOCUMENTATION_MAP.md).

Use this guide for the private 0.6.3 review candidate. The owner prepares access and the download. Legal review and commercial approval remain pending; see the [release record](PREMIUM_RELEASE.md). Any friend evaluation needs the owner's written grant for the exact version.

**What works today:** bundled workflows, whole-kit installation, project upgrades, modular skill updates and signed offline artifact verification. **Still unconfigured:** hosted checkout, real discounts, automatic license activation and online updates. A coupon is a checkout discount, not a CLI activation key.

## 1. Owner: choose the delivery route

| Option | What it does | Cost | Risk | Recommended |
| --- | --- | --- | --- | --- |
| Private manual gift now | Send the reviewed archive and record who receives updates | Your preparation and update time | Manual access tracking | Yes |
| Polar coupon after setup | Friend redeems a real discount and receives a hosted download | Provider fees and setup time | Requires onboarding and a tested checkout | No |
| Automated CLI activation later | Service grants and refreshes customer entitlements | Backend and security operations | Service is not implemented | No |

Recommendation: use a manual gift for the first friend while the payment and activation services are unconfigured. Use the coupon route when your tested checkout exists.

Original Premium work uses [Bui Van Giang's single-user license](PREMIUM_LICENSE.md). Inherited MIT material and earlier MIT copies keep their rights. The owner can grant a named friend a seat in writing; customers cannot forward their own seat or kit. State exactly which version and update rights the gift or purchase includes. See [selling and offer definitions](PREMIUM_SELLING.md).

## 2. Owner: prepare the downloadable kit

From the reviewed source checkout:

```sh
npm test
npm run security:probe
npm run pack:dry-run
git diff --check
```

Create a private release folder outside the repository. Replace the example path below with that existing folder:

```sh
npm pack --ignore-scripts --pack-destination "/absolute/path/to/private-release-folder"
```

For the current private candidate, the archive is `minimal-vibe-coding-kit-premium-0.6.3.tgz`. Complete the [legal and commercial gates](PREMIUM_RELEASE.md) before selling. Do not reuse the earlier MIT-era review archive as the newly licensed download. Keep each shared archive immutable; changed release bytes need a new version and review. Packing creates a local file; it does not publish to npm or configure checkout.

Record the archive's SHA-256 digest with this Node command, replacing the filename with its actual path:

```sh
node -e "console.log(require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync(process.argv[1])).digest('hex'))" "/absolute/path/to/minimal-vibe-coding-kit-premium-0.6.3.tgz"
```

Send the digest through a trusted channel alongside the version and release notes. A matching digest detects changed bytes; it does not establish who sent the archive.

For a manual gift, privately record the named recipient, grant ID, license version, delivered version, archive digest and promised update period. Supply the license for review and record acceptance. Send the archive and the message in section 7. No coupon or activation command is needed for an authorized user's bundled workflows.

## 3. Owner: create a real coupon when checkout is ready

This optional command generates a random candidate for a free one-time gift:

```sh
node -e "console.log('GIFT100-' + require('node:crypto').randomBytes(8).toString('hex').toUpperCase())"
```

**The printed code is inactive until you create it in your payment dashboard.** Generating a string does not reserve a discount or grant access.

In your approved Polar organization:

1. Create the intended one-time product and its File Downloads benefit. Show the Premium license and the exact seat/update terms before checkout. Upload the reviewed archive and confirm customer access.
2. Create a percentage discount with the candidate code: 100% for a gift, duration Once, the exact product, a short explicit expiry, one total redemption and one redemption per customer.
3. Test this in sandbox with a separate customer: redeem, download, compare the digest and install. Confirm an expired or reused code cannot grant another discount.
4. Create separate production product, benefit and discount records. Send the actual production checkout link and registered code.

Polar documents these [discount restrictions](https://polar.sh/docs/features/discounts) and [File Download benefits](https://polar.sh/docs/features/benefits/file-downloads). A one-use code is still usable by the first person who receives it. For a named-person gift, verify the recipient through your manual process or authenticated service.

Use [the coupon guide](PREMIUM_COUPONS.md) for partial discounts or subscriptions. State the regular renewal price and when any subscription discount ends. The full production journey has not been tested by this repository review.

## 4. Friend: download and prepare

1. Read the supplied license and seat/update terms. For a coupon, open the supplied checkout link, enter the code, complete checkout and download from your customer access page. For a manual gift, confirm the owner's written grant and use their direct download.
2. Run the SHA-256 command from section 2 on the downloaded archive and compare the exact digest with the owner's value.
3. Extract it with your archive tool into a separate tools folder. The npm archive contains a `package/` directory with `bin/mvck.js` and hidden `.vibekit/` files. Do not extract it over your application.
4. Open a terminal in that extracted `package/` directory. Check `node --version`; the CLI requires Node 18 or newer. No dependency installation is needed for these core commands.
5. Back up your project, including uncommitted work, before whole-kit installation or update. Replace every example project path below with your existing project directory.

Examples use macOS/Linux paths. In Windows PowerShell, use a quoted absolute path such as `"C:\work\my-project"`. Commands still run through `node`.

## 5. Friend: choose the command for your project

| Your project | Use |
| --- | --- |
| No kit installed | Fresh whole-kit installation, section 5A |
| Older OSS whole-kit installation, including 0.5.15 | Upgrade from the new Premium download, section 5B |
| Older Premium whole-kit installation | Update from the newer Premium download, section 5B |
| Individual skills installed using `skill add` | Modular update, section 5C |
| A separately signed private skill | Signed artifact delivery, section 6 |

### 5A. Fresh whole-kit installation

Run from the extracted new kit. Choose your provider with `--profile`: `claude`, `cursor`, `codex`, `opencode`, `grok`, `kimi`, a comma-separated list or `all`.

```sh
node bin/mvck.js install "/absolute/path/to/project" --profile codex --dry-run --json
```

Review the target and planned files. Then apply the same choice:

```sh
node bin/mvck.js install "/absolute/path/to/project" --profile codex
```

Legacy `install` writes immediately unless `--dry-run` is supplied. It does not use `--apply`. Complete the project's first-time initialization using the next prompt printed by the installer. Review the proposed project backbone before accepting it.

### 5B. Upgrade OSS or update an older Premium whole-kit install

Use the new downloaded kit as the source and your application as the target:

```sh
node bin/mvck.js update "/absolute/path/to/project" --profile codex --dry-run --json
```

Review the changed files and back up local edits. Then run:

```sh
node bin/mvck.js update "/absolute/path/to/project" --profile codex
```

Legacy `update` also writes immediately without `--dry-run`. Use the same provider profile in both commands. Keep backups enabled. Replaced kit files are copied to `.vibekit/update-backup/<timestamp>/`.

The update preserves your existing backbone, settings and text outside managed instruction blocks. It refreshes the kit's managed blocks and may replace locally customized legacy kit files after backing them up. It does not merge every skill customization or remove obsolete files. Review the resulting diff before resuming work.

An initialized OSS project keeps its own configuration. Do not replace it with this source repository's backbone. A pre-0.4 layout may need manual cleanup after the CLI reports legacy paths.

If modular skills also exist, the updater skips their entire skill IDs. Update them through section 5C. A pending modular transaction must be inspected and recovered first. Run only one installer or updater at a time; the legacy updater has a preflight check, not a shared transaction mutex.

### 5C. Update individual modular skills

Use the newer downloaded kit's CLI:

```sh
node bin/mvck.js skill sync --target "/absolute/path/to/project" --json
```

Review all conflicts and the plan's `sha256`. Apply the exact preview:

```sh
node bin/mvck.js skill sync --target "/absolute/path/to/project" --apply --accept-plan-sha256 ACTUAL_DIGEST_FROM_PREVIEW
node bin/mvck.js skill doctor --target "/absolute/path/to/project" --json
```

Replace the digest placeholder with the complete value from your preview. A changed source or target requires a new preview. An interactive terminal can instead use `--apply` and approve its displayed plan.

For a single skill, replace `skill sync` with `skill update closed-loop-engineering`. These commands use the bundled catalog from the selected download; they do not fetch new versions online. Signed artifacts are preserved and need section 6.

Do not force-install over a modular project. The CLI refuses this. Files adopted with `--adopt` remain user-owned; differing adopted files require manual reconciliation before synchronization. For an existing whole-kit project, keeping whole-kit updates is simpler than adopting every bundled file into modular ownership.

### Verify afterward

For a whole-kit project, run these commands using the new downloaded source:

```sh
node bin/mvck.js doctor "/absolute/path/to/project"
node bin/mvck.js validate "/absolute/path/to/project"
```

Then, from your application directory, check that its installed runtime starts:

```sh
node .vibekit/scripts/mvck.mjs capabilities --json
node .vibekit/scripts/mvck.mjs license status --json
```

For standalone modular installation, use `skill doctor` from the downloaded source instead. Modular installation copies the chosen skills and ownership records, not the whole runtime. A whole-kit validator is inappropriate for a standalone skill project.

`license status` currently reports `service: not-configured`, `mode: community` and online Premium downloads blocked. That describes service readiness, not your legal license. Authorized users need no activation for installed bundled workflows. Whole-kit installation keeps the kit license in `.vibekit/docs/licenses/` and preserves your project's root `LICENSE`. Keep the reviewed download for future CLI operations and keep reusable Premium files private when publishing your application.

## 6. Separately signed private skills

This advanced route requires an owner-produced delivery JSON containing the release, file bundle, signed entitlement and reviewed public trust keys. It is separate from a `.tgz` download, Polar coupon or Polar license key. The production issuer is not configured.

From the reviewed kit source:

```sh
node bin/mvck.js artifact verify --input "/absolute/path/to/delivery.json" --json
node bin/mvck.js artifact add --input "/absolute/path/to/delivery.json" --target "/absolute/path/to/project" --provider codex --json
```

After reviewing the trust keys through a trusted channel and checking the plan, apply the same `artifact add` command with `--apply --accept-plan-sha256 ACTUAL_DIGEST_FROM_PREVIEW`. A newer signed release uses the same flow. Do not make your own entitlement, copy another person's delivery file or use test signing keys for a real offer. Expiry blocks new delivery; it does not delete installed files.

See [signed delivery security](PREMIUM_SECURITY.md) and [migration and recovery](PREMIUM_MIGRATION.md).

## 7. Owner: copy this message after access is ready

```text
Here is your MVCK Premium development kit, version [version].
I, Bui Van Giang, grant [friend's full name] one named-user seat under
MVCK Premium License 1.0, included in this download.
Download or checkout: [actual private link]
Coupon: [registered code, or "manual gift, no code needed"]
Grant or order ID: [private reference]
Updates included: [none, or exact end date and scope]
Continued use of this delivered version: subject to the supplied license.
Coupon expiry, if any: [date, time and timezone]
Archive SHA-256: [full digest]

Personal and commercial/client work and private modifications are permitted.
Do not share or resell the Premium kit or your seat.
Please read the supplied license and confirm acceptance before using the kit.

Extract the archive into a separate folder, then open:
package/.vibekit/docs/PREMIUM_FRIEND_HANDOFF.md

Use section 5A for a new project or 5B for an older OSS/Premium project.
Use 5C if you installed individual skills.
Bundled workflows need no activation key in this development edition.
Please keep the private download and coupon code to yourself.
```

Before sending this, replace every placeholder and test the exact archive you will share. Automatic activation and automatic entitlement-limited updates require the service work in [the selling guide](PREMIUM_SELLING.md).
