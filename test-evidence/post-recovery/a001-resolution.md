# A-001 resolution — imported knowledge-pack preservation

The post-recovery audit found that the RX-8F reclaim-space action treated every installed semantic knowledge pack as re-downloadable. Imported/custom packs are different: they can be user-supplied and may have no remote source.

This branch makes pack provenance explicit and preserves all `source: imported` packs during reclaim-space cleanup. The existing Settings count now reflects reclaimable packs only, while imported packs are tracked separately as preserved content.

Regression coverage locks the rule that imported packs are not reclaimable while remote/builtin packs remain eligible for safe space recovery.
