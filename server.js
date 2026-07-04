const express = require('express');
const dgram = require('dgram');
const net = require('net');
const os = require('os');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// A2S_INFO query packet (Valve protocol)
const A2S_INFO_PAYLOAD = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x54,
  0x53, 0x6F, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45, 0x6E, 0x67, 0x69, 0x6E, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79,
  0x00
]);

function getLocalNetworks() {
  const interfaces = os.networkInterfaces();
  const networks = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        // Calculate network base from IP and subnet
        const parts = addr.address.split('.').map(Number);
        const maskParts = addr.netmask.split('.').map(Number);
        const networkBase = parts.map((p, i) => p & maskParts[i]).join('.');
        const cidr = maskParts.reduce((acc, m) => acc + m.toString(2).split('').filter(b => b === '1').length, 0);

        // Only scan /24 or smaller ranges to avoid huge scans
        const effectiveCidr = Math.max(cidr, 24);

        networks.push({
          interface: name,
          address: addr.address,
          netmask: addr.netmask,
          networkBase,
          cidr: effectiveCidr
        });
      }
    }
  }
  return networks;
}

function generateIPs(networkBase, cidr) {
  const ips = [];
  if (cidr >= 24) {
    const base = networkBase.split('.').slice(0, 3).join('.');
    for (let i = 1; i <= 254; i++) {
      ips.push(`${base}.${i}`);
    }
  }
  return ips;
}

// Parse A2S_INFO response
function parseServerInfo(buf, ip, port) {
  try {
    let offset = 4; // skip 0xFF 0xFF 0xFF 0xFF
    const type = buf[offset++];

    // 0x49 = Source response, 0x6D = GoldSrc/CS1.6 response
    const isGoldSrc = type === 0x6D;
    const isSource = type === 0x49;

    if (!isGoldSrc && !isSource) return null;

    const readString = () => {
      let str = '';
      while (offset < buf.length && buf[offset] !== 0x00) {
        str += String.fromCharCode(buf[offset++]);
      }
      offset++; // skip null terminator
      return str;
    };

    let serverName, map, folder, game, players, maxPlayers, appId, gameVersion, os_type;

    if (isGoldSrc) {
      // GoldSrc (CS 1.6) format
      const address = readString(); // server address
      serverName = readString();
      map = readString();
      folder = readString();
      game = readString();
      players = buf[offset++];
      maxPlayers = buf[offset++];
      const protocol = buf[offset++];
      os_type = String.fromCharCode(buf[offset++]);
      appId = folder.toLowerCase().includes('cstrike') ? 10 : 0;
      gameVersion = '1.6';
    } else {
      // Source format
      const protocol = buf[offset++];
      serverName = readString();
      map = readString();
      folder = readString();
      game = readString();
      appId = buf.readInt16LE(offset); offset += 2;
      players = buf[offset++];
      maxPlayers = buf[offset++];
      const bots = buf[offset++];
      const serverType = String.fromCharCode(buf[offset++]);
      os_type = String.fromCharCode(buf[offset++]);
      const password = buf[offset++];
      const vac = buf[offset++];
      gameVersion = readString();
    }

    // Detect game type
    let gameType = 'unknown';
    const folderLower = folder ? folder.toLowerCase() : '';
    const gameLower = game ? game.toLowerCase() : '';

    if (folderLower === 'cstrike' || gameLower.includes('counter-strike') && !gameLower.includes('source') && !gameLower.includes('go')) {
      gameType = isSource ? 'css' : 'cs16';
    } else if (folderLower === 'cstrike_src' || (gameLower.includes('counter-strike') && gameLower.includes('source'))) {
      gameType = 'css';
    } else if (folderLower === 'tf' || gameLower.includes('team fortress')) {
      gameType = 'tf2';
    } else if (folderLower === 'left4dead' || gameLower.includes('left 4 dead')) {
      gameType = 'l4d';
    } else {
      gameType = isGoldSrc ? 'goldsrc' : 'source';
    }

    // Force appId detection for CS
    if (appId === 10 || appId === 0) {
      if (folderLower === 'cstrike') gameType = 'cs16';
    }
    if (appId === 240) gameType = 'css';

    return {
      ip,
      port,
      name: serverName || 'Unknown Server',
      map: map || 'unknown',
      folder: folder || '',
      game: game || '',
      players: players || 0,
      maxPlayers: maxPlayers || 0,
      gameType,
      appId,
      protocol: isGoldSrc ? 'GoldSrc' : 'Source',
      ping: 0
    };
  } catch (e) {
    return null;
  }
}

// Query a single server
function queryServer(ip, port, timeout = 1500) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const start = Date.now();
    let resolved = false;

    const cleanup = (result) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try { socket.close(); } catch (e) {}
      resolve(result);
    };

    const timer = setTimeout(() => cleanup(null), timeout);

    socket.on('message', (msg) => {
      const ping = Date.now() - start;
      const info = parseServerInfo(msg, ip, port);
      if (info) info.ping = ping;
      cleanup(info);
    });

    socket.on('error', () => cleanup(null));

    socket.send(A2S_INFO_PAYLOAD, 0, A2S_INFO_PAYLOAD.length, port, ip);
  });
}

// Scan with concurrency control
async function scanRange(ips, ports, progressCallback) {
  const results = [];
  const CONCURRENCY = 80;
  const tasks = [];

  for (const ip of ips) {
    for (const port of ports) {
      tasks.push({ ip, port });
    }
  }

  let completed = 0;
  const total = tasks.length;

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(({ ip, port }) => queryServer(ip, port)));

    for (const r of batchResults) {
      if (r) results.push(r);
      completed++;
      if (progressCallback) progressCallback(completed, total, r);
    }
  }

  return results;
}

// SSE scan endpoint
app.get('/api/scan', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const networks = getLocalNetworks();
  if (networks.length === 0) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'No network interfaces found' })}\n\n`);
    res.end();
    return;
  }

  const ports = [27015, 27016, 27017, 27018, 27019, 27020, 27021, 27022, 27023, 27024, 27025];
  const allIPs = [];

  for (const network of networks) {
    const ips = generateIPs(network.networkBase, network.cidr);
    allIPs.push(...ips);
  }

  const uniqueIPs = [...new Set(allIPs)];
  const total = uniqueIPs.length * ports.length;

  res.write(`data: ${JSON.stringify({ type: 'start', total, networks: networks.map(n => n.address), ips: uniqueIPs.length })}\n\n`);

  const servers = [];

  await scanRange(uniqueIPs, ports, (completed, total, found) => {
    if (found) {
      servers.push(found);
      res.write(`data: ${JSON.stringify({ type: 'found', server: found })}\n\n`);
    }
    if (completed % 50 === 0 || completed === total) {
      res.write(`data: ${JSON.stringify({ type: 'progress', completed, total })}\n\n`);
    }
  });

  res.write(`data: ${JSON.stringify({ type: 'done', total: servers.length })}\n\n`);
  res.end();
});

app.get('/api/networks', (req, res) => {
  res.json(getLocalNetworks());
});

// Query specific server
app.post('/api/query', async (req, res) => {
  const { ip, port = 27015 } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });

  const result = await queryServer(ip, parseInt(port), 3000);
  if (result) {
    res.json(result);
  } else {
    res.status(404).json({ error: 'No CS server found at that address' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CS Server Scanner running at http://localhost:${PORT}`);
});