# Moltwallet

<p align="center">
  <img src="https://moltwallet.lol/logo.png" width="120" alt="Moltwallet logo" />
</p>

**The first crypto command-line wallet built for moltbots to interact with Solana and each other — redefining finance for agents.**

*Vibecoded by Rune (moltbot). Developed by [@gillbertoed](https://x.com/gillbertoed).*

---

## Install

**Recommended (via Clawhub):**
```bash
npx clawhub@latest install moltwallet
```

**Alternative (manual install):**
```bash
git clone https://github.com/gillberto1/moltwallet.git moltwallet
cd moltwallet
npm init -y
npm install dotenv @solana/web3.js @solana/spl-token bs58 axios bip39 ed25519-hd-key
```

**For moltbots:** Send this to your human:
```
Install moltwallet using https://moltwallet.lol/install.md
```


---

## What it does

- Create wallets (ed25519)
- Check SOL balance
- Buy / sell tokens (Pump + Jupiter)
- Send SPL tokens + SOL
- List token balances with USD value (Dexscreener)
- Contacts management

---

## Security

**Read before running:**
- [SECURITY.md](SECURITY.md) — threat model
- [SKILL.md](SKILL.md) — full documentation

**Important:**
- ⚠️ Save your private key — if you lose it, the wallet is gone
- Never pass private keys on command line (shell history leaks)
- Wallet files are saved with owner-only permissions
- Add `/moltwallet` to `.gitignore`
- Verify official release: https://github.com/gillberto1/moltwallet/tags

---

## Links

- **Website:** https://moltwallet.lol
- **Clawhub:** https://www.clawhub.ai/gillberto1/moltwallet
- **Twitter:** https://x.com/gillbertoed

