#!/usr/bin/env node

const STABLE_TAG_PATTERN = /^v\d+\.\d+\.\d+$/;
const PRERELEASE_TAG_PATTERN = /^v\d+\.\d+\.\d+-(?:beta|rc)\.\d+$/;
const MAC_ARTIFACT_PATTERN = /\.(?:dmg|app\.tar\.gz)$/i;
const WINDOWS_ARTIFACT_PATTERN = /\.(?:msi|exe|nsis\.zip)$/i;

function parseArgs(argv) {
  const tagIndex = argv.indexOf('--tag');
  if (tagIndex >= 0) {
    const tag = argv[tagIndex + 1];
    if (!tag) {
      throw new Error('Missing value for --tag.');
    }
    return { tag };
  }

  return { tag: process.env.GITHUB_REF_NAME ?? '' };
}

function isStableTag(tag) {
  return STABLE_TAG_PATTERN.test(tag);
}

function isPrereleaseTag(tag) {
  return PRERELEASE_TAG_PATTERN.test(tag);
}

function hasMacArtifact(release) {
  return (release.assets ?? []).some((asset) => MAC_ARTIFACT_PATTERN.test(asset.name ?? ''));
}

function hasWindowsArtifact(release) {
  return (release.assets ?? []).some((asset) => WINDOWS_ARTIFACT_PATTERN.test(asset.name ?? ''));
}

function isQualifyingBetaRelease(release, stableTag) {
  return (
    typeof release.tag_name === 'string' &&
    release.tag_name.startsWith(`${stableTag}-beta.`) &&
    release.prerelease === true &&
    release.draft === false &&
    hasMacArtifact(release) &&
    hasWindowsArtifact(release)
  );
}

function findQualifyingBetaRelease(releases, stableTag) {
  return releases.find((release) => isQualifyingBetaRelease(release, stableTag)) ?? null;
}

async function fetchGitHubReleases() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;

  if (!repository) {
    throw new Error('GITHUB_REPOSITORY is required when RELEASE_GUARD_RELEASES_JSON is not set.');
  }
  if (!token) {
    throw new Error('GITHUB_TOKEN is required when RELEASE_GUARD_RELEASES_JSON is not set.');
  }

  const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=100`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub releases API returned ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

async function loadReleases() {
  if (process.env.RELEASE_GUARD_RELEASES_JSON) {
    const releases = JSON.parse(process.env.RELEASE_GUARD_RELEASES_JSON);
    if (!Array.isArray(releases)) {
      throw new Error('RELEASE_GUARD_RELEASES_JSON must be a JSON array.');
    }
    return releases;
  }

  return await fetchGitHubReleases();
}

async function main() {
  const { tag } = parseArgs(process.argv.slice(2));
  if (!tag) {
    throw new Error('No tag supplied. Pass --tag or set GITHUB_REF_NAME.');
  }

  if (isPrereleaseTag(tag)) {
    console.log(`Tag ${tag} is a prerelease tag and does not require prior beta verification.`);
    return;
  }

  if (!isStableTag(tag)) {
    console.log(`Tag ${tag} is not a stable release tag; skipping beta release guard.`);
    return;
  }

  const releases = await loadReleases();
  const betaRelease = findQualifyingBetaRelease(releases, tag);

  if (!betaRelease) {
    throw new Error(
      [
        `No qualifying beta prerelease found for ${tag}.`,
        `Publish and test a ${tag}-beta.N prerelease before pushing ${tag}.`,
        'The beta prerelease must be non-draft, marked prerelease, and include macOS plus Windows artifacts.'
      ].join(' ')
    );
  }

  console.log(`Found qualifying beta prerelease ${betaRelease.tag_name}; stable release ${tag} may proceed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
