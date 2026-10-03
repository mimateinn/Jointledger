# Sticky tops at 375

Measured after removing `.app-frame { overflow-x: hidden }` (that rule created a scroll container and parked `.entry-sticky` below the viewport).

| Page | Viewport | Selector | top | bottom | visible |
|---|---|---|---:|---:|---|
| entry | 375x812 | `.entry-sticky` | 460 | 527 | yes |
| entry | 375x812 | `.mobile-bar` | 756 | 812 | yes |
| overview | 375x812 | `.mobile-bar` | 756 | 812 | yes |
| holdings | 375x812 | `.mobile-bar` | 756 | 812 | yes |
| ledger | 375x812 | `.mobile-bar` | 756 | 812 | yes |
| account | 375x812 | `.mobile-bar` | 756 | 812 | yes |
| entry | 375x667 | `.entry-sticky` | 315 | 382 | yes |
| entry | 375x667 | `.mobile-bar` | 611 | 667 | yes |
| overview | 375x667 | `.mobile-bar` | 611 | 667 | yes |
| holdings | 375x667 | `.mobile-bar` | 611 | 667 | yes |
| ledger | 375x667 | `.mobile-bar` | 611 | 667 | yes |
| account | 375x667 | `.mobile-bar` | 611 | 667 | yes |

