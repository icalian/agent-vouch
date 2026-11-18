# Agent Vouch

Sybil-resistant vouching between Agent ID holders: one vouch per holder,
forever, enforced on-chain. A minimal second hackathon prototype, built to
cost far less to deploy than the polling prototype.

## Deployed (BNB Chain mainnet)

- Contract: `0x432cA9C8b7eeB382924eafB95ae7a0cCdaCc4996`
- Deploy tx: `0x980fe2c03bef3ae1320f95b98d9da5c7ac0af5fa14ca7f8fc0a09856de8eb598`
  (block 134,327,179; 289,002 gas at 0.05 gwei = 0.0000144501 BNB)
- Verified: Sourcify `exact_match` (creation + runtime), 2026-11-18.
- Live frontend: https://agent-vouch.sulaimansamadin.workers.dev
  (Cloudflare Worker `agent-vouch`, script `worker.js`, route enabled).
- Details: `deployment-mainnet.json`. The frontend defaults to this address
  on Mainnet (chain 56).

## What it is

Any Agent ID holder can vouch for exactly one address, once, forever. Vouches
are public and permanent: anyone can look up how many vouches an address has
received, whether an address has vouched, and for whom. Because Agent ID is
non-transferable and one-per-user, one holder cannot manufacture many vouches
— the trust signal cannot be Sybil-farmed from a single identity.

There is deliberately nothing else: no strings, no dynamic arrays, no
deadlines, no admin, no fees, no funds held. The whole contract is one file.

## Agent ID integration

`AgentVouch` takes the Agent ID registry address (ERC-721) in its constructor
and stores it immutably. `vouch()` calls `registry.balanceOf(msg.sender)` and
reverts unless the caller holds an Agent ID. The subject of a vouch does not
need to hold an Agent ID — only the voucher does.

Real registry (BNB Chain mainnet):
`0x60b9262456de011f7d15a54cdd8c48baaa8b022f`

## Contract API

- `vouch(address subject)` — one vouch per holder, forever. Reverts:
  `ZeroSubject`, `SelfVouch`, `AlreadyVouched`, `NotAgentIDHolder`.
- `vouchCount(address)` — vouches received by a subject.
- `hasVouched(address)` — whether an address used its one vouch.
- `vouchedFor(address)` — the subject an address vouched for (`address(0)` if none).
- `totalVouches()` — total vouches ever recorded.
- `isHolder(address)` — registry `balanceOf > 0`.
- Event `Vouched(address indexed voucher, address indexed subject)`.

## Deploy cost (verified, read-only estimate)

- Creation bytecode: **1,265 bytes** (deployed: 1,081 bytes).
- `eth_estimateGas` against two public BSC RPCs (identical result):
  **292,463 gas** — about **5.8x cheaper** than the polling prototype
  (1,699,418 gas).
- Cost: ~0.0000146 BNB at 0.05 gwei · ~0.0002925 BNB at 1 gwei ·
  ~0.0008774 BNB at 3 gwei.

## Run locally

Requirements: Foundry (`forge`, `anvil`) and Python 3. No keys, no funds.

```sh
cd ~/workspace/agent-vouch-prototype

# 1. Terminal 1: local chain
anvil

# 2. Terminal 2: deploy mock registry + AgentVouch, mint mock IDs to the
#    first three default anvil accounts (no private key used)
forge script script/DeployLocal.s.sol \
  --rpc-url http://127.0.0.1:8545 --broadcast --unlocked \
  --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# 3. Terminal 3: serve the frontend
python3 -m http.server 8080 --directory frontend
```

Open http://localhost:8080, connect a wallet on Localhost (chain 31337,
RPC `http://127.0.0.1:8545`), paste the printed AgentVouch address into
Contract Settings. To demo the holder experience, import one of anvil's
default test accounts into the wallet; any other account demonstrates the
non-holder experience.

## Tests

```sh
forge test
```

13 tests, all passing: constructor zero-registry revert, non-holder revert,
successful vouch, second-vouch revert, self-vouch revert, zero-subject
revert, multi-voucher counts, vouching for a non-holder subject, view
correctness, `Vouched` event, mock soulbound transfers, mock one-ID-per-address.

## Owner-permissions disclosure

There are none. The contract has **no owner, no admin functions, no pause,
no upgrade path, and no payable functions**. The registry address is
immutable. Nothing can alter vouches, counts, or results after deployment,
and the contract never holds funds.

## Compliance notes

- Wallet interaction is injected-provider only (`window.ethereum`); every
  action is a transaction the user confirms in their own wallet.
- No QR-code login, no pairing codes, no session storage, no signing on
  behalf of the user, no collection of seed phrases, private keys, or
  API secrets.
- No project branding of any chain or exchange; no earnings, payout, or
  "passive income" language anywhere. The footer states: gas only, no fees.

## Pending steps for a real submission

1. Deploy `AgentVouch` to BNB Chain mainnet with the real registry address
   (user decision — costs gas, irreversible). See `deploy/DEPLOY.md`.
2. Verify source on BscScan (single file + constructor arguments).
3. Host the frontend pointed at the deployed contract.
4. Drive usage: ≥30 distinct Agent ID holders interacting during the
   submission period.
5. Submit via the hackathon form before **9 Dec 2026 08:00 UTC**.
6. Keep it live through the review periods (9–20 Dec).

## Layout

- `src/AgentVouch.sol` — the contract (MIT).
- `src/MockAgentID.sol` — local-only soulbound mock registry.
- `test/AgentVouch.t.sol` — Foundry tests.
- `script/DeployLocal.s.sol` — local anvil deploy + seed script.
- `frontend/` — static single-page app (ethers v6 via CDN, ES module import).
- `abi/` — generated ABIs.
- `deploy/` — flattened source + Remix deploy guide.
