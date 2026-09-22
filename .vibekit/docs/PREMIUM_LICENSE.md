# Premium license and customer rights

**Licensor: Bui Van Giang.** Original Premium work uses the proprietary [MVCK Premium License 1.0](licenses/LICENSE). A purchase or written gift authorizes one named user. Read the complete terms before accepting access. This guide summarizes them; the license and the applicable written order or grant govern.

## What a customer may do

| Activity | Permission |
| --- | --- |
| Use the kit for personal, employer or commercial/client projects | Yes, for the named user |
| Use multiple devices and projects | Yes, for the same named user |
| Modify the kit privately and keep backups | Yes |
| Use coding agents to assist authorized work | Yes, subject to the license and provider terms |
| Sell or publish the customer's own application and project output | Yes |
| Share a seat, publish the Premium kit or resell its files | Requires a separate written grant from Bui Van Giang |
| Give a client the reusable Premium kit | The client needs authorized seats or a separate agreement |
| Receive future versions or support | Only for the period promised in the order or gift |

There is no project-count limit in the standard license. Expiry of update access alone does not revoke use of previously delivered versions. An explicitly agreed fixed use term is different. The kit does not claim ownership of the customer's original output.

## Why MIT still appears in some files

This repository started from the MIT-licensed OSS kit. Renaming it Premium does not erase licenses already granted. The [complete inherited notice](licenses/THIRD_PARTY_NOTICES.md) preserves the original copyright and permission text. The [MIT license](https://opensource.org/license/mit) requires retaining these notices when its material is copied or distributed.

| Material | Current license scope |
| --- | --- |
| Original Premium modules in `.vibekit/scripts/premium/`, Premium docs and original Premium additions | MVCK Premium License 1.0, to the extent Bui Van Giang owns or is authorized to license them |
| `closed-loop-engineering` 1.0.3 and its provider copies | MVCK Premium License 1.0, with inherited components excluded |
| The 26 inherited skills whose catalog entries say `MIT`, including `clean-delivery`, and their provider copies | MIT |
| Renamed inherited skill `mvck-explain-again` and its provider copies | MIT, with the Matt Pocock upstream notice and inherited MVCK notice retained |
| Inherited portions of the OSS 0.5.15 import, identified by commit `50ff0431796de771d509ea4caebd4b0042dcc1b1` | Their existing MIT terms |
| A copy of any earlier version lawfully received under MIT | That copy keeps its MIT rights |
| Mermaid reference materials and separately installed third-party software | Their own licenses and notices |

A directory name does not prove ownership. Mixed files retain the applicable rights in inherited portions. Do not claim that another contributor's work is exclusively yours; obtain the needed written permission before distributing it as proprietary material.

The package declares `SEE LICENSE IN LICENSE`, the [npm format for a custom license](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#license). The plugin declares both `LicenseRef-MVCK-Premium-1.0` and `MIT` to describe the distribution's component licenses. These are separate component terms, not a choice to use all Premium material under MIT. `private: true` prevents accidental npm publication; it is not license enforcement or a download access control.

## License versus activation

`skill list` and `skill info` show each skill's license. The legacy catalog field `access: community` means that the skill can be installed from the local bundle without a signed delivery document. It does not mean that proprietary material is free to redistribute.

`license status` currently shows `service: not-configured` and `mode: community`. It does not verify a purchase, accept terms, activate a seat or redeem a coupon. The authorized customer can use the bundled kit without an activation key. Live activation and automatic online updates are separate unfinished service features.

## Owner: grant a friend access

Bui Van Giang may give a named friend a seat in writing. Privately record the recipient, grant ID, license version, delivered kit version, archive digest and exact update period. Do not put customer details in this repository or its archives.

Use this grant text as part of the [friend handoff message](PREMIUM_FRIEND_HANDOFF.md#7-owner-copy-this-message-after-access-is-ready):

```text
I, Bui Van Giang, grant [friend's full name] one personal seat for MVCK Premium
version [kit version] under MVCK Premium License 1.0, supplied with this download.
You may use it for personal and commercial/client projects and modify it privately.
Do not share or resell the Premium kit or your seat.
You may continue using this delivered version subject to the license.
Updates included: [none, or an explicit end date and scope].
Grant ID: [private reference]. Archive SHA-256: [complete digest].
Please read the attached license and confirm acceptance before using the kit.
```

A coupon changes the checkout price. Register a real discount in the payment dashboard before sharing its code. The completed order must grant a named seat under the displayed terms. Follow [coupons](PREMIUM_COUPONS.md) and [download, install and upgrade](PREMIUM_FRIEND_HANDOFF.md) for the exact steps. A customer cannot grant another person a seat by forwarding their download.

## Install, upgrade and publish your own project

- Whole-kit install and update carry these terms in `.vibekit/docs/licenses/`. They preserve the application's root `LICENSE`.
- Standalone `closed-loop-engineering` installation carries `LICENSE` and `THIRD_PARTY_NOTICES.md` beside `SKILL.md`, in its canonical folder and selected provider copies.
- Read the new terms before an OSS-to-Premium upgrade. Buying Premium is not required to keep using your existing MIT copy.
- Keep reusable Premium CLI modules, skill copies, documentation and backups in private storage. Before publishing an application repository or handing it to a client, check its current files and Git history for bundled Premium material. A root MIT license on the application does not relicense embedded Premium files. Project-specific output remains permitted under the Premium license.

## Release and sales checklist

1. Review ownership of the new Premium contributions. Obtain any missing contributor permissions and have qualified counsel review the license and the intended sales terms before commercial launch. Legal review is pending; use the [counsel brief](PREMIUM_LEGAL_REVIEW.md) to obtain and record it.
2. Show the complete license before purchase or gift acceptance. Record one named user, price, refund terms, delivered version and update rights. Do not imply that a discount supplies additional seats.
3. Pack and test the current source with its license and notices. The earlier 2026-09-15 review archive was built while the source said MIT; it is historical evidence, not a newly licensed download. Do not relabel it or replace it in place.
4. If a package version has already been distributed, use a new package version for changed bytes or terms. The current source is the private review candidate `0.6.3`; see [its release record](PREMIUM_RELEASE.md). It is pending legal review and commercial approval. Keep each delivered archive and its digest immutable.
5. Use the [handoff guide](PREMIUM_FRIEND_HANDOFF.md) to verify fresh install, OSS upgrade and Premium update. Payment setup, production activation and automatic online updates remain separate release work.
