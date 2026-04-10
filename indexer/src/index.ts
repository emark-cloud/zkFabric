/**
 * zkFabric indexer
 * ----------------
 * Watches the on-chain `CredentialRegistered` event on `ZKFabricRegistry` and
 * maintains an off-chain leaf list in insertion order. The frontend / SDK
 * rebuilds the Merkle tree from this list, removing the localStorage single-
 * point-of-failure.
 *
 * State model:
 *   - leaves[]            ordered list of credential hashes (decimal strings)
 *   - lastBlock           highest block fully scanned
 *   - persisted to STATE_FILE (JSON) on every change
 *
 * Endpoints:
 *   GET /leaves    -> { leaves: string[], lastBlock: string, count: number }
 *   GET /root      -> { currentRoot: string }            (live read from chain)
 *   GET /health    -> { ok: true, lastBlock, count }
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  createPublicClient,
  http,
  webSocket,
  parseAbiItem,
  type Address,
  type PublicClient,
} from "viem";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

// ----------------------------------------------------------------------------
// Config
// ----------------------------------------------------------------------------

const REGISTRY_ADDRESS = (process.env.REGISTRY_ADDRESS ??
  "0xa1708C934175Bf7EaC25220D560BE0C681725957") as Address;

const RPC_URL = process.env.RPC_URL ?? "https://testnet.hsk.xyz";
const WS_URL = process.env.WS_URL ?? "wss://hashkey-testnet.drpc.org";
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 133);
const DEPLOY_BLOCK = BigInt(process.env.DEPLOY_BLOCK ?? "0");
const PORT = Number(process.env.PORT ?? 8787);
const STATE_FILE = process.env.STATE_FILE ?? "./data/state.json";
const BACKFILL_CHUNK = BigInt(process.env.BACKFILL_CHUNK ?? "5000");

const CREDENTIAL_REGISTERED_EVENT = parseAbiItem(
  "event CredentialRegistered(uint256 indexed identityCommitment, uint256 indexed credentialHash, address adapter)"
);

const REGISTRY_ABI = [
  {
    type: "function",
    name: "currentRoot",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ----------------------------------------------------------------------------
// State persistence
// ----------------------------------------------------------------------------

interface IndexerState {
  leaves: string[];
  // Use a Set internally to dedupe; serialize to array.
  seen: Record<string, true>;
  lastBlock: string;
}

function loadState(): IndexerState {
  if (!existsSync(STATE_FILE)) {
    return { leaves: [], seen: {}, lastBlock: DEPLOY_BLOCK.toString() };
  }
  try {
    const raw = readFileSync(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<IndexerState>;
    return {
      leaves: parsed.leaves ?? [],
      seen: parsed.seen ?? {},
      lastBlock: parsed.lastBlock ?? DEPLOY_BLOCK.toString(),
    };
  } catch (err) {
    console.error("[indexer] failed to load state, starting fresh:", err);
    return { leaves: [], seen: {}, lastBlock: DEPLOY_BLOCK.toString() };
  }
}

function saveState(state: IndexerState): void {
  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const state = loadState();
console.log(
  `[indexer] loaded state: ${state.leaves.length} leaves, lastBlock=${state.lastBlock}`
);

// ----------------------------------------------------------------------------
// Chain clients
// ----------------------------------------------------------------------------

const httpClient: PublicClient = createPublicClient({
  transport: http(RPC_URL),
});

let wsClient: PublicClient | null = null;
try {
  wsClient = createPublicClient({ transport: webSocket(WS_URL) });
  console.log(`[indexer] websocket transport ready: ${WS_URL}`);
} catch (err) {
  console.warn(`[indexer] websocket unavailable, falling back to polling:`, err);
}

// ----------------------------------------------------------------------------
// Event ingestion
// ----------------------------------------------------------------------------

function ingestLeaf(credentialHash: bigint): boolean {
  const key = credentialHash.toString();
  if (state.seen[key]) return false;
  state.seen[key] = true;
  state.leaves.push(key);
  return true;
}

async function backfill(toBlock: bigint): Promise<void> {
  let from = BigInt(state.lastBlock);
  if (from < DEPLOY_BLOCK) from = DEPLOY_BLOCK;
  console.log(`[indexer] backfilling from ${from} to ${toBlock}`);

  while (from <= toBlock) {
    const to = from + BACKFILL_CHUNK > toBlock ? toBlock : from + BACKFILL_CHUNK;
    try {
      const logs = await httpClient.getLogs({
        address: REGISTRY_ADDRESS,
        event: CREDENTIAL_REGISTERED_EVENT,
        fromBlock: from,
        toBlock: to,
      });
      let added = 0;
      for (const log of logs) {
        const credentialHash = log.args.credentialHash;
        if (credentialHash !== undefined && ingestLeaf(credentialHash)) {
          added++;
        }
      }
      state.lastBlock = to.toString();
      saveState(state);
      if (added > 0) {
        console.log(`[indexer] backfill ${from}-${to}: +${added} leaves (total ${state.leaves.length})`);
      }
    } catch (err) {
      console.error(`[indexer] backfill chunk ${from}-${to} failed:`, err);
      // Brief retry delay so we don't hot-loop on RPC errors.
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    from = to + 1n;
  }
  console.log(`[indexer] backfill complete: ${state.leaves.length} leaves`);
}

function startWatcher(client: PublicClient): () => void {
  return client.watchEvent({
    address: REGISTRY_ADDRESS,
    event: CREDENTIAL_REGISTERED_EVENT,
    onLogs: (logs) => {
      let added = 0;
      let highestBlock = BigInt(state.lastBlock);
      for (const log of logs) {
        const credentialHash = log.args.credentialHash;
        if (credentialHash !== undefined && ingestLeaf(credentialHash)) {
          added++;
        }
        if (log.blockNumber && log.blockNumber > highestBlock) {
          highestBlock = log.blockNumber;
        }
      }
      if (added > 0 || highestBlock > BigInt(state.lastBlock)) {
        state.lastBlock = highestBlock.toString();
        saveState(state);
        console.log(`[indexer] live: +${added} leaves (total ${state.leaves.length}, block ${state.lastBlock})`);
      }
    },
    onError: (err) => {
      console.error(`[indexer] watcher error:`, err);
    },
  });
}

// ----------------------------------------------------------------------------
// HTTP API
// ----------------------------------------------------------------------------

const app = new Hono();
app.use("*", cors());

app.get("/health", (c) =>
  c.json({
    ok: true,
    chainId: CHAIN_ID,
    registry: REGISTRY_ADDRESS,
    lastBlock: state.lastBlock,
    count: state.leaves.length,
  })
);

app.get("/leaves", (c) =>
  c.json({
    leaves: state.leaves,
    lastBlock: state.lastBlock,
    count: state.leaves.length,
  })
);

app.get("/root", async (c) => {
  try {
    const root = await httpClient.readContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: "currentRoot",
    });
    return c.json({ currentRoot: (root as bigint).toString() });
  } catch (err) {
    return c.json({ error: String(err) }, 502);
  }
});

// ----------------------------------------------------------------------------
// Bootstrap
// ----------------------------------------------------------------------------

const POLL_INTERVAL = Number(process.env.POLL_INTERVAL ?? 10_000); // 10s default

async function pollLoop() {
  while (true) {
    try {
      const head = await httpClient.getBlockNumber();
      const from = BigInt(state.lastBlock) + 1n;
      if (from <= head) {
        await backfill(head);
      }
    } catch (err) {
      console.error("[indexer] poll error:", err);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

async function main() {
  const head = await httpClient.getBlockNumber();
  await backfill(head);

  // Try WebSocket watcher; fall back to HTTP polling if it errors
  const watcherClient = wsClient ?? httpClient;
  startWatcher(watcherClient);
  console.log(`[indexer] watching live events on chain ${CHAIN_ID}`);

  // Always run polling as a fallback (handles WS failures on free-tier RPCs)
  pollLoop();
  console.log(`[indexer] polling every ${POLL_INTERVAL / 1000}s as fallback`);

  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`[indexer] HTTP listening on http://0.0.0.0:${info.port}`);
  });
}

main().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});
