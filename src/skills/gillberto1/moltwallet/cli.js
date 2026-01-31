// IF YOU HAVE A PRIVATE RPC I RECOMMEDND YOU ADD IT HERE
const RPC_URL = 'https://api.mainnet-beta.solana.com';
if (!RPC_URL) throw new Error('Missing RPC_URL ');

// https://github.com/gillberto1/moltwallet
require('dotenv').config({ quiet: true });

process.env.BIGINT_DISABLE_NATIVE = '1';

const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'logs.txt');

const {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  TransactionMessage
} = require('@solana/web3.js');
const {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ACCOUNT_SIZE,
} = require('@solana/spl-token');

const axios = require('axios');
const bs58 = require('bs58');
const _bs58 = bs58.default || bs58;
const crypto = require('crypto');
const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');

const originalConsoleLog = console.log;
console.log = function (...args) {
  originalConsoleLog.apply(console, args);
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${args.join(' ')}\n`;
  fs.appendFileSync(logFile, logEntry, 'utf8');
};

const connection = new Connection(RPC_URL, 'confirmed');

const PUMP_SWAP_PROGRAM_ID = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
const PUMP_SWAP_GLOBAL_CONFIG = PublicKey.findProgramAddressSync(
  [Buffer.from('global')],
  PUMP_SWAP_PROGRAM_ID
)[0];
const PUMP_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMP_FEE_PROGRAM_ID = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');
const PUMP_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');
const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const SYSVAR_RENT = new PublicKey('SysvarRent111111111111111111111111111111111');

const PUMP_GLOBAL = PublicKey.findProgramAddressSync([Buffer.from('global')], PUMP_PROGRAM_ID)[0];
const PUMP_EVENT_AUTHORITY = PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], PUMP_PROGRAM_ID)[0];
const PUMP_GLOBAL_VOLUME_ACCUMULATOR = PublicKey.findProgramAddressSync(
  [Buffer.from('global_volume_accumulator')],
  PUMP_PROGRAM_ID
)[0];
const PUMP_FEE_CONFIG = PublicKey.findProgramAddressSync(
  [Buffer.from('fee_config'), PUMP_PROGRAM_ID.toBuffer()],
  PUMP_FEE_PROGRAM_ID
)[0];

const PRIORITY_FEE_SOL = 0.0001;
// 
function computeUnitPriceMicrolamports(unitLimit) {
  const feeLamports = Math.floor(PRIORITY_FEE_SOL * LAMPORTS_PER_SOL);
  return Math.max(0, Math.floor((feeLamports * 1_000_000) / unitLimit));
}

async function sendTx(tx, signers) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  if (tx instanceof Transaction) {
    tx.feePayer = signers[0].publicKey;
    tx.recentBlockhash = blockhash;
    tx.sign(...signers);
    const rawTx = tx.serialize();
    const sig = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      maxRetries: 5,
    });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    return sig;
  }

  if (tx instanceof VersionedTransaction) {
    tx.message.recentBlockhash = blockhash;
    tx.sign(signers);
    const rawTx = tx.serialize();
    const sig = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      maxRetries: 5,
    });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    return sig;
  }

  throw new Error('Unsupported transaction type: must be Transaction or VersionedTransaction');
}

function keypairFromPrivateKey(pk) {
  if (typeof pk === 'string') {
    const trimmed = pk.trim();
    if (trimmed.startsWith('[')) {
      pk = JSON.parse(trimmed);
    } else {
      pk = _bs58.decode(trimmed);
    }
  }
  if (Array.isArray(pk)) pk = Uint8Array.from(pk);
  if (!(pk instanceof Uint8Array)) {
    throw new Error('privateKey must be Uint8Array, array, or JSON string array');
  }
  return Keypair.fromSecretKey(pk);
}

async function tokenProgramForMint(mintPk) {
  const info = await connection.getAccountInfo(mintPk);
  if (!info) throw new Error('Mint not found');
  return info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}

function anchorDisc(name) {
  return crypto.createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

function bondingCurvePda(mintPk) {
  return PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mintPk.toBuffer()], PUMP_PROGRAM_ID)[0];
}

function mintAuthorityPda() {
  return PublicKey.findProgramAddressSync([Buffer.from('mint-authority')], PUMP_PROGRAM_ID)[0];
}

function metadataPda(mintPk) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPk.toBuffer()],
    MPL_TOKEN_METADATA_PROGRAM_ID
  )[0];
}

function creatorVaultPda(creator) {
  return PublicKey.findProgramAddressSync([Buffer.from('creator-vault'), creator.toBuffer()], PUMP_PROGRAM_ID)[0];
}

function userVolumeAccumulatorPda(user) {
  return PublicKey.findProgramAddressSync([Buffer.from('user_volume_accumulator'), user.toBuffer()], PUMP_PROGRAM_ID)[0];
}

async function getBondingCurveState(mintPk, tokenProgramId) {
  const bondingCurve = bondingCurvePda(mintPk);
  const associatedBondingCurve = await getAssociatedTokenAddress(
    mintPk,
    bondingCurve,
    true,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const info = await connection.getAccountInfo(bondingCurve);
  if (!info) return null;

  const d = info.data;
  return {
    bondingCurve,
    associatedBondingCurve,
    virtualTokenReserves: d.readBigUInt64LE(8),
    virtualSolReserves: d.readBigUInt64LE(16),
    complete: d[48] === 1,
    creator: new PublicKey(d.slice(49, 81)),
  };
}

async function buyToken({ privateKey, mint, sol, slippageBps = 500 }) {
  const user = keypairFromPrivateKey(privateKey);
  const mintPk = new PublicKey(mint);
  const lamportsIn = Math.floor(sol * LAMPORTS_PER_SOL);
  const tokenProgramId = await tokenProgramForMint(mintPk);

  const curve = await getBondingCurveState(mintPk, tokenProgramId);
  if (!curve) throw new Error('Bonding curve not found');

  // ─── PATH 1: PRE-BONDED (Pump.fun native bonding curve) ─────────────────
  if (!curve.complete) {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction().add(
      // Boost priority so we don't hit blockhash expiry under load
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: computeUnitPriceMicrolamports(300_000) })
    );

    const userAta = await getAssociatedTokenAddress(
      mintPk, user.publicKey, false, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const bcAta = await getAssociatedTokenAddress(
      mintPk, curve.bondingCurve, true, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Precompute rent for any missing ATAs to avoid rent-exemption failures
    const rentExempt = await connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);
    let rentNeeded = 0;

    const userAtaInfo = await connection.getAccountInfo(userAta);
    const bcAtaInfo = await connection.getAccountInfo(bcAta);
    const bondingCurveInfo = await connection.getAccountInfo(curve.bondingCurve);

    if (!userAtaInfo) {
      rentNeeded += rentExempt;
      tx.add(
        createAssociatedTokenAccountInstruction(
          user.publicKey, userAta, user.publicKey, mintPk, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    if (!bcAtaInfo) {
      rentNeeded += rentExempt;
      tx.add(
        createAssociatedTokenAccountInstruction(
          user.publicKey, bcAta, curve.bondingCurve, mintPk, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    // Top up bonding curve lamports to rent-exempt if needed
    let topUpLamports = 0;
    if (bondingCurveInfo) {
      const neededForRent = rentExempt;
      if (bondingCurveInfo.lamports < neededForRent) {
        topUpLamports = neededForRent - bondingCurveInfo.lamports;
        tx.add(
          SystemProgram.transfer({
            fromPubkey: user.publicKey,
            toPubkey: curve.bondingCurve,
            lamports: topUpLamports,
          })
        );
      }
    } else {
      throw new Error('Bonding curve account missing on-chain');
    }

    // Ensure wallet can cover trade + rent + any bonding-curve top-up + a small fee buffer
    const feeBufferLamports = Math.floor(0.0005 * LAMPORTS_PER_SOL); // ~0.0005 SOL buffer
    const neededLamports = lamportsIn + rentNeeded + topUpLamports + feeBufferLamports;
    if (balance < neededLamports) {
      throw new Error(`Wallet balance too low for trade + rent (need ${(neededLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL)`);
    }

    const tradeLamports = lamportsIn;
    const tradeLamportsBig = BigInt(tradeLamports);

    const newSol = curve.virtualSolReserves + tradeLamportsBig;
    const newToken = (curve.virtualSolReserves * curve.virtualTokenReserves) / newSol;
    const tokensOut = curve.virtualTokenReserves - newToken;
    const maxSolCost = tradeLamportsBig + (tradeLamportsBig * BigInt(slippageBps)) / 10_000n;

    const data = Buffer.concat([anchorDisc('buy'), Buffer.alloc(8), Buffer.alloc(8)]);
    data.writeBigUInt64LE(tokensOut, 8);
    data.writeBigUInt64LE(maxSolCost, 16);

    tx.add(
      new TransactionInstruction({
        programId: PUMP_PROGRAM_ID,
        keys: [
          { pubkey: PUMP_GLOBAL, isSigner: false, isWritable: false },
          { pubkey: PUMP_FEE_RECIPIENT, isSigner: false, isWritable: true },
          { pubkey: mintPk, isSigner: false, isWritable: false },
          { pubkey: curve.bondingCurve, isSigner: false, isWritable: true },
          { pubkey: bcAta, isSigner: false, isWritable: true },
          { pubkey: userAta, isSigner: false, isWritable: true },
          { pubkey: user.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: tokenProgramId, isSigner: false, isWritable: false },
          { pubkey: creatorVaultPda(curve.creator), isSigner: false, isWritable: true },
          { pubkey: PUMP_EVENT_AUTHORITY, isSigner: false, isWritable: false },
          { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: PUMP_GLOBAL_VOLUME_ACCUMULATOR, isSigner: false, isWritable: false },
          { pubkey: userVolumeAccumulatorPda(user.publicKey), isSigner: false, isWritable: true },
          { pubkey: PUMP_FEE_CONFIG, isSigner: false, isWritable: false },
          { pubkey: PUMP_FEE_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data
      })
    );

    tx.feePayer = user.publicKey;
    tx.recentBlockhash = blockhash;
    tx.sign(user);

    // Send with a lightweight retry to avoid blockhash expiry
    let sig;
    try {
      sig = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 5,
      });
    } catch (e) {
      // If blockhash/fee issues, refresh blockhash and resend once
      if (e?.message?.includes('blockheight exceeded')) {
        const { blockhash: bh2, lastValidBlockHeight: lvbh2 } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = bh2;
        tx.sign(user);
        sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 5 });
        // update for confirm
        return { signature: sig, tradeLamports, blockhash: bh2, lastValidBlockHeight: lvbh2 };
      }
      throw e;
    }

    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    return { signature: sig, tradeLamports };
  }

  else {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const instructionCollector = new Transaction();

    const tradeLamports = lamportsIn;

    const inputMint = 'So11111111111111111111111111111111111111112';
    const outputMint = mint;

    const quoteUrl = `https://public.jupiterapi.com/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${tradeLamports}&slippageBps=${slippageBps}&onlyDirectRoutes=false`;

    let quoteResponse;
    try {
      const quoteRes = await axios.get(quoteUrl);
      quoteResponse = quoteRes.data;
    } catch (err) {
      throw new Error(`Jupiter quote failed: ${err.response?.status || ''} - ${err.response?.data?.error || err.message}`);
    }

    if (!quoteResponse || !quoteResponse.outAmount) {
      throw new Error('Invalid quote from Jupiter');
    }

    const instructionsUrl = 'https://public.jupiterapi.com/swap-instructions';
    const body = {
      quoteResponse,
      userPublicKey: user.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      computeUnitPriceMicroLamports: computeUnitPriceMicrolamports(600_000),
      useSharedAccounts: true,
    };

    let swapInstructionsData;
    try {
      const res = await axios.post(instructionsUrl, body, {
        headers: { 'Content-Type': 'application/json' }
      });
      swapInstructionsData = res.data;
    } catch (err) {
      throw new Error(`Jupiter swap-instructions failed: ${err.response?.status || ''} - ${err.response?.data?.error || err.message}`);
    }

    const jupiterInstructions = [];

    if (swapInstructionsData.setupInstructions) {
      swapInstructionsData.setupInstructions.forEach(instr => {
        jupiterInstructions.push(new TransactionInstruction({
          programId: new PublicKey(instr.programId),
          keys: instr.accounts.map(a => ({
            pubkey: new PublicKey(a.pubkey),
            isSigner: a.isSigner,
            isWritable: a.isWritable
          })),
          data: Buffer.from(instr.data, 'base64')
        }));
      });
    }

    if (swapInstructionsData.swapInstruction) {
      const instr = swapInstructionsData.swapInstruction;
      jupiterInstructions.push(new TransactionInstruction({
        programId: new PublicKey(instr.programId),
        keys: instr.accounts.map(a => ({
          pubkey: new PublicKey(a.pubkey),
          isSigner: a.isSigner,
          isWritable: a.isWritable
        })),
        data: Buffer.from(instr.data, 'base64')
      }));
    }

    if (swapInstructionsData.cleanupInstruction) {
      const instr = swapInstructionsData.cleanupInstruction;
      jupiterInstructions.push(new TransactionInstruction({
        programId: new PublicKey(instr.programId),
        keys: instr.accounts.map(a => ({
          pubkey: new PublicKey(a.pubkey),
          isSigner: a.isSigner,
          isWritable: a.isWritable
        })),
        data: Buffer.from(instr.data, 'base64')
      }));
    }

    instructionCollector.add(...jupiterInstructions);

    let lookupTables = [];
    if (swapInstructionsData.addressLookupTableAccounts) {
      lookupTables = swapInstructionsData.addressLookupTableAccounts.map(alt => ({
        key: new PublicKey(alt.key),
        writableIndexes: alt.writableIndexes || [],
        readonlyIndexes: alt.readonlyIndexes || []
      }));
    }

    const messageV0 = new TransactionMessage({
      payerKey: user.publicKey,
      recentBlockhash: blockhash,
      instructions: instructionCollector.instructions
    }).compileToV0Message(lookupTables);

    const versionedTx = new VersionedTransaction(messageV0);
    versionedTx.sign([user]);

    const sig = await sendTx(versionedTx, [user]);

    return { signature: sig, tradeLamports };
  }
}

async function sellToken({ privateKey, mint, amount, slippageBps = 500 }) {
  const user = keypairFromPrivateKey(privateKey);
  const mintPk = new PublicKey(mint);
  const tokenProgramId = await tokenProgramForMint(mintPk);

  const userAta = await getAssociatedTokenAddress(
    mintPk, user.publicKey, false, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const bal = await connection.getTokenAccountBalance(userAta).catch(() => null);
  const decimals = bal?.value?.decimals ?? 6;
  const amountRaw = BigInt(Math.floor(Number(amount) * 10 ** decimals));
  if (amountRaw <= 0n) throw new Error('Amount must be > 0');

  const curve = await getBondingCurveState(mintPk, tokenProgramId);
  if (!curve) throw new Error('Bonding curve not found');

  // ─── PATH 1: PRE-BONDED (Pump.fun native bonding curve) ─────────────────
  if (!curve.complete) {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: computeUnitPriceMicrolamports(300_000) })
    );

    const bcAta = await getAssociatedTokenAddress(
      mintPk, curve.bondingCurve, true, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const newToken = curve.virtualTokenReserves + amountRaw;
    const newSol = (curve.virtualSolReserves * curve.virtualTokenReserves) / newToken;
    const solOut = curve.virtualSolReserves - newSol;
    const minSolOut = solOut - (solOut * BigInt(slippageBps)) / 10_000n;

    const data = Buffer.concat([anchorDisc('sell'), Buffer.alloc(8), Buffer.alloc(8)]);
    data.writeBigUInt64LE(amountRaw, 8);
    data.writeBigUInt64LE(minSolOut, 16);

    tx.add(
      new TransactionInstruction({
        programId: PUMP_PROGRAM_ID,
        keys: [
          { pubkey: PUMP_GLOBAL, isSigner: false, isWritable: false },
          { pubkey: PUMP_FEE_RECIPIENT, isSigner: false, isWritable: true },
          { pubkey: mintPk, isSigner: false, isWritable: false },
          { pubkey: curve.bondingCurve, isSigner: false, isWritable: true },
          { pubkey: bcAta, isSigner: false, isWritable: true },
          { pubkey: userAta, isSigner: false, isWritable: true },
          { pubkey: user.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: tokenProgramId, isSigner: false, isWritable: false },
          { pubkey: creatorVaultPda(curve.creator), isSigner: false, isWritable: true },
          { pubkey: PUMP_EVENT_AUTHORITY, isSigner: false, isWritable: false },
          { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: PUMP_GLOBAL_VOLUME_ACCUMULATOR, isSigner: false, isWritable: false },
          { pubkey: userVolumeAccumulatorPda(user.publicKey), isSigner: false, isWritable: true },
          { pubkey: PUMP_FEE_CONFIG, isSigner: false, isWritable: false },
          { pubkey: PUMP_FEE_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data
      })
    );

    tx.feePayer = user.publicKey;
    tx.recentBlockhash = blockhash;
    tx.sign(user);

    let sig;
    try {
      sig = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 5,
      });
    } catch (e) {
      if (e?.message?.includes('blockheight exceeded')) {
        const { blockhash: bh2, lastValidBlockHeight: lvbh2 } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = bh2;
        tx.sign(user);
        sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 5 });
        return { signature: sig, amountRaw: amountRaw.toString(), blockhash: bh2, lastValidBlockHeight: lvbh2 };
      }
      throw e;
    }

    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    return { signature: sig, amountRaw: amountRaw.toString() };
  }

  // ─── PATH 2: BONDED (Jupiter) ───────────────────────────────────────────
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const instructionCollector = new Transaction();

  const inputMint = mint;
  const outputMint = 'So11111111111111111111111111111111111111112';

  const quoteUrl = `https://public.jupiterapi.com/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountRaw.toString()}&slippageBps=${slippageBps}&onlyDirectRoutes=false`;

  let quoteResponse;
  try {
    const quoteRes = await axios.get(quoteUrl);
    quoteResponse = quoteRes.data;
  } catch (err) {
    throw new Error(`Jupiter quote failed: ${err.response?.status || ''} - ${err.response?.data?.error || err.message}`);
  }

  if (!quoteResponse || !quoteResponse.outAmount) {
    throw new Error('Invalid quote from Jupiter');
  }

  const instructionsUrl = 'https://public.jupiterapi.com/swap-instructions';
  const body = {
    quoteResponse,
    userPublicKey: user.publicKey.toBase58(),
    wrapAndUnwrapSol: true,
    computeUnitPriceMicroLamports: computeUnitPriceMicrolamports(600_000),
    useSharedAccounts: true,
  };

  let swapInstructionsData;
  try {
    const res = await axios.post(instructionsUrl, body, {
      headers: { 'Content-Type': 'application/json' }
    });
    swapInstructionsData = res.data;
  } catch (err) {
    throw new Error(`Jupiter swap-instructions failed: ${err.response?.status || ''} - ${err.response?.data?.error || err.message}`);
  }

  const jupiterInstructions = [];

  if (swapInstructionsData.setupInstructions) {
    swapInstructionsData.setupInstructions.forEach(instr => {
      jupiterInstructions.push(new TransactionInstruction({
        programId: new PublicKey(instr.programId),
        keys: instr.accounts.map(a => ({
          pubkey: new PublicKey(a.pubkey),
          isSigner: a.isSigner,
          isWritable: a.isWritable
        })),
        data: Buffer.from(instr.data, 'base64')
      }));
    });
  }

  if (swapInstructionsData.swapInstruction) {
    const instr = swapInstructionsData.swapInstruction;
    jupiterInstructions.push(new TransactionInstruction({
      programId: new PublicKey(instr.programId),
      keys: instr.accounts.map(a => ({
        pubkey: new PublicKey(a.pubkey),
        isSigner: a.isSigner,
        isWritable: a.isWritable
      })),
      data: Buffer.from(instr.data, 'base64')
    }));
  }

  if (swapInstructionsData.cleanupInstruction) {
    const instr = swapInstructionsData.cleanupInstruction;
    jupiterInstructions.push(new TransactionInstruction({
      programId: new PublicKey(instr.programId),
      keys: instr.accounts.map(a => ({
        pubkey: new PublicKey(a.pubkey),
        isSigner: a.isSigner,
        isWritable: a.isWritable
      })),
      data: Buffer.from(instr.data, 'base64')
    }));
  }

  instructionCollector.add(...jupiterInstructions);

  let lookupTables = [];
  if (swapInstructionsData.addressLookupTableAccounts) {
    lookupTables = swapInstructionsData.addressLookupTableAccounts.map(alt => ({
      key: new PublicKey(alt.key),
      writableIndexes: alt.writableIndexes || [],
      readonlyIndexes: alt.readonlyIndexes || []
    }));
  }

  const messageV0 = new TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: blockhash,
    instructions: instructionCollector.instructions
  }).compileToV0Message(lookupTables);

  const versionedTx = new VersionedTransaction(messageV0);
  versionedTx.sign([user]);

  const sig = await sendTx(versionedTx, [user]);

  return { signature: sig, amountRaw: amountRaw.toString() };
}

function createWallet() {
  const kp = Keypair.generate();
  return { publicKey: kp.publicKey.toBase58(), privateKey: _bs58.encode(kp.secretKey) };
}

async function getWalletBalance(pubkey) {
  const balance = await connection.getBalance(new PublicKey(pubkey));
  return balance / LAMPORTS_PER_SOL;
}

async function sendToken({ privateKey, mint, to, amount, decimals = null }) {
  const sender = keypairFromPrivateKey(privateKey);
  const mintPk = new PublicKey(mint);
  const toPk = new PublicKey(to);
  const tokenProgramId = await tokenProgramForMint(mintPk);

  const senderAta = await getAssociatedTokenAddress(
    mintPk,
    sender.publicKey,
    false,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const receiverAta = await getAssociatedTokenAddress(
    mintPk,
    toPk,
    false,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Create receiver ATA if missing
  const receiverInfo = await connection.getAccountInfo(receiverAta);

  if (decimals === null) {
    const bal = await connection.getTokenAccountBalance(senderAta).catch(() => null);
    decimals = bal?.value?.decimals ?? 6;
  }
  const amountRaw = BigInt(Math.floor(Number(amount) * 10 ** decimals));

  const { createTransferInstruction } = require('@solana/spl-token');
  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: computeUnitPriceMicrolamports(100_000) })
  );

  if (!receiverInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        sender.publicKey,
        receiverAta,
        toPk,
        mintPk,
        tokenProgramId,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  tx.add(
    createTransferInstruction(
      senderAta,
      receiverAta,
      sender.publicKey,
      amountRaw,
      [],
      tokenProgramId
    )
  );

  const sig = await sendTx(tx, [sender]);
  return { signature: sig, amount_raw: amountRaw.toString(), decimals };
}

async function preflightCheck(walletPubkey, minSol) {
  try {
    await connection.getLatestBlockhash('finalized');
  } catch (e) {
    throw new Error(`RPC unavailable: ${e.message}`);
  }
  let balLamports = 0;
  try {
    balLamports = await connection.getBalance(new PublicKey(walletPubkey));
  } catch (e) {
    throw new Error(`Balance check failed: ${e.message}`);
  }
  const balSol = balLamports / LAMPORTS_PER_SOL;
  if (balSol < minSol) throw new Error(`Insufficient SOL: ${balSol.toFixed(4)} / ${minSol}`);
  return { balSol };
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(`Welcome to Moltwallet!\nDeveloped solely by https://x.com/gillbertoed and Claude Opus. Try it out!\n\nTo open this menu anytime, just type: moltwallet\n\nSuggestions:\n1) send SOL\n2) buy token\n3) sell token\n4) check balances\n\nYou can ask me anything. Try:\n"hey can you set a cron job to check on my current token positions and sell if they go below $100"\n\nCommands:\n  create\n  import --in <PRIVATE_KEY_FILE>\n  balance <PUBKEY>\n  contacts add <NAME> <PUBKEY>\n  contacts list\n  contacts remove <NAME>\n  tokens --keyfile <WALLET_JSON>\n  buy --keyfile <WALLET_JSON> --mint <MINT> --sol <AMOUNT> [--slippageBps <BPS>]\n  sell --keyfile <WALLET_JSON> --mint <MINT> --amount <AMOUNT> [--slippageBps <BPS>]\n  send --keyfile <WALLET_JSON> --mint <MINT> --to <PUBKEY> --amount <AMOUNT> [--decimals <N>]\n  solsend --keyfile <WALLET_JSON> --to <PUBKEY> --sol <AMOUNT>\n  check\n  checkversion\n`);
    return;
  }

  const getFlag = (name) => {
    const idx = args.indexOf(`--${name}`);
    if (idx === -1) return null;
    return args[idx + 1] ?? null;
  };

  const getPrivateKeyFromFile = (filePath) => {
    const fs = require('fs');
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (!data.privateKey) throw new Error('wallet file missing privateKey');
    return data.privateKey;
  };

  const ensureWalletDir = () => {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), 'moltwallet', 'wallets');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  };
  const getContactsPath = () => {
    const path = require('path');
    const dir = ensureWalletDir();
    return path.join(dir, 'contacts.json');
  };

  const loadContacts = () => {
    const fs = require('fs');
    const p = getContactsPath();
    if (!fs.existsSync(p)) return {};
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
    } catch {
      return {};
    }
  };

  const saveContacts = (obj) => {
    const fs = require('fs');
    const p = getContactsPath();
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
    try { fs.chmodSync(p, 0o600); } catch {}
  };


  if (cmd === 'create') {
    const w = createWallet();
    const payload = JSON.stringify(w, null, 2);
    const fs = require('fs');
    const path = require('path');
    const dir = ensureWalletDir();
    const out = path.join(dir, `${w.publicKey}.json`);
    if (fs.existsSync(out)) {
      throw new Error(`Refusing to overwrite existing file: ${out}`);
    }
    fs.writeFileSync(out, payload, 'utf8');
    try { fs.chmodSync(out, 0o600); } catch {}
    console.log(`Wallet saved to ${out} (permissions set to owner-only)`);
    console.log(`Public key: ${w.publicKey}`);

    // warn if gitignore doesn't protect /moltwallet
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    try {
      if (!fs.existsSync(gitignorePath)) {
        console.warn('Warning: .gitignore not found. Add /moltwallet to avoid committing keys.');
      } else {
        const gi = fs.readFileSync(gitignorePath, 'utf8');
        if (!gi.includes('/moltwallet')) {
          console.warn('Warning: .gitignore missing /moltwallet. Add it to avoid committing keys.');
        }
      }
    } catch {}
    return;
  }

  if (cmd === 'import') {
    const infile = getFlag('in');
    if (!infile) throw new Error('Usage: import --in <PRIVATE_KEY_FILE>');
    const fs = require('fs');
    if (!fs.existsSync(infile)) throw new Error('Private key file not found');
    const pk = fs.readFileSync(infile, 'utf8').trim();
    const kp = keypairFromPrivateKey(pk);
    const w = { publicKey: kp.publicKey.toBase58(), privateKey: pk };
    const payload = JSON.stringify(w, null, 2);
    const path = require('path');
    const dir = ensureWalletDir();
    const out = path.join(dir, `${w.publicKey}.json`);
    if (fs.existsSync(out)) throw new Error(`Refusing to overwrite existing file: ${out}`);
    fs.writeFileSync(out, payload, 'utf8');
    try { fs.chmodSync(out, 0o600); } catch {}
    console.log(`Wallet imported to ${out} (permissions set to owner-only)`);
    console.log(`Public key: ${w.publicKey}`);
    return;
  }

  if (cmd === 'contacts') {
    const sub = args[1];
    const contacts = loadContacts();
    if (sub === 'add') {
      const name = args[2];
      const pubkey = args[3];
      if (!name || !pubkey) throw new Error('Usage: contacts add <NAME> <PUBKEY>');
      contacts[name] = pubkey;
      saveContacts(contacts);
      console.log(JSON.stringify({ ok: true, name, pubkey }, null, 2));
      return;
    }
    if (sub === 'remove') {
      const name = args[2];
      if (!name) throw new Error('Usage: contacts remove <NAME>');
      delete contacts[name];
      saveContacts(contacts);
      console.log(JSON.stringify({ ok: true, removed: name }, null, 2));
      return;
    }
    if (sub === 'list') {
      console.log(JSON.stringify({ contacts }, null, 2));
      return;
    }
    throw new Error('Usage: contacts add <NAME> <PUBKEY> | contacts list | contacts remove <NAME>');
  }

  if (cmd === 'balance') {
    const pubkey = args[1];
    if (!pubkey) throw new Error('Usage: balance <PUBKEY>');
    const bal = await getWalletBalance(pubkey);
    console.log(JSON.stringify({ publicKey: pubkey, sol: bal }, null, 2));
    return;
  }

  if (cmd === 'tokens') {
    const keyfile = getFlag('keyfile');
    if (!keyfile) throw new Error('Usage: tokens --keyfile <WALLET_JSON>');
    const privateKey = getPrivateKeyFromFile(keyfile);
    const owner = keypairFromPrivateKey(privateKey).publicKey;

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    });

    const balances = tokenAccounts.value
      .map((ta) => {
        const info = ta.account.data.parsed.info;
        const amount = Number(info.tokenAmount.uiAmount || 0);
        const decimals = info.tokenAmount.decimals;
        return {
          mint: info.mint,
          amount,
          decimals,
        };
      })
      .filter((t) => t.amount > 0);

    // Fetch USD prices from Dexscreener (best-effort)
    let prices = {};
    try {
      if (balances.length) {
        const mints = balances.map((b) => b.mint).join(',');
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints}`);
        const data = await res.json();
        for (const pair of data.pairs || []) {
          if (pair?.baseToken?.address && pair?.priceUsd) {
            prices[pair.baseToken.address] = Number(pair.priceUsd);
          }
        }
      }
    } catch {}

    const out = balances.map((b) => ({
      ...b,
      priceUsd: prices[b.mint] ?? null,
      valueUsd: prices[b.mint] ? b.amount * prices[b.mint] : null,
    }));

    console.log(JSON.stringify({ owner: owner.toBase58(), tokens: out }, null, 2));
    return;
  }

  if (cmd === 'buy') {
    const keyfile = getFlag('keyfile');
    const mint = getFlag('mint');
    const sol = Number(getFlag('sol'));
    const slippageBps = getFlag('slippageBps') ? Number(getFlag('slippageBps')) : undefined;
    if (!keyfile || !mint || !Number.isFinite(sol)) {
      throw new Error('Usage: buy --keyfile <WALLET_JSON> --mint <MINT> --sol <AMOUNT> [--slippageBps <BPS>]');
    }
    const privateKey = getPrivateKeyFromFile(keyfile);
    const res = await buyToken({ privateKey, mint, sol, slippageBps });
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd === 'sell') {
    const keyfile = getFlag('keyfile');
    const mint = getFlag('mint');
    const amount = Number(getFlag('amount'));
    const slippageBps = getFlag('slippageBps') ? Number(getFlag('slippageBps')) : undefined;
    if (!keyfile || !mint || !Number.isFinite(amount)) {
      throw new Error('Usage: sell --keyfile <WALLET_JSON> --mint <MINT> --amount <AMOUNT> [--slippageBps <BPS>]');
    }
    const privateKey = getPrivateKeyFromFile(keyfile);
    const res = await sellToken({ privateKey, mint, amount, slippageBps });
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd === 'send') {
    const keyfile = getFlag('keyfile');
    const mint = getFlag('mint');
    const to = getFlag('to');
    const amount = Number(getFlag('amount'));
    const decimals = getFlag('decimals') ? Number(getFlag('decimals')) : null;
    if (!keyfile || !mint || !to || !Number.isFinite(amount)) {
      throw new Error('Usage: send --keyfile <WALLET_JSON> --mint <MINT> --to <PUBKEY> --amount <AMOUNT> [--decimals <N>]');
    }
    const privateKey = getPrivateKeyFromFile(keyfile);
    const res = await sendToken({ privateKey, mint, to, amount, decimals });
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd === 'solsend') {
    const keyfile = getFlag('keyfile');
    const to = getFlag('to');
    const sol = Number(getFlag('sol'));
    if (!keyfile || !to || !Number.isFinite(sol)) {
      throw new Error('Usage: solsend --keyfile <WALLET_JSON> --to <PUBKEY> --sol <AMOUNT>');
    }
    const privateKey = getPrivateKeyFromFile(keyfile);
    const sender = keypairFromPrivateKey(privateKey);
    const toPk = new PublicKey(to);
    const lamports = Math.floor(sol * LAMPORTS_PER_SOL);
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: sender.publicKey, toPubkey: toPk, lamports })
    );
    const sig = await sendTx(tx, [sender]);
    console.log(JSON.stringify({ signature: sig, lamports }, null, 2));
    return;
  }

  const VERSION = 'v1.3';

  if (cmd === 'check') {
    await connection.getLatestBlockhash('confirmed');
    console.log(JSON.stringify({ ok: true, rpc: RPC_URL, version: VERSION }, null, 2));
    return;
  }

  if (cmd === 'checkversion') {
    console.log(JSON.stringify({ version: VERSION }, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = {
  connection,
  keypairFromPrivateKey,
  tokenProgramForMint,
  sendTx,
  buyToken,
  createWallet,
  getWalletBalance,
  preflightCheck,
  sendToken,
  sellToken,
};
