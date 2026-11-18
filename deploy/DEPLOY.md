# Deploy AgentVouch ke BSC Mainnet (via Remix, dari wallet kamu sendiri)

Kenapa dari wallet kamu: Muse tidak bisa mengirim transaksi contract-creation
dari sini — baw wajib pakai alamat tujuan (`--to`), dan tidak ada factory
CREATE permissionless di BSC. Deploy harus dari wallet yang kamu pegang
(Binance Wallet / MetaMask) lewat Remix. Kontraknya tidak punya owner/admin,
jadi alamat deployer tidak memegang kuasa apa pun atas vouch.

## 1. Dana dulu

- Deploy butuh **292.463 gas** (estimasi `eth_estimateGas`, terverifikasi
  2 RPC, cek 18 Nov 2026 22:01 WITA):
  ~0,0000146 BNB pada 0,05 gwei (harga gas saat dicek),
  ~0,0002925 BNB pada 1 gwei, ~0,0008774 BNB pada 3 gwei.
- Isi wallet deployer minimal **0,001 BNB** (deploy + buffer kalau harga gas
  naik + interaksi lanjutan). Jauh lebih murah daripada prototipe polling
  (1.699.418 gas, ~5,8x lipat).
- Deploy dari wallet yang memegang Agent ID (wallet 1, bojescrypto.ai).

## 2. Deploy di Remix

1. Buka https://remix.ethereum.org — TIDAK PERNAH memasukkan seed phrase /
   private key ke situs mana pun. Remix hanya minta koneksi wallet.
2. Buat file `AgentVouch.sol`, paste SELURUH isi
   `deploy/AgentVouch.flattened.sol` dari paket ini.
3. Compile: Solidity compiler **0.8.28**, optimizer **ON**, runs **200**,
   EVM version default.
4. Tab "Deploy & Run transactions": Environment = **Injected Provider**,
   hubungkan wallet, pastikan jaringan **BNB Smart Chain Mainnet (56)**.
5. Contract: pilih `AgentVouch`. Constructor arg (1 arg, alamat registry):
   `0x60b9262456de011f7d15a54cdd8c48baaa8b022f`
6. Klik Deploy, konfirmasi di wallet. Catat **alamat kontrak** + hash transaksi.
7. Kirim alamat kontraknya ke Muse — frontend akan dihubungkan ke alamat itu.

## 3. Verifikasi source di BscScan (wajib untuk hackathon)

1. Buka halaman kontrak di https://bscscan.com → "Verify and Publish".
2. Compiler Type: Solidity (Single file). Compiler: **0.8.28**.
   Optimization: **Yes, 200 runs**. License: **MIT**.
3. Paste SELURUH isi `deploy/AgentVouch.flattened.sol`.
4. Constructor Arguments (ABI-encoded, hex saja):
   `00000000000000000000000060b9262456de011f7d15a54cdd8c48baaa8b022f`
5. Verify. Kalau gagal, pastikan versi compiler + optimizer sama persis
   dengan saat compile di Remix.

## 4. Setelah live

- Kabari Muse alamat kontraknya → Muse: cek `totalVouches`/`registry`
  on-chain, hubungkan frontend, siapkan materi submit hackathon.
- Target hackathon: ≥30 alamat holder Agent ID berinteraksi selama periode
  submit (s.d. 9 Des 2026 16:00 WITA).
