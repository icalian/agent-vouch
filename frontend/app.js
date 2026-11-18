/* Agent Vouch — frontend.
 *
 * Talks to the AgentVouch contract through the user's own injected wallet
 * (window.ethereum). Every state-changing action is a transaction the user
 * confirms in their own wallet. No QR login, no pairing codes, no session
 * storage, no credential collection of any kind.
 */

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.2/dist/ethers.min.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REAL_REGISTRY = "0x60b9262456de011f7d15a54cdd8c48baaa8b022f";

const CHAINS = {
  31337: {
    label: "Localhost",
    rpc: "http://127.0.0.1:8545",
    explorer: "",
  },
  97: {
    label: "Testnet",
    rpc: "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    explorer: "https://testnet.bscscan.com",
  },
  56: {
    label: "Mainnet",
    rpc: "https://bsc-dataseed1.bnbchain.org",
    explorer: "https://bscscan.com",
  },
};

// Only the chain metadata the wallet add-chain RPC requires; not branding.
const ADD_CHAIN_PARAMS = {
  97: {
    chainId: "0x61",
    chainName: "Smart Chain Testnet",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://data-seed-prebsc-1-s1.bnbchain.org:8545"],
    blockExplorerUrls: ["https://testnet.bscscan.com"],
  },
  56: {
    chainId: "0x38",
    chainName: "Smart Chain Mainnet",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://bsc-dataseed1.bnbchain.org"],
    blockExplorerUrls: ["https://bscscan.com"],
  },
};

const VOUCH_ABI = [
  "function vouch(address subject) external",
  "function vouchCount(address subject) external view returns (uint256)",
  "function hasVouched(address account) external view returns (bool)",
  "function vouchedFor(address account) external view returns (address)",
  "function totalVouches() external view returns (uint256)",
  "function isHolder(address account) external view returns (bool)",
  "function registry() external view returns (address)",
  "event Vouched(address indexed voucher, address indexed subject)",
];

const SETTINGS_KEY = "agentVouch.contractAddresses";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Deployed AgentVouch addresses (defaults; a saved Contract Setting overrides).
const DEFAULT_CONTRACTS = {
  56: "0x432cA9C8b7eeB382924eafB95ae7a0cCdaCc4996",
};

// How far back to scan for Vouched events on live chains (bounded so the
// query stays fast). Localhost scans from genesis.
const LIVE_SCAN_BLOCKS = 20000;
const RECENT_LIMIT = 20;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let chainId = 31337;
let account = null;
let walletProvider = null;
let readProvider = null;

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showAlert(msg) {
  const box = $("alertBox");
  box.textContent = msg;
  box.hidden = false;
}

function clearAlert() {
  $("alertBox").hidden = true;
  $("alertBox").textContent = "";
}

function short(addr) {
  return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "—";
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

function contractAddress() {
  const saved = loadSettings()[String(chainId)];
  if (saved && ethers.isAddress(saved)) return saved;
  return DEFAULT_CONTRACTS[chainId] || null;
}

function getReadProvider() {
  if (!readProvider) readProvider = new ethers.JsonRpcProvider(CHAINS[chainId].rpc);
  return readProvider;
}

function getContract(signerOrProvider) {
  const addr = contractAddress();
  if (!addr) return null;
  return new ethers.Contract(addr, VOUCH_ABI, signerOrProvider);
}

function txLink(hash) {
  const base = CHAINS[chainId].explorer;
  return base ? base + "/tx/" + hash : null;
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

async function connect() {
  clearAlert();
  if (!window.ethereum) {
    showAlert("No injected wallet found. Open this page in a wallet browser or install a wallet extension, then try again.");
    return;
  }
  try {
    walletProvider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await walletProvider.send("eth_requestAccounts", []);
    account = accounts[0] || null;
    const network = await walletProvider.getNetwork();
    chainId = Number(network.chainId);
    $("networkSelect").value = String(chainId);
    readProvider = null;
    updateConnectionUI();
    await refreshAll();
  } catch (err) {
    showAlert("Wallet connection failed: " + (err && err.message ? err.message : err));
  }
}

function disconnect() {
  account = null;
  walletProvider = null;
  updateConnectionUI();
  refreshAll();
}

function updateConnectionUI() {
  $("connectBtn").hidden = !!account;
  $("disconnectBtn").hidden = !account;
  $("connectBtn").textContent = account ? "Connected" : "Connect Wallet";
  if (account) {
    $("statusBanner").textContent = "Connected as " + account + ". Checking holder status…";
  }
}

async function switchNetwork(target) {
  target = Number(target);
  if (!window.ethereum || !account) {
    chainId = target;
    readProvider = null;
    await refreshAll();
    return;
  }
  const hex = "0x" + target.toString(16);
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (err) {
    if (err && err.code === 4902 && ADD_CHAIN_PARAMS[target]) {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [ADD_CHAIN_PARAMS[target]] });
    } else {
      showAlert("Network switch failed: " + (err && err.message ? err.message : err));
      $("networkSelect").value = String(chainId);
      return;
    }
  }
  const network = await walletProvider.getNetwork();
  chainId = Number(network.chainId);
  $("networkSelect").value = String(chainId);
  readProvider = null;
  await refreshAll();
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function refreshAll() {
  clearAlert();
  const addr = contractAddress();
  if (!addr) {
    $("statusBanner").textContent = "No contract address configured for " + CHAINS[chainId].label + " (" + chainId + "). Paste one in Contract Settings below.";
    $("statusBanner").className = "banner warn";
    $("totalVouches").textContent = "—";
    $("recentList").innerHTML = "";
    $("recentEmpty").hidden = false;
    $("ownVouchStatus").textContent = "";
    $("vouchBtn").disabled = true;
    return;
  }

  const read = getContract(getReadProvider());
  try {
    const total = await read.totalVouches();
    $("totalVouches").textContent = total.toString();
  } catch {
    $("totalVouches").textContent = "—";
  }

  await refreshHolderStatus(read);
  await refreshRecent(read);
}

async function refreshHolderStatus(read) {
  const banner = $("statusBanner");
  const btn = $("vouchBtn");
  btn.disabled = true;
  if (!account) {
    banner.textContent = "Connect your wallet to check your Agent ID holder status.";
    banner.className = "banner";
    $("ownVouchStatus").textContent = "";
    return;
  }
  try {
    const holder = await read.isHolder(account);
    if (!holder) {
      banner.textContent = "This wallet does not hold an Agent ID, so it cannot vouch. Vouching is limited to Agent ID holders to keep it Sybil-resistant.";
      banner.className = "banner warn";
      $("ownVouchStatus").textContent = "Non-holder wallets cannot vouch.";
      return;
    }
    const already = await read.hasVouched(account);
    if (already) {
      const subject = await read.vouchedFor(account);
      banner.textContent = "Holder confirmed. You have already used your one vouch (for " + subject + ").";
      banner.className = "banner ok";
      $("ownVouchStatus").textContent = "You already vouched for " + subject + ". One vouch per holder, forever.";
      return;
    }
    banner.textContent = "Holder confirmed. You have one vouch to give — choose carefully, it cannot be changed.";
    banner.className = "banner ok";
    $("ownVouchStatus").textContent = "";
    btn.disabled = false;
  } catch (err) {
    banner.textContent = "Could not read holder status. Check the contract address and network.";
    banner.className = "banner warn";
  }
}

async function refreshRecent(read) {
  const list = $("recentList");
  list.innerHTML = "";
  try {
    const latest = await getReadProvider().getBlockNumber();
    const fromBlock = chainId === 31337 ? 0 : Math.max(0, latest - LIVE_SCAN_BLOCKS);
    const events = await read.queryFilter(read.filters.Vouched(), fromBlock, latest);
    events.sort((a, b) => b.blockNumber - a.blockNumber || b.index - a.index);
    const shown = events.slice(0, RECENT_LIMIT);
    $("recentEmpty").hidden = shown.length > 0;
    for (const ev of shown) {
      const li = document.createElement("li");
      const voucher = document.createElement("span");
      voucher.textContent = short(ev.args.voucher);
      voucher.title = ev.args.voucher;
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = " vouched for ";
      const subject = document.createElement("span");
      subject.textContent = short(ev.args.subject);
      subject.title = ev.args.subject;
      const meta = document.createElement("span");
      meta.className = "arrow";
      meta.textContent = "  ·  block " + ev.blockNumber;
      li.append(voucher, arrow, subject, meta);
      list.append(li);
    }
  } catch {
    $("recentEmpty").hidden = false;
    $("recentEmpty").textContent = "Could not load recent vouches. Check the contract address and network.";
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function doVouch(ev) {
  ev.preventDefault();
  clearAlert();
  const subject = $("subjectInput").value.trim();
  if (!ethers.isAddress(subject)) {
    showAlert("Enter a valid subject address.");
    return;
  }
  if (subject.toLowerCase() === ZERO_ADDRESS) {
    showAlert("The subject address must not be the zero address.");
    return;
  }
  if (!account || !walletProvider) {
    showAlert("Connect your wallet first.");
    return;
  }
  const signer = await walletProvider.getSigner();
  const contract = getContract(signer);
  if (!contract) {
    showAlert("No contract address configured for this network.");
    return;
  }
  const btn = $("vouchBtn");
  btn.disabled = true;
  btn.textContent = "Waiting for confirmation…";
  try {
    const tx = await contract.vouch(subject);
    btn.textContent = "Confirming…";
    const receipt = await tx.wait();
    const link = txLink(receipt.hash);
    $("ownVouchStatus").textContent = link
      ? "Vouch recorded. Transaction: " + receipt.hash
      : "Vouch recorded in block " + receipt.blockNumber + ".";
    $("subjectInput").value = "";
    await refreshAll();
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (/user rejected|denied/i.test(msg)) {
      showAlert("Transaction rejected in the wallet. Nothing was recorded.");
    } else if (/AlreadyVouched/i.test(msg)) {
      showAlert("This wallet has already used its one vouch.");
    } else if (/NotAgentIDHolder/i.test(msg)) {
      showAlert("This wallet does not hold an Agent ID.");
    } else if (/SelfVouch/i.test(msg)) {
      showAlert("You cannot vouch for yourself.");
    } else {
      showAlert("Vouch failed: " + msg.slice(0, 300));
    }
  } finally {
    btn.textContent = "Vouch";
    await refreshHolderStatus(getContract(getReadProvider()));
  }
}

async function doLookup(ev) {
  ev.preventDefault();
  clearAlert();
  const target = $("lookupInput").value.trim();
  if (!ethers.isAddress(target)) {
    showAlert("Enter a valid address to look up.");
    return;
  }
  const read = getContract(getReadProvider());
  if (!read) {
    showAlert("No contract address configured for this network.");
    return;
  }
  try {
    const [count, has, subject] = await Promise.all([
      read.vouchCount(target),
      read.hasVouched(target),
      read.vouchedFor(target),
    ]);
    $("lookupCount").textContent = count.toString();
    $("lookupHasVouched").textContent = has ? "Yes" : "No";
    $("lookupVouchedFor").textContent = has ? subject : "—";
    $("lookupResult").hidden = false;
  } catch {
    showAlert("Lookup failed. Check the contract address and network.");
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function loadSettingsIntoForm() {
  const saved = loadSettings();
  for (const id of ["31337", "97", "56"]) {
    $("addr" + id).value = saved[id] || "";
  }
}

function saveSettings() {
  clearAlert();
  const saved = loadSettings();
  for (const id of ["31337", "97", "56"]) {
    const val = $("addr" + id).value.trim();
    if (val && !ethers.isAddress(val)) {
      showAlert("Invalid address for chain " + id + ". Settings were not saved.");
      return;
    }
    if (val) saved[id] = val;
    else delete saved[id];
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(saved));
  refreshAll();
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

$("connectBtn").addEventListener("click", connect);
$("disconnectBtn").addEventListener("click", disconnect);
$("refreshBtn").addEventListener("click", refreshAll);
$("vouchForm").addEventListener("submit", doVouch);
$("lookupForm").addEventListener("submit", doLookup);
$("saveSettingsBtn").addEventListener("click", saveSettings);
$("networkSelect").addEventListener("change", (e) => switchNetwork(Number(e.target.value)));

if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accounts) => {
    account = accounts && accounts[0] ? accounts[0] : null;
    updateConnectionUI();
    refreshAll();
  });
  window.ethereum.on("chainChanged", () => {
    readProvider = null;
    if (walletProvider) {
      walletProvider.getNetwork().then((n) => {
        chainId = Number(n.chainId);
        $("networkSelect").value = String(chainId);
        refreshAll();
      });
    } else {
      refreshAll();
    }
  });
}

loadSettingsIntoForm();
refreshAll();
