import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

type FileRecord = { path: string; bytes: number; sha256: string };
type Asset = { techniqueId: string; tier: number; label: string; width: number; height: number;
    source: FileRecord; metadata: FileRecord; inputs: FileRecord[]; prototype: FileRecord; runtime: FileRecord;
    generation: { model: string; revision: string; seed: number; sha256: string; dimensions: number[];
        source: string; sourceSha256?: string; originalSword?: string; originalSwordSha256?: string };
    qa: { userApproval: string } };
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('four runtime sword tiers have verified v2 generation ancestry and matching source/prototype/runtime hashes', () => {
    const manifest = JSON.parse(readFileSync('docs/art/kiem-y-runtime-v2.json', 'utf8')) as
        { version: string; budgetVnd: number; provenanceSource: string; assets: Asset[] };
    assert.equal(manifest.version, 'kiem-y-runtime-v2'); assert.equal(manifest.budgetVnd, 0);
    assert.ok(manifest.provenanceSource.endsWith('/v2/final-assets.metadata.json'));
    assert.deepEqual(manifest.assets.map(asset => asset.tier), [1, 2, 3, 4]);
    const hashes = new Set<string>();
    for (const asset of manifest.assets) {
        assert.equal(asset.techniqueId, 'kiem-y'); assert.equal(asset.label, 'Tầng ' + asset.tier);
        assert.equal(asset.runtime.path, 'web/assets/than-lo/technique-kiem-y-tier-' + asset.tier + '.webp');
        assert.ok(asset.source.path.includes('/kiem-y/v2/'));
        for (const file of [asset.source, asset.metadata, ...asset.inputs, asset.prototype, asset.runtime]) {
            const bytes = readFileSync(file.path);
            assert.equal(bytes.length, file.bytes, file.path); assert.equal(hash(bytes), file.sha256, file.path);
        }
        assert.equal(asset.prototype.sha256, asset.runtime.sha256);
        const metadata = JSON.parse(readFileSync(asset.metadata.path, 'utf8'));
        assert.deepEqual(metadata, asset.generation);
        assert.equal(asset.source.sha256, metadata.sha256);
        assert.equal(metadata.model, 'Lykon/dreamshaper-8');
        assert.equal(metadata.revision, 'a7e52b98680b1ba8ff7bce97c7f9f2e2e5337917');
        assert.ok(Number.isSafeInteger(metadata.seed));
        assert.deepEqual(metadata.dimensions, [asset.width, asset.height]);
        if (metadata.sourceSha256) assert.equal(asset.inputs.find(file => file.path.endsWith('/' + metadata.source))?.sha256, metadata.sourceSha256);
        if (metadata.originalSwordSha256) assert.equal(asset.inputs.find(file => file.path.endsWith('/' + metadata.originalSword))?.sha256, metadata.originalSwordSha256);
        const png = readFileSync(asset.source.path);
        assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [asset.width, asset.height]);
        const webp = readFileSync(asset.runtime.path);
        assert.equal(webp.toString('ascii', 0, 4), 'RIFF'); assert.equal(webp.toString('ascii', 8, 12), 'WEBP');
        assert.equal(webp.toString('ascii', 12, 16), 'VP8 ');
        assert.deepEqual([webp.readUInt16LE(26) & 0x3fff, webp.readUInt16LE(28) & 0x3fff], [asset.width, asset.height]);
        assert.equal(asset.qa.userApproval, 'pending');
        hashes.add(asset.runtime.sha256);
    }
    assert.equal(hashes.size, 4, 'Tier progression must reference four distinct verified assets');
});
