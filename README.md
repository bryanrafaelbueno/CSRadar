<div align="center">

<!-- Logo SVG inline -->
<img width="680" height="480" alt="resultado" src="https://github.com/user-attachments/assets/4e00d7b0-04c4-476a-9aeb-7a096a2579bb" />
<h1>CS RADAR</h1>

<p><strong>Local network scanner for Counter-Strike servers — CS 1.6 & CS:Source</strong></p>

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![License](https://img.shields.io/badge/License-MIT-00ff88?style=flat-square)](#license)
[![Protocol](https://img.shields.io/badge/Protocol-A2S__INFO-ff6b35?style=flat-square&logo=valve&logoColor=white)](https://developer.valvesoftware.com/wiki/Server_queries)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/yourusername/cs-radar/pulls)

<img src="https://img.shields.io/badge/CS%201.6-GoldSrc-ff6b35?style=for-the-badge" alt="CS 1.6"/>
<img src="https://img.shields.io/badge/CS%3ASource-Source%20Engine-00b4ff?style=for-the-badge" alt="CS:Source"/>

</div>

---

## Overview

**CS Radar** is a web-based LAN scanner that actively probes your local network for Counter-Strike servers using the **Valve A2S_INFO protocol** — no master server dependency, no internet required. It detects CS 1.6 (GoldSrc) and CS:Source servers running anywhere on your subnet, with real-time results streamed directly to a retro terminal-styled UI.

---

## Features

- **Active UDP scanning** — sends A2S_INFO probes to all hosts on your `/24` subnet
- **Real-time results** via Server-Sent Events (SSE), no page refresh needed
- **Auto-detects game version** — CS 1.6 (GoldSrc `0x6D`) vs CS:Source (Source `0x49`)
- **Manual IP query** — ping a specific server by IP:port
- **Concurrency-controlled** — 80 parallel probes for fast scans without flooding
- **Server info** — name, map, player count, ping, engine, VAC status
- **Copy-to-connect** — click any card to copy the `connect ip:port` command
- **Animated radar favicon** — SVG with rotating sweep and blips
- **Retro terminal UI** — scanline overlay, phosphor green palette, Orbitron font

---

## Screenshots
<img width="1920" height="961" alt="image" src="https://github.com/user-attachments/assets/630be591-ae5e-4cab-ba52-8e4f9e2beb7d" />

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18 or higher
- npm 9+

### Installation

```bash
git clone https://github.com/yourusername/cs-radar.git
cd cs-radar
npm install
```

### Running

```bash
node server.js
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

```
CS Server Scanner running at http://localhost:3000
```

---

## How It Works

<img width="246" height="401" alt="Untitled-2026-07-04-0147" src="https://github.com/user-attachments/assets/02d3b103-74cd-4361-ba5c-13e3d9556b19" />

The scanner uses the [Valve Server Query Protocol](https://developer.valvesoftware.com/wiki/Server_queries) — the same protocol used by Steam's server browser. It works entirely over **UDP**, with no TCP handshake required, making it very fast for network sweeps.

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/scan` | SSE stream — scans full subnet, emits events |
| `GET` | `/api/networks` | Returns detected local network interfaces |
| `POST` | `/api/query` | Query a specific `{ ip, port }` |

### SSE Event Types

```jsonc
{ "type": "start",    "total": 2794, "ips": 254 }
{ "type": "progress", "completed": 160, "total": 2794 }
{ "type": "found",    "server": { "name": "...", "map": "de_dust2", ... } }
{ "type": "done",     "total": 3 }
{ "type": "error",    "message": "No network interfaces found" }
```

### Server Object

```jsonc
{
  "ip": "192.168.1.42",
  "port": 27015,
  "name": "My CS 1.6 Server",
  "map": "de_dust2",
  "game": "Counter-Strike",
  "folder": "cstrike",
  "players": 8,
  "maxPlayers": 16,
  "gameType": "cs16",       // "cs16" | "css" | "goldsrc" | "source" | "tf2" | ...
  "protocol": "GoldSrc",    // "GoldSrc" | "Source"
  "appId": 10,
  "ping": 4
}
```

---

## Configuration

Edit `server.js` to adjust scan behaviour:

```js
// Ports to probe on each host
const ports = [27015, 27016, 27017, 27018, 27019, 27020, 27021, 27022, 27023, 27024, 27025];

// Concurrent UDP sockets (lower = less network noise)
const CONCURRENCY = 80;

// Per-host timeout in ms
function queryServer(ip, port, timeout = 1500) { ... }
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Server | [Express.js](https://expressjs.com) |
| Networking | Node.js `dgram` (UDP) |
| Streaming | Server-Sent Events (SSE) |
| Frontend | Vanilla JS, CSS custom properties |
| Fonts | [Orbitron](https://fonts.google.com/specimen/Orbitron), [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) |
| Protocol | [Valve A2S_INFO](https://developer.valvesoftware.com/wiki/Server_queries) |

---

## Roadmap

- [ ] Support for `/16` subnet scanning (with warning)
- [ ] Player list via `A2S_PLAYER` query
- [ ] Server rules via `A2S_RULES` query
- [ ] Export results as JSON/CSV
- [ ] CS:GO / CS2 detection
- [ ] Persistent server history (localStorage)
- [ ] Dark/light theme toggle
- [ ] Docker image

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

```bash
# Fork the repo, then:
git checkout -b feature/your-feature
git commit -m "feat: add your feature"
git push origin feature/your-feature
# Open a Pull Request
```

---

## License

[MIT](LICENSE) — feel free to use, modify, and distribute.

---

<div align="center">

Made with 💚 for the CS LAN party scene

*"Is this server on?" — CS Radar knows.*

</div>
