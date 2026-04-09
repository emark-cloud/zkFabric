// Node preload hack: force IPv4 for all outbound HTTP(S) from this process.
// WSL2 here has broken IPv6 + round-robin Cloudflare IPv4; without this,
// Hardhat's provider picks a stale IP and times out while curl connects fine.
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
require("https").globalAgent.options.family = 4;
require("http").globalAgent.options.family = 4;

// Hardhat's HttpProvider uses undici.Pool — patch it so every Pool forces IPv4.
// Nuclear: patch net.createConnection so every TCP connect forces family:4.
const net = require("net");
const origCreate = net.createConnection;
net.createConnection = function (...args) {
  if (args.length && typeof args[0] === "object" && args[0] !== null) {
    args[0] = { ...args[0], family: 4, autoSelectFamily: false };
  }
  return origCreate.apply(this, args);
};

try {
  const undici = require("undici");
  const OrigPool = undici.Pool;
  function PatchedPool(origin, opts) {
    if (!(this instanceof PatchedPool)) return new PatchedPool(origin, opts);
    return Reflect.construct(OrigPool, [origin, {
      ...(opts || {}),
      connect: {
        ...(opts && opts.connect),
        family: 4,
        autoSelectFamily: false,
        timeout: 60000,
      },
      connectTimeout: 60000,
    }], PatchedPool);
  }
  Object.setPrototypeOf(PatchedPool.prototype, OrigPool.prototype);
  Object.setPrototypeOf(PatchedPool, OrigPool);
  undici.Pool = PatchedPool;
  console.error("[force-ipv4] undici.Pool patched");
} catch (e) {
  console.error("[force-ipv4] undici patch failed:", e.message);
}

