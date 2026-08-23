/**
 * Definition extraction, all six syntaxes plus the derived user-story heading
 * (FR-011, FR-012) and the fenced-code exclusion (FR-005).
 *
 * The corpus survey found that a matcher keyed on the obvious shape — a bolded
 * identifier followed by a colon, in a list item — finds barely half of the real
 * definitions. Each case below is one of the ways the corpus deviates from that
 * shape, and each one was measured as costing real resolutions when missed.
 *
 * Extraction runs on RAW markdown line by line, host-side, so every position
 * here is in raw-file coordinates. Those coordinates are deliberately never sent
 * to the webview as a navigation instruction — see the data model.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { extractDefinitions, type DefinitionSite } from '../../../features/speckitIndex/extract';

const FIXTURES = join(__dirname, '../../fixtures/speckit');

function fixture(relativePath: string): string {
  return readFileSync(join(FIXTURES, relativePath), 'utf8');
}

function sitesFor(text: string, fsPath = '/w/specs/001-example-feature/spec.md'): DefinitionSite[] {
  return extractDefinitions(text, fsPath);
}

function find(sites: DefinitionSite[], id: string): DefinitionSite | undefined {
  return sites.find(site => site.id === id);
}

describe('the six definition syntaxes (FR-011)', () => {
  it('finds a plain bullet whose first inline element is the bolded ID', () => {
    const sites = sitesFor('- **FR-001**: The system MUST render a stored document on open.\n');
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ id: 'FR-001', kind: 'bullet', line: 0 });
  });

  it('finds a bolded bullet with NO trailing colon', () => {
    // `- **BR-1** Storage MUST be addressable without a path.` — the colon is
    // optional, and a colon-anchored matcher misses this whole family.
    const sites = sitesFor('- **BR-1** Storage MUST be addressable without a path.\n');
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ id: 'BR-1', kind: 'bullet' });
  });

  it('finds a checkbox bullet carrying a bare, unbolded ID', () => {
    const sites = sitesFor('- [ ] T027 [P] [US1] Render a stored document\n');
    expect(find(sites, 'T027')).toMatchObject({ kind: 'checkboxBare' });
  });

  it('finds a checked checkbox bullet too', () => {
    const sites = sitesFor('- [X] T001 Create the storage folder layout\n');
    expect(find(sites, 'T001')).toMatchObject({ kind: 'checkboxBare' });
  });

  it('finds a checkbox bullet carrying a bolded ID', () => {
    const sites = sitesFor('- [ ] **US8-1**: Storage is created on first write, not at startup.\n');
    expect(find(sites, 'US8-1')).toMatchObject({ kind: 'checkboxBold' });
  });

  it.each([
    ['## R-001: How is a folder handle obtained', 'R-001'],
    ['## R-011. Migration order for stored folders', 'R-011'],
    ['## D1 — Storage is addressed by handle, not by path', 'D1'],
    ['## D13 Progress is reported per slice', 'D13'],
    ['## C4 — Handles are opaque', 'C4'],
  ])('finds a heading definition in %s', (line, id) => {
    // Four separator forms: colon, full stop, em dash, and nothing at all. A
    // matcher keyed on any single delimiter finds a quarter of these.
    const sites = sitesFor(`${line}\n`);
    expect(find(sites, id)).toMatchObject({ kind: 'heading' });
  });

  it.each([
    ['| R-029 | Does a handle survive a process restart | Resolved |', 'R-029'],
    ['| `R-030` | Is a handle safe to log | Resolved |', 'R-030'],
    ['| **R-031** | Can two handles address one folder | Open |', 'R-031'],
  ])('finds a table-row definition in %s', (line, id) => {
    // Bare, backticked, and bolded first cells all occur. Matching only the bare
    // form loses the whole precondition family.
    const sites = sitesFor(`${line}\n`);
    expect(find(sites, id)).toMatchObject({ kind: 'tableRow' });
  });

  it.each([
    ['**AD-4 — The storage layer owns handle allocation**', 'AD-4'],
    ['**AD-5** When a handle is released it is never re-issued.', 'AD-5'],
    ['**AD-6 (BR-17)** All writes carry an author, without exception.', 'AD-6'],
  ])('finds a bolded ID opening a paragraph in %s', (line, id) => {
    // The sixth syntax. Its absence held this family's resolution at 50%.
    const sites = sitesFor(`${line}\n`);
    expect(find(sites, id)).toMatchObject({ kind: 'paragraphBold' });
  });

  it('tolerates leading indentation, because nested definitions are real', () => {
    const sites = sitesFor(
      '- [ ] T104 [US1] Verify the read path\n' +
        '  - [ ] **AS1**: A stored document renders on first open.\n'
    );
    expect(find(sites, 'AS1')).toMatchObject({ kind: 'checkboxBold', line: 1 });
  });

  it('records the raw-file line of every site', () => {
    const sites = sitesFor('intro\n\n- **FR-001**: one\n- **FR-002**: two\n');
    expect(find(sites, 'FR-001')?.line).toBe(2);
    expect(find(sites, 'FR-002')?.line).toBe(3);
  });

  it('records the artifact path on every site', () => {
    const sites = sitesFor('- **FR-001**: one\n', '/w/specs/001-example-feature/spec.md');
    expect(sites[0].fsPath).toBe('/w/specs/001-example-feature/spec.md');
  });
});

describe('the derived user-story heading (FR-012)', () => {
  it('synthesizes US<n> from a heading in which the token never appears', () => {
    const sites = sitesFor('### User Story 2 - Reopen the last folder (Priority: P2)\n');
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ id: 'US2', kind: 'userStoryHeading', line: 0 });
    expect(sites[0].headingText).toContain('User Story 2');
  });

  it('does not treat the (Priority: P#) ornament as a definition of anything', () => {
    const sites = sitesFor('### User Story 8 - Per-app storage (Priority: P4)\n');
    expect(sites.map(site => site.id)).toEqual(['US8']);
  });
});

describe('fenced code is not a definition site (FR-005)', () => {
  it('ignores a definition shown as an example inside a fenced block', () => {
    const text = [
      '- **FR-001**: real definition',
      '',
      '```markdown',
      '- **FR-777**: an example, not a target',
      '## R-777: also only an example',
      '```',
      '',
      '- **FR-002**: real definition',
    ].join('\n');
    expect(sitesFor(text).map(site => site.id)).toEqual(['FR-001', 'FR-002']);
  });

  it('ignores a tilde-fenced block as well', () => {
    const text = ['~~~', '- **FR-777**: example', '~~~', '- **FR-003**: real'].join('\n');
    expect(sitesFor(text).map(site => site.id)).toEqual(['FR-003']);
  });

  it('does not close a fence on a shorter delimiter of the same marker', () => {
    const text = ['````', '```', '- **FR-777**: still inside', '````', '- **FR-004**: real'].join(
      '\n'
    );
    expect(sitesFor(text).map(site => site.id)).toEqual(['FR-004']);
  });
});

describe('ordinary prose is not a definition', () => {
  it.each([
    'Reference forms in prose: see FR-001. Also (FR-002).',
    'The read path covers FR-001/002 and the retry rules in FR-005a/005b.',
    '**Decision**: Ask the storage layer, do not construct one.',
    '| ID | Question | Status |',
    '|---|---|---|',
  ])('extracts nothing from %s', line => {
    expect(sitesFor(`${line}\n`)).toEqual([]);
  });
});

describe('over the fixture corpus', () => {
  it('finds the definitions the requirements corpus fixture declares', () => {
    const sites = sitesFor(fixture('specs/001-example-feature/spec.md'));
    const ids = sites.map(site => site.id);
    // The four user stories are synthesized; the requirements are bullets.
    expect(ids).toEqual(expect.arrayContaining(['US1', 'US2', 'US3', 'US8']));
    expect(ids).toEqual(
      expect.arrayContaining(['FR-001', 'FR-005a', 'FR-G12', 'FR-EX-001', 'SC-001', 'SC-EX-001'])
    );
    expect(ids).toEqual(expect.arrayContaining(['US8-1', 'US8-2']));
  });

  it('finds heading, table and unhyphenated forms in the research fixture', () => {
    const ids = sitesFor(fixture('specs/001-example-feature/research.md')).map(site => site.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'R-001',
        'R-011',
        'R2',
        'R10',
        'D1',
        'D13',
        'Q1',
        'R-029',
        'R-030',
        'R-031',
        'P-APP-DIR',
        'P-PLATFORM-LINK',
        'P-SOPS',
      ])
    );
  });

  it('finds every contract namespace form', () => {
    const ids = sitesFor(fixture('specs/001-example-feature/contracts/example.contract.md')).map(
      site => site.id
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        'C-read-1',
        'C-readFile-1',
        'C-git-write-2',
        'C-UI-1',
        'C-P-4',
        'C1',
        'C4',
        'C-7',
        'C-9',
        'C-11',
        'C-12',
      ])
    );
  });

  it('finds the paragraph-bold and colon-free bullet forms in the briefs fixture', () => {
    const sites = sitesFor(fixture('specs/briefs/example-brief.md'));
    expect(find(sites, 'BR-1')).toMatchObject({ kind: 'bullet' });
    expect(find(sites, 'AD-4')).toMatchObject({ kind: 'paragraphBold' });
    expect(find(sites, 'AD-6')).toMatchObject({ kind: 'paragraphBold' });
    expect(find(sites, 'P-APP-DIR')).toMatchObject({ kind: 'tableRow' });
  });

  it('extracts nothing at all from a file of pure look-alikes', () => {
    expect(sitesFor(fixture('lookalikes.md'))).toEqual([]);
  });
});
