/**
 * All Cypher lives here so the graph logic is auditable in one place.
 * Detection is 100% graph-native — multi-hop shared-identity traversal that a
 * SQL JOIN cannot express cleanly. Runs on a stock Aura instance (no GDS session
 * required). If you later provision Aura Graph Analytics or run local GDS, you can
 * swap RING_CANDIDATES for gds.louvain — see README "GDS upgrade".
 */

// --- Schema: constraints + indexes -----------------------------------------
export const SCHEMA = [
  `CREATE CONSTRAINT account_id IF NOT EXISTS FOR (a:Account) REQUIRE a.id IS UNIQUE`,
  `CREATE CONSTRAINT device_id  IF NOT EXISTS FOR (d:Device)  REQUIRE d.id IS UNIQUE`,
  `CREATE CONSTRAINT ip_id      IF NOT EXISTS FOR (i:IP)      REQUIRE i.id IS UNIQUE`,
];

// --- Wipe (demo re-seed) ---------------------------------------------------
export const WIPE = `MATCH (n) DETACH DELETE n`;

// Clear any prior :LINKED edges so detection is clean + repeatable across runs.
export const CLEAR_LINKS = `MATCH ()-[r:LINKED]-() DELETE r`;

/**
 * Step 1: materialize a :LINKED edge between any two accounts that share a
 * device or IP fingerprint. This is the whole trick — legit accounts have unique
 * fingerprints (no LINKED edges), so ONLY ring members get linked. The ring
 * emerges as the connected component of the LINKED subgraph.
 * The 2-hop `(a)->(x)<-(b)` pattern is exactly what SQL can't do cleanly.
 */
export const BUILD_LINKS = `
MATCH (a:Account)-[:USED_DEVICE|USED_IP]->(x)<-[:USED_DEVICE|USED_IP]-(b:Account)
WHERE a.id < b.id
WITH a, b, count(DISTINCT x) AS shared
MERGE (a)-[r:LINKED]-(b)
SET r.shared = shared
`;

/**
 * Step 2: pull the ring candidates — every account that shares a fingerprint with
 * another (i.e. has at least one :LINKED edge). Returns the attributes we score on.
 */
export const RING_CANDIDATES = `
MATCH (a:Account)-[:LINKED]-()
WITH DISTINCT a
OPTIONAL MATCH (a)-[:USED_DEVICE]->(d:Device)
OPTIONAL MATCH (a)-[:USED_IP]->(i:IP)
RETURN a.id AS id, a.name AS name, coalesce(a.openedDaysAgo, 0) AS openedDaysAgo,
       collect(DISTINCT d.id) AS devices, collect(DISTINCT i.id) AS ips
`;

// All money movement (used to compute internal flow + find the mule by volume)
export const FETCH_TX = `
MATCH (a:Account)-[t:SENT]->(b:Account)
RETURN a.id AS src, b.id AS dst, t.amount AS amount, t.ts AS ts`;

// Mark a ring's accounts as frozen (called after an investigator pays + acts)
export const FREEZE_RING = `
UNWIND $ids AS id
MATCH (a:Account { id: id }) SET a.flagged = true, a.frozenAt = timestamp()
RETURN count(a) AS frozen`;
